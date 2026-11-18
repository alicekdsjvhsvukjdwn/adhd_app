// Lancer : npm test
// « Ma journée » : le bonhomme, la saisie, les détails facultatifs, les 7 jours modifiables, les zones, la migration.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { addItem, getItem } from "../lib/db/items.ts";
import { getListes } from "../lib/db/listes.ts";
import { getStats } from "../lib/db/stats.ts";
import { REGLES_POINTS } from "../lib/db/recompenses.ts";
import {
  ajouterEntree,
  cocherTache,
  decocherTache,
  definirZoneListe,
  entreesDu,
  getEntree,
  getZones,
  lierTache,
  modifierEntree,
  modifierZone,
  noterEntree,
  restaurerEntree,
  supprimerEntree,
  tachesAFaire,
  textesPasses,
} from "../lib/db/journee.ts";
import { runMigrations } from "../lib/db/migrations.ts";
import { melanger } from "../lib/theme.ts";
import { placerDansTrois } from "../lib/db/trois.ts";
import {
  chaleur,
  compterParZone,
  contourZone,
  couleurChaleur,
  couleurZone,
  FOND_ZONE,
  GRIS_ZONE,
  intensite,
  modifiable,
  momentDeHeureJournee,
  nettoyerDetails,
  origineSaisie,
  pointsEntree,
  statsJournee,
  suggestions,
  tacheCorrespondante,
  validerSaisie,
  zoneDeListe,
  zoneDeTache,
  ZONES_DEFAUT,
} from "../lib/journee-regles.ts";

// ─── Règles pures ───

test("saisie : zone obligatoire, texte vide refusé, message clair", () => {
  assert.match(validerSaisie(null, "Meal prep"), /zone/);
  assert.match(validerSaisie("mains", "   "), /Écris/);
  assert.equal(validerSaisie("mains", "Meal prep"), null);
});

test("couleur : toujours la sienne, atténuée (18 %) sans entrée, de plus en plus vive à 1, 2, 3+ entrées", () => {
  const c = "#FB923C";
  const n0 = couleurZone(c, 0);
  assert.notEqual(n0, GRIS_ZONE);
  assert.equal(n0, melanger(FOND_ZONE, c, 0.18));
  assert.equal(contourZone(c), melanger(FOND_ZONE, c, 0.5));
  const n1 = couleurZone(c, 1);
  const n2 = couleurZone(c, 2);
  assert.notEqual(n1, n2);
  assert.equal(couleurZone(c, 3).toUpperCase(), c);
  assert.equal(couleurZone(c, 12), couleurZone(c, 3));
  assert.deepEqual([0, 1, 2, 3, 9].map(intensite), [0, 1, 2, 3, 3]);
  // Plus vive = plus loin du fond : la distance croît avec le nombre d'entrées.
  const dist = (h) => Math.abs(parseInt(h.slice(1, 3), 16) - parseInt(FOND_ZONE.slice(1, 3), 16));
  assert.ok(dist(n0) < dist(n1) && dist(n1) < dist(n2) && dist(n2) < dist(c));
  // Carte de chaleur : normalisée sur la zone la plus remplie, vide = 18 %.
  assert.equal(couleurChaleur(c, 6, 6).toUpperCase(), c);
  assert.equal(couleurChaleur(c, 0, 6), n0);
  assert.ok(dist(couleurChaleur(c, 2, 6)) < dist(couleurChaleur(c, 4, 6)));
});

test("jours modifiables : 7 jours en arrière, puis lecture seule ; pas les jours à venir", () => {
  const a = "2026-11-17";
  assert.equal(modifiable(a, a), true);
  assert.equal(modifiable("2026-11-10", a), true);
  assert.equal(modifiable("2026-11-09", a), false);
  assert.equal(modifiable("2026-11-18", a), false);
  // Changement de mois et d'année.
  assert.equal(modifiable("2026-12-27", "2027-01-03"), true);
  assert.equal(modifiable("2026-12-26", "2027-01-03"), false);
});

test("moment par défaut d'après l'heure, origine 'recopie' quand on note après coup", () => {
  assert.deepEqual([7, 12, 15, 19, 2].map(momentDeHeureJournee), ["matin", "midi", "apres_midi", "soir", "soir"]);
  assert.equal(origineSaisie("2026-11-17", "apres_midi", "2026-11-17", 15), "saisie");
  assert.equal(origineSaisie("2026-11-17", "matin", "2026-11-17", 20), "recopie");
  assert.equal(origineSaisie("2026-11-16", "soir", "2026-11-17", 8), "recopie");
});

test("détails facultatifs : null efface, valeurs hors bornes ignorées", () => {
  assert.deepEqual(nettoyerDetails({ duree_min: 30, ressenti: 4 }), { duree_min: 30, ressenti: 4 });
  assert.deepEqual(nettoyerDetails({ duree_min: null, ressenti: null }), { duree_min: null, ressenti: null });
  assert.deepEqual(nettoyerDetails({ duree_min: 0, ressenti: 7 }), { duree_min: null, ressenti: null });
  assert.deepEqual(nettoyerDetails({}), { duree_min: null, ressenti: null });
});

test("suggestions : même zone d'abord, puis les plus fréquentes, sans accents ni doublons", () => {
  const passees = [
    { texte: "Ménage salle de bain", zone: "mains", n: 1 },
    { texte: "Menage cuisine", zone: "mains", n: 5 },
    { texte: "Méditation", zone: "ventre", n: 9 },
    { texte: "menage cuisine", zone: "ventre", n: 2 },
  ];
  assert.deepEqual(suggestions("men", "mains", passees), ["Menage cuisine", "Ménage salle de bain"]);
  assert.deepEqual(suggestions("me", "ventre", passees), ["Méditation", "menage cuisine", "Ménage salle de bain"]);
  assert.deepEqual(suggestions("m", "mains", passees), []);
  // Texte déjà complet : rien à proposer de plus.
  assert.deepEqual(suggestions("Méditation", "ventre", passees), []);
});

// ─── Base en mémoire ───

test("zones : 7 par défaut ; renommer, recolorer, désactiver ; recrées si la table est vidée", async () => {
  await initialiserBase();
  const db = await getDatabase();
  let z = await getZones();
  assert.deepEqual(z.map((x) => x.cle), ZONES_DEFAUT.map((x) => x.cle));
  await modifierZone("pieds", { libelle: "  Musique  ", couleur: "#F472B6", active: 0 });
  await modifierZone("tete", { libelle: "   " }); // libellé vide : ignoré
  z = await getZones();
  const pieds = z.find((x) => x.cle === "pieds");
  assert.deepEqual([pieds.libelle, pieds.couleur, pieds.active], ["Musique", "#F472B6", 0]);
  assert.equal(z.find((x) => x.cle === "tete").libelle, ZONES_DEFAUT[0].libelle);
  // Les réglages restent, rien n'est réécrit par-dessus.
  assert.equal((await getZones()).find((x) => x.cle === "pieds").libelle, "Musique");
  await modifierZone("pieds", { libelle: ZONES_DEFAUT[6].libelle, couleur: ZONES_DEFAUT[6].couleur, active: 1 });
  await db.runAsync("DELETE FROM zones");
  assert.equal((await getZones()).length, 7);
});

test("journal : saisir, détails facultatifs, modifier, changer de zone, supprimer puis annuler", async () => {
  await initialiserBase();
  const jour = getAujourdhui();
  const id = await ajouterEntree({ jour, moment: "matin", zone: "mains", texte: "  Meal prep  " });
  let e = await getEntree(id);
  assert.equal(e.texte, "Meal prep");
  assert.equal(e.duree_min, null);
  assert.equal(e.ressenti, null);
  assert.equal(e.tache_id, null);
  assert.ok(["saisie", "recopie"].includes(e.origine));

  await modifierEntree(id, { duree_min: 30 });
  await modifierEntree(id, { ressenti: 4 });
  e = await getEntree(id);
  assert.deepEqual([e.duree_min, e.ressenti], [30, 4]);
  await modifierEntree(id, { duree_min: null });
  e = await getEntree(id);
  assert.deepEqual([e.duree_min, e.ressenti], [null, 4]);

  await modifierEntree(id, { zone: "ventre", texte: "Repas préparé", moment: "midi" });
  e = await getEntree(id);
  assert.deepEqual([e.zone, e.texte, e.moment], ["ventre", "Repas préparé", "midi"]);

  const hier = decalerJours(jour, -1);
  const idHier = await ajouterEntree({ jour: hier, moment: "soir", zone: "jambes", texte: "Balade à la mer" });
  assert.equal((await getEntree(idHier)).origine, "recopie");

  const supprimee = await supprimerEntree(id);
  assert.equal(await getEntree(id), null);
  await restaurerEntree(supprimee);
  assert.deepEqual(await getEntree(id), supprimee);

  const duJour = await entreesDu(jour);
  assert.deepEqual(compterParZone(duJour), { ventre: 1 });
  assert.ok((await textesPasses()).some((p) => p.texte === "Balade à la mer"));
});

test("migration 41 en ajout seulement : tâches et « 3 » intactes", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const jour = getAujourdhui();
  const tache = await addItem({ nom: "Appeler la CAF", type: "tache" });
  await placerDansTrois(jour, 0, tache);
  const compter = async () => ({
    items: (await db.getFirstAsync("SELECT COUNT(*) AS n FROM items")).n,
    trois: (await db.getFirstAsync("SELECT COUNT(*) AS n FROM trois")).n,
    listes: (await db.getFirstAsync("SELECT COUNT(*) AS n FROM listes")).n,
  });
  const avant = await compter();
  // La base telle qu'elle était sur le téléphone avant Ma journée.
  await db.execAsync(
    "DROP TABLE journal; DROP TABLE zones; DROP TABLE journal_bonus; ALTER TABLE listes DROP COLUMN zone; " +
      "DROP TABLE courses_faites; DROP TABLE recap_semaine; DROP TABLE points_jours; DROP TABLE pioches; " +
      "ALTER TABLE achats DROP COLUMN souvenir_texte; ALTER TABLE achats DROP COLUMN souvenir_photo_uri; ALTER TABLE achats DROP COLUMN souvenir_ressenti; ALTER TABLE achats DROP COLUMN journal_id; " +
      "PRAGMA user_version = 40",
  );
  await runMigrations();
  assert.deepEqual(await compter(), avant);
  assert.equal((await getZones()).length, 7);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM journal")).n, 0);
  assert.ok((await getListes()).every((l) => l.zone === null));
  assert.equal((await db.getFirstAsync("PRAGMA user_version")).user_version, 45);
  assert.equal((await db.getFirstAsync("SELECT statut FROM items WHERE id = ?", tache)).statut, "actif");
});

// ─── Partie B : tâches, correspondance, points, progrès ───

test("correspondance entrée ↔ tâche : accents, majuscules, pluriels, mots clés", () => {
  const taches = [
    { id: 1, nom: "Meal prep" },
    { id: 2, nom: "Faire le ménage de la cuisine" },
    { id: 3, nom: "Appeler maman" },
    { id: 4, nom: "Rendre les livres à la médiathèque" },
  ];
  assert.equal(tacheCorrespondante("fait le MEAL PREP du dimanche", taches)?.id, 1);
  assert.equal(tacheCorrespondante("ménage", taches)?.id, 2);
  assert.equal(tacheCorrespondante("Menage cuisine", taches)?.id, 2);
  assert.equal(tacheCorrespondante("appelé maman", taches)?.id, 3);
  assert.equal(tacheCorrespondante("livre rendu à la mediatheque", taches)?.id, 4);
  assert.equal(tacheCorrespondante("Courir 20 min", taches), null);
  // « faire » seul ne suffit pas.
  assert.equal(tacheCorrespondante("faire une sieste", taches), null);
});

test("liste → zone : la table par défaut, rien de deviné sans mot reconnu", () => {
  const z = (n) => zoneDeListe(n);
  assert.deepEqual(
    ["Quotidien", "Travail", "Administratif", "Compétences", "Perso", "Projets", "Courses / achats", "Sport", "Ménage", "Cuisine", "Amis", "Sorties"].map(z),
    ["mains", "tete", "mains", "tete", "ventre", "pieds", "mains", "bras", "mains", "mains", "coeur", "jambes"],
  );
  assert.equal(z("Divers"), null);
  assert.equal(z("Mercredi"), null);
  // La zone réglée sur la liste passe devant la devinette.
  assert.equal(zoneDeTache({ liste_zone: "coeur", liste_nom: "Quotidien" }), "coeur");
  assert.equal(zoneDeTache({ liste_zone: null, liste_nom: "Quotidien" }), "mains");
  assert.equal(zoneDeTache({ liste_zone: null, liste_nom: "Divers" }), null);
});

test("points d'une entrée : 2, plafonnés à 20 par jour, 0 si liée à une tâche", () => {
  assert.equal(pointsEntree(0), 2);
  assert.equal(pointsEntree(19), 1);
  assert.equal(pointsEntree(20), 0);
  assert.equal(pointsEntree(0, true), 0);
  assert.ok(REGLES_POINTS.some((r) => r.action.startsWith("Ma journée : une entrée")));
  assert.ok(REGLES_POINTS.some((r) => r.action.includes("4 zones")));
});

test("plafond par jour et bonus des 4 zones (une fois), entrées liées comprises", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const jour = decalerJours(getAujourdhui(), -3);
  await db.runAsync("DELETE FROM journal WHERE jour = ?", jour);
  const points = async () => (await getStats()).points;
  const depart = await points();

  // 12 entrées dans la même zone : 20 points, pas 24 ; une seule zone, pas de bonus.
  for (let i = 0; i < 12; i++) {
    const r = await noterEntree({ jour, moment: "matin", zone: "mains", texte: "Petit truc " + i });
    assert.equal(r.bonus, false);
  }
  assert.equal((await points()) - depart, 20);

  await noterEntree({ jour, moment: "midi", zone: "tete", texte: "Candidature" });
  await noterEntree({ jour, moment: "midi", zone: "coeur", texte: "Appel" });
  // La 4e zone vient d'une tâche cochée : 0 point pour l'entrée, mais elle colore sa zone et donne le bonus.
  const tache = await addItem({ nom: "Courir", type: "tache" });
  const r = await cocherTache({ id: tache, nom: "Courir" }, "bras", jour, "soir");
  assert.equal(r.bonus, true);
  const entree = await getEntree(r.id);
  assert.deepEqual([entree.points, entree.tache_id, entree.origine], [0, tache, "tache"]);
  // Plafond atteint : 0 pour les entrées ; +10 la tâche ; +10 le bonus.
  assert.equal((await points()) - depart, 40);

  // Le bonus ne revient pas.
  const r2 = await noterEntree({ jour, moment: "soir", zone: "jambes", texte: "Balade" });
  assert.equal(r2.bonus, false);
  assert.equal((await points()) - depart, 40);

  // Décocher : la tâche revient, ses points repartent, l'entrée aussi.
  await decocherTache(r.id);
  assert.equal(await getEntree(r.id), null);
  assert.equal((await getItem(tache)).statut, "actif");
  assert.equal((await points()) - depart, 30);
});

test("« Cocher aussi … ? » : la tâche est faite et liée, sans double point", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const jour = decalerJours(getAujourdhui(), -2);
  await db.runAsync("DELETE FROM journal WHERE jour = ?", jour);
  const avant = (await getStats()).points;
  const tache = await addItem({ nom: "Meal prep", type: "tache" });
  assert.ok((await tachesAFaire(jour)).some((t) => t.id === tache));
  const { id } = await noterEntree({ jour, moment: "midi", zone: "mains", texte: "meal prep du dimanche" });
  assert.equal((await getEntree(id)).points, 2);
  await lierTache(id, tache);
  const e = await getEntree(id);
  assert.deepEqual([e.tache_id, e.points], [tache, 0]);
  // Rien que les 10 points de la tâche : les 2 de l'entrée sont repris.
  assert.equal((await getStats()).points - avant, 10);
  assert.equal((await getItem(tache)).statut, "termine");
  assert.ok(!(await tachesAFaire(jour)).some((t) => t.id === tache));
  // Une deuxième liaison ne change rien.
  await lierTache(id, tache);
  assert.equal((await getStats()).points - avant, 10);
  // Supprimer l'entrée liée : la tâche reste faite, aucun point repris (l'entrée n'en avait pas).
  await supprimerEntree(id);
  assert.equal((await getStats()).points - avant, 10);
});

test("zone d'une liste : choisie une fois, valable pour toutes ses tâches", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const r = await db.runAsync("INSERT INTO listes (nom, icone, ordre, cree_le) VALUES (?, NULL, 99, ?)", "Divers", new Date().toISOString());
  const liste = r.lastInsertRowId;
  const a = await addItem({ nom: "Truc A", type: "tache", liste_id: liste });
  const b = await addItem({ nom: "Truc B", type: "tache", liste_id: liste });
  const trouve = async (id) => (await tachesAFaire(getAujourdhui())).find((t) => t.id === id);
  assert.equal(zoneDeTache(await trouve(a)), null);
  await definirZoneListe(liste, "pieds");
  assert.equal(zoneDeTache(await trouve(a)), "pieds");
  assert.equal(zoneDeTache(await trouve(b)), "pieds");
  assert.equal((await getListes()).find((l) => l.id === liste).zone, "pieds");
});

test("progrès : carte de chaleur, ressenti moyen, temps total, zones colorées par jour", () => {
  assert.deepEqual(chaleur({ mains: 6, tete: 2, bras: 0, pieds: 1 }), { mains: 3, tete: 1, bras: 0, pieds: 1 });
  assert.deepEqual(chaleur({}), {});
  const e = [
    { jour: "2026-11-16", zone: "mains", ressenti: 4, duree_min: 30 },
    { jour: "2026-11-16", zone: "mains", ressenti: 3, duree_min: null },
    { jour: "2026-11-16", zone: "tete", ressenti: null, duree_min: 60 },
    { jour: "2026-11-17", zone: "mains", ressenti: null, duree_min: null },
  ];
  const s = statsJournee(e, ["2026-11-15", "2026-11-16", "2026-11-17"]);
  assert.deepEqual(s.parZone.mains, { n: 3, ressentiMoyen: 3.5, minutes: 30 });
  assert.deepEqual(s.parZone.tete, { n: 1, ressentiMoyen: null, minutes: 60 });
  assert.deepEqual(s.zonesParJour, [0, 2, 1]);
});

test("zones désactivées : les entrées restent, la zone ne se colore plus", async () => {
  await initialiserBase();
  const jour = decalerJours(getAujourdhui(), -5);
  const { id } = await noterEntree({ jour, moment: "matin", zone: "coeur", texte: "Café avec Léa" });
  await modifierZone("coeur", { active: 0 });
  assert.equal((await getEntree(id)).zone, "coeur");
  assert.equal((await getZones()).find((z) => z.cle === "coeur").active, 0);
  await modifierZone("coeur", { active: 1 });
});
