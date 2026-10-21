/**
 * Plan de sport (le coach), sans accès à la base : testable seul (tests/plan-sport.test.mjs).
 * Un objectif, un test de niveau, mes jours et ma durée, mon matériel : l'appli compose un cycle de 6 semaines.
 * Chaque exercice vise une fourchette de répétitions (ou de secondes) ; quand je touche le haut sur toutes les
 * séries 2 fois, il monte (plus de répétitions, plus de poids, ou variante plus dure). La semaine 6 est plus légère.
 */
import { decalerJours } from "./dates";
import { EXERCICES, exercice, faisable } from "./exercices";
import type { Materiel, MaterielCle } from "./materiel";
import { dureeEstimee, type LigneSeance } from "./seances-sport";

export const SEMAINES = 6;
export const JOURS_MAX = 6;
export const DUREES_PLAN = [20, 30, 45] as const;
export type DureePlan = (typeof DUREES_PLAN)[number];

// ─── Objectif ───────────────────────────────────────────────────────────

export type ObjectifPlan = "force" | "skill" | "tonifier" | "mobilite";

export const OBJECTIFS_PLAN: { cle: ObjectifPlan; nom: string; aide: string }[] = [
  { cle: "force", nom: "Prendre de la force", aide: "Des mouvements de base, un peu plus lourds ou plus durs à chaque cycle." },
  { cle: "skill", nom: "Un premier skill", aide: "L-sit, poirier, pistol, tuck planche… avec le travail qui prépare." },
  { cle: "tonifier", nom: "Tonifier, régularité", aide: "Des séances variées et accessibles, pour tenir dans la durée." },
  { cle: "mobilite", nom: "Mobilité", aide: "Épaules, hanches, dos : assouplir, avec du gainage en soutien." },
];

// ─── Test de niveau ─────────────────────────────────────────────────────

export type CleTest = "pompes" | "dips" | "planche" | "tuck_lsit" | "squats" | "pont";

export type TestNiveau = {
  cle: CleTest;
  nom: string;
  consigne: string;
  unite: "reps" | "s";
  /** Exercice de la bibliothèque qui sert de test. */
  exercice: string;
  materiel: MaterielCle[];
  /** Valeur minimale de chaque niveau, du 1 au 5. */
  bornes: [number, number, number, number, number];
};

export const TESTS_NIVEAU: TestNiveau[] = [
  { cle: "pompes", nom: "Pompes", consigne: "Le plus de pompes d'affilée, bien gainée, poitrine à un poing du sol.", unite: "reps", exercice: "pompes", materiel: [], bornes: [0, 3, 8, 15, 25] },
  { cle: "dips", nom: "Dips aux parallettes", consigne: "Le plus de dips d'affilée, jusqu'à 90° aux coudes.", unite: "reps", exercice: "dips_parallettes", materiel: ["parallettes"], bornes: [0, 1, 6, 12, 20] },
  { cle: "planche", nom: "Planche", consigne: "Combien de secondes tu tiens, coudes sous les épaules, corps droit.", unite: "s", exercice: "planche", materiel: [], bornes: [0, 20, 45, 90, 150] },
  { cle: "tuck_lsit", nom: "Tuck L-sit", consigne: "Combien de secondes tu tiens, genoux contre la poitrine, aux parallettes.", unite: "s", exercice: "tuck_lsit_parallettes", materiel: ["parallettes"], bornes: [0, 1, 10, 20, 30] },
  { cle: "squats", nom: "Squats", consigne: "Le plus de squats d'affilée, cuisses parallèles au sol.", unite: "reps", exercice: "squat", materiel: [], bornes: [0, 10, 25, 45, 70] },
  { cle: "pont", nom: "Pont fessier", consigne: "Le plus de ponts fessiers d'affilée, en serrant les fesses en haut.", unite: "reps", exercice: "pont", materiel: [], bornes: [0, 10, 20, 35, 50] },
];

export const CLES_TESTS: CleTest[] = TESTS_NIVEAU.map((t) => t.cle);

export const testNiveau = (cle: CleTest): TestNiveau => TESTS_NIVEAU.find((t) => t.cle === cle)!;

export type ResultatsTests = Partial<Record<CleTest, number | null>>;

/** Niveau (1 à 5) d'un résultat : le plus haut niveau dont la borne est atteinte. */
export function niveauDuTest(cle: CleTest, valeur: number): number {
  const b = testNiveau(cle).bornes;
  return b.reduce((n, min, i) => (valeur >= min ? i + 1 : n), 1);
}

export type Niveaux = { poussee: number; jambes: number; tronc: number; tirage: number };

const moyenne = (l: number[]): number | null => (l.length ? Math.min(5, Math.max(1, Math.round(l.reduce((s, x) => s + x, 0) / l.length + 1e-9))) : null);

/** Niveau de chaque grand mouvement d'après les tests faits (un test passé est ignoré ; sans rien : niveau 2). */
export function niveauxDepuisTests(r: ResultatsTests): Niveaux {
  const n = (cles: CleTest[]) => moyenne(cles.flatMap((c) => (typeof r[c] === "number" ? [niveauDuTest(c, r[c] as number)] : [])));
  const poussee = n(["pompes", "dips"]) ?? 2;
  const tronc = n(["planche", "tuck_lsit"]) ?? 2;
  const jambes = n(["squats", "pont"]) ?? 2;
  return { poussee, jambes, tronc, tirage: moyenne([poussee, tronc]) ?? 2 };
}

// ─── Séances types ──────────────────────────────────────────────────────

export type Bloc = "pousser" | "epaules" | "triceps" | "tirer" | "cuisses" | "fessiers" | "mollets" | "gainage" | "obliques" | "abdos_bas" | "mobilite" | "skill";
export type Focus = "pousser" | "tirer" | "jambes" | "gainage" | "haut" | "bas" | "complet" | "skill" | "mobilite";

const BLOCS: Record<Focus, Bloc[]> = {
  pousser: ["pousser", "epaules", "triceps", "gainage"],
  tirer: ["tirer", "abdos_bas", "gainage", "obliques"],
  jambes: ["cuisses", "fessiers", "mollets", "gainage"],
  gainage: ["gainage", "obliques", "abdos_bas", "mobilite"],
  haut: ["pousser", "tirer", "epaules", "triceps"],
  bas: ["cuisses", "fessiers", "mollets", "abdos_bas"],
  complet: ["pousser", "cuisses", "tirer", "gainage", "fessiers", "obliques"],
  skill: ["skill", "gainage"],
  mobilite: ["mobilite"],
};

export const NOM_FOCUS: Record<Focus, string> = {
  pousser: "Poussée",
  tirer: "Tirage",
  jambes: "Jambes",
  gainage: "Gainage",
  haut: "Haut du corps",
  bas: "Bas du corps",
  complet: "Corps complet",
  skill: "Skill",
  mobilite: "Mobilité",
};

/** Les séances de la semaine : une par jour choisi. Un objectif ajoute son accent (skill, mobilité). */
export function focusDeLaSemaine(objectif: ObjectifPlan, nbJours: number): Focus[][] {
  const n = Math.min(JOURS_MAX, Math.max(1, nbJours));
  const force: Focus[][][] = [
    [["complet"]],
    [["haut"], ["bas"]],
    [["pousser"], ["jambes"], ["tirer"]],
    [["pousser"], ["jambes"], ["tirer"], ["complet"]],
    [["pousser"], ["jambes"], ["tirer"], ["gainage"], ["complet"]],
    [["pousser"], ["jambes"], ["tirer"], ["gainage"], ["complet"], ["mobilite"]],
  ];
  const base = force[n - 1];
  if (objectif === "skill") {
    // 3 jours : poussée + skill / jambes + gainage / complet.
    const skill: Focus[][][] = [
      [["skill", "complet"]],
      [["skill", "haut"], ["bas", "gainage"]],
      [["pousser", "skill"], ["jambes", "gainage"], ["complet"]],
      [["pousser", "skill"], ["jambes"], ["tirer", "skill"], ["complet"]],
      [["pousser", "skill"], ["jambes"], ["tirer", "skill"], ["gainage"], ["complet"]],
      [["pousser", "skill"], ["jambes"], ["tirer", "skill"], ["gainage"], ["complet"], ["mobilite"]],
    ];
    return skill[n - 1];
  }
  if (objectif === "tonifier") {
    const t: Focus[][][] = [
      [["complet"]],
      [["complet"], ["bas", "gainage"]],
      [["complet"], ["jambes", "gainage"], ["haut"]],
      [["complet"], ["jambes", "gainage"], ["haut"], ["complet"]],
      [["complet"], ["jambes", "gainage"], ["haut"], ["complet"], ["mobilite"]],
      [["complet"], ["jambes", "gainage"], ["haut"], ["complet"], ["gainage"], ["mobilite"]],
    ];
    return t[n - 1];
  }
  if (objectif === "mobilite") {
    const m: Focus[][][] = [
      [["mobilite"]],
      [["mobilite"], ["gainage", "mobilite"]],
      [["mobilite"], ["gainage", "mobilite"], ["mobilite"]],
      [["mobilite"], ["gainage", "mobilite"], ["mobilite"], ["jambes", "mobilite"]],
      [["mobilite"], ["gainage", "mobilite"], ["mobilite"], ["jambes", "mobilite"], ["mobilite"]],
      [["mobilite"], ["gainage", "mobilite"], ["mobilite"], ["jambes", "mobilite"], ["mobilite"], ["haut", "mobilite"]],
    ];
    return m[n - 1];
  }
  return base;
}

export const nomSeance = (focus: Focus[]): string => focus.map((f) => NOM_FOCUS[f]).join(" + ");

// ─── Exercices d'un bloc ────────────────────────────────────────────────

/** Progressions d'un même mouvement, du plus facile au plus dur. */
const CHAINES: Record<Exclude<Bloc, "skill" | "mobilite">, string[]> = {
  pousser: ["pompes_mur", "pompes_inclinees", "pompes_genoux", "pompes", "pompes_pieds_sureleves", "pompes_archer"],
  epaules: ["pike_taps", "presse_epaules", "pike_pushups", "pike_pushups_sureleves"],
  triceps: ["dips_banc", "extension_triceps", "dips_parallettes"],
  tirer: ["superman", "rowing_halteres", "rowing_table", "tractions_negatives", "tractions"],
  cuisses: ["squat", "squat_halteres", "fente", "squat_bulgare", "pistol_assiste", "pistol_squat"],
  fessiers: ["pont", "souleve_de_terre_roumain", "pont_unijambiste", "hip_thrust"],
  mollets: ["mollets", "mollets_unijambiste"],
  gainage: ["bird_dog", "planche", "bear_hold", "tuck_lsit_parallettes", "hollow", "lsit_parallettes"],
  obliques: ["crunch", "planche_laterale_tenue", "planche_laterale"],
  abdos_bas: ["dead_bug", "releve_jambes", "hollow_rock"],
};

/** Le plus dur de la chaîne qui reste à mon niveau et à ma portée (matériel) ; le plus facile sinon. null : rien de faisable. */
export function choisirDansChaine(chaine: string[], niveau: number, m: Materiel): string | null {
  const ok = chaine.map((id) => exercice(id)).filter((e): e is NonNullable<typeof e> => !!e && faisable(e, m));
  if (ok.length === 0) return null;
  const ceuxQuiVont = ok.filter((e) => e.niveau <= niveau);
  return (ceuxQuiVont.length ? ceuxQuiVont[ceuxQuiVont.length - 1] : ok[0]).id;
}

const NIVEAU_DU_BLOC: Record<string, keyof Niveaux> = {
  pousser: "poussee",
  epaules: "poussee",
  triceps: "poussee",
  tirer: "tirage",
  cuisses: "jambes",
  fessiers: "jambes",
  mollets: "jambes",
  gainage: "tronc",
  obliques: "tronc",
  abdos_bas: "tronc",
};

// ─── Lignes d'un plan ───────────────────────────────────────────────────

export type LignePlan = {
  exercice: string;
  series: number;
  /** Fourchette visée par série (répétitions ou secondes) ; le haut déclenche la progression. */
  bas: number;
  haut: number;
  poids: number | null;
  repos_s: number;
  /** 'skill' : l'étape du skill (elle avance en la validant, pas par la fourchette). */
  role: "base" | "skill";
};

export type EtapeSkill = { exercice: string; series: number; objectif: number };

/** Fourchette, séries et repos d'un exercice selon l'objectif. */
export function plageDe(e: ReturnType<typeof exercice> & object, objectif: ObjectifPlan): { bas: number; haut: number; series: number; repos_s: number } {
  const mobilite = e.zones.includes("mobilite");
  if (objectif === "mobilite" || (mobilite && e.mode === "s")) return e.mode === "s" ? { bas: 30, haut: 45, series: 2, repos_s: 15 } : { bas: 10, haut: 15, series: 2, repos_s: 20 };
  if (objectif === "tonifier") return e.mode === "s" ? { bas: 30, haut: 45, series: 3, repos_s: 40 } : { bas: 10, haut: 15, series: 3, repos_s: 40 };
  if (objectif === "skill") return e.mode === "s" ? { bas: 30, haut: 45, series: 3, repos_s: 45 } : { bas: 8, haut: 12, series: 3, repos_s: 60 };
  // force
  if (e.mode === "s") return { bas: 30, haut: 45, series: 3, repos_s: 45 };
  if (e.mode === "reps_poids") return { bas: 6, haut: 10, series: 4, repos_s: 90 };
  return { bas: 5, haut: 8, series: 4, repos_s: 75 };
}

const poidsDeDepart = (e: NonNullable<ReturnType<typeof exercice>>, m: Materiel): number | null =>
  e.mode === "reps_poids" && m.poids.length > 0 ? m.poids[Math.floor((m.poids.length - 1) / 2)] : null;

function ligneDe(id: string, objectif: ObjectifPlan, m: Materiel): LignePlan {
  const e = exercice(id)!;
  const p = plageDe(e, objectif);
  return { exercice: id, series: p.series, bas: p.bas, haut: p.haut, poids: poidsDeDepart(e, m), repos_s: p.repos_s, role: "base" };
}

export const enLigneSeance = (l: LignePlan, cible: number = l.haut): LigneSeance => ({ exercice: l.exercice, series: l.series, cible, poids: l.poids, repos_s: l.repos_s });

export type SlotPlan = { nom: string; focus: Focus[]; lignes: LignePlan[] };

/**
 * Les séances types du plan (une par jour choisi), avec leurs exercices, selon l'objectif, mon niveau, mon matériel
 * et la durée : on ajoute des blocs jusqu'à remplir la durée, sans la dépasser de beaucoup.
 */
export function genererSlots(p: {
  objectif: ObjectifPlan;
  nbJours: number;
  duree: DureePlan;
  niveaux: Niveaux;
  materiel: Materiel;
  /** L'étape en cours du skill choisi (objectif « skill »). */
  skill?: EtapeSkill | null;
}): SlotPlan[] {
  const cibleDuree = p.duree * 60;
  return focusDeLaSemaine(p.objectif, p.nbJours).map((focus, slot) => {
    const lignes: LignePlan[] = [];
    const pris = new Set<string>();
    const total = () => dureeEstimee(lignes.map((l) => enLigneSeance(l)));
    const ajouter = (l: LignePlan | null): boolean => {
      if (!l || pris.has(l.exercice)) return false;
      if (lignes.length >= 3 && total() + dureeEstimee([enLigneSeance(l)]) > cibleDuree * 1.15) return false;
      lignes.push(l);
      pris.add(l.exercice);
      return true;
    };
    const blocs = [...new Set(focus.flatMap((f) => BLOCS[f]))];
    for (const bloc of focus.includes("skill") ? (["skill", ...blocs.filter((b) => b !== "skill")] as Bloc[]) : blocs) {
      if (lignes.length >= 3 && total() >= cibleDuree * 0.92) break;
      if (bloc === "skill") {
        if (!p.skill) continue;
        const e = exercice(p.skill.exercice);
        if (e && faisable(e, p.materiel)) ajouter({ exercice: e.id, series: p.skill.series, bas: p.skill.objectif, haut: p.skill.objectif, poids: null, repos_s: e.mode === "s" ? 45 : 60, role: "skill" });
      } else if (bloc === "mobilite") {
        const pool = EXERCICES.filter((e) => e.zones.includes("mobilite") && e.niveau <= 2 && faisable(e, p.materiel));
        const debut = (slot * 3) % Math.max(1, pool.length);
        // Une séance de mobilité seule (ou l'objectif mobilité) remplit sa durée ; ailleurs, 3 exercices en complément.
        const seule = p.objectif === "mobilite" || (focus.length === 1 && focus[0] === "mobilite");
        const choisis = [...pool.slice(debut), ...pool.slice(0, debut)].slice(0, seule ? pool.length : 3);
        for (const e of choisis) {
          if (lignes.length >= 3 && total() >= cibleDuree * 0.98) break;
          ajouter(ligneDe(e.id, "mobilite", p.materiel));
        }
      } else {
        const id = choisirDansChaine(CHAINES[bloc], p.niveaux[NIVEAU_DU_BLOC[bloc]], p.materiel);
        if (id) ajouter(ligneDe(id, p.objectif, p.materiel));
      }
    }
    // Pas assez pour remplir la durée : une série de plus, jusqu'à 5.
    while (total() < cibleDuree * 0.8 && lignes.some((l) => l.role === "base" && l.series < 5)) {
      for (const l of lignes) {
        if (l.role === "skill" || total() >= cibleDuree * 0.9 || l.series >= 5) continue;
        l.series += 1;
      }
    }
    return { nom: nomSeance(focus), focus, lignes };
  });
}

// ─── Une séance du plan, selon la semaine, le bilan et le jour ──────────

/**
 * Les lignes à faire pour une séance du plan : la semaine 6 est plus légère (séries × 0,6, cible au bas de la
 * fourchette), le bilan de la semaine précédente ajoute ou retire une série, et un jour difficile donne une
 * version courte (3 exercices, une série de moins).
 */
export function lignesPourSeance(lignes: LignePlan[], o: { semaine: number; ajust?: number; courte?: boolean }): LigneSeance[] {
  const decharge = o.semaine >= SEMAINES;
  const res = lignes.map((l) => {
    let series = l.series;
    if (decharge) series = Math.max(2, Math.round(series * 0.6));
    if (l.role === "base") series = Math.min(6, Math.max(2, series + (o.ajust ?? 0)));
    return enLigneSeance({ ...l, series }, decharge && l.role === "base" ? l.bas : l.haut);
  });
  return o.courte ? res.slice(0, 3).map((l) => ({ ...l, series: Math.max(1, l.series - 1) })) : res;
}

// ─── Progression ────────────────────────────────────────────────────────

/** Séries à atteindre le haut de la fourchette, de suite, avant de monter. */
export const SEANCES_AU_PLAFOND = 2;

/**
 * Après une séance : toutes les séries prévues au haut de la fourchette ? Le compteur monte d'un cran, sinon il repart
 * à zéro. À SEANCES_AU_PLAFOND, l'exercice monte. La semaine de décharge et les étapes de skill ne comptent pas.
 */
export function evaluerProgression(l: Pick<LignePlan, "series" | "haut" | "role">, faites: number[], atteint: number, semaine: number): { atteint: number; monte: boolean } {
  if (l.role === "skill" || semaine >= SEMAINES) return { atteint, monte: false };
  const auPlafond = faites.length >= l.series && faites.slice(0, l.series).every((v) => v >= l.haut);
  const n = auPlafond ? atteint + 1 : 0;
  return { atteint: n >= SEANCES_AU_PLAFOND ? 0 : n, monte: n >= SEANCES_AU_PLAFOND };
}

export type Raison = "poids" | "variante" | "repetitions";

/**
 * L'exercice monte : plus de poids (le suivant de mes haltères, sinon +1 kg), sinon la variante plus dure
 * si mon matériel la permet, sinon une fourchette plus haute (+2 répétitions, +5 secondes).
 */
export function monter(l: LignePlan, m: Materiel, objectif: ObjectifPlan): { ligne: LignePlan; raison: Raison } {
  const e = exercice(l.exercice)!;
  if (e.mode === "reps_poids" && l.poids) {
    const suivant = m.poids.find((p) => p > l.poids!) ?? l.poids + 1;
    return { ligne: { ...l, poids: suivant, ...fourchetteDe(e, objectif) }, raison: "poids" };
  }
  const dur = e.plus_dur ? exercice(e.plus_dur) : undefined;
  if (dur && faisable(dur, m)) {
    const p = plageDe(dur, objectif);
    return { ligne: { ...l, exercice: dur.id, bas: p.bas, haut: p.haut, poids: poidsDeDepart(dur, m) }, raison: "variante" };
  }
  const pas = e.mode === "s" ? 5 : 2;
  return { ligne: { ...l, bas: l.bas + pas, haut: l.haut + pas }, raison: "repetitions" };
}

const fourchetteDe = (e: Parameters<typeof plageDe>[0], objectif: ObjectifPlan) => {
  const p = plageDe(e, objectif);
  return { bas: p.bas, haut: p.haut };
};

export const libelleRaison = (r: Raison, nouvelExercice?: string): string =>
  r === "poids" ? "un peu plus lourd" : r === "variante" ? `variante plus dure : ${nouvelExercice}` : "fourchette plus haute";

// ─── Calendrier ─────────────────────────────────────────────────────────

/** Jours de la semaine (0 = dimanche) → les `n` prochaines dates sur ces jours, à partir de `depart` compris. */
export function calendrier(n: number, jours: number[], depart: string): string[] {
  if (jours.length === 0) return [];
  const res: string[] = [];
  for (let i = 0; res.length < n && i < 800; i++) {
    const d = decalerJours(depart, i);
    if (jours.includes(new Date(d + "T00:00:00Z").getUTCDay())) res.push(d);
  }
  return res;
}

export const lundiDe = (iso: string): string => decalerJours(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));

export type SeancePlanne = { id: number; ordre: number; semaine: number; nom: string; jour: string; statut: "a_faire" | "faite"; /** Jour où elle a été faite. */ fait_le?: string | null };

/** Les 7 jours de la semaine de `jour` (lundi → dimanche), avec la séance faite ce jour-là, ou prévue (à faire). */
export function semaineCalendaire(seances: SeancePlanne[], jour: string) {
  const lundi = lundiDe(jour);
  return Array.from({ length: 7 }, (_, i) => {
    const d = decalerJours(lundi, i);
    return { jour: d, seance: seances.find((s) => (s.statut === "faite" ? (s.fait_le ?? s.jour) : s.jour) === d) ?? null };
  });
}

/** Le bilan du dimanche règle la semaine suivante : trop facile = une série de plus, trop dur = une de moins. */
export const ajustementDuBilan = (ressenti: string): number => (ressenti === "facile" ? 1 : ressenti === "dur" ? -1 : 0);

// ─── Progression vers l'objectif ────────────────────────────────────────

export type ProgressionTest = { cle: CleTest; premier: number | null; dernier: number | null };

/** Part de l'objectif atteinte (0 à 1) : l'étape du skill, ou l'amélioration des tests (+50 % = complet), ou la régularité. */
export function jaugeObjectif(p: {
  objectif: ObjectifPlan;
  skillEtape?: number;
  skillNbEtapes?: number;
  tests: ProgressionTest[];
  faites: number;
  prevues: number;
}): number {
  if (p.objectif === "skill" && p.skillNbEtapes) return Math.min(1, Math.max(0, ((p.skillEtape ?? 1) - 1) / p.skillNbEtapes));
  if (p.objectif === "mobilite") return p.prevues === 0 ? 0 : Math.min(1, p.faites / p.prevues);
  const gains = p.tests.flatMap((t) => (t.premier !== null && t.dernier !== null ? [Math.min(1, Math.max(0, (t.dernier - t.premier) / Math.max(1, t.premier) / 0.5))] : []));
  return gains.length ? gains.reduce((s, x) => s + x, 0) / gains.length : 0;
}
