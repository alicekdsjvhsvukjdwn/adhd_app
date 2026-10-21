// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { analyserIcs } from "../push-worker/src/ics.ts";

const ics = (...evts) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...evts.flatMap((e) => ["BEGIN:VEVENT", ...e, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
const AUJ = "2026-10-21"; // fenêtre : 14 octobre → 20 décembre
const liste = (...evts) => analyserIcs(ics(...evts), AUJ).map((e) => `${e.jour} ${e.debut ?? "journée"}${e.fin ? "-" + e.fin : ""} ${e.titre}`);

test("heure de Paris, UTC (été et hiver) et autre fuseau", () => {
  assert.deepEqual(
    liste(
      ["UID:a", "SUMMARY:Dentiste", "DTSTART;TZID=Europe/Paris:20261022T140000", "DTEND;TZID=Europe/Paris:20261022T150000"],
      ["UID:b", "SUMMARY:Été UTC", "DTSTART:20261023T080000Z", "DTEND:20261023T090000Z"], // +2 h
      ["UID:c", "SUMMARY:Hiver UTC", "DTSTART:20261130T080000Z", "DTEND:20261130T090000Z"], // +1 h
      ["UID:d", "SUMMARY:New York", "DTSTART;TZID=America/New_York:20261105T090000", "DTEND;TZID=America/New_York:20261105T100000"],
    ),
    ["2026-10-22 14:00-15:00 Dentiste", "2026-10-23 10:00-11:00 Été UTC", "2026-11-05 15:00-16:00 New York", "2026-11-30 09:00-10:00 Hiver UTC"],
  );
});

test("journée entière : un jour, plusieurs jours (fin exclue)", () => {
  assert.deepEqual(
    liste(
      ["UID:a", "SUMMARY:Férié", "DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261102"],
      ["UID:b", "SUMMARY:Vacances", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261113"],
    ),
    ["2026-11-01 journée Férié", "2026-11-10 journée Vacances", "2026-11-11 journée Vacances", "2026-11-12 journée Vacances"],
  );
});

test("hebdomadaire BYDAY, exception EXDATE, COUNT, et ligne repliée / virgule échappée", () => {
  assert.deepEqual(
    liste([
      "UID:r",
      "SUMMARY:Cours\\, salle 2 très très très très très très très très très très",
      " long",
      "DTSTART;TZID=Europe/Paris:20261012T180000",
      "DTEND;TZID=Europe/Paris:20261012T190000",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6", // 12, 14, 19, 21, 26, 28 octobre
      "EXDATE;TZID=Europe/Paris:20261021T180000",
    ]).map((s) => s.slice(0, 22)),
    ["2026-10-14 18:00-19:00", "2026-10-19 18:00-19:00", "2026-10-26 18:00-19:00", "2026-10-28 18:00-19:00"], // le 12 est hors fenêtre, le 21 est exclu
  );
  assert.match(liste(["UID:r", "SUMMARY:Cours\\, salle", " 2", "DTSTART:20261022T100000Z", "DTEND:20261022T110000Z"])[0], /Cours, salle2$/);
});

test("récurrence : l'heure du mur survit au changement d'heure du 25 octobre", () => {
  const l = liste(["UID:r", "SUMMARY:Réunion", "DTSTART;TZID=Europe/Paris:20261019T090000", "DTEND;TZID=Europe/Paris:20261019T093000", "RRULE:FREQ=WEEKLY;COUNT=3"]);
  assert.deepEqual(l, ["2026-10-19 09:00-09:30 Réunion", "2026-10-26 09:00-09:30 Réunion", "2026-11-02 09:00-09:30 Réunion"]);
  // Série créée en UTC (été) : l'heure suit l'UTC, donc glisse d'une heure à Paris.
  const u = liste(["UID:u", "SUMMARY:UTC", "DTSTART:20261019T070000Z", "DTEND:20261019T073000Z", "RRULE:FREQ=WEEKLY;COUNT=2"]);
  assert.deepEqual(u, ["2026-10-19 09:00-09:30 UTC", "2026-10-26 08:00-08:30 UTC"]);
});

test("quotidien avec UNTIL, mensuel 1er lundi et dernier vendredi, mensuel par jour du mois", () => {
  assert.deepEqual(
    liste(["UID:q", "SUMMARY:Q", "DTSTART;TZID=Europe/Paris:20260101T080000", "DTEND;TZID=Europe/Paris:20260101T081500", "RRULE:FREQ=DAILY;UNTIL=20261023T060000Z"]),
    ["2026-10-14 08:00-08:15 Q", "2026-10-15 08:00-08:15 Q", "2026-10-16 08:00-08:15 Q", "2026-10-17 08:00-08:15 Q", "2026-10-18 08:00-08:15 Q", "2026-10-19 08:00-08:15 Q", "2026-10-20 08:00-08:15 Q", "2026-10-21 08:00-08:15 Q", "2026-10-22 08:00-08:15 Q", "2026-10-23 08:00-08:15 Q"],
  );
  assert.deepEqual(
    liste(
      ["UID:m", "SUMMARY:Premier lundi", "DTSTART;TZID=Europe/Paris:20260105T100000", "DTEND;TZID=Europe/Paris:20260105T110000", "RRULE:FREQ=MONTHLY;BYDAY=1MO"],
      ["UID:v", "SUMMARY:Dernier vendredi", "DTSTART;TZID=Europe/Paris:20260130T100000", "DTEND;TZID=Europe/Paris:20260130T110000", "RRULE:FREQ=MONTHLY;BYDAY=-1FR"],
      ["UID:j", "SUMMARY:Le 31", "DTSTART;TZID=Europe/Paris:20260131T100000", "DTEND;TZID=Europe/Paris:20260131T110000", "RRULE:FREQ=MONTHLY"],
    ),
    ["2026-10-30 10:00-11:00 Dernier vendredi", "2026-10-31 10:00-11:00 Le 31", "2026-11-02 10:00-11:00 Premier lundi", "2026-11-27 10:00-11:00 Dernier vendredi", "2026-12-07 10:00-11:00 Premier lundi"],
  );
});

test("occurrence déplacée (RECURRENCE-ID) ou annulée, événement annulé", () => {
  const serie = ["UID:s", "SUMMARY:Série", "DTSTART;TZID=Europe/Paris:20261019T090000", "DTEND;TZID=Europe/Paris:20261019T100000", "RRULE:FREQ=WEEKLY;COUNT=3"];
  assert.deepEqual(
    liste(
      serie,
      ["UID:s", "SUMMARY:Série (déplacée)", "RECURRENCE-ID;TZID=Europe/Paris:20261026T090000", "DTSTART;TZID=Europe/Paris:20261027T160000", "DTEND;TZID=Europe/Paris:20261027T170000"],
      ["UID:s", "SUMMARY:x", "STATUS:CANCELLED", "RECURRENCE-ID;TZID=Europe/Paris:20261102T090000", "DTSTART;TZID=Europe/Paris:20261102T090000", "DTEND;TZID=Europe/Paris:20261102T100000"],
      ["UID:z", "SUMMARY:Annulé", "STATUS:CANCELLED", "DTSTART:20261024T100000Z", "DTEND:20261024T110000Z"],
    ),
    ["2026-10-19 09:00-10:00 Série", "2026-10-27 16:00-17:00 Série (déplacée)"],
  );
});

test("fenêtre : 7 jours avant, 60 jours après ; durée comptée jusqu'à minuit", () => {
  const l = analyserIcs(
    ics(
      ["UID:a", "SUMMARY:Trop ancien", "DTSTART:20261013T100000Z", "DTEND:20261013T110000Z"],
      ["UID:b", "SUMMARY:Limite basse", "DTSTART:20261014T100000Z", "DTEND:20261014T110000Z"],
      ["UID:c", "SUMMARY:Limite haute", "DTSTART:20261220T100000Z", "DTEND:20261220T110000Z"],
      ["UID:d", "SUMMARY:Trop loin", "DTSTART:20261221T100000Z", "DTEND:20261221T110000Z"],
      ["UID:e", "SUMMARY:Nuit", "DTSTART;TZID=Europe/Paris:20261022T220000", "DTEND;TZID=Europe/Paris:20261023T020000"],
    ),
    AUJ,
  );
  assert.deepEqual(l.map((e) => e.titre), ["Limite basse", "Nuit", "Limite haute"]);
  assert.equal(l[1].duree_min, 120);
  assert.equal(l[1].fin, "23:59");
});
