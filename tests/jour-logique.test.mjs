// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { definirDebutJour, getDebutJour, jourLogique } from "../lib/dates.ts";

// Dates construites en heure locale : le test vaut quel que soit le fuseau de la machine.
const L = (m, j, h, mi = 0) => new Date(2026, m - 1, j, h, mi);

test("la journée commence à 6 h : 23 h, 1 h, 5 h 59, 6 h", () => {
  assert.equal(jourLogique(L(10, 21, 23), 6), "2026-10-21");
  assert.equal(jourLogique(L(10, 22, 1), 6), "2026-10-21");
  assert.equal(jourLogique(L(10, 22, 5, 59), 6), "2026-10-21");
  assert.equal(jourLogique(L(10, 22, 6), 6), "2026-10-22");
});

test("heure de début réglable, et valeur hors 4–8 refusée", () => {
  assert.equal(jourLogique(L(10, 22, 4, 30), 4), "2026-10-22");
  assert.equal(jourLogique(L(10, 22, 7, 59), 8), "2026-10-21");
  definirDebutJour(7);
  assert.equal(getDebutJour(), 7);
  assert.equal(jourLogique(L(10, 22, 6, 30)), "2026-10-21");
  definirDebutJour(12);
  assert.equal(getDebutJour(), 6);
  definirDebutJour(NaN);
  assert.equal(getDebutJour(), 6);
});

test("changements d'heure (29 mars et 25 octobre 2026) et passages de mois / d'année", () => {
  assert.equal(jourLogique(L(3, 29, 5, 59), 6), "2026-03-28");
  assert.equal(jourLogique(L(3, 29, 6), 6), "2026-03-29");
  assert.equal(jourLogique(L(10, 25, 5, 59), 6), "2026-10-24");
  assert.equal(jourLogique(L(10, 25, 6), 6), "2026-10-25");
  assert.equal(jourLogique(L(11, 1, 2), 6), "2026-10-31");
  assert.equal(jourLogique(L(1, 1, 3), 6), "2025-12-31");
});
