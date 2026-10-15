// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { echapperCsv, lisezmoi, versCsv } from "../lib/csv.ts";

test("échappement : virgules, guillemets, retours à la ligne", () => {
  assert.equal(echapperCsv("simple"), "simple");
  assert.equal(echapperCsv("a,b"), '"a,b"');
  assert.equal(echapperCsv('dit "oui"'), '"dit ""oui"""');
  assert.equal(echapperCsv("ligne1\nligne2"), '"ligne1\nligne2"');
  assert.equal(echapperCsv("a\r\nb"), '"a\r\nb"');
  assert.equal(echapperCsv(" espace"), '" espace"');
  assert.equal(echapperCsv(null), "");
  assert.equal(echapperCsv(0), "0");
  assert.equal(echapperCsv(7.5), "7.5");
});

test("datetime SQLite en ISO, le reste inchangé", () => {
  assert.equal(echapperCsv("2026-10-15 08:30:00"), "2026-10-15T08:30:00Z");
  assert.equal(echapperCsv("2026-10-15"), "2026-10-15");
  assert.equal(echapperCsv("2026-10-15T08:30:00.000Z"), "2026-10-15T08:30:00.000Z");
});

test("CSV : en-têtes, colonnes dans l'ordre, NULL vide, CRLF", () => {
  const csv = versCsv(["id", "nom", "note"], [
    { id: 1, nom: "Café, croissant", note: null },
    { nom: 'Le "vrai"', id: 2, note: "x" },
  ]);
  assert.equal(csv, 'id,nom,note\r\n1,"Café, croissant",\r\n2,"Le ""vrai""",x\r\n');
});

test("LISEZMOI : chaque colonne exportée est listée", () => {
  const txt = lisezmoi(
    [{ nom: "sommeil", colonnes: ["date", "qualite", "inconnue"], lignes: 3 }],
    "2026-10-15",
  );
  assert.match(txt, /sommeil\.csv {2}\(3 lignes\)/);
  assert.match(txt, /qualite : qualité ressentie : 1 = mauvaise/);
  assert.match(txt, /inconnue : \(non documentée\)/);
});
