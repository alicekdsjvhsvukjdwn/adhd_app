// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { indexSemaine, moisDeSemaine, semaineDe, SEMAINES_BANDE } from "../lib/regles-taches.ts";

test("lundi → dimanche d'une même semaine : même index", () => {
  // 2026-10-21 est un mercredi
  for (const j of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-25"]) assert.equal(indexSemaine("2026-10-21", j), SEMAINES_BANDE);
  assert.equal(indexSemaine("2026-10-21", "2026-10-26"), SEMAINES_BANDE + 1);
  assert.equal(indexSemaine("2026-10-21", "2026-10-18"), SEMAINES_BANDE - 1);
});

test("aujourd'hui un dimanche : toujours la semaine du lundi précédent", () => {
  assert.equal(indexSemaine("2026-10-25", "2026-10-19"), SEMAINES_BANDE);
  assert.equal(indexSemaine("2026-10-25", "2026-10-26"), SEMAINES_BANDE + 1);
});

test("changement d'année", () => {
  assert.equal(indexSemaine("2026-12-30", "2027-01-04"), SEMAINES_BANDE + 1);
  assert.equal(indexSemaine("2027-01-02", "2026-12-28"), SEMAINES_BANDE);
  assert.equal(indexSemaine("2026-12-30", "2025-12-31"), SEMAINES_BANDE - 52);
});

test("mois affiché : celui du jeudi", () => {
  assert.equal(moisDeSemaine(semaineDe("2026-10-21")), "octobre 2026");
  // lundi 29 déc. 2025 → dimanche 4 janv. 2026 : jeudi 1er janvier
  assert.equal(moisDeSemaine(semaineDe("2025-12-30")), "janvier 2026");
  assert.equal(moisDeSemaine(semaineDe("2026-11-01")), "octobre 2026");
});
