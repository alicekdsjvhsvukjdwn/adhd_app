// Lancer : npm test
// Rappels web : lesquels sont dus, selon l'heure, le fuseau et ce qui est déjà parti aujourd'hui.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heureLocale, rappelsDus, TEXTES, TOLERANCE_MIN } from "../push-worker/src/rappels.ts";

const PARIS = "Europe/Paris";
const reglages = (quotidien, soir) => ({
  quotidien: { actif: quotidien !== null, heure: quotidien ?? "20:00" },
  soir: { actif: soir !== null, heure: soir ?? "22:30" },
});
const a = (iso) => new Date(iso);

test("heure de Paris : été (UTC+2) et hiver (UTC+1)", () => {
  assert.deepEqual(heureLocale(a("2026-07-10T06:10:00Z"), PARIS), { date: "2026-07-10", minutes: 8 * 60 + 10 });
  assert.deepEqual(heureLocale(a("2026-12-10T07:10:00Z"), PARIS), { date: "2026-12-10", minutes: 8 * 60 + 10 });
  // Le soir tard, la date de Paris a déjà changé alors que l'UTC non.
  assert.deepEqual(heureLocale(a("2026-07-10T22:50:00Z"), PARIS), { date: "2026-07-11", minutes: 50 });
});

test("rappel quotidien : pas avant l'heure, dû dès l'heure, plus après la tolérance", () => {
  const r = reglages("08:00", null);
  assert.deepEqual(rappelsDus(a("2026-07-10T05:59:00Z"), PARIS, r, {}), []); // 07:59
  assert.deepEqual(rappelsDus(a("2026-07-10T06:00:00Z"), PARIS, r, {}), ["quotidien"]); // 08:00
  assert.deepEqual(rappelsDus(a("2026-07-10T06:59:00Z"), PARIS, r, {}), ["quotidien"]); // 08:59
  assert.equal(TOLERANCE_MIN, 60);
  assert.deepEqual(rappelsDus(a("2026-07-10T07:00:00Z"), PARIS, r, {}), []); // 09:00 : trop tard
});

test("l'heure suit le fuseau : même instant UTC, pas dû l'hiver", () => {
  const r = reglages("08:00", null);
  assert.deepEqual(rappelsDus(a("2026-07-10T06:10:00Z"), PARIS, r, {}), ["quotidien"]); // 08:10 en été
  assert.deepEqual(rappelsDus(a("2026-12-10T06:10:00Z"), PARIS, r, {}), []); // 07:10 en hiver
  assert.deepEqual(rappelsDus(a("2026-12-10T07:10:00Z"), PARIS, r, {}), ["quotidien"]);
});

test("une seule fois par jour, et de nouveau le lendemain", () => {
  const r = reglages("08:00", null);
  const maintenant = a("2026-07-10T06:15:00Z");
  assert.deepEqual(rappelsDus(maintenant, PARIS, r, { quotidien: "2026-07-10" }), []);
  assert.deepEqual(rappelsDus(a("2026-07-11T06:15:00Z"), PARIS, r, { quotidien: "2026-07-10" }), ["quotidien"]);
  // Le cron repasse 15 min plus tard : toujours dans la tolérance, mais déjà envoyé.
  assert.deepEqual(rappelsDus(a("2026-07-10T06:30:00Z"), PARIS, r, { quotidien: "2026-07-10" }), []);
});

test("rappels inactifs jamais envoyés ; les deux peuvent être dus ensemble", () => {
  assert.deepEqual(rappelsDus(a("2026-07-10T06:10:00Z"), PARIS, reglages(null, null), {}), []);
  assert.deepEqual(rappelsDus(a("2026-07-10T06:10:00Z"), PARIS, reglages("08:00", "08:05"), {}), ["quotidien", "soir"]);
  // Le soir déjà envoyé n'empêche pas le quotidien.
  assert.deepEqual(rappelsDus(a("2026-07-10T06:10:00Z"), PARIS, reglages("08:00", "08:05"), { soir: "2026-07-10" }), ["quotidien"]);
});

test("rappel du soir passé minuit : compté sur la date de Paris", () => {
  const r = reglages(null, "00:30");
  // 22:50 UTC le 10 = 00:50 Paris le 11 ; le rappel parti le 10 ne bloque pas celui du 11.
  assert.deepEqual(rappelsDus(a("2026-07-10T22:50:00Z"), PARIS, r, { soir: "2026-07-10" }), ["soir"]);
  assert.deepEqual(rappelsDus(a("2026-07-10T22:50:00Z"), PARIS, r, { soir: "2026-07-11" }), []);
});

test("toucher un rappel ouvre le bon onglet", () => {
  assert.equal(TEXTES.quotidien.url, "/");
  assert.equal(TEXTES.soir.url, "/suivi");
});
