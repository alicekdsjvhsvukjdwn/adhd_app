// Lancer : npm test
// Feuille « détail » d'une tâche : ajout d'étape, dernière étape, tâche récurrente.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  BONUS_FIN,
  debutEtapesEnCours,
  POINTS_COMPLETION,
  POINTS_DERNIERE_ETAPE,
  POINTS_ETAPE,
  pointsEtapesARetirer,
  SQL_AJOUT_ETAPE,
} from "../lib/regles-taches.ts";

test("dernière étape : étape + tâche + bonus, une seule fois", () => {
  assert.equal(POINTS_DERNIERE_ETAPE, POINTS_ETAPE + POINTS_COMPLETION + BONUS_FIN);
  // 3 étapes cochées sur 3 : on reprend 3 étapes et le bonus, pas plus (la complétion se reprend à part).
  assert.equal(pointsEtapesARetirer(3, 3), 3 * POINTS_ETAPE + BONUS_FIN);
  assert.equal(pointsEtapesARetirer(2, 3), 2 * POINTS_ETAPE); // pas de bonus avant la fin
});

test("ajouter une étape : à la fin, sans toucher aux autres", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE etapes (id INTEGER PRIMARY KEY, item_id INTEGER, nom TEXT, ordre INTEGER, faite INTEGER DEFAULT 0)`);
  const ajouter = (item, nom) => db.prepare(SQL_AJOUT_ETAPE).run(item, nom, item);
  ajouter(1, "a"); // liste vide : ordre 0
  ajouter(1, "b");
  ajouter(2, "autre tâche");
  db.exec("UPDATE etapes SET faite = 1 WHERE nom = 'a'");
  ajouter(1, "c");
  const lignes = db.prepare("SELECT nom, ordre, faite FROM etapes WHERE item_id = 1 ORDER BY ordre").all();
  assert.deepEqual(lignes.map((l) => [l.nom, l.ordre, l.faite]), [["a", 0, 1], ["b", 1, 0], ["c", 2, 0]]);
  assert.equal(db.prepare("SELECT ordre FROM etapes WHERE item_id = 2").get().ordre, 0);
});

test("tâche récurrente : les étapes de la fois en cours repartent après chaque complétion", () => {
  // Faite le mardi 13 : le mercredi 14, plus rien n'est coché ; sans complétion, la semaine compte.
  assert.equal(debutEtapesEnCours("2026-10-14", "semaine", "2026-10-13"), "2026-10-14");
  assert.equal(debutEtapesEnCours("2026-10-14", "semaine", null), "2026-10-12");
  // Une complétion de la semaine précédente ne coupe pas la semaine en cours.
  assert.equal(debutEtapesEnCours("2026-10-14", "semaine", "2026-10-09"), "2026-10-12");
});
