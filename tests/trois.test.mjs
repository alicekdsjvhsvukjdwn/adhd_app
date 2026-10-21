// Lancer : npm test
// « Mes 3 » (règles pures et base en mémoire), retour à hier et points, rendez-vous du jour.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chargeDuJour, joursAvecRdv, rdvDuJour } from "../lib/agenda-regles.ts";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { annulerCompletion, completer, getAujourdhui, getRoutinesAvecStatutDuJour } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { basculerEtapeRoutine, enregistrerEtapes, getEtapesRoutines } from "../lib/db/etapes.ts";
import { addItem, placerTache } from "../lib/db/items.ts";
import { genererPropositions } from "../lib/db/moteur.ts";
import { getStats } from "../lib/db/stats.ts";
import {
  ajouterUneAutre,
  choisirPourJour,
  ecrirePrefsTrois,
  lesTroisDuJour,
  lirePrefsTrois,
} from "../lib/db/trois.ts";
import { ordreManuel } from "../lib/regles-taches.ts";
import { POIDS } from "../lib/moteur-regles.ts";
import { bonusCharge, composerTrois, ordreTrois, PREFS_DEFAUT, poidsTrois, prefsValides } from "../lib/trois-regles.ts";

const C = (o = {}) => ({ urgence: 0, importance: 0.5, moment: 0.5, equilibre: 0.5, etat: 0.5, negligence: 0, ...o });

// ─── Règles pures ───

test("composition : choix de la veille, report des non faites, moteur pour compléter", () => {
  const base = { nombre: 3, ordre: [5, 6, 7, 8, 9], veille: [], choisis: [] };
  // Rien choisi, rien de la veille : le moteur.
  assert.deepEqual(composerTrois({ ...base, mode: "melange" }).map((x) => x.itemId), [5, 6, 7]);
  // Rien choisi : d'abord les non faites de la veille (4, faite, ne revient pas), puis le moteur.
  assert.deepEqual(composerTrois({ ...base, mode: "melange", veille: [8, 4, 9] }), [
    { itemId: 8, source: "report" },
    { itemId: 9, source: "report" },
    { itemId: 5, source: "moteur" },
  ]);
  // « Je choisis » : seulement ce que j'ai choisi, une tâche faite en moins, sans remplacement.
  assert.deepEqual(composerTrois({ ...base, mode: "choisis", choisis: [9, 4, 6] }).map((x) => x.itemId), [9, 6]);
  // « Mélange » : mes choix, puis le moteur complète.
  assert.deepEqual(composerTrois({ ...base, mode: "melange", choisis: [9] }).map((x) => x.itemId), [9, 5, 6]);
  // « L'appli choisit » : le moteur seul, mes choix ignorés ; le nombre est respecté.
  assert.deepEqual(composerTrois({ ...base, mode: "appli", nombre: 2, choisis: [9], veille: [8] }).map((x) => x.itemId), [5, 6]);
});

test("préférences : valeurs hors limites remplacées par les défauts", () => {
  assert.deepEqual(prefsValides(null), PREFS_DEFAUT);
  const p = prefsValides({ mode: "x", nombre: 9, curseurs: { echeance: 2, priorite: 7 } });
  assert.equal(p.mode, "melange");
  assert.equal(p.nombre, 3);
  assert.deepEqual(p.curseurs, { echeance: 2, priorite: 1, varier: 1 });
  assert.equal(prefsValides({ nombre: 5 }).nombre, 5);
});

test("curseurs : poids remis à 1, échéance et priorité déplacées", () => {
  const n = poidsTrois({ echeance: 1, priorite: 1, varier: 1 });
  for (const k of Object.keys(POIDS)) assert.ok(Math.abs(n[k] - POIDS[k]) < 1e-9);
  const fort = poidsTrois({ echeance: 2, priorite: 0, varier: 1 });
  assert.ok(Math.abs(Object.values(fort).reduce((s, x) => s + x, 0) - 1) < 1e-9);
  assert.ok(fort.urgence > POIDS.urgence && fort.importance < POIDS.importance);
});

test("ordre : listes exclues ce jour-là, échéance qui monte avec le curseur, variété des listes", () => {
  const travail = { itemId: 1, liste_id: 10, duree_min: 30, composantes: C({ urgence: 1 }) };
  const maison = { itemId: 2, liste_id: 20, duree_min: 30, composantes: C({ importance: 1 }) };
  const maison2 = { itemId: 3, liste_id: 20, duree_min: 30, composantes: C({ importance: 0.95 }) };
  const perso = { itemId: 4, liste_id: 30, duree_min: 30, composantes: C({ importance: 0.75 }) };
  const ids = (l) => l.map((x) => x.itemId);
  const prefs = (extra = {}) => ({ ...PREFS_DEFAUT, ...extra });

  // Samedi (6) : pas de Travail ; un lundi (1), oui.
  assert.deepEqual(ids(ordreTrois([travail, maison], prefs({ exclusions: { 10: [0, 6] } }), 6, 0)), [2]);
  assert.deepEqual(ids(ordreTrois([travail, maison], prefs({ exclusions: { 10: [0, 6] } }), 1, 0)).sort(), [1, 2]);
  // Échéance : de « moins » à « plus », l'échéance passe devant.
  const echeance = (n) => ids(ordreTrois([travail, maison], prefs({ curseurs: { echeance: n, priorite: 1, varier: 1 } }), 1, 0))[0];
  assert.equal(echeance(0), 2);
  assert.equal(echeance(2), 1);
  // Varier : sans, deux tâches de la même liste se suivent ; avec, une autre liste s'intercale.
  const varier = (n) => ids(ordreTrois([maison, maison2, perso], prefs({ curseurs: { echeance: 1, priorite: 1, varier: n } }), 1, 0));
  assert.deepEqual(varier(0), [2, 3, 4]);
  assert.deepEqual(varier(2), [2, 4, 3]);
});

test("journée chargée en rendez-vous : tâches courtes favorisées", () => {
  assert.equal(bonusCharge(10, 60), 0);
  assert.ok(bonusCharge(10, 300) > bonusCharge(10, 150) && bonusCharge(10, 150) > 0);
  assert.ok(bonusCharge(90, 300) < 0);
  assert.equal(bonusCharge(null, 300), 0);
  const longue = { itemId: 1, liste_id: null, duree_min: 90, composantes: C({ importance: 1 }) };
  const courte = { itemId: 2, liste_id: null, duree_min: 10, composantes: C({ importance: 0.8 }) };
  assert.equal(ordreTrois([longue, courte], PREFS_DEFAUT, 1, 0)[0].itemId, 1);
  assert.equal(ordreTrois([longue, courte], PREFS_DEFAUT, 1, 300)[0].itemId, 2);
});

test("rendez-vous : du jour, charge (journées entières exclues), jours marqués", () => {
  const ev = (jour, debut, duree_min, journee = false) => ({ id: jour + debut, titre: "x", jour, debut, fin: null, journee, duree_min });
  const l = [ev("2026-10-22", "14:00", 60), ev("2026-10-22", "09:00", 90), ev("2026-10-22", null, 0, true), ev("2026-10-23", "10:00", 30)];
  assert.deepEqual(rdvDuJour(l, "2026-10-22").map((e) => e.debut), [null, "09:00", "14:00"]);
  assert.equal(chargeDuJour(l, "2026-10-22"), 150);
  assert.deepEqual([...joursAvecRdv(l)], ["2026-10-22", "2026-10-23"]);
});

// ─── Base en mémoire ───

await initialiserBase();
const AUJ = getAujourdhui();
const HIER = decalerJours(AUJ, -1);

test("revenir à hier : cocher donne les points, décocher les reprend, la série suit", async () => {
  const id = await addItem({ nom: "Boire de l'eau", type: "routine" });
  // Une routine n'est pas attendue avant sa création : on la fait remonter à il y a 5 jours.
  await (await getDatabase()).runAsync("UPDATE items SET cree_le = ? WHERE id = ?", decalerJours(AUJ, -5) + "T08:00:00.000Z", id);
  const avant = (await getStats()).points;
  await completer(id, "complet", undefined, "normale", undefined, HIER);
  assert.equal((await getStats()).points, avant + 10);
  assert.equal((await getRoutinesAvecStatutDuJour(HIER)).find((r) => r.id === id).faitAujourdhui, true);
  assert.equal((await getRoutinesAvecStatutDuJour()).find((r) => r.id === id).faitAujourdhui, false);
  assert.ok((await getStats()).currentStreak >= 1); // hier compte : la série court depuis hier
  await annulerCompletion(id, HIER);
  assert.equal((await getStats()).points, avant);
  assert.equal((await getRoutinesAvecStatutDuJour(HIER)).find((r) => r.id === id).faitAujourdhui, false);
});

test("revenir à hier : étapes d'une routine cochées pour hier, pas pour aujourd'hui", async () => {
  const id = await addItem({ nom: "Matin", type: "routine" });
  await enregistrerEtapes(id, [
    { nom: "Lit", essentielle: true },
    { nom: "Douche", essentielle: true },
  ]);
  const [e1, e2] = (await getEtapesRoutines([id], HIER))[id];
  const avant = (await getStats()).points;
  await basculerEtapeRoutine(e1.id, HIER);
  await basculerEtapeRoutine(e2.id, HIER);
  assert.equal((await getEtapesRoutines([id], HIER))[id].every((e) => e.cochee), true);
  assert.equal((await getEtapesRoutines([id]))[id].some((e) => e.cochee), false);
  assert.ok((await getStats()).points > avant);
  await basculerEtapeRoutine(e1.id, HIER);
  await basculerEtapeRoutine(e2.id, HIER);
  assert.equal((await getStats()).points, avant);
});

test("préférences enregistrées et relues", async () => {
  assert.deepEqual(await lirePrefsTrois(), PREFS_DEFAUT);
  await ecrirePrefsTrois({ ...PREFS_DEFAUT, nombre: 4, mode: "choisis", exclusions: { 1: [0, 6] } });
  const p = await lirePrefsTrois();
  assert.equal(p.nombre, 4);
  assert.equal(p.mode, "choisis");
  assert.deepEqual(p.exclusions, { 1: [0, 6] });
  await ecrirePrefsTrois(PREFS_DEFAUT);
});

test("choix pour demain, report des non faites, tâche faite qui disparaît, « Une autre »", async () => {
  await addItem({ nom: "A", type: "tache", importance: 3 });
  await addItem({ nom: "B", type: "tache", importance: 2 });
  const c = await addItem({ nom: "C", type: "tache", importance: 1 });
  const d = await addItem({ nom: "D", type: "tache", importance: 1 });
  const e = await addItem({ nom: "E", type: "tache", importance: 1 });
  const prefs = { ...PREFS_DEFAUT, nombre: 3, mode: "choisis" };

  // Hier : j'avais choisi C, D et E ; elles sont composées une fois, E est faite, C et D non.
  await choisirPourJour(HIER, [c, d, e]);
  let classement = await genererPropositions();
  const hier = await lesTroisDuJour(HIER, classement, prefs, 0);
  assert.deepEqual(hier.map((p) => p.nom), ["C", "D", "E"]);
  await completer(e, "complet");
  classement = await genererPropositions();

  // Aujourd'hui, rien de choisi : C et D reviennent d'abord (E est faite), puis le moteur complète.
  const jour = await lesTroisDuJour(AUJ, classement, prefs, 0);
  assert.deepEqual(jour.map((p) => p.nom).slice(0, 2), ["C", "D"]);
  assert.equal(jour.length, 3);
  assert.ok(["A", "B"].includes(jour[2].nom));

  // Faite : elle disparaît, sans remplacement automatique.
  await completer(c, "complet");
  classement = await genererPropositions();
  const apres = await lesTroisDuJour(AUJ, classement, prefs, 0);
  assert.deepEqual(apres.map((p) => p.nom), jour.map((p) => p.nom).filter((n) => n !== "C"));
  // « Une autre ? » en ajoute une.
  assert.equal(await ajouterUneAutre(AUJ, classement, prefs, 0), true);
  assert.equal((await lesTroisDuJour(AUJ, classement, prefs, 0)).length, apres.length + 1);

  // decision_log garde les poids utilisés.
  const db = await getDatabase();
  const ligne = await db.getFirstAsync("SELECT composantes, raison FROM decision_log WHERE raison LIKE 'Mes 3%' ORDER BY id DESC LIMIT 1");
  assert.match(ligne.raison, /^Mes 3 \(/);
  assert.ok(JSON.parse(ligne.composantes).poids_trois.urgence > 0);
});

// ─── Place choisie à la main ───

test("ordre manuel : en haut, ordre de l'appli, en bas — sans toucher la liste d'origine", () => {
  const l = [
    { id: "a", rang_manuel: null },
    { id: "b", rang_manuel: 1 },
    { id: "c", rang_manuel: -1 },
    { id: "d", rang_manuel: null },
    { id: "e", rang_manuel: -2 },
    { id: "f", rang_manuel: 2 },
  ];
  assert.deepEqual(ordreManuel(l).map((x) => x.id), ["e", "c", "a", "d", "b", "f"]);
  assert.equal(l[0].id, "a");
});

test("placer une tâche : en haut passe devant les autres, en bas derrière, retour à l'ordre de l'appli", async () => {
  const liste = (await (await getDatabase()).getFirstAsync("SELECT id FROM listes ORDER BY ordre, id LIMIT 1")).id;
  const ids = [];
  for (const nom of ["P", "Q", "R"]) ids.push(await addItem({ nom, type: "tache", liste_id: liste }));
  const rang = async (id) => (await (await getDatabase()).getFirstAsync("SELECT rang_manuel AS r FROM items WHERE id = ?", id)).r;
  await placerTache(ids[0], "haut");
  await placerTache(ids[1], "haut"); // passe devant P
  await placerTache(ids[2], "bas");
  assert.ok((await rang(ids[1])) < (await rang(ids[0])) && (await rang(ids[0])) < 0);
  assert.ok((await rang(ids[2])) > 0);
  await placerTache(ids[0], "bas"); // maintenant derrière R
  assert.ok((await rang(ids[0])) > (await rang(ids[2])));
  await placerTache(ids[0], null);
  assert.equal(await rang(ids[0]), null);
});
