// Lancer : npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// migrations.ts dépend d'expo-sqlite : on lit le source plutôt que de l'importer.
const source = readFileSync(new URL("../lib/db/migrations.ts", import.meta.url), "utf8");
const migrations = [...source.matchAll(/version: (\d+),\s*nom: "([^"]*)"/g)].map(
  (m) => ({ version: Number(m[1]), nom: m[2] }),
);

test("migrations : numéros uniques et croissants à partir de 1", () => {
  assert.ok(migrations.length > 0);
  migrations.forEach((m, i) => assert.equal(m.version, i + 1, m.nom));
});

test("migrations déjà appliquées sur le téléphone : jamais renommées", () => {
  const nom = (v) => migrations.find((m) => m.version === v)?.nom;
  assert.equal(nom(10), "bilan de la journée : concentration et humeur facultatives");
  assert.equal(nom(11), "listes de tâches");
  assert.equal(nom(12), "sommeil");
  assert.equal(nom(13), "sport : callisthénie guidée");
});

test("migrations 12 et suivantes : toute colonne NOT NULL a un DEFAULT", () => {
  const debut = source.indexOf("version: 12,");
  const lignes = source.slice(debut).split("\n");
  const fautives = lignes.filter(
    (l) => /NOT NULL/.test(l) && !/DEFAULT/.test(l) && !/PRIMARY KEY/.test(l),
  );
  assert.deepEqual(fautives, []);
});
