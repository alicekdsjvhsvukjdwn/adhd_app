// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  comparer,
  decalerHeure,
  dureeSommeilMin,
  ecartTypeCoucherMin,
  nbPaliers,
  palierDepart,
  phraseAttente,
  phraseRegularite,
  proposerMontee,
  nuitRapporte,
} from "../lib/suivi-regles.ts";

test("durée de sommeil : passage de minuit, même jour, nuit nulle", () => {
  assert.equal(dureeSommeilMin("23:30", "07:00"), 450);
  assert.equal(dureeSommeilMin("00:30", "07:15"), 405);
  assert.equal(dureeSommeilMin("22:00", "06:00"), 480);
  assert.equal(dureeSommeilMin("14:00", "15:30"), 90); // sieste
  assert.equal(dureeSommeilMin("07:00", "07:00"), 0);
});

test("±15 min autour de minuit reste sur 24 h", () => {
  assert.equal(decalerHeure("23:50", 15), "00:05");
  assert.equal(decalerHeure("00:05", -15), "23:50");
});

test("régularité : 23:30 et 00:30 sont à une heure, pas à 23", () => {
  assert.equal(ecartTypeCoucherMin(["23:30", "00:30"]), 30);
  assert.equal(ecartTypeCoucherMin(["23:00"]), null);
  assert.match(phraseRegularite(30), /très régulier/);
  assert.match(phraseRegularite(45), /assez régulier/);
  assert.match(phraseRegularite(120), /^Coucher irrégulier/);
});

const ok = (fin) => ({ fin, realise: [12, 12, 13] });
const rate = (fin) => ({ fin, realise: [12, 11, 12] });
const base = { haut: 12, palierActuel: 2, palierMax: 6, dernierRefus: null };

test("montée : 2 séances réussies d'affilée au palier", () => {
  assert.equal(proposerMontee({ ...base, seances: [ok("2026-10-12"), ok("2026-10-10")] }), true);
  assert.equal(proposerMontee({ ...base, seances: [ok("2026-10-12")] }), false);
  // la plus récente ratée : on attend
  assert.equal(proposerMontee({ ...base, seances: [rate("2026-10-12"), ok("2026-10-10"), ok("2026-10-08")] }), false);
  // une séance partielle (2 séries) n'est pas réussie
  assert.equal(proposerMontee({ ...base, seances: [{ fin: "2026-10-12", realise: [12, 12] }, ok("2026-10-10")] }), false);
});

test("montée : jamais au dernier palier, et 2 nouvelles réussites après un refus", () => {
  const s = [ok("2026-10-12"), ok("2026-10-10")];
  assert.equal(proposerMontee({ ...base, seances: s, palierActuel: 6 }), false);
  assert.equal(proposerMontee({ ...base, seances: s, dernierRefus: "2026-10-11" }), false);
  assert.equal(proposerMontee({ ...base, seances: s, dernierRefus: "2026-10-09" }), true);
});

test("Tirer : 5 paliers avec barre, rowings seulement sans barre", () => {
  assert.equal(nbPaliers("tirer", true), 5);
  assert.equal(nbPaliers("tirer", false), 2);
  assert.equal(palierDepart("tirer", 4, false), 2);
  assert.equal(palierDepart("pousser", "inconnu", false), 2);
  assert.equal(palierDepart("jambes", "inconnu", false), 1);
});

test("seuil des 7 jours dans chaque groupe", () => {
  const sept = [1, 1, 1, 1, 1, 1, 1];
  assert.deepEqual(comparer(sept, [0, 0, 0]), { ok: false, avancement: 3 });
  assert.equal(phraseAttente({ avancement: 3 }), "Pas encore assez de données (3/7)");
  assert.deepEqual(comparer(sept, [...sept, 1].map((x) => x * 0.5)), {
    ok: true, moyA: 1, moyB: 0.5, nA: 7, nB: 8,
  });
  assert.deepEqual(comparer([...sept, ...sept], []), { ok: false, avancement: 0 });
});

test("nuits : des points pour les 7 derniers jours seulement", () => {
  assert.equal(nuitRapporte("2026-10-18", "2026-10-18"), true);
  assert.equal(nuitRapporte("2026-10-12", "2026-10-18"), true);
  assert.equal(nuitRapporte("2026-10-11", "2026-10-18"), false);
  assert.equal(nuitRapporte("2026-10-19", "2026-10-18"), false);
  // Changement d'heure (25 octobre) : toujours 7 jours de calendrier.
  assert.equal(nuitRapporte("2026-10-20", "2026-10-26"), true);
  assert.equal(nuitRapporte("2026-10-19", "2026-10-26"), false);
});
