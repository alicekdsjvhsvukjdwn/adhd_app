// Lancer : npm test
// Sport, lot 2 : séances construites (Mes séances, séances proposées), séries enregistrées une à une, records, résumé.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { historiqueExercice } from "../lib/db/exercices-historique.ts";
import {
  commencerSeanceSport,
  dupliquerMaSeance,
  enregistrerMaSeance,
  listerMesSeances,
  lireMaSeance,
  noterSeanceCommePrevu,
  noterSerieSport,
  recordsDeSeance,
  seriesDeSeance,
  supprimerMaSeance,
  terminerSeanceSport,
} from "../lib/db/seances-sport.ts";
import { enregistrerSeanceGuidee } from "../lib/db/seances-guidees.ts";
import { getStats } from "../lib/db/stats.ts";
import { EXERCICES, exercice, faisable } from "../lib/exercices.ts";
import { MATERIEL_DEFAUT, materielValide } from "../lib/materiel.ts";
import {
  cibleParDefaut,
  DUREES_PROPOSEES,
  dureeEstimee,
  faitMieux,
  ligneParDefaut,
  meilleurePerf,
  nouveauRecord,
  pasDeSaisie,
  pastillesRapides,
  proposerSeance,
  resumeSeance,
  ZONES_PROPOSEES,
} from "../lib/seances-sport.ts";

const solSeul = materielValide({ dispo: { mobilier: false, halteres: false, parallettes: false } });
const avecPoids = materielValide({ poids: [5, 8, 12] });

// ─── Règles pures ───

test("ligne de départ : cible selon le niveau et le mode, poids du milieu de mes haltères, repos adapté", () => {
  assert.equal(cibleParDefaut(exercice("pompes_mur")), 15); // niveau 1
  assert.equal(cibleParDefaut(exercice("pompes")), 10); // niveau 3
  assert.equal(cibleParDefaut(exercice("planche")), 30); // secondes
  assert.equal(cibleParDefaut(exercice("chat_vache")), 15); // niveau 1, répétitions
  assert.equal(cibleParDefaut(exercice("etirement_ischios")), 40); // mobilité tenue
  assert.equal(cibleParDefaut(exercice("curl_halteres")), 10);
  assert.deepEqual(ligneParDefaut("curl_halteres", avecPoids), { exercice: "curl_halteres", series: 3, cible: 10, poids: 8, repos_s: 45 });
  assert.equal(ligneParDefaut("curl_halteres", MATERIEL_DEFAUT).poids, null); // aucun poids saisi
  assert.equal(ligneParDefaut("pompes", avecPoids).poids, null); // pas d'exercice avec poids
  assert.equal(ligneParDefaut("posture_enfant").repos_s, 10);
  assert.equal(ligneParDefaut("posture_enfant").series, 2);
  assert.equal(ligneParDefaut("planche").repos_s, 30);
});

test("durée estimée : séries × (effort + repos)", () => {
  // 3 × (10 reps × 3 s + 5 + 45) + 3 × (30 s + 30)
  const l = [{ exercice: "pompes", series: 3, cible: 10, poids: null, repos_s: 45 }, { exercice: "planche", series: 3, cible: 30, poids: null, repos_s: 30 }];
  assert.equal(dureeEstimee(l), 3 * (35 + 45) + 3 * (30 + 30));
  assert.equal(dureeEstimee([]), 0);
  assert.equal(dureeEstimee([{ exercice: "inconnu", series: 3, cible: 10, poids: null, repos_s: 45 }]), 0);
});

test("séances proposées : 5 zones × 4 durées, avec mon matériel seulement, sans doublon, durée proche de celle demandée", () => {
  for (const m of [MATERIEL_DEFAUT, solSeul, materielValide({ dispo: { barre: true, elastiques: true }, poids: [8] })]) {
    for (const z of ZONES_PROPOSEES) {
      for (const d of DUREES_PROPOSEES) {
        const s = proposerSeance(z.cle, d, m);
        const nom = `${z.cle} ${d}`;
        assert.equal(s.nom, `${z.nom} · ${d} min`);
        assert.ok(s.lignes.length >= 3, `${nom} : ${s.lignes.length} exercices`);
        assert.equal(new Set(s.lignes.map((l) => l.exercice)).size, s.lignes.length, nom);
        assert.ok(s.lignes.every((l) => faisable(exercice(l.exercice), m)), `${nom} : matériel`);
        const ecart = dureeEstimee(s.lignes) / (d * 60);
        assert.ok(ecart >= 0.7 && ecart <= 1.3, `${nom} : ${Math.round(ecart * 100)} % de la durée`);
        if (z.cle !== "complet") assert.ok(s.lignes.every((l) => exercice(l.exercice).zones.includes(z.cle)), `${nom} : zone`);
      }
    }
  }
});

test("séance proposée : corps complet mélange haut, bas et abdos ; sans barre pas de tractions ; « une autre » change les exercices", () => {
  const s = proposerSeance("complet", 30, MATERIEL_DEFAUT);
  const zones = new Set(s.lignes.flatMap((l) => exercice(l.exercice).zones));
  for (const z of ["haut", "bas", "abdos"]) assert.ok(zones.has(z), z);
  const graines = Array.from({ length: 12 }, (_, g) => g);
  const tractions = (m) => graines.some((g) => proposerSeance("haut", 45, m, g).lignes.some((l) => ["tractions", "tractions_negatives"].includes(l.exercice)));
  assert.equal(tractions(MATERIEL_DEFAUT), false); // pas de barre : jamais
  assert.equal(tractions(materielValide({ dispo: { barre: true } })), true); // avec une barre : elles reviennent
  const memes = JSON.stringify(proposerSeance("bas", 20, MATERIEL_DEFAUT, 0));
  assert.equal(memes, JSON.stringify(proposerSeance("bas", 20, MATERIEL_DEFAUT, 0))); // pas de hasard
  assert.notEqual(memes, JSON.stringify(proposerSeance("bas", 20, MATERIEL_DEFAUT, 1)));
  // Mes poids d'haltères servent aux exercices avec poids.
  const avec = proposerSeance("haut", 30, avecPoids, 0).lignes.filter((l) => exercice(l.exercice).mode === "reps_poids");
  assert.ok(avec.every((l) => l.poids === 8));
  // Mobilité : tenues courtes, repos courts.
  const mob = proposerSeance("mobilite", 20, MATERIEL_DEFAUT);
  assert.ok(mob.lignes.every((l) => l.repos_s <= 30));
});

test("records : plus lourd d'abord, puis plus de répétitions ; la première fois n'en est pas un", () => {
  assert.equal(faitMieux({ realise: 8, poids: 10 }, { realise: 12, poids: 8 }), true); // plus lourd, moins de reps
  assert.equal(faitMieux({ realise: 12, poids: 8 }, { realise: 8, poids: 8 }), true);
  assert.equal(faitMieux({ realise: 8, poids: 8 }, { realise: 8, poids: 8 }), false); // égal : pas mieux
  assert.equal(faitMieux({ realise: 20, poids: null }, { realise: 15, poids: null }), true);
  assert.deepEqual(meilleurePerf([{ realise: 10, poids: null }, { realise: 15, poids: null }, { realise: 12, poids: null }]), { realise: 15, poids: null });
  assert.equal(meilleurePerf([]), null);
  assert.equal(nouveauRecord([], { realise: 20, poids: null }), false);
  assert.equal(nouveauRecord([{ realise: 15, poids: null }], { realise: 16, poids: null }), true);
  assert.equal(nouveauRecord([{ realise: 15, poids: null }], { realise: 15, poids: null }), false);
  assert.equal(nouveauRecord([{ realise: 15, poids: null }, { realise: 18, poids: null }], { realise: 16, poids: null }), false);
});

test("résumé : fait contre prévu par exercice, séries manquantes, records", () => {
  const prevu = [
    { exercice: "pompes", series: 3, cible: 10, poids: null, repos_s: 45 },
    { exercice: "planche", series: 2, cible: 30, poids: null, repos_s: 30 },
    { exercice: "squat", series: 3, cible: 12, poids: null, repos_s: 45 },
  ];
  const faites = [
    { exercice: "pompes", numero: 1, realise: 12, poids: null },
    { exercice: "pompes", numero: 2, realise: 10, poids: null },
    { exercice: "pompes", numero: 3, realise: 8, poids: null },
    { exercice: "planche", numero: 1, realise: 35, poids: null },
  ];
  const r = resumeSeance(prevu, faites, ["pompes"]);
  assert.deepEqual(r.exercices.map((x) => [x.exercice, x.faites, x.prevues, x.totalFait, x.totalPrevu, x.record]), [
    ["pompes", 3, 3, 30, 30, true],
    ["planche", 1, 2, 35, 60, false],
    ["squat", 0, 3, 0, 36, false],
  ]);
  assert.equal(r.completion, 4 / 8);
  assert.equal(resumeSeance([], []).completion, 0);
});

test("saisie : pastilles autour de la cible, pas du − / +", () => {
  assert.deepEqual(pastillesRapides(12), [8, 10, 12, 14]);
  assert.deepEqual(pastillesRapides(30), [20, 25, 30, 35]);
  assert.deepEqual(pastillesRapides(5), [3, 4, 5, 6]);
  assert.ok(pastillesRapides(1).every((v) => v > 0));
  assert.equal(pasDeSaisie("s", 30), 5);
  assert.equal(pasDeSaisie("s", 10), 1);
  assert.equal(pasDeSaisie("reps", 30), 1);
});

// ─── Base en mémoire ───

await initialiserBase();
const AUJ = getAujourdhui();
const points = async () => (await getStats()).points;
const db = await getDatabase();

test("Mes séances : créer, relire dans l'ordre, modifier, dupliquer, supprimer ; valeurs bornées", async () => {
  const id = await enregistrerMaSeance({
    nom: "  Pousser  ",
    lignes: [
      { exercice: "pompes", series: 99, cible: 12, poids: null, repos_s: 45 },
      { exercice: "curl_halteres", series: 3, cible: 10, poids: 7.7, repos_s: 30 },
      { exercice: "n'existe pas", series: 3, cible: 10, poids: null, repos_s: 30 },
      { exercice: "planche", series: 2, cible: 0, poids: -5, repos_s: 9999 },
    ],
  });
  const s = await lireMaSeance(id);
  assert.equal(s.nom, "Pousser");
  assert.deepEqual(s.lignes.map((l) => l.exercice), ["pompes", "curl_halteres", "planche"]); // l'inconnu n'est pas gardé
  assert.deepEqual([s.lignes[0].series, s.lignes[1].poids, s.lignes[2].cible, s.lignes[2].poids, s.lignes[2].repos_s], [10, 7.5, 1, null, 600]);

  await enregistrerMaSeance({ id, nom: "", lignes: [s.lignes[2], s.lignes[0]] }); // réordonnée, sans nom : « Ma séance »
  const m = await lireMaSeance(id);
  assert.deepEqual([m.nom, ...m.lignes.map((l) => l.exercice)], ["Ma séance", "planche", "pompes"]);

  const copie = await dupliquerMaSeance(id);
  assert.notEqual(copie, id);
  assert.equal((await lireMaSeance(copie)).nom, "Ma séance (copie)");
  assert.deepEqual((await lireMaSeance(copie)).lignes, m.lignes);
  assert.equal((await listerMesSeances()).length, 2);
  assert.equal(await dupliquerMaSeance(99999), null);

  await supprimerMaSeance(id);
  assert.equal(await lireMaSeance(id), null);
  assert.equal((await listerMesSeances()).length, 1);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM sport_seances_ex WHERE seance_id = ?", id)).n, 0);
  await supprimerMaSeance(copie);
});

test("série par série : enregistrée avec son exercice et son poids, corrigée au même numéro, +10 pts une seule fois", async () => {
  const avant = await points();
  const id = await commencerSeanceSport("Pousser", "perso", AUJ);
  const a = await noterSerieSport(id, { exercice: "pompes", numero: 1, realise: 12, poids: null, prevu: 12 });
  assert.equal(a.points, 10);
  assert.equal((await noterSerieSport(id, { exercice: "pompes", numero: 2, realise: 10, poids: null, prevu: 12 })).points, 0);
  await noterSerieSport(id, { exercice: "curl_halteres", numero: 1, realise: 10, poids: 8, prevu: 10 });
  // Corriger la série 2 : même numéro, pas de ligne en plus.
  await noterSerieSport(id, { exercice: "pompes", numero: 2, realise: 11, poids: null, prevu: 12 });
  const s = await seriesDeSeance(id);
  assert.deepEqual(s.map((x) => [x.exercice, x.numero, x.realise, x.poids]), [["pompes", 1, 12, null], ["pompes", 2, 11, null], ["curl_halteres", 1, 10, 8]]);
  const ligne = await db.getFirstAsync("SELECT exercice, unite, objectif_haut, famille FROM series WHERE exercice_id = 'curl_halteres'");
  assert.deepEqual({ ...ligne }, { exercice: "Curl aux haltères", unite: "reps", objectif_haut: 10, famille: "" });
  assert.equal(await points(), avant + 10);

  // Une autre séance le même jour : pas de points en plus.
  const id2 = await commencerSeanceSport("Gainage", "proposee", AUJ);
  assert.equal((await noterSerieSport(id2, { exercice: "planche", numero: 1, realise: 40, poids: null, prevu: 30 })).points, 0);
  assert.equal((await db.getFirstAsync("SELECT unite FROM series WHERE exercice_id = 'planche'")).unite, "s");
  assert.equal(await points(), avant + 10);
  await terminerSeanceSport(id2, "");

  // Même chose avec une séance guidée déjà payée : rien de plus.
  await enregistrerSeanceGuidee("reveil", 300, ["squat"], true, AUJ);
  assert.equal(await points(), avant + 10);

  const fin = await terminerSeanceSport(id, "ok");
  assert.deepEqual(fin.records, []); // rien avant : aucune première fois n'est un record
  const ligneSeance = await db.getFirstAsync("SELECT nom, origine, ressenti, fin FROM seances WHERE id = ?", id);
  assert.deepEqual([ligneSeance.nom, ligneSeance.origine, ligneSeance.ressenti, !!ligneSeance.fin], ["Pousser", "perso", "ok", true]);
});

test("records : plus de répétitions qu'avant, ou plus lourd, signalé pendant la séance et au résumé", async () => {
  const hier = decalerJours(AUJ, -3);
  const a = await commencerSeanceSport("Avant", "perso", hier);
  await noterSerieSport(a, { exercice: "squat", numero: 1, realise: 15, poids: null, prevu: 15 });
  await noterSerieSport(a, { exercice: "rowing_halteres", numero: 1, realise: 10, poids: 8, prevu: 10 });
  await terminerSeanceSport(a, "");

  const b = await commencerSeanceSport("Après", "perso", AUJ);
  assert.equal((await noterSerieSport(b, { exercice: "squat", numero: 1, realise: 15, poids: null, prevu: 15 })).record, false); // égal
  assert.equal((await noterSerieSport(b, { exercice: "squat", numero: 2, realise: 18, poids: null, prevu: 15 })).record, true);
  assert.equal((await noterSerieSport(b, { exercice: "rowing_halteres", numero: 1, realise: 6, poids: 10, prevu: 10 })).record, true); // plus lourd, moins de reps
  assert.equal((await noterSerieSport(b, { exercice: "superman", numero: 1, realise: 12, poids: null, prevu: 12 })).record, false); // première fois
  assert.deepEqual((await recordsDeSeance(b)).sort(), ["rowing_halteres", "squat"]);
  assert.deepEqual((await terminerSeanceSport(b, "facile")).records.sort(), ["rowing_halteres", "squat"]);

  const h = await historiqueExercice(exercice("rowing_halteres"));
  assert.deepEqual(h.record, { valeur: 6, poids: 10, date: AUJ });
  assert.deepEqual(h.courbe.map((c) => c.valeur), [8, 10]); // le poids, pour un exercice avec poids
  assert.equal((await historiqueExercice(exercice("squat"))).record.valeur, 18);
});

test("séance sans aucune série faite : elle n'a pas eu lieu", async () => {
  const avant = await db.getFirstAsync("SELECT COUNT(*) AS n FROM seances");
  const id = await commencerSeanceSport("Rien", "perso", AUJ);
  await noterSerieSport(id, { exercice: "pompes", numero: 1, realise: 0, poids: null, prevu: 10 }); // passée : 0
  assert.equal(await terminerSeanceSport(id, "dur"), null);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM seances")).n, avant.n);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM series WHERE seance_id = ?", id)).n, 0);
});

test("noter en 1 tap, comme prévu : toutes les séries à leur cible, le jour choisi, +10 pts une fois par jour", async () => {
  const jour = decalerJours(AUJ, -10);
  const avant = await points();
  const lignes = [
    { exercice: "pompes", series: 3, cible: 12, poids: null, repos_s: 45 },
    { exercice: "curl_halteres", series: 2, cible: 10, poids: 8, repos_s: 30 },
  ];
  const r = await noterSeanceCommePrevu("Pousser", "perso", lignes, jour);
  assert.equal(r.points, 10);
  const s = await seriesDeSeance(r.seanceId);
  assert.equal(s.length, 5);
  assert.ok(s.filter((x) => x.exercice === "pompes").every((x) => x.realise === 12));
  assert.deepEqual(s.filter((x) => x.exercice === "curl_halteres").map((x) => x.poids), [8, 8]);
  assert.equal((await db.getFirstAsync("SELECT date FROM seances WHERE id = ?", r.seanceId)).date, jour);
  assert.equal(await points(), avant + 10);
  assert.equal((await noterSeanceCommePrevu("Pousser", "perso", lignes, jour)).points, 0); // même jour : déjà payé
  assert.equal(await points(), avant + 10);
});

test("migration 34 : tables et colonnes de séances de sport créées", async () => {
  const cols = (await db.getAllAsync("PRAGMA table_info(series)")).map((c) => c.name);
  for (const c of ["exercice_id", "poids"]) assert.ok(cols.includes(c), c);
  const seances = (await db.getAllAsync("PRAGMA table_info(seances)")).map((c) => c.name);
  for (const c of ["nom", "origine", "ressenti"]) assert.ok(seances.includes(c), c);
  const noms = (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
  for (const t of ["sport_seances", "sport_seances_ex"]) assert.ok(noms.includes(t), t);
  assert.ok(EXERCICES.length >= 60);
});

// ─── Lot 3 : les skills lisent les séries de toutes les séances ───

const pause = (ms = 6) => new Promise((r) => setTimeout(r, ms));
/** Une séance de 3 séries d'un exercice, comme dans le Workout. */
const seanceDe = async (exerciceId, valeurs) => {
  const id = await commencerSeanceSport("Séance", "perso", AUJ);
  for (const [i, v] of valeurs.entries()) await noterSerieSport(id, { exercice: exerciceId, numero: i + 1, realise: v, poids: null, prevu: v });
  await terminerSeanceSport(id, "");
  await pause();
  return id;
};

test("skills : les séries notées dans n'importe quelle séance valident les étapes, à partir du moment où l'étape est en cours", async () => {
  const { configurerSport, ficheSkill, validerEtape } = await import("../lib/db/sport.ts");
  await configurerSport(MATERIEL_DEFAUT, {});
  assert.equal((await ficheSkill("pompe")).etape ?? 1, 1);

  // Étape 1 : Pompes au mur, 3 × 12. Une séance incomplète ne compte pas pour valider ; deux réussies, oui.
  await pause();
  assert.deepEqual((await ficheSkill("pompe")).seances, []);
  await seanceDe("pompes_mur", [12, 12]); // 2 séries sur 3
  assert.equal((await ficheSkill("pompe")).proposition, false);
  await seanceDe("pompes_mur", [12, 12, 13]);
  assert.equal((await ficheSkill("pompe")).proposition, false); // une seule réussie
  await seanceDe("pompes_mur", [12, 14, 12]);
  const f1 = await ficheSkill("pompe");
  assert.deepEqual(f1.seances[0].realise, [12, 14, 12]); // la plus récente d'abord
  assert.equal(f1.proposition, true);
  assert.equal(f1.meilleur, 14);

  // Des séances de l'étape 3 faites AVANT de l'atteindre ne comptent pas une fois qu'on y arrive.
  await seanceDe("pompes_genoux", [12, 12, 12]);
  await seanceDe("pompes_genoux", [12, 12, 12]);
  await pause();
  await validerEtape("pompe"); // → étape 2
  await pause();
  assert.deepEqual((await ficheSkill("pompe")).seances, []); // les pompes au mur ne valident pas les pompes inclinées
  await seanceDe("pompes_inclinees", [12, 12, 12]);
  await seanceDe("pompes_inclinees", [13, 12, 12]);
  assert.equal((await ficheSkill("pompe")).proposition, true);
  await pause();
  await validerEtape("pompe"); // → étape 3 : pompes sur les genoux
  await pause();
  assert.deepEqual((await ficheSkill("pompe")).seances, []); // les deux séances d'avant l'arrivée sont écartées
  assert.equal((await ficheSkill("pompe")).proposition, false);
  await seanceDe("pompes_genoux", [12, 12, 12]);
  await seanceDe("pompes_genoux", [12, 12, 12]);
  assert.equal((await ficheSkill("pompe")).proposition, true);
  await pause();
  await validerEtape("pompe"); // → étape 4 : Pompes 3 × 5
  await pause();

  // Même exercice sur deux étapes d'affilée (Pompes 3 × 5 puis 3 × 10) : ce qui précède l'arrivée ne compte pas.
  await seanceDe("pompes", [5, 5, 5]);
  await seanceDe("pompes", [10, 10, 10]);
  await seanceDe("pompes", [10, 10, 10]);
  assert.equal((await ficheSkill("pompe")).proposition, true);
  await pause();
  await validerEtape("pompe"); // → étape 5 : Pompes 3 × 10
  await pause();
  assert.equal((await ficheSkill("pompe")).proposition, false); // les 3 × 10 d'avant ne comptent pas
  await seanceDe("pompes", [10, 11, 10]);
  assert.equal((await ficheSkill("pompe")).proposition, false);
  await seanceDe("pompes", [10, 10, 12]);
  assert.equal((await ficheSkill("pompe")).proposition, true);
});

test("séance de skills : l'étape en cours des skills actifs, l'entretien des maîtrisés, rien quand il manque le matériel", async () => {
  const { seanceSkills, validerEtape, ficheSkill } = await import("../lib/db/sport.ts");
  const s = await seanceSkills(MATERIEL_DEFAUT);
  const par = Object.fromEntries(s.lignes.map((l) => [l.exercice, l]));
  assert.deepEqual([par.pompes.series, par.pompes.cible, par.pompes.poids], [3, 10, null]); // étape 5 de la pompe
  assert.deepEqual([par.appui_tenu.series, par.appui_tenu.cible], [3, 30]); // dips, étape 1 : en secondes
  assert.deepEqual([par.squat.series, par.squat.cible], [3, 20]); // pistol, étape 1
  assert.deepEqual([par.planche.series, par.planche.cible], [3, 60]); // gainage
  assert.ok(!s.lignes.some((l) => l.exercice === "suspension_passive")); // pas de barre : la traction n'y est pas
  assert.ok(s.lignes.every((l) => faisable(exercice(l.exercice), MATERIEL_DEFAUT)));
  // Sans table ni chaise : l'appui entre deux chaises disparaît.
  const sansMobilier = materielValide({ dispo: { mobilier: false } });
  assert.ok(!(await seanceSkills(sansMobilier)).lignes.some((l) => l.exercice === "appui_tenu"));

  // Pompe maîtrisée : elle quitte les skills actifs, une série d'entretien la remplace.
  await pause();
  await validerEtape("pompe");
  await pause();
  assert.equal((await ficheSkill("pompe")).etat.etape, 6);
  const apres = await seanceSkills(MATERIEL_DEFAUT);
  const entretien = apres.lignes.find((l) => l.exercice === "pompes");
  assert.deepEqual([entretien.series, entretien.cible], [1, 10]);
});

test("essai noté sur un skill : compte aussi pour l'historique de l'exercice de l'étape", async () => {
  const { noterEssai } = await import("../lib/db/sport.ts");
  await noterEssai("dips", 3, 30, AUJ);
  const ligne = await db.getFirstAsync("SELECT exercice_id, famille, palier FROM series WHERE famille = 'dips' ORDER BY id DESC");
  assert.deepEqual({ ...ligne }, { exercice_id: "appui_tenu", famille: "dips", palier: 1 });
  assert.equal((await historiqueExercice(exercice("appui_tenu"))).record.valeur, 30);
});
