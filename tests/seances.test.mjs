// Lancer : npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { exercice, EXERCICES } from "../lib/exercices.ts";
import { SQL_TABLES_SEANCES_GUIDEES } from "../lib/schema.ts";
import { deroule, faiteLe, REVEIL_DEFAUT, ZONES } from "../lib/seances.ts";
import { SKILLS } from "../lib/skills.ts";

// FigureSkill.tsx dépend de react-native : on lit le source.
const figures = readFileSync(new URL("../components/FigureSkill.tsx", import.meta.url), "utf8");

test("bibliothèque : ids uniques, bonhomme dessiné, zones connues", () => {
  const ids = EXERCICES.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const x of EXERCICES) {
    assert.match(figures, new RegExp(`\n  ${x.figure}: \{ d:`), `${x.id} → ${x.figure}`);
    for (const z of x.zones) assert.ok(ZONES.some((y) => y.cle === z), `${x.id} → ${z}`);
  }
});

test("les étapes des skills portent le nom de l'exercice quand c'est le même mouvement", () => {
  const etapes = new Set(SKILLS.flatMap((s) => s.etapes.map((e) => e.nom)));
  for (const nom of ["Pompes", "Pompes inclinées", "Pompes sur les genoux", "Pike push-ups", "Dips sur banc", "Squat", "Fente", "Squat bulgare", "Planche", "Hollow body hold"]) {
    assert.ok(etapes.has(nom), nom);
    assert.ok(EXERCICES.some((x) => x.nom === nom), nom);
  }
});

test("routine du matin : exercices existants, sans doublon", () => {
  for (const id of REVEIL_DEFAUT.exercices) assert.ok(exercice(id), id);
  assert.equal(new Set(REVEIL_DEFAUT.exercices).size, REVEIL_DEFAUT.exercices.length);
});

test("routine du matin : 6 exercices, 45 s / 15 s", () => {
  assert.deepEqual(REVEIL_DEFAUT.exercices.map((id) => exercice(id).nom), [
    "Pike shoulder taps",
    "Reverse snow angels",
    "Pont fessier",
    "Planche latérale avec rotation",
    "Hollow body hold",
    "Squat",
  ]);
  assert.equal(REVEIL_DEFAUT.effort_s, 45);
  assert.equal(REVEIL_DEFAUT.repos_s, 15);
});

test("déroulé : effort et repos alternés, pas de repos à la fin, tours dans l'ordre", () => {
  const s = { ...REVEIL_DEFAUT, exercices: ["squat", "pont"], tours: 2 };
  assert.deepEqual(
    deroule(s).map((x) => `${x.type}:${x.exercice}:${x.tour}`),
    ["effort:squat:1", "repos:pont:1", "effort:pont:1", "repos:squat:2", "effort:squat:2", "repos:pont:2", "effort:pont:2"],
  );
  assert.equal(deroule({ ...s, repos_s: 0 }).length, 4);
  assert.deepEqual(deroule({ ...s, exercices: [] }), []);
});

test("faite hier / aujourd'hui", () => {
  assert.equal(faiteLe("2026-10-19", "2026-10-19", "2026-10-18"), "Faite aujourd'hui");
  assert.equal(faiteLe("2026-10-18", "2026-10-19", "2026-10-18"), "Faite hier");
  assert.equal(faiteLe("2026-10-10", "2026-10-19", "2026-10-18"), null);
  assert.equal(faiteLe(null, "2026-10-19", "2026-10-18"), null);
});

test("migration 24 : tables créées, rejouable, une seule séance perso", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(SQL_TABLES_SEANCES_GUIDEES);
  db.exec(SQL_TABLES_SEANCES_GUIDEES);
  db.exec("INSERT INTO seances_guidees (date, seance) VALUES ('2026-10-19', 'reveil')");
  db.exec("INSERT OR REPLACE INTO seance_perso (id, exercices) VALUES (1, 'squat')");
  db.exec("INSERT OR REPLACE INTO seance_perso (id, exercices) VALUES (1, 'pont')");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM seance_perso").get().n, 1);
  assert.throws(() => db.exec("INSERT INTO seance_perso (id) VALUES (2)"));
  assert.equal(db.prepare("SELECT effort_s, repos_s FROM seance_perso").get().effort_s, 45);
});
