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
import { basculerEtoile, emplacementsDuJour, placerDansTrois, retirerDesTrois } from "../lib/db/trois.ts";
import { lireJours, ordreManuel, prevueLe } from "../lib/regles-taches.ts";
import { composerTrois, estPropose, idVide } from "../lib/trois-regles.ts";

// ─── Règles pures ───

test("composition : mes choix prennent leur place, le reste est proposé (prévues, veille, moteur)", () => {
  const base = { stockes: [], dus: [], veille: [], ordre: [5, 6, 7, 8, 9] };
  const ids = (l) => l.map((x) => x.itemId);
  // Rien de choisi : le moteur.
  assert.deepEqual(ids(composerTrois(base)), [5, 6, 7]);
  // Veille non faite d'abord (4 est faite : elle ne revient pas), puis le moteur.
  assert.deepEqual(composerTrois({ ...base, veille: [8, 4, 9] }).map((e) => [e.itemId, e.source]), [[8, "report"], [9, "report"], [5, "moteur"]]);
  // Tâche prévue ce jour-là : devant la veille et le moteur.
  assert.deepEqual(ids(composerTrois({ ...base, dus: [7], veille: [8] })), [7, 8, 5]);
  // Mon choix garde son rang, le reste complète sans doublon.
  const e = composerTrois({ ...base, stockes: [{ rang: 1, itemId: 9, source: "choisi" }] });
  assert.deepEqual(ids(e), [5, 9, 6]);
  assert.equal(estPropose(e[0]), true);
  assert.equal(estPropose(e[1]), false);
  // Tâche choisie qui est faite : son emplacement reste libre, sans remplacement.
  assert.deepEqual(ids(composerTrois({ ...base, stockes: [{ rang: 0, itemId: 4, source: "choisi" }] })), [null, 5, 6]);
  // Emplacement vidé : il ne se remplit pas tout seul.
  assert.deepEqual(ids(composerTrois({ ...base, stockes: [{ rang: 0, itemId: idVide(0), source: "vide" }] })), [null, 5, 6]);
  // Peu de tâches : emplacements libres.
  assert.deepEqual(ids(composerTrois({ ...base, ordre: [5] })), [5, null, null]);
});

test("tâche régulière : due les bons jours (lundi → dimanche, changement d'année)", () => {
  assert.deepEqual(lireJours("5,1,1,9,x,3"), [1, 3, 5]);
  assert.deepEqual(lireJours(null), []);
  const lun_mer_ven = lireJours("1,3,5");
  // 2026-10-19 est un lundi
  const attendu = [true, false, true, false, true, false, false];
  for (let i = 0; i < 7; i++) assert.equal(prevueLe(lun_mer_ven, `2026-10-${19 + i}`), attendu[i], `jour ${i}`);
  // Dimanche (0) autour du nouvel an : 2026-12-27 et 2027-01-03
  assert.equal(prevueLe([0], "2026-12-27"), true);
  assert.equal(prevueLe([0], "2027-01-03"), true);
  assert.equal(prevueLe([0], "2027-01-01"), false);
  assert.equal(prevueLe([], "2026-10-19"), false);
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

test("Mes 3 : proposition figée, choix, remplacement, retrait, étoile, report, tâche faite", async () => {
  await addItem({ nom: "A", type: "tache", importance: 3 });
  await addItem({ nom: "B", type: "tache", importance: 2 });
  const c = await addItem({ nom: "C", type: "tache", importance: 1 });
  const d = await addItem({ nom: "D", type: "tache", importance: 1 });
  const e = await addItem({ nom: "E", type: "tache", importance: 1 });
  const nom = (cl, id) => cl.find((p) => p.itemId === id)?.nom ?? null;
  const noms = async (j, cl, figer = false) => (await emplacementsDuJour(j, cl, figer)).map((x) => (x.itemId ? nom(cl, x.itemId) : null));

  // Hier : je choisis C, D et E (emplacements 0, 1, 2) ; E est faite, C et D non.
  let classement = await genererPropositions();
  await placerDansTrois(HIER, 0, c);
  await placerDansTrois(HIER, 1, d);
  await placerDansTrois(HIER, 2, e);
  assert.deepEqual(await noms(HIER, classement), ["C", "D", "E"]);
  await completer(e, "complet");
  classement = await genererPropositions();

  // Aujourd'hui, rien de choisi : C et D reviennent d'abord (report), puis le moteur ; figé à l'ouverture.
  const auj = await emplacementsDuJour(AUJ, classement, true);
  assert.deepEqual(auj.slice(0, 2).map((x) => [nom(classement, x.itemId), x.source]), [["C", "report"], ["D", "report"]]);
  assert.ok(["A", "B"].includes(nom(classement, auj[2].itemId)));
  assert.ok(auj.every((x) => x.stocke));
  const figee = await noms(AUJ, classement);

  // Mon choix : remplacer l'emplacement 2 par B ; c'est un choix, plus une proposition.
  const b = classement.find((p) => p.nom === "B").itemId;
  await placerDansTrois(AUJ, 2, b);
  assert.equal((await emplacementsDuJour(AUJ, classement, false))[2].source, "choisi");
  assert.equal((await noms(AUJ, classement))[2], "B");

  // Déplacer une tâche déjà dans les 3 vers un autre emplacement libère l'ancien.
  await placerDansTrois(AUJ, 0, b);
  assert.deepEqual(await noms(AUJ, classement), ["B", "D", null]);
  await placerDansTrois(AUJ, 2, c);
  assert.deepEqual(await noms(AUJ, classement), ["B", "D", "C"]);

  // Retirer : l'emplacement reste libre, la proposition ne revient pas.
  await retirerDesTrois(AUJ, 1);
  assert.deepEqual(await noms(AUJ, classement, true), ["B", null, "C"]);

  // Étoile : sur une tâche des 3, elle la retire ; sur une autre, elle va dans le premier emplacement libre ; si tout est pris, false.
  const empl = () => emplacementsDuJour(AUJ, classement, false);
  assert.equal(await basculerEtoile(AUJ, await empl(), d), true);
  assert.deepEqual(await noms(AUJ, classement), ["B", "D", "C"]);
  assert.equal(await basculerEtoile(AUJ, await empl(), classement.find((p) => p.nom === "A").itemId), false);
  assert.equal(await basculerEtoile(AUJ, await empl(), c), true);
  assert.deepEqual(await noms(AUJ, classement), ["B", "D", null]);

  // Tâche faite : elle disparaît, sans remplacement automatique.
  await completer(d, "complet");
  classement = await genererPropositions();
  assert.deepEqual(await noms(AUJ, classement), ["B", null, null]);

  // Demain, rien de choisi, sans rien enregistrer : proposé en direct (B de ce soir en tête : elle reste à faire).
  const demain = decalerJours(AUJ, 1);
  const dem = await emplacementsDuJour(demain, classement, false);
  assert.equal(nom(classement, dem[0].itemId), "B");
  assert.equal(dem[0].source, "report");
  assert.ok(dem.every((x) => !x.stocke));
  assert.equal((await (await getDatabase()).getFirstAsync("SELECT COUNT(*) AS n FROM trois WHERE jour = ?", demain)).n, 0);
  void figee;
});

test("tâche régulière aux jours choisis : proposée en priorité ces jours-là", async () => {
  const jour = new Date(AUJ + "T00:00:00Z").getUTCDay();
  const id = await addItem({ nom: "Courir", type: "tache", importance: 1, recurrence: "semaine:2", jours: String(jour) });
  const autre = await addItem({ nom: "Ranger", type: "tache", importance: 3, recurrence: "semaine:2", jours: String((jour + 3) % 7) });
  const classement = await genererPropositions();
  const p = classement.find((x) => x.itemId === id);
  assert.deepEqual(p.jours, [jour]);
  assert.equal(p.raison, "Prévue aujourd'hui");
  assert.notEqual(classement.find((x) => x.itemId === autre).raison, "Prévue aujourd'hui");
  assert.equal(classement.filter((x) => x.raison === "Prévue aujourd'hui").length >= 1, true);
  // Elle ouvre les 3 d'un jour sans choix (avant les tâches plus importantes).
  const j = await emplacementsDuJour(decalerJours(AUJ, 7), classement, false);
  assert.equal(j[0].itemId, id);
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
