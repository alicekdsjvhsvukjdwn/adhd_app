// Lancer : npm test
// Ménage par pièce : règles pures, puis le vrai code de lib/db/ sur node:sqlite.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { ecrireMeta } from "../lib/db/meta.ts";
import {
  ajouterPiece,
  ajouterTacheMenage,
  cocherTacheMenage,
  decocherTacheMenage,
  deplacerPiece,
  getMenage,
  supprimerPiece,
} from "../lib/db/menage.ts";
import { getStats } from "../lib/db/stats.ts";
import { REGLES_POINTS } from "../lib/db/recompenses.ts";
import {
  aFaireAujourdhui,
  couleurJauge,
  jauge,
  libelleFrequence,
  partRetard,
  PIECES_DEFAUT,
  retardJours,
} from "../lib/menage-regles.ts";

const AUJ = "2026-10-21";
const t = (id, freq, prochaine, extra = {}) => ({
  id, piece_id: 1, nom: "T" + id, freq_jours: freq, prochaine_le: prochaine, fait_le: null, avant_le: null, points_donnes: 0, ...extra,
});

// ─── Règles pures ───

test("retard : jours de retard, part de la période écoulée", () => {
  assert.equal(retardJours(t(1, 7, "2026-10-21"), AUJ), 0);
  assert.equal(retardJours(t(1, 7, "2026-10-18"), AUJ), 3);
  assert.equal(retardJours(t(1, 7, "2026-10-28"), AUJ), 0);
  assert.equal(partRetard(t(1, 7, "2026-10-28"), AUJ), 0); // vient d'être faite
  assert.equal(partRetard(t(1, 4, "2026-10-23"), AUJ), 0.5); // 2 jours sur 4
  assert.equal(partRetard(t(1, 7, "2026-10-21"), AUJ), 1); // à faire aujourd'hui
  assert.equal(partRetard(t(1, 7, "2026-10-10"), AUJ), 1); // en retard : plafonné
});

test("jauge d'une pièce : moyenne des retards, pleine = propre, vide = à faire", () => {
  assert.equal(jauge([], AUJ), 1);
  assert.equal(jauge([t(1, 7, "2026-10-28")], AUJ), 1);
  assert.equal(jauge([t(1, 7, "2026-10-21")], AUJ), 0);
  assert.equal(jauge([t(1, 4, "2026-10-28"), t(2, 7, "2026-10-21")], AUJ), 0.5);
  assert.equal(couleurJauge(0), "#FB923C"); // orange
  assert.equal(couleurJauge(1), "#34D399"); // vert
  assert.equal(couleurJauge(2), "#34D399");
});

test("fréquences en toutes lettres", () => {
  assert.deepEqual([1, 2, 3, 7, 14, 30].map(libelleFrequence), [
    "chaque jour", "tous les 2 jours", "tous les 3 jours", "chaque semaine", "toutes les 2 semaines", "chaque mois",
  ]);
});

test("à faire aujourd'hui : dues et en retard, les plus en retard d'abord, 5 visibles, jour difficile = chaque jour", () => {
  const l = [
    t(1, 7, "2026-10-21"), // due aujourd'hui
    t(2, 1, "2026-10-20"), // 1 jour de retard
    t(3, 7, "2026-10-15"), // 6 jours
    t(4, 7, "2026-10-25"), // pas due
    t(5, 30, "2026-10-10"), // 11 jours
    t(6, 3, "2026-10-19"), // 2 jours
    t(7, 1, "2026-10-21"), // due aujourd'hui, 0 jour
    t(8, 7, "2026-10-21", { fait_le: AUJ }), // cochée aujourd'hui : plus à faire
  ];
  const { visibles, autres } = aFaireAujourdhui(l, AUJ);
  assert.deepEqual(visibles.map((x) => x.id), [5, 3, 6, 2, 1]);
  assert.equal(autres, 1);
  const difficile = aFaireAujourdhui(l, AUJ, { jourDifficile: true });
  assert.deepEqual(difficile.visibles.map((x) => x.id), [2, 7]);
  assert.equal(difficile.autres, 0);
});

test("pièces de départ : celles demandées, chacune avec ses tâches", () => {
  assert.deepEqual(PIECES_DEFAUT.map((p) => p.nom), ["Cuisine", "Salle de bain", "Chambre", "Salon", "Entrée", "Linge", "Courses & poubelles"]);
  const cuisine = Object.fromEntries(PIECES_DEFAUT[0].taches);
  assert.deepEqual([cuisine["Vaisselle"], cuisine["Plan de travail"], cuisine["Frigo"]], [1, 2, 30]);
  const sdb = Object.fromEntries(PIECES_DEFAUT[1].taches);
  assert.deepEqual([sdb["Lavabo"], sdb["Douche"], sdb["Toilettes"]], [7, 7, 7]);
  const linge = Object.fromEntries(PIECES_DEFAUT[5].taches);
  assert.deepEqual([linge["Lessive"], linge["Changer les draps"]], [3, 14]);
});

// ─── Base en mémoire ───

await initialiserBase();
const J = getAujourdhui();
const points = async () => (await getStats()).points;
const tacheDe = async (nom) => (await getMenage()).taches.find((x) => x.nom === nom);

test("première ouverture : pièces et tâches de départ créées une seule fois", async () => {
  const m = await getMenage();
  assert.equal(m.pieces.length, 7);
  assert.equal(m.taches.length, PIECES_DEFAUT.reduce((s, p) => s + p.taches.length, 0));
  assert.equal((await getMenage()).pieces.length, 7);
  // Vaisselle (chaque jour) est due aujourd'hui ; le frigo (mensuel, 3ᵉ tâche) est étalé plus tard.
  assert.equal((await tacheDe("Vaisselle")).prochaine_le, J);
  assert.equal((await tacheDe("Frigo")).prochaine_le, decalerJours(J, 3 % 30));
});

test("cocher repousse l'échéance à maintenant + fréquence, +5 une fois, décocher reprend tout", async () => {
  const avant = await points();
  const v = await tacheDe("Vaisselle");
  assert.equal(await cocherTacheMenage(v.id), 5);
  const apres = await tacheDe("Vaisselle");
  assert.equal(apres.prochaine_le, decalerJours(J, 1));
  assert.equal(apres.fait_le, J);
  assert.equal(await points(), avant + 5);
  // Recocher le même jour : rien de plus.
  assert.equal(await cocherTacheMenage(v.id), 0);
  assert.equal(await points(), avant + 5);
  // Décocher : l'échéance revient, les points aussi sont repris.
  await decocherTacheMenage(v.id);
  const retour = await tacheDe("Vaisselle");
  assert.equal(retour.prochaine_le, J);
  assert.equal(retour.fait_le, null);
  assert.equal(await points(), avant);
  // Recocher après : de nouveau +5, jamais deux fois pour la même échéance.
  assert.equal(await cocherTacheMenage(v.id), 5);
  assert.equal(await points(), avant + 5);
  const lignes = await (await getDatabase()).getAllAsync("SELECT * FROM menage_faits WHERE tache_id = ?", v.id);
  assert.equal(lignes.length, 1);
});

test("pas de double comptage : même échéance déjà payée, ou tâche pas encore due", async () => {
  const db = await getDatabase();
  const avant = await points();
  // Une échéance déjà payée (ligne dans menage_faits) ne rapporte plus rien.
  const p = await tacheDe("Plan de travail");
  await db.runAsync("INSERT INTO menage_faits (tache_id, echeance, jour) VALUES (?, ?, ?)", p.id, p.prochaine_le, J);
  assert.equal(await cocherTacheMenage(p.id), 0);
  assert.equal(await points(), avant);
  // Cochée en avance (pas encore due) : l'échéance repart, mais aucun point.
  const frigo = await tacheDe("Frigo");
  await db.runAsync("UPDATE menage_taches SET prochaine_le = ? WHERE id = ?", decalerJours(J, 10), frigo.id);
  assert.equal(await cocherTacheMenage(frigo.id), 0);
  assert.equal((await tacheDe("Frigo")).prochaine_le, decalerJours(J, 30));
  assert.equal(await points(), avant);
  await decocherTacheMenage(frigo.id); // sans points : rien à reprendre
  assert.equal((await tacheDe("Frigo")).prochaine_le, decalerJours(J, 10));
  assert.equal(await points(), avant);
});

test("jour difficile : seules les tâches « chaque jour » restent dans « à faire aujourd'hui »", async () => {
  const m = await getMenage();
  assert.equal(m.jourDifficile, false);
  await ecrireMeta(`energie_routines:${J}`, "1");
  const d = await getMenage();
  assert.equal(d.jourDifficile, true);
  const { visibles } = aFaireAujourdhui(d.taches, J, { jourDifficile: d.jourDifficile, max: 50 });
  assert.ok(visibles.length > 0 && visibles.every((x) => x.freq_jours === 1));
  await ecrireMeta(`energie_routines:${J}`, null);
});

test("pièces : ajouter, réordonner, supprimer avec ses tâches ; règle ajoutée aux règles de points", async () => {
  const id = await ajouterPiece("Balcon");
  await ajouterTacheMenage(id, "Arroser", 2);
  const m = await getMenage();
  const nouvelle = m.taches.find((x) => x.piece_id === id);
  assert.equal(nouvelle.prochaine_le, J); // une tâche ajoutée est à faire aujourd'hui
  assert.equal(m.pieces.at(-1).nom, "Balcon");
  await deplacerPiece(id, -1);
  assert.equal((await getMenage()).pieces.at(-2).nom, "Balcon");
  await deplacerPiece(id, -1);
  await deplacerPiece(id, 1);
  await cocherTacheMenage(nouvelle.id);
  await supprimerPiece(id);
  const fin = await getMenage();
  assert.ok(!fin.pieces.some((p) => p.id === id) && !fin.taches.some((x) => x.piece_id === id));
  assert.equal((await (await getDatabase()).getAllAsync("SELECT * FROM menage_faits WHERE tache_id = ?", nouvelle.id)).length, 0);
  assert.ok(REGLES_POINTS.some((r) => /ménage/i.test(r.action) && r.points === "+5"));
});
