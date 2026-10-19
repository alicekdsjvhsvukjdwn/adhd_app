// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aEnregistrer,
  guidageA,
  MEDITATIONS,
  phaseA,
  secondesEcoulees,
} from "../lib/meditations.ts";

const m = (id) => MEDITATIONS.find((x) => x.id === id);

test("catalogue : 4 séances, durées annoncées, audio prévu vide", () => {
  assert.deepEqual(
    MEDITATIONS.map((x) => [x.id, x.duree_s]),
    [["pause", 60], ["carre", 180], ["corps", 600], ["nuit", 480]],
  );
  for (const x of MEDITATIONS) {
    assert.equal(x.audio, null);
    assert.equal(x.guidage[0].a_s, 0);
  }
});

test("minuteur : arrêt avant 1 min = rien, à 1 min ou au bout = enregistrée", () => {
  assert.equal(aEnregistrer(0, 600), false);
  assert.equal(aEnregistrer(59, 600), false);
  assert.equal(aEnregistrer(60, 600), true);
  assert.equal(aEnregistrer(60, 60), true); // la pause d'une minute, terminée
  // Le temps se calcule depuis le départ, borné à la durée.
  assert.equal(secondesEcoulees(1000, 1000 + 59_900, 600), 59);
  assert.equal(secondesEcoulees(0, 10 * 60_000, 180), 180);
  assert.equal(secondesEcoulees(5000, 1000, 180), 0);
});

test("respiration carrée : inspire 4 · bloque 4 · expire 4 · bloque 4", () => {
  const r = m("carre").respiration;
  assert.deepEqual(phaseA(r, 0), { phase: "inspire", part: 0 });
  assert.deepEqual(phaseA(r, 2), { phase: "inspire", part: 0.5 });
  assert.equal(phaseA(r, 4).phase, "bloque");
  assert.equal(phaseA(r, 8).phase, "expire");
  assert.equal(phaseA(r, 12).phase, "bloqueVide");
  assert.equal(phaseA(r, 16).phase, "inspire"); // nouveau cycle
  // Sans pause : inspire puis expire seulement.
  assert.equal(phaseA(m("pause").respiration, 5).phase, "expire");
});

test("guidage : la ligne en cours selon le temps", () => {
  const p = m("pause");
  assert.equal(guidageA(p, 0), p.guidage[0].texte);
  assert.equal(guidageA(p, 14), p.guidage[0].texte);
  assert.equal(guidageA(p, 15), p.guidage[1].texte);
  assert.equal(guidageA(p, 60), p.guidage[3].texte);
});
