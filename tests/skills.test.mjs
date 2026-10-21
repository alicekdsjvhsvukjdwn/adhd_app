// Lancer : npm test
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  choisirEntretien,
  critere,
  etapeDepart,
  manques,
  phraseMotivante,
  pointsValidation,
  proposerValidation,
  seanceReussie,
  seriesAtteintes,
  skill,
  SKILLS,
  statut,
} from "../lib/skills.ts";
import { SQL_SKILLS_DEPUIS_PALIERS, SQL_TABLES_LOT4, transformationsApres } from "../lib/schema.ts";

const pompe = skill("pompe");
const e1 = pompe.etapes[0]; // 3 × 12

test("catalogue : ids uniques, prérequis existants, 11 bonhommes", () => {
  const ids = SKILLS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 11);
  for (const s of SKILLS) for (const p of s.prerequis) assert.ok(skill(p), `${s.id} → ${p}`);
  assert.equal(skill("traction").etapes.length, 7);
  assert.equal(critere(skill("pistol").etapes[1]), "3 × 10 / jambe");
  assert.equal(critere(skill("poirier").etapes[4]), "10 s");
});

const ok = (fin) => ({ fin, realise: [12, 12, 13] });
const rate = (fin) => ({ fin, realise: [12, 11, 12] });

test("validation d'étape : critère atteint sur 2 séances d'affilée", () => {
  assert.equal(seanceReussie([12, 12, 12], e1), true);
  assert.equal(seanceReussie([12, 12], e1), false); // une série manque
  const v = (seances, dernierRefus = null) => proposerValidation({ seances, etape: e1, dernierRefus });
  assert.equal(v([ok("2026-10-12"), ok("2026-10-10")]), true);
  assert.equal(v([ok("2026-10-12")]), false);
  assert.equal(v([rate("2026-10-12"), ok("2026-10-10"), ok("2026-10-08")]), false);
  // Une étape à une série (1 traction stricte).
  const une = skill("traction").etapes[5];
  assert.equal(proposerValidation({ seances: [{ fin: "b", realise: [1] }, { fin: "a", realise: [1] }], etape: une, dernierRefus: null }), true);
});

test("refus puis reproposition : 2 nouvelles réussites après le refus", () => {
  const s = [ok("2026-10-12T18:00"), ok("2026-10-10T18:00")];
  const v = (seances, dernierRefus) => proposerValidation({ seances, etape: e1, dernierRefus });
  assert.equal(v(s, "2026-10-12T19:00"), false); // refusée juste après
  assert.equal(v([ok("2026-10-14T18:00"), ...s], "2026-10-12T19:00"), false); // une seule depuis
  assert.equal(v([ok("2026-10-16T18:00"), ok("2026-10-14T18:00"), ...s], "2026-10-12T19:00"), true);
});

test("prérequis et barre : verrouillé, puis débloqué", () => {
  const sans = {};
  assert.equal(statut(skill("lsit"), sans, true), "verrouille");
  assert.deepEqual(manques(skill("lsit"), sans, true), { prerequis: ["gainage"], barre: false });
  const gainageMaitrise = { gainage: { etape: 3, actif: false } };
  assert.equal(statut(skill("lsit"), gainageMaitrise, true), "en_cours");
  // Planche : pompe ET L-sit maîtrisés.
  assert.deepEqual(manques(skill("planche"), { pompe: { etape: 6, actif: false } }, true).prerequis, ["lsit"]);
  // Sans barre : traction grisée, « barre nécessaire ».
  assert.equal(statut(skill("traction"), sans, false), "verrouille");
  assert.deepEqual(manques(skill("traction"), sans, false), { prerequis: [], barre: true });
  assert.equal(statut(skill("dips"), sans, false), "en_cours");
});

test("maîtrise : dernière étape validée", () => {
  assert.equal(statut(pompe, { pompe: { etape: 5, actif: true } }, true), "en_cours");
  assert.equal(statut(pompe, { pompe: { etape: 6, actif: false } }, true), "maitrise");
  assert.equal(etapeDepart(pompe, "inconnu"), 1);
  assert.equal(etapeDepart(pompe, 9), 6); // borné à « maîtrisé »
});

test("points : +20 par étape, +50 la maîtrise, jamais en double", () => {
  const p = (n, dejaValidees = [], dejaMaitrise = false) =>
    pointsValidation({ n, nbEtapes: 5, dejaValidees, dejaMaitrise });
  assert.deepEqual(p(2), { etape: 20, maitrise: 0 });
  assert.deepEqual(p(5), { etape: 20, maitrise: 50 });
  // Redescendre puis revalider : rien de plus.
  assert.deepEqual(p(2, [1, 2]), { etape: 0, maitrise: 0 });
  assert.deepEqual(p(5, [1, 2, 3, 4, 5], true), { etape: 0, maitrise: 0 });
});

test("phrase motivante et séries de la dernière séance", () => {
  assert.equal(phraseMotivante([10, 12, 11], e1), "Encore 2 répétitions par série");
  assert.equal(phraseMotivante([12, 12, 12], e1), "Objectif atteint : encore une séance comme ça.");
  assert.equal(phraseMotivante([12, 12], e1), "Encore 1 série au même niveau.");
  assert.match(phraseMotivante(null, e1), /Première séance/);
  const planche = skill("gainage").etapes[0]; // 3 × 60 s
  assert.equal(phraseMotivante([55, 60, 58], planche), "Encore 5 secondes par série");
  assert.equal(phraseMotivante([7], skill("poirier").etapes[4]), "Encore 3 secondes");
  assert.deepEqual(seriesAtteintes([12, 10], e1), [true, false, false]);
});

test("entretien : 2 skills maîtrisés au plus, le moins récent d'abord", () => {
  assert.deepEqual(choisirEntretien([]), []);
  assert.deepEqual(
    choisirEntretien([
      { id: "pompe", dernier: "2026-10-15" },
      { id: "dips", dernier: null },
      { id: "gainage", dernier: "2026-10-10" },
    ]),
    ["dips", "gainage"],
  );
});

// ─── Migration 23 : reprise des anciens paliers ───

const baseSport = (paliers, barre) => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE sport_reglages (id INTEGER PRIMARY KEY, barre_traction INTEGER NOT NULL DEFAULT 0,
      configure_le TEXT NOT NULL DEFAULT '');
    CREATE TABLE sport_paliers (famille TEXT PRIMARY KEY, palier INTEGER NOT NULL DEFAULT 1,
      maj_le TEXT NOT NULL DEFAULT '');
  `);
  if (barre !== undefined) db.prepare("INSERT INTO sport_reglages VALUES (1, ?, 'x')").run(barre ? 1 : 0);
  for (const [f, p] of Object.entries(paliers))
    db.prepare("INSERT INTO sport_paliers VALUES (?, ?, '2026-10-01T08:00:00.000Z')").run(f, p);
  db.exec(SQL_TABLES_LOT4);
  return db;
};
const etats = (db) =>
  Object.fromEntries(
    db.prepare("SELECT skill, etape, actif FROM skills_etat").all().map((r) => [r.skill, [r.etape, r.actif]]),
  );

test("23 : anciens paliers convertis en étapes, l'historique garde la trace", () => {
  const db = baseSport({ pousser: 4, tirer: 3, jambes: 4, gainage: 3 }, true);
  db.exec(SQL_SKILLS_DEPUIS_PALIERS);
  assert.deepEqual(etats(db), {
    pompe: [4, 1], // « Pompes » → 3 × 5 pompes
    traction: [4, 1], // négatives → négatives 5 s
    pistol: [5, 1], // pistol assisté
    gainage: [2, 1], // hollow
  });
  const h = db.prepare("SELECT skill, de, vers, origine, date FROM skills_historique ORDER BY skill").all();
  assert.equal(h.length, 4);
  assert.deepEqual({ ...h[0] }, { skill: "gainage", de: null, vers: 2, origine: "depart", date: "2026-10-01" });
});

test("23 : bornes des échelles, Tirer sans barre inactif, rejouable", () => {
  const db = baseSport({ pousser: 6, tirer: 1, jambes: 1, gainage: 1 }, false);
  db.exec(SQL_SKILLS_DEPUIS_PALIERS);
  db.exec(SQL_SKILLS_DEPUIS_PALIERS); // après une restauration : rien en double
  assert.deepEqual(etats(db), { pompe: [5, 1], traction: [3, 0], pistol: [1, 1], gainage: [1, 1] });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM skills_historique").get().n, 4);
  // Tractions (ancien dernier palier) : 1 traction stricte acquise.
  const db2 = baseSport({ tirer: 5 }, true);
  db2.exec(SQL_SKILLS_DEPUIS_PALIERS);
  assert.deepEqual(etats(db2), { traction: [7, 1] });
});

test("23 : jamais configuré → rien à convertir (le premier lancement demandera)", () => {
  const db = baseSport({});
  db.exec(SQL_SKILLS_DEPUIS_PALIERS);
  assert.deepEqual(etats(db), {});
  assert.ok(transformationsApres(22).includes(SQL_SKILLS_DEPUIS_PALIERS));
  assert.deepEqual(transformationsApres(32), []);
});
