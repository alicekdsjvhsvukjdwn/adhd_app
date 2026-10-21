// Lancer : npm test
// Sport, lot 4 : le plan (le coach) : niveaux, génération sur 6 semaines, progression, décharge, calendrier qui se décale, bilan.
import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabase } from "../lib/db/client.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { ecrireMeta } from "../lib/db/meta.ts";
import {
  bilanARepondre,
  creerPlan,
  derniersTests,
  enregistrerBilan,
  enregistrerTests,
  lignesDe,
  planActif,
  prochaineSeance,
  replanifier,
  resumeDuPlan,
  seanceDuJour,
  testsProgression,
  validerSeancePlan,
} from "../lib/db/plan-sport.ts";
import { commencerSeanceSport, noterSerieSport, terminerSeanceSport } from "../lib/db/seances-sport.ts";
import { configurerSport, validerEtape } from "../lib/db/sport.ts";
import { exercice, faisable } from "../lib/exercices.ts";
import { MATERIEL_DEFAUT, materielValide } from "../lib/materiel.ts";
import {
  ajustementDuBilan,
  calendrier,
  choisirDansChaine,
  DUREES_PLAN,
  evaluerProgression,
  focusDeLaSemaine,
  genererSlots,
  jaugeObjectif,
  lignesPourSeance,
  monter,
  niveauDuTest,
  niveauxDepuisTests,
  OBJECTIFS_PLAN,
  plageDe,
  semaineCalendaire,
  SEMAINES,
} from "../lib/plan-sport.ts";
import { dureeEstimee } from "../lib/seances-sport.ts";

const niv = (n) => ({ poussee: n, jambes: n, tronc: n, tirage: n });
const solSeul = materielValide({ dispo: { mobilier: false, halteres: false, parallettes: false } });
const ligne = (o = {}) => ({ exercice: "pompes", series: 4, bas: 5, haut: 8, poids: null, repos_s: 75, role: "base", ...o });

// ─── Niveau ───

test("test de niveau : le niveau le plus haut dont la borne est atteinte", () => {
  assert.equal(niveauDuTest("pompes", 0), 1);
  assert.equal(niveauDuTest("pompes", 3), 2);
  assert.equal(niveauDuTest("pompes", 14), 3);
  assert.equal(niveauDuTest("pompes", 25), 5);
  assert.equal(niveauDuTest("planche", 44), 2);
  assert.equal(niveauDuTest("planche", 45), 3);
  assert.equal(niveauDuTest("tuck_lsit", 0), 1);
  assert.equal(niveauDuTest("squats", 70), 5);
});

test("niveaux : moyenne des tests de chaque mouvement, test passé ignoré, rien = niveau 2", () => {
  assert.deepEqual(niveauxDepuisTests({}), niv(2));
  assert.deepEqual(niveauxDepuisTests({ pompes: 12, dips: null, planche: 100, tuck_lsit: 12, squats: 10, pont: 5 }), { poussee: 3, tronc: 4, jambes: 2, tirage: 4 }); // pompes 3 ; planche 4 et tuck 3 → 4 ; squats 2 et pont 1 → 2 ; tirage = moyenne de la poussée et du tronc
  // pompes seules : le niveau de la poussée vient d'elles, pas des dips.
  assert.equal(niveauxDepuisTests({ pompes: 30 }).poussee, 5);
  assert.deepEqual(niveauxDepuisTests({ squats: 50, pont: 50 }).jambes, 5);
});

// ─── Séances types ───

test("séances de la semaine : une par jour choisi, 3 jours « poussée + skill / jambes + gainage / complet »", () => {
  for (const o of OBJECTIFS_PLAN) for (let n = 1; n <= 6; n++) assert.equal(focusDeLaSemaine(o.cle, n).length, n, `${o.cle} ${n}`);
  assert.deepEqual(focusDeLaSemaine("skill", 3), [["pousser", "skill"], ["jambes", "gainage"], ["complet"]]);
  assert.deepEqual(focusDeLaSemaine("force", 3), [["pousser"], ["jambes"], ["tirer"]]);
  assert.ok(focusDeLaSemaine("mobilite", 4).every((f) => f.includes("mobilite") || f.includes("gainage") || f.includes("jambes")));
  assert.equal(focusDeLaSemaine("force", 99).length, 6); // borné
});

test("choisir dans une chaîne : le plus dur à mon niveau et à ma portée, jamais ce qui manque de matériel", () => {
  const chaine = ["pompes_mur", "pompes_inclinees", "pompes_genoux", "pompes", "pompes_pieds_sureleves"];
  assert.equal(choisirDansChaine(chaine, 1, MATERIEL_DEFAUT), "pompes_inclinees");
  assert.equal(choisirDansChaine(chaine, 1, solSeul), "pompes_mur"); // pas de table : le mur
  assert.equal(choisirDansChaine(chaine, 3, MATERIEL_DEFAUT), "pompes");
  assert.equal(choisirDansChaine(chaine, 5, MATERIEL_DEFAUT), "pompes_pieds_sureleves");
  assert.equal(choisirDansChaine(["tractions_negatives", "tractions"], 5, MATERIEL_DEFAUT), null); // pas de barre : rien
  assert.equal(choisirDansChaine(["tractions_negatives", "tractions"], 5, materielValide({ dispo: { barre: true } })), "tractions");
  assert.equal(choisirDansChaine(["pistol_squat"], 1, MATERIEL_DEFAUT), "pistol_squat"); // trop dur mais seul : le plus facile de la chaîne
});

test("plan généré : tous jours × durées × objectifs, avec mon matériel, sans doublon, durée respectée", () => {
  for (const m of [MATERIEL_DEFAUT, solSeul, materielValide({ dispo: { barre: true }, poids: [5, 8, 12] })]) {
    for (const o of OBJECTIFS_PLAN) {
      for (const d of DUREES_PLAN) {
        for (let n = 1; n <= 6; n += 1) {
          const slots = genererSlots({ objectif: o.cle, nbJours: n, duree: d, niveaux: niv(3), materiel: m, skill: o.cle === "skill" ? { exercice: "tuck_lsit_parallettes", series: 3, objectif: 15 } : null });
          const nom = `${o.cle} ${d} min ${n} j`;
          assert.equal(slots.length, n, nom);
          for (const s of slots) {
            assert.ok(s.lignes.length >= 3, `${nom} « ${s.nom} » : ${s.lignes.length} exercices`);
            assert.equal(new Set(s.lignes.map((l) => l.exercice)).size, s.lignes.length, nom);
            assert.ok(s.lignes.every((l) => faisable(exercice(l.exercice), m)), `${nom} : matériel`);
            const ecart = dureeEstimee(s.lignes.map((l) => ({ exercice: l.exercice, series: l.series, cible: l.haut, poids: l.poids, repos_s: l.repos_s }))) / (d * 60);
            assert.ok(ecart >= (m === solSeul ? 0.5 : 0.65) && ecart <= 1.3, `${nom} « ${s.nom} » : ${Math.round(ecart * 100)} % de la durée`);
          }
        }
      }
    }
  }
});

test("plan : l'objectif, le niveau et le matériel changent les exercices et les fourchettes", () => {
  const gen = (o, n, extra = {}) => genererSlots({ objectif: o, nbJours: 3, duree: 30, niveaux: niv(n), materiel: MATERIEL_DEFAUT, ...extra });
  const ids = (slots) => slots.flatMap((s) => s.lignes.map((l) => l.exercice));
  assert.ok(ids(gen("force", 1)).includes("pompes_inclinees") && !ids(gen("force", 1)).includes("pompes"));
  assert.ok(ids(gen("force", 3)).includes("pompes"));
  assert.ok(ids(gen("force", 5)).includes("pompes_archer"));
  // Fourchettes : force 4 × 5–8, tonifier 3 × 10–15, mobilité 2 × 30–45 s.
  const f = gen("force", 3)[0].lignes.find((l) => l.exercice === "pompes");
  assert.deepEqual([f.series, f.bas, f.haut], [4, 5, 8]);
  const t = gen("tonifier", 3).flatMap((s) => s.lignes).find((l) => l.exercice === "pompes");
  assert.deepEqual([t.series, t.bas, t.haut], [3, 10, 15]);
  const m = gen("mobilite", 3)[0].lignes;
  assert.ok(m.every((l) => l.series === 2));
  assert.deepEqual(plageDe(exercice("planche"), "force"), { bas: 30, haut: 45, series: 3, repos_s: 45 });
  // Skill : la ligne du skill vient en premier, avec le critère de l'étape, et ne bouge pas avec la fourchette.
  const sk = gen("skill", 3, { skill: { exercice: "tuck_lsit_parallettes", series: 3, objectif: 15 } });
  assert.deepEqual(sk[0].lignes[0], { exercice: "tuck_lsit_parallettes", series: 3, bas: 15, haut: 15, poids: null, repos_s: 45, role: "skill" });
  assert.ok(sk[0].nom.includes("Skill"));
  assert.ok(sk[1].lignes.every((l) => l.role === "base")); // jambes + gainage : pas de skill
  // Poids : le poids du milieu de mes haltères pour les exercices avec poids.
  const avecPoids = genererSlots({ objectif: "force", nbJours: 3, duree: 45, niveaux: niv(2), materiel: materielValide({ poids: [5, 8, 12] }) }).flatMap((s) => s.lignes);
  assert.ok(avecPoids.filter((l) => exercice(l.exercice).mode === "reps_poids").every((l) => l.poids === 8));
});

// ─── Séance du plan ───

test("semaine 6 plus légère, bilan du dimanche ± 1 série, version courte d'un jour difficile", () => {
  const l = [ligne(), ligne({ exercice: "planche", series: 3, bas: 30, haut: 45 }), ligne({ exercice: "tuck_lsit_parallettes", series: 3, bas: 15, haut: 15, role: "skill" }), ligne({ exercice: "squat", series: 4 })];
  const normal = lignesPourSeance(l, { semaine: 2 });
  assert.deepEqual(normal.map((x) => [x.series, x.cible]), [[4, 8], [3, 45], [3, 15], [4, 8]]); // cible = haut de la fourchette
  const decharge = lignesPourSeance(l, { semaine: SEMAINES });
  assert.deepEqual(decharge.map((x) => [x.series, x.cible]), [[2, 5], [2, 30], [2, 15], [2, 5]]); // séries × 0,6, bas de la fourchette ; le skill garde sa cible
  assert.deepEqual(lignesPourSeance(l, { semaine: 2, ajust: 1 }).map((x) => x.series), [5, 4, 3, 5]); // le skill ne bouge pas
  assert.deepEqual(lignesPourSeance(l, { semaine: 2, ajust: -1 }).map((x) => x.series), [3, 2, 3, 3]);
  assert.equal(Math.min(...lignesPourSeance(l, { semaine: 2, ajust: -9 }).filter((_, i) => i !== 2).map((x) => x.series)), 2); // jamais sous 2
  assert.equal(Math.max(...lignesPourSeance(l, { semaine: 2, ajust: 9 }).map((x) => x.series)), 6);
  const courte = lignesPourSeance(l, { semaine: 2, courte: true });
  assert.deepEqual(courte.map((x) => [x.exercice, x.series]), [["pompes", 3], ["planche", 2], ["tuck_lsit_parallettes", 2]]);
  assert.equal(ajustementDuBilan("facile"), 1);
  assert.equal(ajustementDuBilan("ok"), 0);
  assert.equal(ajustementDuBilan("dur"), -1);
});

test("progression : le haut sur toutes les séries 2 fois de suite, puis l'exercice monte ; la décharge ne compte pas", () => {
  const l = ligne(); // 4 séries, haut 8
  assert.deepEqual(evaluerProgression(l, [8, 8, 8, 8], 0, 2), { atteint: 1, monte: false });
  assert.deepEqual(evaluerProgression(l, [9, 8, 10, 8], 1, 3), { atteint: 0, monte: true }); // 2ᵉ fois : monte, compteur remis à zéro
  assert.deepEqual(evaluerProgression(l, [8, 8, 8, 7], 1, 3), { atteint: 0, monte: false }); // une série en dessous : repart de zéro
  assert.deepEqual(evaluerProgression(l, [8, 8, 8], 1, 3), { atteint: 0, monte: false }); // une série manque
  assert.deepEqual(evaluerProgression(l, [8, 8, 8, 8], 1, SEMAINES), { atteint: 1, monte: false }); // décharge : rien ne change
  assert.deepEqual(evaluerProgression(ligne({ role: "skill" }), [8, 8, 8, 8], 1, 2), { atteint: 1, monte: false }); // le skill avance par sa validation
});

test("monter : plus de poids, sinon variante plus dure, sinon fourchette plus haute", () => {
  const haltere = ligne({ exercice: "curl_halteres", bas: 6, haut: 10, poids: 8 });
  assert.equal(monter(haltere, materielValide({ poids: [5, 8, 12] }), "force").ligne.poids, 12);
  assert.equal(monter(haltere, materielValide({ poids: [5, 8] }), "force").ligne.poids, 9); // plus lourd que mes haltères : +1 kg
  const m = monter(haltere, materielValide({ poids: [5, 8, 12] }), "force");
  assert.deepEqual([m.raison, m.ligne.bas, m.ligne.haut], ["poids", 6, 10]); // la fourchette repart du bas
  const v = monter(ligne(), MATERIEL_DEFAUT, "force");
  assert.deepEqual([v.raison, v.ligne.exercice], ["variante", exercice("pompes").plus_dur]);
  assert.ok(faisable(exercice(v.ligne.exercice), MATERIEL_DEFAUT));
  // Variante qui demande du matériel absent : fourchette plus haute.
  const dips = monter(ligne({ exercice: "dips_banc", bas: 8, haut: 12 }), materielValide({ dispo: { parallettes: false } }), "tonifier");
  assert.deepEqual([dips.raison, dips.ligne.exercice, dips.ligne.bas, dips.ligne.haut], ["repetitions", "dips_banc", 10, 14]);
  const planche = monter(ligne({ exercice: "hollow_rock", bas: 5, haut: 8 }), MATERIEL_DEFAUT, "force"); // pas de variante plus dure
  assert.deepEqual([planche.raison, planche.ligne.bas, planche.ligne.haut], ["repetitions", 7, 10]);
  const tenue = monter(ligne({ exercice: "frontlever", bas: 5, haut: 8 }), materielValide({ dispo: { barre: true } }), "force");
  assert.deepEqual([tenue.ligne.bas, tenue.ligne.haut], [10, 13]); // secondes : +5
});

// ─── Calendrier et jauge ───

test("calendrier : les prochaines dates sur mes jours, aujourd'hui compris", () => {
  // 2026-10-21 est un mercredi.
  assert.deepEqual(calendrier(4, [1, 3, 5], "2026-10-21"), ["2026-10-21", "2026-10-23", "2026-10-26", "2026-10-28"]);
  assert.deepEqual(calendrier(2, [1, 3, 5], "2026-10-22"), ["2026-10-23", "2026-10-26"]); // jeudi : le prochain jour du plan
  assert.deepEqual(calendrier(3, [0], "2026-12-27"), ["2026-12-27", "2027-01-03", "2027-01-10"]); // dimanches, changement d'année
  assert.deepEqual(calendrier(3, [], "2026-10-21"), []);
  assert.equal(calendrier(18, [1, 3, 5], "2026-10-21").length, 18);
});

test("semaine en cours : lundi → dimanche avec la séance de chaque jour", () => {
  const s = [{ id: 1, ordre: 0, semaine: 1, nom: "A", jour: "2026-10-21", statut: "faite" }, { id: 2, ordre: 1, semaine: 1, nom: "B", jour: "2026-10-23", statut: "a_faire" }];
  const w = semaineCalendaire(s, "2026-10-25"); // dimanche : la semaine du 19
  assert.deepEqual(w.map((x) => x.jour), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  assert.deepEqual(w.map((x) => x.seance?.nom ?? null), [null, null, "A", null, "B", null, null]);
  // Une séance faite plus tôt que prévu se range au jour où elle a été faite.
  const tot = semaineCalendaire([{ id: 1, ordre: 0, semaine: 1, nom: "A", jour: "2026-10-23", statut: "faite", fait_le: "2026-10-21" }], "2026-10-21");
  assert.deepEqual(tot.map((x) => x.seance?.nom ?? null), [null, null, "A", null, null, null, null]);
});

test("progression vers l'objectif : l'étape du skill, les tests (+50 % = complet), la régularité", () => {
  const t = [{ cle: "pompes", premier: 10, dernier: 15 }, { cle: "squats", premier: 20, dernier: 20 }, { cle: "pont", premier: null, dernier: 30 }];
  assert.equal(jaugeObjectif({ objectif: "force", tests: t, faites: 0, prevues: 18 }), (1 + 0) / 2); // pompes +50 % = 1, squats 0 ; le pont sans premier test est ignoré
  assert.equal(jaugeObjectif({ objectif: "tonifier", tests: [], faites: 5, prevues: 18 }), 0);
  assert.equal(jaugeObjectif({ objectif: "skill", skillEtape: 3, skillNbEtapes: 4, tests: [], faites: 0, prevues: 0 }), 0.5);
  assert.equal(jaugeObjectif({ objectif: "skill", skillEtape: 5, skillNbEtapes: 4, tests: [], faites: 0, prevues: 0 }), 1); // maîtrisé
  assert.equal(jaugeObjectif({ objectif: "mobilite", tests: [], faites: 9, prevues: 18 }), 0.5);
  assert.equal(jaugeObjectif({ objectif: "force", tests: [{ cle: "pompes", premier: 10, dernier: 40 }], faites: 0, prevues: 0 }), 1); // plafonné
});

// ─── Base en mémoire ───

await initialiserBase();
const MER = "2026-10-21"; // mercredi
const db = await getDatabase();
const pause = (ms = 6) => new Promise((r) => setTimeout(r, ms));

/** Fait une séance du plan comme le lecteur : chaque série au haut de la fourchette. */
async function faireSeance(planSeance, plan, { complet = true, date = MER } = {}) {
  const l = lignesDe(plan, planSeance);
  const id = await commencerSeanceSport(planSeance.nom, "plan", date);
  for (const x of l) for (let n = 1; n <= (complet ? x.series : 1); n++) await noterSerieSport(id, { exercice: x.exercice, numero: n, realise: x.cible, poids: x.poids, prevu: x.cible });
  await terminerSeanceSport(id, "");
  await pause();
  return validerSeancePlan(planSeance.id, id);
}

test("créer un plan : 6 semaines de séances sur mes jours, tests gardés, niveaux calculés, l'ancien plan terminé", async () => {
  assert.equal(await planActif(), null);
  const id = await creerPlan({ objectif: "force", jours: [5, 1, 3, 3], duree: 30, materiel: MATERIEL_DEFAUT, tests: { pompes: 12, squats: 30, planche: 50, pont: 25, dips: null }, aujourdhui: MER });
  const p = await planActif();
  assert.equal(p.id, id);
  assert.deepEqual(p.jours, [1, 3, 5]); // triés, sans doublon
  assert.deepEqual([p.objectif, p.duree], ["force", 30]);
  assert.equal(p.seances.length, 3 * SEMAINES);
  assert.deepEqual(p.niveaux, niveauxDepuisTests({ pompes: 12, squats: 30, planche: 50, pont: 25 }));
  assert.deepEqual(p.seances.slice(0, 4).map((s) => s.jour), ["2026-10-21", "2026-10-23", "2026-10-26", "2026-10-28"]);
  assert.deepEqual(p.seances.map((s) => s.semaine).filter((_, i) => i % 3 === 0), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(p.seances.slice(0, 3).map((s) => s.slot), [0, 1, 2]);
  assert.deepEqual(p.seances.slice(0, 3).map((s) => s.nom), ["Poussée", "Jambes", "Tirage"]);
  assert.ok(p.slots.every((s) => s.lignes.length >= 3));
  // Un test passé (null) n'est pas enregistré.
  assert.deepEqual(await derniersTests(), { pompes: 12, squats: 30, planche: 50, pont: 25 });

  // Un nouveau plan termine l'ancien ; sans tests, les niveaux viennent des derniers tests.
  const id2 = await creerPlan({ objectif: "tonifier", jours: [2, 4], duree: 20, materiel: MATERIEL_DEFAUT, aujourdhui: MER });
  assert.notEqual(id2, id);
  assert.equal((await planActif()).id, id2);
  assert.equal((await db.getFirstAsync("SELECT statut FROM sport_plan WHERE id = ?", id)).statut, "termine");
  assert.deepEqual((await planActif()).niveaux, niveauxDepuisTests({ pompes: 12, squats: 30, planche: 50, pont: 25 }));
  await assert.rejects(creerPlan({ objectif: "force", jours: [], duree: 30, materiel: MATERIEL_DEFAUT }));
});

test("séance faite : le plan avance, les séances à faire suivent sans rien de « manqué »", async () => {
  await creerPlan({ objectif: "force", jours: [1, 3, 5], duree: 30, materiel: MATERIEL_DEFAUT, aujourdhui: MER });
  let p = await planActif();
  assert.equal((await seanceDuJour(MER)).planSeance.id, p.seances[0].id);
  assert.equal((await seanceDuJour("2026-10-22")), null); // jeudi : jour de repos
  assert.equal((await prochaineSeance()).planSeance.ordre, 0);

  await faireSeance(p.seances[0], p);
  p = await planActif();
  assert.equal(p.seances[0].statut, "faite");
  assert.equal(p.seances[0].fait_le, MER);
  assert.deepEqual([resumeDuPlan(p).faites, resumeDuPlan(p).prevues, resumeDuPlan(p).semaine], [1, 18, 1]);
  await replanifier(MER); // la séance du jour est faite : la suite commence demain, vendredi
  p = await planActif();
  assert.equal(p.seances[1].jour, "2026-10-23");

  // Deux jours sans séance (vendredi et lundi ratés) : tout se décale sur les prochains jours du plan.
  await replanifier("2026-10-27"); // mardi
  p = await planActif();
  assert.deepEqual(p.seances.slice(1, 4).map((s) => s.jour), ["2026-10-28", "2026-10-30", "2026-11-02"]);
  assert.equal(p.seances.filter((s) => s.statut === "a_faire" && s.jour < "2026-10-27").length, 0); // rien dans le passé
  assert.equal(new Set(p.seances.filter((s) => s.statut === "a_faire").map((s) => s.jour)).size, 17); // un jour chacune
  assert.equal((await seanceDuJour("2026-10-28")).planSeance.ordre, 1);
});

test("jour difficile : la séance du jour est proposée en version courte", async () => {
  await ecrireMeta("energie_routines:2026-10-28", "1");
  const s = await seanceDuJour("2026-10-28");
  assert.equal(s.courte, true);
  assert.ok(s.lignes.length <= 3);
  const entiere = lignesDe(s.plan, s.planSeance);
  assert.ok(s.lignes.every((l, i) => l.exercice === entiere[i].exercice && l.series === Math.max(1, entiere[i].series - 1)));
  assert.equal((await seanceDuJour("2026-10-30")).courte, false);
});

test("progression : le haut sur toutes les séries 2 fois de suite fait monter l'exercice, la décharge de la semaine 6 n'y change rien", async () => {
  await creerPlan({ objectif: "force", jours: [3], duree: 30, materiel: MATERIEL_DEFAUT, tests: { pompes: 12 }, aujourdhui: MER });
  let p = await planActif();
  assert.equal(p.seances.length, 6);
  const principal = p.slots[0].lignes[0];
  const avant = { exercice: principal.exercice, bas: principal.bas, haut: principal.haut };

  // Semaine 1 : au haut, mais pas toutes les séries → rien. Semaine 2 : toutes → compteur à 1. Semaine 3 : monte.
  let r = await faireSeance(p.seances[0], p, { complet: false });
  assert.deepEqual(r.evenements, []);
  p = await planActif();
  assert.equal(p.slots[0].lignes[0].exercice, avant.exercice);
  r = await faireSeance(p.seances[1], p);
  assert.deepEqual(r.evenements, []);
  assert.equal((await db.getFirstAsync("SELECT atteint FROM sport_plan_lignes WHERE plan_id = ? AND slot = 0 AND rang = 0", p.id)).atteint, 1);
  p = await planActif();
  r = await faireSeance(p.seances[2], p);
  assert.equal(r.evenements.length >= 1, true);
  const ev = r.evenements.find((e) => e.exercice === avant.exercice);
  assert.ok(ev, "l'exercice principal monte");
  p = await planActif();
  const apres = p.slots[0].lignes[0];
  assert.ok(apres.exercice !== avant.exercice || apres.haut > avant.haut, "variante plus dure ou fourchette plus haute");
  assert.equal((await db.getFirstAsync("SELECT atteint FROM sport_plan_lignes WHERE plan_id = ? AND slot = 0 AND rang = 0", p.id)).atteint, 0);

  // Une séance rejouée ne compte pas deux fois.
  assert.deepEqual((await validerSeancePlan(p.seances[2].id, 1)).evenements, []);

  // Semaine 6 (décharge) : séries réduites, cible au bas de la fourchette, aucun compteur ne bouge.
  const dechargeL = lignesDe(p, p.seances[5]);
  assert.ok(dechargeL.every((l) => l.series >= 2 && l.series <= 3));
  const compteurs = async () => (await db.getAllAsync("SELECT atteint FROM sport_plan_lignes WHERE plan_id = ? ORDER BY id", p.id)).map((x) => x.atteint);
  const avantDecharge = await compteurs();
  await faireSeance(p.seances[5], p);
  assert.deepEqual(await compteurs(), avantDecharge);
  assert.equal(resumeDuPlan(await planActif()).faites, 4);
});

test("objectif skill : la ligne du skill suit l'étape en cours, elle avance en validant l'étape", async () => {
  await configurerSport(MATERIEL_DEFAUT, {});
  const id = await creerPlan({ objectif: "skill", skill: "pompe", jours: [1, 3, 5], duree: 30, materiel: MATERIEL_DEFAUT, tests: { pompes: 5 }, aujourdhui: MER });
  let p = await planActif();
  assert.equal(p.skill, "pompe");
  const skillLigne = (plan) => plan.slots[0].lignes.find((l) => l.role === "skill");
  assert.deepEqual([skillLigne(p).exercice, skillLigne(p).series, skillLigne(p).haut], ["pompes_mur", 3, 12]); // étape 1 : Pompes au mur 3 × 12
  assert.ok(p.slots[0].nom.includes("Skill"));
  await pause();
  await validerEtape("pompe");
  p = await planActif();
  assert.equal(p.id, id);
  assert.equal(skillLigne(p).exercice, "pompes_inclinees"); // étape 2
  // Cible de la séance = critère de l'étape, jamais décalée par le bilan.
  const l = lignesDe(p, { ...p.seances[0], ajust: 1 }).find((x) => x.exercice === "pompes_inclinees");
  assert.deepEqual([l.series, l.cible], [3, 12]);
});

test("tests de niveau : le premier et le dernier de chaque test, pour les comparer", async () => {
  const plan = await planActif();
  await enregistrerTests(plan.id, { pompes: 20, planche: 70 }, "2026-12-02");
  const t = Object.fromEntries((await testsProgression()).map((x) => [x.cle, [x.premier, x.dernier]]));
  assert.deepEqual(t.pompes, [12, 20]); // premier test du premier plan, dernier test fait
  assert.deepEqual(t.planche, [50, 70]);
  assert.deepEqual(t.squats, [30, 30]);
  assert.equal(t.dips, undefined); // jamais passé
});

test("bilan du dimanche : demandé le dimanche (ou le lundi) après une séance, règle la semaine suivante, une seule fois", async () => {
  await creerPlan({ objectif: "tonifier", jours: [1, 3, 5], duree: 30, materiel: MATERIEL_DEFAUT, aujourdhui: "2026-11-02" }); // lundi
  let p = await planActif();
  assert.equal(await bilanARepondre("2026-11-08"), null); // dimanche, mais rien de fait cette semaine
  await faireSeance(p.seances[0], p, { date: "2026-11-02" });
  p = await planActif();
  assert.equal(await bilanARepondre("2026-11-04"), null); // mercredi : pas le moment
  assert.equal(await bilanARepondre("2026-11-08"), "2026-11-02"); // dimanche
  assert.equal(await bilanARepondre("2026-11-09"), "2026-11-02"); // lundi : si le dimanche est passé

  await enregistrerBilan("dur", "2026-11-08");
  assert.equal(await bilanARepondre("2026-11-08"), null); // déjà répondu
  assert.equal(await bilanARepondre("2026-11-09"), null);
  p = await planActif();
  const aFaire = p.seances.filter((s) => s.statut === "a_faire");
  for (const s of aFaire) {
    const suivante = s.jour >= "2026-11-09" && s.jour <= "2026-11-15";
    assert.equal(s.ajust, suivante ? -1 : 0, s.jour);
  }
  // La semaine suivante : une série de moins (jamais sous 2).
  const prochaine = aFaire.find((s) => s.jour >= "2026-11-09");
  const base = p.slots[prochaine.slot].lignes;
  assert.deepEqual(lignesDe(p, prochaine).map((l) => l.series), base.map((l) => Math.max(2, l.series - 1)));

  await enregistrerBilan("facile", "2026-11-08"); // le bilan se corrige
  p = await planActif();
  assert.ok(p.seances.filter((s) => s.statut === "a_faire" && s.jour >= "2026-11-09" && s.jour <= "2026-11-15").every((s) => s.ajust === 1));
});

test("cycle terminé : toutes les séances faites, le plan le dit", async () => {
  await creerPlan({ objectif: "mobilite", jours: [2], duree: 20, materiel: MATERIEL_DEFAUT, aujourdhui: "2026-11-03" });
  let p = await planActif();
  for (const s of p.seances) await faireSeance(s, p, { date: "2026-11-03" });
  p = await planActif();
  assert.deepEqual([resumeDuPlan(p).cycleTermine, resumeDuPlan(p).faites, resumeDuPlan(p).semaine], [true, 6, SEMAINES]);
  assert.equal(await seanceDuJour("2026-11-10"), null);
  assert.equal(await prochaineSeance(), null);
});

test("migration 35 : tables du plan créées", async () => {
  const noms = (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
  for (const t of ["sport_plan", "sport_plan_lignes", "sport_plan_seances", "sport_tests", "sport_bilans"]) assert.ok(noms.includes(t), t);
});
