// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ETAT_NEUTRE,
  POIDS,
  RAISON_PAR_DEFAUT,
  raisonDominante,
  scoreTotal,
} from "../lib/moteur-regles.ts";

const tache = (c = {}) => ({
  urgence: 0,
  importance: 0.5,
  moment: 0.5,
  equilibre: 0.5,
  etat: ETAT_NEUTRE,
  negligence: 0,
  ...c,
});

test("les poids font 1 : le score reste entre 0 et 1", () => {
  const somme = Object.values(POIDS).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(somme - 1) < 1e-9);
});

test("État est constant : il ne change jamais l'ordre de deux tâches", () => {
  const a = tache({ urgence: 0.8 });
  const b = tache({ importance: 1 });
  assert.equal(scoreTotal(a) > scoreTotal(b), scoreTotal({ ...a, etat: 0 }) > scoreTotal({ ...b, etat: 0 }));
  const ecart = scoreTotal(tache()) - scoreTotal(tache({ etat: 0 }));
  assert.ok(Math.abs(ecart - ETAT_NEUTRE * POIDS.etat) < 1e-9);
});

test("la raison affichée ne parle jamais d'énergie", () => {
  const avecEtatSeul = tache({ importance: 0, moment: 0, equilibre: 0, etat: 1 });
  assert.equal(raisonDominante(avecEtatSeul), RAISON_PAR_DEFAUT);
  assert.notEqual(raisonDominante(tache()), "Adapté à ton énergie");
});

test("la raison suit la composante qui pèse le plus", () => {
  assert.equal(raisonDominante(tache({ urgence: 1, importance: 0, moment: 0, equilibre: 0 })), "Échéance proche");
  assert.equal(raisonDominante(tache({ importance: 1 })), "Important pour toi");
});
