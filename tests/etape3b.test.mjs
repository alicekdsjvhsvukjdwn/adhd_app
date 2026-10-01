// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dureeParDefaut,
  dureesProposees,
  finPrevue,
  formatRestant,
  minutesEcoulees,
  prolonger,
  restantMs,
} from "../lib/minuteur.ts";

const MIN = 60_000;
const debut = Date.parse("2026-10-01T09:00:00Z");

test("sans durée : 5 minutes ; sinon la durée de la tâche", () => {
  assert.equal(dureeParDefaut(null), 5);
  assert.equal(dureeParDefaut(0), 5);
  assert.equal(dureeParDefaut(30), 30);
});

test("puces : 5, 15, 25, plus la durée de la tâche si elle est autre", () => {
  assert.deepEqual(dureesProposees(null), [5, 15, 25]);
  assert.deepEqual(dureesProposees(15), [5, 15, 25]);
  assert.deepEqual(dureesProposees(60), [5, 15, 25, 60]);
});

test("temps restant calculé depuis les heures : juste après 2 min en arrière-plan", () => {
  const fin = finPrevue(debut, 5);
  // Aucun « tic » entre les deux : seul l'instant présent compte.
  assert.equal(restantMs(fin, debut + 2 * MIN), 3 * MIN);
  assert.equal(formatRestant(restantMs(fin, debut + 2 * MIN)), "3:00");
});

test("le temps restant ne descend jamais sous zéro", () => {
  const fin = finPrevue(debut, 5);
  assert.equal(restantMs(fin, debut + 9 * MIN), 0);
  assert.equal(formatRestant(0), "0:00");
});

test("« Encore un peu » : +5 min depuis maintenant après la fin, depuis la fin avant", () => {
  const fin = finPrevue(debut, 5);
  assert.equal(prolonger(fin, debut + 8 * MIN), debut + 13 * MIN);
  assert.equal(prolonger(fin, debut + 4 * MIN), debut + 10 * MIN);
});

test("minutes passées arrondies ; un arrêt rapide donne 0", () => {
  assert.equal(minutesEcoulees(debut, debut + 20_000), 0);
  assert.equal(minutesEcoulees(debut, debut + 4 * MIN + 40_000), 5);
  assert.equal(minutesEcoulees(debut, debut - MIN), 0);
});

test("affichage « m:ss », arrondi à la seconde supérieure", () => {
  assert.equal(formatRestant(245_000), "4:05");
  assert.equal(formatRestant(244_100), "4:05");
  assert.equal(formatRestant(25 * MIN), "25:00");
});
