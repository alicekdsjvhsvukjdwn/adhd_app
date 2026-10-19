// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barresSemaine,
  boutonSommeil,
  comparer,
  coucherPour,
  decalerHeure,
  dureeSommeilMin,
  jourDuLever,
  leverOublie,
  lireCoucher,
  phraseAttente,
  positionEchelle,
  nuitRapporte,
  reponsesCompletes,
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

// ─── Sommeil en un geste ───

const c = (date, heure) => ({ date, heure });

test("nuit en cours : coucher le soir → nuit datée du lendemain, passage de minuit compris", () => {
  assert.equal(jourDuLever(c("2026-10-18", "23:30")), "2026-10-19");
  assert.equal(jourDuLever(c("2026-10-19", "00:45")), "2026-10-19"); // après minuit
  assert.equal(jourDuLever(c("2026-10-31", "22:00")), "2026-11-01"); // changement de mois
  assert.deepEqual(lireCoucher("2026-10-18 23:30"), c("2026-10-18", "23:30"));
  assert.equal(lireCoucher("n'importe quoi"), null);
  assert.equal(lireCoucher(null), null);
});

test("le grand bouton : dormir le soir, se lever avec une nuit en cours", () => {
  const b = (enCours, heure, nuitDuJourNotee = false) => boutonSommeil({ enCours, heure, nuitDuJourNotee });
  assert.equal(b(null, 22.5), "dormir");
  assert.equal(b(null, 18), "dormir");
  assert.equal(b(null, 2), "dormir"); // après minuit, pas encore couchée
  assert.equal(b(c("2026-10-18", "23:30"), 7.25), "lever");
  assert.equal(b(c("2026-10-18", "23:30"), 23.9), "lever"); // nuit en cours : toujours lever
  // Oubli du soir : en journée, nuit du jour pas notée → « Je me lève » (qui demande le coucher).
  assert.equal(b(null, 8), "lever");
  assert.equal(b(null, 8, true), "dormir");
});

test("oubli du soir : l'heure donnée au lever est rattachée à la bonne nuit", () => {
  assert.deepEqual(coucherPour("2026-10-19", "23:15"), c("2026-10-18", "23:15"));
  assert.deepEqual(coucherPour("2026-10-19", "00:30"), c("2026-10-19", "00:30"));
  assert.deepEqual(coucherPour("2026-11-01", "22:45"), c("2026-10-31", "22:45"));
  // Dans tous les cas, la nuit retombe sur le jour du lever.
  assert.equal(jourDuLever(coucherPour("2026-10-19", "23:15")), "2026-10-19");
  assert.equal(jourDuLever(coucherPour("2026-10-19", "00:30")), "2026-10-19");
});

test("oubli du matin : demandé à partir de 11 h le jour du lever, ou plus tard", () => {
  const nuit = c("2026-10-18", "23:30");
  assert.equal(leverOublie(nuit, "2026-10-19", 9), false);
  assert.equal(leverOublie(nuit, "2026-10-19", 11), true);
  assert.equal(leverOublie(nuit, "2026-10-20", 8), true); // le lendemain encore
  assert.equal(leverOublie(nuit, "2026-10-18", 23.9), false); // le soir même
  assert.equal(leverOublie(null, "2026-10-19", 15), false);
});

test("barres de la semaine : échelle commune 21 h → 11 h", () => {
  assert.equal(positionEchelle("21:00"), 0);
  assert.equal(positionEchelle("04:00"), 0.5);
  assert.equal(positionEchelle("11:00"), 1);
  assert.equal(positionEchelle("20:00"), 0); // avant le haut : borné
  assert.equal(positionEchelle("13:00"), 1); // après le bas : borné
  const jours = ["2026-10-12", "2026-10-13", "2026-10-14"];
  const barres = barresSemaine(
    [
      { date: "2026-10-12", coucher: "23:00", lever: "07:00", qualite: 3, reponses: 1 },
      { date: "2026-10-14", coucher: "00:30", lever: "06:30", qualite: 1, reponses: 1 },
    ],
    jours,
  );
  assert.deepEqual(barres[0], { date: "2026-10-12", haut: 2 / 14, bas: 10 / 14, pale: false });
  assert.deepEqual(barres[1], { date: "2026-10-13", vide: true });
  assert.equal(barres[2].pale, true); // mauvaise nuit
});

test("barres : une qualité par défaut (sans réponses) n'est pas une mauvaise nuit", () => {
  const [b] = barresSemaine(
    [{ date: "2026-10-12", coucher: "23:00", lever: "07:00", qualite: 1, reponses: 0 }],
    ["2026-10-12"],
  );
  assert.equal(b.pale, false);
});

test("réponses du matin : complètes seulement avec la qualité et les écrans", () => {
  assert.equal(reponsesCompletes({}), false);
  assert.equal(reponsesCompletes({ qualite: 2 }), false);
  assert.equal(reponsesCompletes({ ecrans: 0 }), false);
  assert.equal(reponsesCompletes({ qualite: 1, ecrans: 0 }), true);
});
