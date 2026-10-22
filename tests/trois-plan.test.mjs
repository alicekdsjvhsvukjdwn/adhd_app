// Lancer : npm test
// « Mes 3 » planifiables : jours futurs sans proposition automatique, jours passés en lecture seule, tâche faite qui reste,
// tâche faite avant son jour, jour complet (bonus / remplacer), origine et place_le.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { annulerCompletion, completer, getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { addItem } from "../lib/db/items.ts";
import { genererPropositions } from "../lib/db/moteur.ts";
import { bonusDuJour, emplacementsDuJour, etoiler, faitesPour, placerDansTrois, placerEnBonus, planifications, retirerDesTrois, retirerDuBonus } from "../lib/db/trois.ts";
import { composerBonus, composerTrois, faiteAvant, troisFaits } from "../lib/trois-regles.ts";

const vide = { stockes: [], dus: [], veille: [], ordre: [] };

test("jour futur : seules mes tâches, jamais de proposition (proposer = false)", () => {
  const e = composerTrois({ ...vide, ordre: [5, 6, 7], dus: [5], veille: [6], proposer: false, stockes: [{ rang: 1, itemId: 9, source: "choisi" }].map((s) => s) , });
  // 9 n'est pas dans « ordre » (plus à faire) : l'emplacement reste vide, et rien d'autre ne le remplace
  assert.deepEqual(e.map((x) => x.itemId), [null, null, null]);
  const f = composerTrois({ ...vide, ordre: [5, 6, 7, 9], dus: [5], proposer: false, stockes: [{ rang: 1, itemId: 9, source: "choisi", origine: "moi" }] });
  assert.deepEqual(f.map((x) => x.itemId), [null, 9, null]);
  assert.equal(f[1].origine, "moi");
  // le jour même, les propositions remplissent les emplacements restés vides
  assert.deepEqual(composerTrois({ ...vide, ordre: [5, 6, 7, 9], dus: [5], stockes: [{ rang: 1, itemId: 9, source: "choisi" }] }).map((x) => x.itemId), [5, 9, 6]);
});

test("tâche faite : elle garde son emplacement, cochée, avec son jour ; jamais reproposée ; faite avant son jour", () => {
  const e = composerTrois({ ...vide, ordre: [6, 7], faits: { 5: "2026-10-23", 6: "2026-10-23" }, stockes: [{ rang: 0, itemId: 5, source: "choisi", origine: "moi" }] });
  assert.deepEqual([e[0].itemId, e[0].faite, e[0].faiteLe], [5, true, "2026-10-23"]);
  // 6 est « faite » (récurrente ce jour-là) : elle n'est pas proposée dans un emplacement vide
  assert.deepEqual(e.slice(1).map((x) => x.itemId), [7, null]);
  assert.equal(faiteAvant(e[0], "2026-10-24"), true);
  assert.equal(faiteAvant(e[0], "2026-10-23"), false);
  assert.equal(troisFaits(e), false);
  const tous = composerTrois({ ...vide, ordre: [], faits: { 1: "j", 2: "j", 3: "j" }, stockes: [1, 2, 3].map((id, rang) => ({ rang, itemId: id, source: "choisi" })) });
  assert.equal(troisFaits(tous), true);
  assert.equal(troisFaits(tous.slice(0, 2)), false);
});

test("bonus : dans l'ordre où je les place, les faits restent, une tâche supprimée disparaît", () => {
  const b = composerBonus({ stockes: [{ itemId: 8, rang: 1 }, { itemId: 7, rang: 0 }, { itemId: 9, rang: 2 }], ordre: [7, 8], faits: { 9: "j" } });
  assert.deepEqual(b.map((x) => [x.itemId, x.faite]), [[7, false], [8, false], [9, true]]);
  assert.deepEqual(composerBonus({ stockes: [{ itemId: 3, rang: 0 }], ordre: [] }), []);
});

// ─── Base en mémoire ───

await initialiserBase();
const db = await getDatabase();
const AUJ = getAujourdhui();
const J = (n) => decalerJours(AUJ, n);
const nom = (cl, id) => cl.find((p) => p.itemId === id)?.nom ?? null;

test("planifier un jour futur : mes choix sont enregistrés (origine « moi », place_le), rien n'est ajouté tout seul", async () => {
  const a = await addItem({ nom: "Plan A", type: "tache", importance: 3 });
  await addItem({ nom: "Plan B", type: "tache", importance: 3 });
  const classement = await genererPropositions();
  const jour = J(5);
  assert.deepEqual((await emplacementsDuJour(jour, classement, true, AUJ)).map((e) => e.itemId), [null, null, null]); // figer ne fige rien un autre jour
  assert.equal((await db.getAllAsync("SELECT * FROM trois WHERE jour = ?", jour)).length, 0);
  await placerDansTrois(jour, 1, a);
  const e = await emplacementsDuJour(jour, classement, true, AUJ);
  assert.deepEqual(e.map((x) => x.itemId), [null, a, null]);
  assert.deepEqual([e[1].source, e[1].origine, e[1].stocke], ["choisi", "moi", true]);
  const ligne = await db.getFirstAsync("SELECT * FROM trois WHERE jour = ? AND item_id = ?", jour, a);
  assert.match(ligne.place_le, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(ligne.bonus, 0);
  // revenir plus tard sur ce jour : toujours pas de remplacement automatique
  assert.deepEqual((await emplacementsDuJour(jour, await genererPropositions(), false, AUJ)).map((x) => x.itemId), [null, a, null]);
  await retirerDesTrois(jour, 1);
  assert.deepEqual((await emplacementsDuJour(jour, classement, false, AUJ)).map((x) => x.itemId), [null, null, null]);
});

test("aujourd'hui : les propositions figées gardent leur origine (report, moteur, prévue ce jour-là) et place_le", async () => {
  await db.runAsync("DELETE FROM trois");
  const dow = new Date(AUJ + "T00:00:00Z").getUTCDay();
  const prevue = await addItem({ nom: "Prévue auj", type: "tache", importance: 1, jours: String(dow), recurrence: "hebdo" });
  const veille = await addItem({ nom: "De la veille", type: "tache", importance: 1 });
  await placerDansTrois(J(-1), 0, veille);
  const classement = await genererPropositions();
  const e = await emplacementsDuJour(AUJ, classement, true, AUJ);
  const origines = Object.fromEntries(e.filter((x) => x.itemId).map((x) => [x.itemId, x.origine]));
  assert.equal(origines[veille], "report");
  if (origines[prevue] !== undefined) assert.equal(origines[prevue], "prevue");
  const lignes = await db.getAllAsync("SELECT item_id, origine, place_le FROM trois WHERE jour = ? AND item_id > 0", AUJ);
  assert.ok(lignes.length >= 2);
  assert.ok(lignes.every((l) => ["report", "moteur", "prevue"].includes(l.origine) && l.place_le.startsWith("20")));
});

test("jour passé : lecture seule (rien n'est proposé ni enregistré), on voit ce qui était prévu et ce qui a été fait", async () => {
  await db.runAsync("DELETE FROM trois");
  const x = await addItem({ nom: "Passé fait", type: "tache", importance: 1 });
  const y = await addItem({ nom: "Passé pas fait", type: "tache", importance: 1 });
  await placerDansTrois(J(-2), 0, x);
  await placerDansTrois(J(-2), 1, y);
  await completer(x, "complet", undefined, undefined, undefined, J(-2));
  const classement = await genererPropositions();
  const e = await emplacementsDuJour(J(-2), classement, true, AUJ);
  assert.deepEqual([e[0].itemId, e[0].faite, e[0].faiteLe], [x, true, J(-2)]);
  assert.deepEqual([e[1].itemId, e[1].faite], [y, false]);
  assert.equal(e[2].itemId, null); // pas de proposition dans le passé
  // un jour passé jamais ouvert : vide, et rien n'est écrit
  assert.deepEqual((await emplacementsDuJour(J(-9), classement, true, AUJ)).map((v) => v.itemId), [null, null, null]);
  assert.equal((await db.getAllAsync("SELECT * FROM trois WHERE jour = ?", J(-9))).length, 0);
});

test("tâche faite : elle reste dans son emplacement, cochée, et n'est jamais reproposée ; décochée, elle redevient à faire", async () => {
  await db.runAsync("DELETE FROM trois");
  const a = await addItem({ nom: "Reste cochée", type: "tache", importance: 3 });
  await addItem({ nom: "Autre 1", type: "tache", importance: 2 });
  await addItem({ nom: "Autre 2", type: "tache", importance: 1 });
  let classement = await genererPropositions();
  await placerDansTrois(AUJ, 0, a);
  await completer(a, "complet");
  classement = await genererPropositions();
  let e = await emplacementsDuJour(AUJ, classement, true, AUJ);
  assert.deepEqual([e[0].itemId, e[0].faite, e[0].faiteLe], [a, true, AUJ]);
  assert.equal(e.slice(1).some((x) => x.itemId === a), false); // pas reproposée ailleurs
  await annulerCompletion(a);
  classement = await genererPropositions();
  e = await emplacementsDuJour(AUJ, classement, false, AUJ);
  assert.deepEqual([e[0].itemId, e[0].faite], [a, false]);
});

test("tâche ponctuelle faite avant son jour : « déjà faite » dans l'emplacement de ce jour ; une tâche récurrente se lit sur le jour concerné", async () => {
  await db.runAsync("DELETE FROM trois");
  const ponctuelle = await addItem({ nom: "Ponctuelle samedi", type: "tache", importance: 1 });
  const recurrente = await addItem({ nom: "Récurrente", type: "tache", importance: 1, recurrence: "hebdo", jours: String(new Date(J(3) + "T00:00:00Z").getUTCDay()) });
  await placerDansTrois(J(3), 0, ponctuelle);
  await placerDansTrois(J(3), 1, recurrente);
  await completer(ponctuelle, "complet"); // faite aujourd'hui, pour le jour J+3
  await completer(recurrente, "complet"); // faite aujourd'hui : ne compte pas pour J+3
  const classement = await genererPropositions();
  const e = await emplacementsDuJour(J(3), classement, false, AUJ);
  assert.deepEqual([e[0].itemId, e[0].faite, e[0].faiteLe], [ponctuelle, true, AUJ]);
  assert.equal(faiteAvant(e[0], J(3)), true);
  assert.deepEqual([e[1].itemId, e[1].faite], [recurrente, false]);
  const faits = await faitesPour(J(3), [ponctuelle, recurrente]);
  assert.deepEqual(faits, { [ponctuelle]: AUJ });
  // d'un geste : libérer l'emplacement
  await retirerDesTrois(J(3), 0);
  assert.equal((await emplacementsDuJour(J(3), classement, false, AUJ))[0].itemId, null);
});

test("jour complet : l'étoile ne remplace rien en silence ; « en bonus » ou « remplacer » au choix", async () => {
  await db.runAsync("DELETE FROM trois");
  const ids = [];
  for (const n of ["P1", "P2", "P3", "Nouvelle"]) ids.push(await addItem({ nom: n, type: "tache", importance: 1 }));
  const classement = await genererPropositions();
  const jour = J(2);
  for (let r = 0; r < 3; r++) assert.equal(await etoiler(jour, ids[r], "priorite", classement, AUJ), "ajoute");
  assert.deepEqual((await emplacementsDuJour(jour, classement, false, AUJ)).map((e) => e.itemId), ids.slice(0, 3));
  // les 3 sont pris : rien ne bouge
  assert.equal(await etoiler(jour, ids[3], "priorite", classement, AUJ), "plein");
  assert.deepEqual((await emplacementsDuJour(jour, classement, false, AUJ)).map((e) => e.itemId), ids.slice(0, 3));
  assert.deepEqual(await bonusDuJour(jour, classement), []);
  // choix 1 : en bonus
  await placerEnBonus(jour, ids[3]);
  assert.deepEqual((await bonusDuJour(jour, classement)).map((b) => b.itemId), [ids[3]]);
  // choix 2 : remplacer la priorité 2 ; l'ancienne n'est pas perdue en silence, elle peut passer en bonus
  await placerDansTrois(jour, 1, ids[3]);
  assert.deepEqual((await emplacementsDuJour(jour, classement, false, AUJ)).map((e) => e.itemId), [ids[0], ids[3], ids[2]]);
  assert.deepEqual(await bonusDuJour(jour, classement), []); // la tâche n'est plus en bonus : un seul endroit par jour
  // retirer par l'étoile
  assert.equal(await etoiler(jour, ids[3], "priorite", classement, AUJ), "retire");
  assert.equal((await emplacementsDuJour(jour, classement, false, AUJ))[1].itemId, null);
});

test("bonus : plusieurs, dans l'ordre, retrait ; une priorité passée en bonus libère son emplacement ; origine et place_le remplis", async () => {
  await db.runAsync("DELETE FROM trois");
  const [a, b, c] = [await addItem({ nom: "Bonus a", type: "tache" }), await addItem({ nom: "Bonus b", type: "tache" }), await addItem({ nom: "Bonus c", type: "tache" })];
  const classement = await genererPropositions();
  const jour = J(4);
  await placerDansTrois(jour, 0, a);
  assert.equal(await etoiler(jour, b, "bonus", classement, AUJ), "ajoute");
  assert.equal(await etoiler(jour, c, "bonus", classement, AUJ), "ajoute");
  await placerEnBonus(jour, a); // elle quitte les 3 pour le bonus
  assert.equal((await emplacementsDuJour(jour, classement, false, AUJ))[0].itemId, null);
  assert.deepEqual((await bonusDuJour(jour, classement)).map((x) => x.itemId), [b, c, a]);
  const l = await db.getFirstAsync("SELECT * FROM trois WHERE jour = ? AND item_id = ?", jour, b);
  assert.deepEqual([l.bonus, l.origine, l.source], [1, "moi", "choisi"]);
  assert.match(l.place_le, /^\d{4}-/);
  await retirerDuBonus(jour, b);
  assert.deepEqual((await bonusDuJour(jour, classement)).map((x) => x.itemId), [c, a]);
  // un bonus n'est jamais reporté : demain n'en reçoit pas
  assert.deepEqual(await bonusDuJour(J(5), classement), []);
  assert.deepEqual((await emplacementsDuJour(J(5), classement, false, AUJ)).map((e) => e.itemId), [null, null, null]);
});

test("planifications : où chaque tâche est placée (priorité ou bonus), à partir d'aujourd'hui seulement", async () => {
  await db.runAsync("DELETE FROM trois");
  const a = await addItem({ nom: "Plan star", type: "tache" });
  const classement = await genererPropositions();
  await placerDansTrois(J(-3), 0, a); // passé : ignoré
  await placerDansTrois(J(2), 0, a);
  await etoiler(J(6), a, "bonus", classement, AUJ);
  assert.deepEqual((await planifications(AUJ))[a], [{ jour: J(2), bonus: false }, { jour: J(6), bonus: true }]);
});

test("migration 40 : les colonnes bonus, place_le et origine existent (et le CSV les documente)", async () => {
  const cols = (await db.getAllAsync("PRAGMA table_info(trois)")).map((c) => c.name);
  for (const c of ["bonus", "place_le", "origine"]) assert.ok(cols.includes(c), c);
  const { lisezmoi } = await import("../lib/csv.ts");
  const txt = lisezmoi([{ nom: "trois", colonnes: cols, lignes: 0 }], "2026-10-22T00:00:00.000Z");
  assert.match(txt, /place_le/);
  assert.match(txt, /origine/);
  assert.equal(nom([], 1), null);
});
