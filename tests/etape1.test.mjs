// Lancer : npm test (Node 24 lit le TypeScript sans compilation)
import assert from "node:assert/strict";
import { test } from "node:test";
import { coutTache, scoreEtat } from "../lib/score-etat.ts";

test("sans durée ni énergie, la composante État est neutre", () => {
  assert.equal(coutTache(null), 0.5);
  assert.equal(scoreEtat(null, null), 1); // coût 0.5 ≤ énergie neutre 0.5
});

test("une tâche sans durée n'est jamais pénalisée plus qu'à moitié", () => {
  assert.equal(scoreEtat(null, 1), 0.5);
  assert.equal(scoreEtat(null, 3), 1);
});

test("le coût se lit dans la durée, plafonné à 1 h", () => {
  assert.equal(coutTache(15), 0.25);
  assert.equal(coutTache(60), 1);
  assert.equal(coutTache(120), 1);
});

test("énergie basse : une longue tâche passe derrière une courte", () => {
  assert.ok(scoreEtat(60, 1) < scoreEtat(5, 1));
  assert.equal(scoreEtat(60, 1), 0);
});

test("énergie haute : la durée ne pénalise plus", () => {
  assert.equal(scoreEtat(60, 3), 1);
  assert.equal(scoreEtat(5, 3), 1);
});
