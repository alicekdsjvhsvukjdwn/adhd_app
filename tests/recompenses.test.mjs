// Lancer : npm test
// Récompenses repensées : objectif et ~N jours, pioche (seuil, 2 repioches), utilisation et souvenir, migration sans perte.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { entreesDu } from "../lib/db/journee.ts";
import { runMigrations } from "../lib/db/migrations.ts";
import { moyennePoints14 } from "../lib/db/recap.ts";
import {
  ajouterRecompense,
  compterPioche,
  ecrireObjectif,
  enregistrerSouvenir,
  getRecompenses,
  lireObjectif,
  piochesDuJour,
  pointsGagnes,
  soldePoints,
  souvenirs,
  utiliser,
} from "../lib/db/recompenses.ts";
import { addPoints } from "../lib/db/stats.ts";
import { etageres, objectifProche, piocher, progressionObjectif, suggestionRepos } from "../lib/recompenses-regles.ts";

const R = (id, prix, categorie = "temps", nom = `R${id}`) => ({ id, nom, prix, categorie, icone: null });

test("objectif : pourcentage, reste, ~N jours d'après la moyenne ; rien sans données ; prête", () => {
  assert.deepEqual(progressionObjectif(200, 50, 30), { part: 0.25, pourcent: 25, reste: 150, atteint: false, jours: 5 });
  assert.equal(progressionObjectif(200, 50, null).jours, null, "pas assez de données : rien d'affiché");
  assert.equal(progressionObjectif(200, 50, 0).jours, null);
  const p = progressionObjectif(100, 140, 20);
  assert.deepEqual([p.atteint, p.reste, p.pourcent, p.jours], [true, 0, 100, null]);
});

test("objectif le plus proche : le mien, sinon la moins chère pas encore accessible", () => {
  const l = [R(1, 40), R(2, 150), R(3, 300)];
  assert.equal(objectifProche(l, 100, 3).recompense.id, 3);
  assert.equal(objectifProche(l, 100, null).recompense.id, 2);
  assert.equal(objectifProche(l, 100, null).manque, 50);
  assert.equal(objectifProche(l, 1000, null).manque, 0);
  assert.equal(objectifProche([], 10, null), null);
});

test("pioche : disponible et sous le seuil, une autre à la repioche", () => {
  const l = [R(1, 40), R(2, 60), R(3, 80), R(4, 30)];
  const ids = new Set(Array.from({ length: 50 }, (_, i) => piocher(l, 100, 60, null, () => i / 50).id));
  assert.deepEqual([...ids].sort(), [1, 2, 4]);
  assert.equal(piocher(l, 35, 60, null, () => 0.9).id, 4, "le solde compte aussi");
  assert.notEqual(piocher(l, 100, 60, 1, () => 0).id, 1, "repiocher donne une autre");
  assert.equal(piocher([R(1, 40)], 100, 60, 1).id, 1, "une seule possible : la même");
  assert.equal(piocher(l, 10, 60), null);
});

test("vitrine et suggestion : étagères dans l'ordre, une seule suggestion de repos si une zone a beaucoup donné", () => {
  const l = [R(1, 100, "bouffe"), R(2, 30, "mer"), R(3, 50, "temps"), R(4, 20, "temps"), R(5, 60, "inconnue")];
  assert.deepEqual(etageres(l).map((e) => [e.cle, e.recompenses.map((r) => r.id)]), [["mer", [2]], ["bouffe", [1]], ["temps", [4, 3, 5]]]);
  const s = suggestionRepos({ mains: 12, bras: 3 }, l, 40);
  assert.equal(s.recompense.id, 4);
  assert.match(s.message, /côté maison/);
  assert.equal(suggestionRepos({ mains: 4 }, l, 40), null);
  assert.equal(suggestionRepos({ ventre: 20 }, l, 40), null, "le soin de soi n'appelle pas de repos");
});

test("avec la base : pioches comptées (3 par jour), utiliser baisse le solde pas le total, souvenir → entrée du journal", async () => {
  await initialiserBase();
  const db = await getDatabase();
  assert.equal(await piochesDuJour(), 0);
  assert.equal(await compterPioche(), true);
  assert.equal(await compterPioche(), true);
  assert.equal(await compterPioche(), true);
  assert.equal(await compterPioche(), false, "2 repioches au plus");
  assert.equal(await piochesDuJour(), 3);

  await addPoints(500);
  await ajouterRecompense({ nom: "Glace", icone: "glace", prix: 30, categorie: "bouffe" });
  const glace = (await getRecompenses()).find((r) => r.nom === "Glace");
  await ecrireObjectif(glace.id);
  const [solde, gagnes] = [await soldePoints(), await pointsGagnes()];
  const achat = await utiliser(glace);
  assert.ok(achat);
  assert.equal(await soldePoints(), solde - 30);
  assert.equal(await pointsGagnes(), gagnes, "le niveau ne baisse pas");
  assert.equal(await lireObjectif(), null, "l'objectif utilisé est libéré");

  let entree = (await entreesDu(getAujourdhui())).find((e) => e.source === "recompense");
  assert.deepEqual([entree.zone, entree.texte, entree.points], ["jambes", "Glace", 0]);
  await enregistrerSouvenir(achat, { texte: "Au soleil sur le port", photo: "data:image/jpeg;base64,AAAA", ressenti: 5 });
  entree = (await entreesDu(getAujourdhui())).find((e) => e.source === "recompense");
  assert.deepEqual([entree.texte, entree.ressenti], ["Glace · Au soleil sur le port", 5]);
  const s = (await souvenirs())[0];
  assert.deepEqual([s.souvenir_texte, s.souvenir_photo_uri, s.souvenir_ressenti, s.categorie], ["Au soleil sur le port", "data:image/jpeg;base64,AAAA", 5, "bouffe"]);
  assert.equal((await db.getFirstAsync("SELECT journal_id FROM achats WHERE id = ?", achat)).journal_id, entree.id);
  assert.equal(await utiliser({ ...glace, prix: 100000 }), null, "solde insuffisant");
});

test("~N jours : moyenne des 14 derniers jours d'après les relevés, rien sous 7 jours", async () => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM points_jours");
  const auj = getAujourdhui();
  await db.runAsync("INSERT INTO points_jours (jour, total) VALUES (?, 100), (?, 160)", decalerJours(auj, -3), auj);
  assert.equal(await moyennePoints14(), null);
  await db.runAsync("INSERT INTO points_jours (jour, total) VALUES (?, 20)", decalerJours(auj, -10));
  assert.equal(await moyennePoints14(), 14);
});

test("migration 45 : rien n'est perdu (achats, récompenses)", async () => {
  const db = await getDatabase();
  const avant = {
    achats: await db.getAllAsync("SELECT id, recompense_id, nom, icone, prix, date, horodatage FROM achats ORDER BY id"),
    recompenses: await db.getAllAsync("SELECT * FROM recompenses ORDER BY id"),
  };
  await db.execAsync(
    "DROP TABLE pioches; ALTER TABLE achats DROP COLUMN souvenir_texte; ALTER TABLE achats DROP COLUMN souvenir_photo_uri; " +
      "ALTER TABLE achats DROP COLUMN souvenir_ressenti; ALTER TABLE achats DROP COLUMN journal_id; PRAGMA user_version = 44",
  );
  await runMigrations();
  assert.deepEqual(await db.getAllAsync("SELECT id, recompense_id, nom, icone, prix, date, horodatage FROM achats ORDER BY id"), avant.achats);
  assert.deepEqual(await db.getAllAsync("SELECT * FROM recompenses ORDER BY id"), avant.recompenses);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM achats WHERE souvenir_texte IS NOT NULL")).n, 0);
  assert.equal((await db.getFirstAsync("PRAGMA user_version")).user_version, 45);
});
