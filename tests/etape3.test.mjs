// Lancer : npm test
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  nomApresVariante,
  requeteModification,
  SQL_SUPPRESSION_ITEM,
} from "../lib/modification-item.ts";
import { ordreJourDifficile } from "../lib/moteur-regles.ts";
import {
  miseDeCote,
  momentStocke,
  trancheDeHeure,
  trancheDeRoutine,
  trancheDuMoment,
} from "../lib/moments.ts";

test("bornes des moments : 12 h et 18 h", () => {
  assert.equal(trancheDeHeure(11.99), "matin");
  assert.equal(trancheDeHeure(12), "apres_midi");
  assert.equal(trancheDeHeure(17.99), "apres_midi");
  assert.equal(trancheDeHeure(18), "soir");
});

test("réveil, midi et coucher rangés dans le bon moment ; sans moment : À tout moment", () => {
  const t = (moment) => trancheDeRoutine({ moment, ancre_moment: null });
  assert.equal(t("reveil"), "matin");
  assert.equal(t("midi"), "apres_midi");
  assert.equal(t("apres_midi"), "apres_midi");
  assert.equal(t("coucher"), "soir");
  assert.equal(t(null), "a_tout_moment");
  assert.equal(t("indifferent"), "a_tout_moment");
});

test("une seule orthographe stockée : l'ancienne est corrigée, l'inconnu devient null", () => {
  assert.equal(momentStocke("apres-midi"), "apres_midi");
  assert.equal(momentStocke("apres_midi"), "apres_midi");
  assert.equal(momentStocke("indifferent"), null);
  assert.equal(momentStocke(undefined), null);
  assert.equal(trancheDuMoment("apres-midi"), "apres_midi");
});

test("le moment repère prime sur le moment déclaré", () => {
  assert.equal(trancheDeRoutine({ moment: "matin", ancre_moment: "coucher" }), "soir");
});

test("jour difficile : seules les exigeantes non faites sont mises de côté", () => {
  const r = (effort, faitAujourdhui = false) => ({ effort, faitAujourdhui });
  assert.equal(miseDeCote(r(3), true), true);
  assert.equal(miseDeCote(r(3, true), true), false);
  assert.equal(miseDeCote(r(2), true), false);
  assert.equal(miseDeCote(r(null), true), false);
  assert.equal(miseDeCote(r(3), false), false);
});

test("tâche unique : la prochaine étape d'une tâche découpée passe d'abord", () => {
  const classement = [
    { itemId: 1, duree_min: 10 },
    { itemId: 2, duree_min: null },
    { itemId: 3, duree_min: 60 },
  ];
  const ordre = ordreJourDifficile(classement, (id) => id === 3);
  assert.deepEqual(ordre.map((t) => t.itemId), [3, 1, 2]);
});

test("tâche unique : sinon la plus petite (≤ 15 min) la mieux classée, sans priorité aux échéances", () => {
  const classement = [
    { itemId: 1, duree_min: 60 },
    { itemId: 2, duree_min: null },
    { itemId: 3, duree_min: 15 },
    { itemId: 4, duree_min: 5 },
  ];
  const ordre = ordreJourDifficile(classement, () => false);
  assert.deepEqual(ordre.map((t) => t.itemId), [3, 1, 2, 4]);
});

test("changer le moment repère : complétions passées intactes, nouvelle section", () => {
  // Colonnes utiles des vraies tables (migration 2, ancres.ts) ; la requête est la vraie.
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE items (id INTEGER PRIMARY KEY, nom TEXT, type TEXT, moment TEXT,
      ancre_id INTEGER, ancre_position TEXT, nb_completions INTEGER, maj_le TEXT);
    CREATE TABLE completions (id INTEGER PRIMARY KEY, item_id INTEGER, date TEXT,
      statut TEXT, heure REAL, version TEXT);
    CREATE TABLE ancres (id INTEGER PRIMARY KEY, nom TEXT, moment TEXT, active INTEGER);
    INSERT INTO ancres VALUES (1, 'Café', 'matin', 1), (2, 'Dîner', 'soir', 1);
    INSERT INTO items VALUES (7, 'Lire 5 pages', 'routine', 'matin', 1, 'apres', 2, '2026-09-01');
    INSERT INTO completions VALUES
      (1, 7, '2026-09-29', 'complet', 8.5, 'normale'),
      (2, 7, '2026-09-30', 'complet', 9.0, 'courte');
  `);
  const avant = db.prepare("SELECT * FROM completions ORDER BY id").all();

  const routine = () =>
    db
      .prepare(
        `SELECT i.moment, a.moment AS ancre_moment, i.ancre_position, i.nb_completions
         FROM items i LEFT JOIN ancres a ON a.id = i.ancre_id WHERE i.id = 7`,
      )
      .get();
  const section = () => trancheDeRoutine(routine());
  assert.equal(section(), "matin");

  const q = requeteModification(
    7,
    { ancre_id: 2, ancre_position: "avant", nb_completions: 0 },
    "2026-10-01T10:00:00Z",
  );
  db.prepare(q.sql).run(...q.params);

  assert.deepEqual(db.prepare("SELECT * FROM completions ORDER BY id").all(), avant);
  assert.equal(section(), "soir");
  assert.equal(routine().ancre_position, "avant");
  // Un champ hors liste (nb_completions) n'est jamais écrit.
  assert.equal(routine().nb_completions, 2);

  // Retirer le moment repère : la routine revient à son moment déclaré.
  const q2 = requeteModification(7, { ancre_id: null, ancre_position: null }, "2026-10-01T10:01:00Z");
  db.prepare(q2.sql).run(...q2.params);
  assert.equal(section(), "matin");
  assert.deepEqual(db.prepare("SELECT * FROM completions ORDER BY id").all(), avant);
});

test("aucune modification sans champ autorisé", () => {
  assert.equal(requeteModification(1, { nb_completions: 3 }, "x"), null);
});

test("tâche unique : sinon la première du classement ; liste vide sans tâche", () => {
  const classement = [{ itemId: 7, duree_min: null }, { itemId: 8, duree_min: 30 }];
  assert.deepEqual(ordreJourDifficile(classement, () => false).map((t) => t.itemId), [7, 8]);
  assert.deepEqual(ordreJourDifficile([], () => false), []);
});

test("suggestion simplifier / monter : un nom choisi à la main reste", () => {
  assert.equal(nomApresVariante("Marcher 10 min", "Marcher 10 min", "Marcher 5 min"), "Marcher 5 min");
  assert.equal(nomApresVariante("Ma balade du soir", "Marcher 10 min", "Marcher 5 min"), "Ma balade du soir");
  assert.equal(nomApresVariante("Marcher 10 min", null, "Marcher 5 min"), "Marcher 10 min");
});

test("supprimer un item : ses lignes dépendantes partent, l'analyse reste", () => {
  const db = new DatabaseSync(":memory:");
  const tables = ["etapes_cochees", "etapes", "notes", "suggestions", "sessions", "completions", "decision_log", "event_log"];
  db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, nom TEXT)");
  db.exec("INSERT INTO items VALUES (1, 'gardé'), (2, 'supprimé')");
  for (const t of tables) {
    const col = t === "event_log" ? "routine_id" : "item_id";
    db.exec(`CREATE TABLE ${t} (id INTEGER PRIMARY KEY, ${col} INTEGER)`);
    db.exec(`INSERT INTO ${t} (${col}) VALUES (1), (2)`);
  }
  for (const sql of SQL_SUPPRESSION_ITEM) db.prepare(sql).run(2);
  const n = (t) => {
    const col = t === "event_log" ? "routine_id" : "item_id";
    return db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = 2`).get().n;
  };
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM items").get().n, 1);
  for (const t of ["etapes_cochees", "etapes", "notes", "suggestions", "sessions"]) assert.equal(n(t), 0, t);
  for (const t of ["completions", "decision_log", "event_log"]) assert.equal(n(t), 1, t);
  // L'autre item n'est pas touché.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM etapes WHERE item_id = 1").get().n, 1);
});
