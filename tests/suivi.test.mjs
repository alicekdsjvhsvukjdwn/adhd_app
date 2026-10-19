// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barresSemaine,
  comparer,
  coucherPour,
  dateDuCoucher,
  dureeSommeilMin,
  etatSommeil,
  heureLisible,
  hhmmDe,
  ilYa,
  jourDuLever,
  lireCoucher,
  minutesDe,
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

test("heures sur 24 h autour de minuit", () => {
  assert.equal(hhmmDe(minutesDe("23:50") + 15), "00:05");
  assert.equal(hhmmDe(minutesDe("00:05") - 15), "23:50");
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

test("le bouton selon l'heure et ce qui est déjà noté", () => {
  const e = (heure, enCours = null, leverNote = false) => etatSommeil({ heure, enCours, leverNote });
  const nuit = c("2026-10-18", "23:30");
  // 8 h : « Je me suis levée », avec ou sans coucher noté ; résumé si déjà fait
  assert.equal(e(8, nuit), "lever");
  assert.equal(e(8), "lever");
  assert.equal(e(8, null, true), "resume");
  // 13 h : résumé si le lever est noté, sinon le bouton discret
  assert.equal(e(13, null, true), "resume");
  assert.equal(e(13), "lever_discret");
  assert.equal(e(13, nuit), "lever_discret");
  // 23 h : dormir, ou « Couchée à … » si c'est fait
  assert.equal(e(23), "dormir");
  assert.equal(e(23, c("2026-10-19", "23:05")), "couchee");
  // 1 h du matin : encore le soir
  assert.equal(e(1), "dormir");
  assert.equal(e(1, nuit), "couchee");
  // Bornes exactes
  assert.equal(e(3.99), "dormir");
  assert.equal(e(4), "lever");
  assert.equal(e(11.99), "lever");
  assert.equal(e(12), "lever_discret");
  assert.equal(e(17.99), "lever_discret");
  assert.equal(e(18), "dormir");
});

test("raccourcis : « il y a 30 min » à 0 h 10 → 23 h 40 la veille", () => {
  assert.deepEqual(ilYa("2026-10-19", 10, 30), c("2026-10-18", "23:40"));
  assert.deepEqual(ilYa("2026-10-19", 10, 0), c("2026-10-19", "00:10"));
  assert.deepEqual(ilYa("2026-10-19", 7 * 60 + 20, 60), c("2026-10-19", "06:20"));
  assert.deepEqual(ilYa("2026-11-01", 15, 15), c("2026-11-01", "00:00"));
  assert.deepEqual(ilYa("2026-11-01", 15, 30), c("2026-10-31", "23:45"));
  assert.equal(heureLisible("23:12"), "23 h 12");
});

test("coucher ajusté : rattaché au jour le plus proche, la nuit au bon jour du lever", () => {
  // À 0 h 10, 23 h 40 est la veille : nuit du jour même
  assert.deepEqual(dateDuCoucher("2026-10-19", 10, "23:40"), c("2026-10-18", "23:40"));
  assert.equal(jourDuLever(dateDuCoucher("2026-10-19", 10, "23:40")), "2026-10-19");
  // À 23 h 50, 0 h 30 est le lendemain : nuit du jour qui suit
  assert.deepEqual(dateDuCoucher("2026-10-19", 23 * 60 + 50, "00:30"), c("2026-10-20", "00:30"));
  assert.equal(jourDuLever(dateDuCoucher("2026-10-19", 23 * 60 + 50, "00:30")), "2026-10-20");
  // À 23 h 12, 22 h 45 reste le jour même
  assert.deepEqual(dateDuCoucher("2026-10-19", 23 * 60 + 12, "22:45"), c("2026-10-19", "22:45"));
  assert.equal(jourDuLever(dateDuCoucher("2026-10-19", 23 * 60 + 12, "22:45")), "2026-10-20");
});

test("nuit sans coucher noté : l'heure donnée au lever est rattachée à la bonne nuit", () => {
  assert.deepEqual(coucherPour("2026-10-19", "23:15"), c("2026-10-18", "23:15"));
  assert.deepEqual(coucherPour("2026-10-19", "00:30"), c("2026-10-19", "00:30"));
  assert.deepEqual(coucherPour("2026-11-01", "22:45"), c("2026-10-31", "22:45"));
  // Dans tous les cas, la nuit retombe sur le jour du lever.
  assert.equal(jourDuLever(coucherPour("2026-10-19", "23:15")), "2026-10-19");
  assert.equal(jourDuLever(coucherPour("2026-10-19", "00:30")), "2026-10-19");
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
