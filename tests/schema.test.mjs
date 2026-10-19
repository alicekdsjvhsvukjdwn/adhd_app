// Lancer : npm test
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  SQL_CATEGORIES_RECOMPENSES,
  SQL_COULEURS_LISTES,
  SQL_SKILLS_DEPUIS_PALIERS,
  SQL_LIGNES_DE_BASE,
  SQL_MOMENTS,
  SQL_TABLES_HORS_MIGRATIONS,
  SQL_VERSIONS_EN_ETAPES,
  transformationsApres,
} from "../lib/schema.ts";

// Colonnes utiles des vraies tables (migrations 2, 8, 14).
const baseItems = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE items (id INTEGER PRIMARY KEY, nom TEXT, type TEXT, moment TEXT,
      version_courte TEXT, version_longue TEXT);
    CREATE TABLE etapes (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL,
      nom TEXT NOT NULL, ordre INTEGER NOT NULL, faite INTEGER NOT NULL DEFAULT 0,
      faite_le TEXT, essentielle INTEGER NOT NULL DEFAULT 1);
  `);
  return db;
};
const etapes = (db, id) =>
  db
    .prepare("SELECT nom, essentielle FROM etapes WHERE item_id = ? ORDER BY ordre, id")
    .all(id)
    .map((e) => [e.nom, e.essentielle]);

test("18 : une base existante garde ses lignes ; une vieille table stats reste lisible", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE stats (id INTEGER PRIMARY KEY CHECK (id = 1), points_total INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0);
    INSERT INTO stats VALUES (1, 340, 4);
    CREATE TABLE ancres (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, moment TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0);
    INSERT INTO ancres (nom, moment, active) VALUES ('Mon café', 'matin', 1);
  `);
  db.exec(SQL_TABLES_HORS_MIGRATIONS);
  db.exec(SQL_TABLES_HORS_MIGRATIONS); // rejouable
  db.exec(SQL_LIGNES_DE_BASE);
  assert.equal(db.prepare("SELECT points_total FROM stats").get().points_total, 340);
  // Des moments repères existent déjà : rien n'est ajouté.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ancres").get().n, 1);
  for (const t of ["preferences", "event_log", "meta"]) {
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = ?").get(t), t);
  }
});

test("18 : base neuve, les lignes de départ une seule fois", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(SQL_TABLES_HORS_MIGRATIONS);
  db.exec(SQL_LIGNES_DE_BASE);
  db.exec(SQL_LIGNES_DE_BASE);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stats").get().n, 1);
  const ancres = db.prepare("SELECT nom, moment FROM ancres ORDER BY id").all();
  assert.equal(ancres.length, 8);
  assert.equal(ancres[0].nom, "Le réveil");
  assert.equal(ancres[5].moment, "apres_midi");
});

test("19 : une seule orthographe, « indifférent » devient sans moment", () => {
  const db = baseItems();
  db.exec(`INSERT INTO items (id, moment) VALUES (1, 'apres-midi'), (2, 'apres_midi'), (3, 'indifferent'), (4, 'soir')`);
  db.exec(SQL_MOMENTS);
  assert.deepEqual(
    db.prepare("SELECT moment FROM items ORDER BY id").all().map((r) => r.moment),
    ["apres_midi", "apres_midi", null, "soir"],
  );
});

test("20 : versions écrites à la main → étapes, selon la règle", () => {
  const db = baseItems();
  db.exec(`
    INSERT INTO items (id, nom, type, version_courte, version_longue) VALUES
      (1, 'Ranger 10 min', 'routine', 'Ranger 2 min', NULL),
      (2, 'Marcher 20 min', 'routine', '  ', 'Marcher 45 min'),
      (3, 'Lire 10 pages', 'routine', 'Lire 1 page', 'Lire 30 pages'),
      (4, 'Rien', 'routine', NULL, NULL),
      (5, 'Déjà à étapes', 'routine', 'court', 'long'),
      (6, 'Une tâche', 'tache', 'court', NULL);
    INSERT INTO etapes (item_id, nom, ordre, essentielle) VALUES (5, 'Mon étape', 0, 1);
  `);
  db.exec(SQL_VERSIONS_EN_ETAPES);
  assert.deepEqual(etapes(db, 1), [["Ranger 2 min", 1], ["Ranger 10 min", 0]]);
  assert.deepEqual(etapes(db, 2), [["Marcher 20 min", 1], ["Marcher 45 min", 0]]);
  assert.deepEqual(etapes(db, 3), [["Lire 1 page", 1], ["Lire 10 pages", 0], ["Lire 30 pages", 0]]);
  assert.deepEqual(etapes(db, 4), []);
  assert.deepEqual(etapes(db, 5), [["Mon étape", 1]]);
  assert.deepEqual(etapes(db, 6), []);

  // Rejouée (après une restauration) : rien en double.
  db.exec(SQL_VERSIONS_EN_ETAPES);
  assert.deepEqual(etapes(db, 3), [["Lire 1 page", 1], ["Lire 10 pages", 0], ["Lire 30 pages", 0]]);
  // Les colonnes restent lisibles pour l'analyse.
  assert.equal(db.prepare("SELECT version_courte FROM items WHERE id = 1").get().version_courte, "Ranger 2 min");
});

test("restauration : on ne rejoue que ce que la sauvegarde n'a pas connu", () => {
  const C = SQL_CATEGORIES_RECOMPENSES;
  const S = SQL_SKILLS_DEPUIS_PALIERS;
  assert.deepEqual(transformationsApres(17), [SQL_MOMENTS, SQL_VERSIONS_EN_ETAPES, SQL_COULEURS_LISTES, C, S]);
  assert.deepEqual(transformationsApres(19), [SQL_VERSIONS_EN_ETAPES, SQL_COULEURS_LISTES, C, S]);
  assert.deepEqual(transformationsApres(20), [SQL_COULEURS_LISTES, C, S]);
  assert.deepEqual(transformationsApres(21), [C, S]);
  assert.deepEqual(transformationsApres(22), [SQL_SKILLS_DEPUIS_PALIERS]);
  assert.deepEqual(transformationsApres(23), []);
});

test("21 : anciennes couleurs de listes remappées une à une, rejouable", async () => {
  const { ANCIENNES_CLES, COULEURS_LISTES } = await import("../lib/theme-listes.ts");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE listes (id INTEGER PRIMARY KEY, couleur TEXT)");
  const anciennes = Object.keys(ANCIENNES_CLES);
  anciennes.forEach((c, i) => db.prepare("INSERT INTO listes VALUES (?, ?)").run(i + 1, c));
  db.prepare("INSERT INTO listes VALUES (99, NULL)").run();
  db.exec(SQL_COULEURS_LISTES);
  db.exec(SQL_COULEURS_LISTES);
  const apres = db.prepare("SELECT couleur FROM listes WHERE id < 99 ORDER BY id").all().map((r) => r.couleur);
  // La migration recopie bien la correspondance du code.
  assert.deepEqual(apres, anciennes.map((c) => ANCIENNES_CLES[c]));
  // Toutes connues de la nouvelle palette, et toutes différentes.
  for (const c of apres) assert.ok(c in COULEURS_LISTES, c);
  assert.equal(new Set(apres).size, anciennes.length);
  assert.equal(db.prepare("SELECT couleur FROM listes WHERE id = 99").get().couleur, null);
});
