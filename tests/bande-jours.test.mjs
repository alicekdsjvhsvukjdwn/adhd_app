// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { moisDeSemaine, semaineDe } from "../lib/regles-taches.ts";

test("mois affiché : celui du jeudi", () => {
  assert.equal(moisDeSemaine(semaineDe("2026-10-21")), "octobre 2026");
  // lundi 29 déc. 2025 → dimanche 4 janv. 2026 : jeudi 1er janvier
  assert.equal(moisDeSemaine(semaineDe("2025-12-30")), "janvier 2026");
  assert.equal(moisDeSemaine(semaineDe("2026-11-01")), "octobre 2026");
});
