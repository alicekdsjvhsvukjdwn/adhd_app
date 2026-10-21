import { decalerJours } from "../dates";
import {
  ajustementDuBilan,
  calendrier,
  CLES_TESTS,
  evaluerProgression,
  genererSlots,
  lignesPourSeance,
  lundiDe,
  monter,
  niveauxDepuisTests,
  SEMAINES,
  type CleTest,
  type DureePlan,
  type EtapeSkill,
  type LignePlan,
  type Niveaux,
  type ObjectifPlan,
  type ProgressionTest,
  type Raison,
  type ResultatsTests,
  type SeancePlanne,
  type SlotPlan,
} from "../plan-sport";
import { exercice } from "../exercices";
import type { Materiel } from "../materiel";
import type { LigneSeance } from "../seances-sport";
import { maitrise, skill as skillDe } from "../skills";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { estJourDifficile } from "./jour-difficile";
import { getEtats } from "./sport";
import { getMateriel } from "./sport-materiel";

/**
 * Le plan de sport (le coach) : un plan actif à la fois. Les séances à faire se rangent sur mes jours à partir
 * d'aujourd'hui : si j'en rate une, les suivantes se décalent, rien n'est « manqué ». Tout est expliqué dans lib/plan-sport.ts.
 */

export type SeancePlanDb = SeancePlanne & { ajust: number; seance_id: number | null; fait_le: string | null; slot: number };

export type PlanActif = {
  id: number;
  objectif: ObjectifPlan;
  skill: string;
  jours: number[];
  duree: DureePlan;
  niveaux: Niveaux;
  debut: string;
  slots: SlotPlan[];
  seances: SeancePlanDb[];
};

type LigneDb = { id: number; slot: number; rang: number; exercice_id: string; series: number; bas: number; haut: number; poids: number | null; repos_s: number; role: string; atteint: number };

const joursDe = (s: string): number[] => s.split(",").filter((x) => x !== "").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

/** L'étape en cours du skill choisi (ou la dernière s'il est maîtrisé). */
export async function etapeDuSkill(id: string): Promise<(EtapeSkill & { numero: number }) | null> {
  const s = skillDe(id);
  if (!s) return null;
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  const maitrise_ = maitrise(s, etat);
  const numero = maitrise_ ? s.etapes.length : etat.etape;
  const et = s.etapes[numero - 1];
  return { exercice: et.exercice, series: maitrise_ ? 1 : et.series, objectif: et.objectif, numero };
}

export async function planActif(): Promise<PlanActif | null> {
  const db = await getDatabase();
  const p = await db.getFirstAsync<{ id: number; objectif: string; skill: string; jours: string; duree: number; niveaux: string; debut: string }>(
    "SELECT id, objectif, skill, jours, duree, niveaux, debut FROM sport_plan WHERE statut = 'actif' ORDER BY id DESC LIMIT 1",
  );
  if (!p) return null;
  const lignes = await db.getAllAsync<LigneDb>(
    "SELECT id, slot, rang, exercice_id, series, bas, haut, poids, repos_s, role, atteint FROM sport_plan_lignes WHERE plan_id = ? ORDER BY slot, rang",
    p.id,
  );
  const seances = await db.getAllAsync<SeancePlanDb>(
    "SELECT id, ordre, slot, semaine, nom, jour, statut, ajust, seance_id, fait_le FROM sport_plan_seances WHERE plan_id = ? ORDER BY ordre",
    p.id,
  );
  const etapeSkill = p.skill ? await etapeDuSkill(p.skill) : null;
  const nbSlots = Math.max(...lignes.map((l) => l.slot), seances.reduce((m, s) => Math.max(m, s.slot), 0)) + 1;
  const slots: SlotPlan[] = Array.from({ length: nbSlots }, (_, slot) => ({
    nom: seances.find((s) => s.slot === slot)?.nom ?? "",
    focus: [],
    lignes: lignes
      .filter((l) => l.slot === slot && exercice(l.exercice_id))
      .map((l) => {
        const base: LignePlan = { exercice: l.exercice_id, series: l.series, bas: l.bas, haut: l.haut, poids: l.poids, repos_s: l.repos_s, role: l.role === "skill" ? "skill" : "base" };
        // L'étape du skill avance quand je la valide : la ligne suit toujours l'étape en cours.
        return base.role === "skill" && etapeSkill ? { ...base, exercice: etapeSkill.exercice, series: etapeSkill.series, bas: etapeSkill.objectif, haut: etapeSkill.objectif } : base;
      }),
  }));
  return {
    id: p.id,
    objectif: (p.objectif as ObjectifPlan) || "force",
    skill: p.skill,
    jours: joursDe(p.jours),
    duree: ([20, 30, 45].includes(p.duree) ? p.duree : 30) as DureePlan,
    niveaux: safeJson(p.niveaux),
    debut: p.debut,
    slots,
    seances,
  };
}

function safeJson(s: string): Niveaux {
  try {
    const n = JSON.parse(s);
    return { poussee: n.poussee ?? 2, jambes: n.jambes ?? 2, tronc: n.tronc ?? 2, tirage: n.tirage ?? 2 };
  } catch {
    return { poussee: 2, jambes: 2, tronc: 2, tirage: 2 };
  }
}

// ─── Tests de niveau ────────────────────────────────────────────────────

export async function enregistrerTests(planId: number, r: ResultatsTests, jour: string = getAujourdhui()): Promise<void> {
  const db = await getDatabase();
  for (const cle of CLES_TESTS) {
    const v = r[cle];
    if (typeof v === "number" && v >= 0) await db.runAsync("INSERT INTO sport_tests (plan_id, jour, cle, valeur) VALUES (?, ?, ?, ?)", planId, jour, cle, Math.round(v));
  }
}

/** Le dernier résultat de chaque test (pour recalculer mes niveaux sans refaire les tests). */
export async function derniersTests(): Promise<ResultatsTests> {
  const db = await getDatabase();
  const l = await db.getAllAsync<{ cle: CleTest; valeur: number }>("SELECT cle, valeur FROM sport_tests ORDER BY id");
  const r: ResultatsTests = {};
  for (const x of l) r[x.cle] = x.valeur;
  return r;
}

/** Premier et dernier résultat de chaque test, pour les comparer. */
export async function testsProgression(): Promise<ProgressionTest[]> {
  const db = await getDatabase();
  const l = await db.getAllAsync<{ cle: CleTest; valeur: number }>("SELECT cle, valeur FROM sport_tests ORDER BY id");
  return CLES_TESTS.flatMap((cle) => {
    const v = l.filter((x) => x.cle === cle);
    return v.length ? [{ cle, premier: v[0].valeur, dernier: v[v.length - 1].valeur }] : [];
  });
}

// ─── Créer, ajuster ─────────────────────────────────────────────────────

/**
 * Crée le plan (le précédent est terminé) : séances types, 6 semaines de séances rangées sur mes jours, et les tests.
 * Sans `tests`, les niveaux viennent des derniers tests faits (ajuster mon plan, nouveau cycle).
 */
export async function creerPlan(p: {
  objectif: ObjectifPlan;
  skill?: string;
  jours: number[];
  duree: DureePlan;
  materiel: Materiel;
  tests?: ResultatsTests;
  aujourdhui?: string;
}): Promise<number> {
  const db = await getDatabase();
  const aujourdhui = p.aujourdhui ?? getAujourdhui();
  const jours = [...new Set(p.jours)].filter((j) => j >= 0 && j <= 6).sort((a, b) => a - b);
  if (jours.length === 0) throw new Error("Il faut au moins un jour.");
  const niveaux = niveauxDepuisTests(p.tests ?? (await derniersTests()));
  const skill = p.objectif === "skill" && p.skill ? p.skill : "";
  const etape = skill ? await etapeDuSkill(skill) : null;
  const slots = genererSlots({ objectif: p.objectif, nbJours: jours.length, duree: p.duree, niveaux, materiel: p.materiel, skill: etape });
  const dates = calendrier(slots.length * SEMAINES, jours, aujourdhui);

  let id = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE sport_plan SET statut = 'termine' WHERE statut = 'actif'");
    id = (
      await db.runAsync(
        "INSERT INTO sport_plan (objectif, skill, jours, duree, niveaux, debut, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
        p.objectif,
        skill,
        jours.join(","),
        p.duree,
        JSON.stringify(niveaux),
        aujourdhui,
        new Date().toISOString(),
      )
    ).lastInsertRowId;
    for (const [slot, s] of slots.entries()) {
      for (const [rang, l] of s.lignes.entries()) {
        await db.runAsync(
          "INSERT INTO sport_plan_lignes (plan_id, slot, rang, exercice_id, series, bas, haut, poids, repos_s, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          id,
          slot,
          rang,
          l.exercice,
          l.series,
          l.bas,
          l.haut,
          l.poids,
          l.repos_s,
          l.role,
        );
      }
    }
    for (let k = 0; k < slots.length * SEMAINES; k++) {
      const slot = k % slots.length;
      await db.runAsync(
        "INSERT INTO sport_plan_seances (plan_id, ordre, slot, semaine, nom, jour) VALUES (?, ?, ?, ?, ?, ?)",
        id,
        k,
        slot,
        Math.floor(k / slots.length) + 1,
        slots[slot].nom,
        dates[k] ?? "",
      );
    }
  });
  if (p.tests) await enregistrerTests(id, p.tests, aujourdhui);
  return id;
}

// ─── Le calendrier se décale, sans reproche ─────────────────────────────

/**
 * Les séances pas encore faites se rangent sur mes prochains jours, à partir d'aujourd'hui (demain si la séance
 * du jour est faite). Une séance ratée n'est donc jamais « manquée » : la suite avance d'un cran.
 */
export async function replanifier(aujourdhui: string = getAujourdhui()): Promise<void> {
  const plan = await planActif();
  if (!plan) return;
  const db = await getDatabase();
  const restantes = plan.seances.filter((s) => s.statut === "a_faire");
  const faiteAujourdhui = plan.seances.some((s) => s.statut === "faite" && s.fait_le === aujourdhui);
  const dates = calendrier(restantes.length, plan.jours, faiteAujourdhui ? decalerJours(aujourdhui, 1) : aujourdhui);
  for (const [i, s] of restantes.entries()) {
    if ((dates[i] ?? "") !== s.jour) await db.runAsync("UPDATE sport_plan_seances SET jour = ? WHERE id = ?", dates[i] ?? "", s.id);
  }
}

// ─── Séance du jour ─────────────────────────────────────────────────────

export type SeanceDuPlan = {
  plan: PlanActif;
  planSeance: SeancePlanDb;
  nom: string;
  lignes: LigneSeance[];
  /** Jour difficile : la version courte est proposée. */
  courte: boolean;
  /** La séance est prévue aujourd'hui (sinon c'est la prochaine, faite plus tôt). */
  aujourdhui: boolean;
};

export function lignesDe(plan: PlanActif, ps: SeancePlanDb, courte = false): LigneSeance[] {
  return lignesPourSeance(plan.slots[ps.slot]?.lignes ?? [], { semaine: ps.semaine, ajust: ps.ajust, courte });
}

/** La séance du jour (replanifie d'abord) ; sinon null (jour de repos, ou cycle terminé). */
export async function seanceDuJour(aujourdhui: string = getAujourdhui()): Promise<SeanceDuPlan | null> {
  await replanifier(aujourdhui);
  const plan = await planActif();
  if (!plan) return null;
  const ps = plan.seances.find((s) => s.statut === "a_faire" && s.jour === aujourdhui);
  if (!ps) return null;
  const courte = await estJourDifficile(aujourdhui);
  return { plan, planSeance: ps, nom: ps.nom, lignes: lignesDe(plan, ps, courte), courte, aujourdhui: true };
}

/** La prochaine séance à faire, même un jour de repos (« Faire la prochaine quand même »). */
export async function prochaineSeance(): Promise<SeanceDuPlan | null> {
  const plan = await planActif();
  const ps = plan?.seances.find((s) => s.statut === "a_faire");
  return plan && ps ? { plan, planSeance: ps, nom: ps.nom, lignes: lignesDe(plan, ps), courte: false, aujourdhui: ps.jour === getAujourdhui() } : null;
}

export async function lignesDeSeancePlan(planSeanceId: number, courte = false): Promise<{ nom: string; lignes: LigneSeance[] } | null> {
  const plan = await planActif();
  const ps = plan?.seances.find((s) => s.id === planSeanceId);
  return plan && ps ? { nom: ps.nom, lignes: lignesDe(plan, ps, courte) } : null;
}

// ─── Après une séance : progression ─────────────────────────────────────

export type EvenementPlan = { exercice: string; raison: Raison; nouvelExercice: string };

/**
 * La séance est faite : elle compte dans le plan, et chaque exercice dont toutes les séries ont atteint le haut de
 * la fourchette avance son compteur ; au 2ᵉ, il monte. Sans effet la semaine de décharge. Rejouée : rien de plus.
 */
export async function validerSeancePlan(planSeanceId: number, seanceId: number): Promise<{ evenements: EvenementPlan[] }> {
  const plan = await planActif();
  const ps = plan?.seances.find((s) => s.id === planSeanceId);
  if (!plan || !ps || ps.statut === "faite") return { evenements: [] };
  const db = await getDatabase();
  const materiel = await getMateriel();
  const seance = await db.getFirstAsync<{ date: string }>("SELECT date FROM seances WHERE id = ?", seanceId);
  await db.runAsync("UPDATE sport_plan_seances SET statut = 'faite', seance_id = ?, fait_le = ? WHERE id = ?", seanceId, seance?.date ?? getAujourdhui(), planSeanceId);

  const lignes = await db.getAllAsync<LigneDb>(
    "SELECT id, slot, rang, exercice_id, series, bas, haut, poids, repos_s, role, atteint FROM sport_plan_lignes WHERE plan_id = ? AND slot = ? ORDER BY rang",
    plan.id,
    ps.slot,
  );
  const evenements: EvenementPlan[] = [];
  for (const l of lignes) {
    const faites = (
      await db.getAllAsync<{ realise: number }>("SELECT realise FROM series WHERE seance_id = ? AND exercice_id = ? AND realise > 0 ORDER BY numero", seanceId, l.exercice_id)
    ).map((x) => x.realise);
    if (faites.length === 0) continue;
    const ligne: LignePlan = { exercice: l.exercice_id, series: l.series, bas: l.bas, haut: l.haut, poids: l.poids, repos_s: l.repos_s, role: l.role === "skill" ? "skill" : "base" };
    const r = evaluerProgression(ligne, faites, l.atteint, ps.semaine);
    if (r.monte) {
      const m = monter(ligne, materiel, plan.objectif);
      await db.runAsync(
        "UPDATE sport_plan_lignes SET exercice_id = ?, bas = ?, haut = ?, poids = ?, atteint = 0 WHERE id = ?",
        m.ligne.exercice,
        m.ligne.bas,
        m.ligne.haut,
        m.ligne.poids,
        l.id,
      );
      evenements.push({ exercice: l.exercice_id, raison: m.raison, nouvelExercice: exercice(m.ligne.exercice)?.nom ?? m.ligne.exercice });
    } else {
      await db.runAsync("UPDATE sport_plan_lignes SET atteint = ? WHERE id = ?", r.atteint, l.id);
    }
  }
  await replanifier();
  return { evenements };
}

// ─── Bilan du dimanche ──────────────────────────────────────────────────

/** Le lundi de la semaine dont le bilan est à faire (dimanche : celle-ci ; lundi : celle d'avant), sinon null. */
function semaineDuBilan(aujourdhui: string): string | null {
  const dow = new Date(aujourdhui + "T00:00:00Z").getUTCDay();
  return dow === 0 ? lundiDe(aujourdhui) : dow === 1 ? decalerJours(lundiDe(aujourdhui), -7) : null;
}

/** Faut-il demander « c'était comment ? » : dimanche (ou lundi), s'il y a eu une séance cette semaine et pas encore de bilan. */
export async function bilanARepondre(aujourdhui: string = getAujourdhui()): Promise<string | null> {
  const plan = await planActif();
  const lundi = semaineDuBilan(aujourdhui);
  if (!plan || !lundi) return null;
  const faite = plan.seances.some((s) => s.statut === "faite" && s.fait_le !== null && s.fait_le >= lundi && s.fait_le <= decalerJours(lundi, 6));
  if (!faite) return null;
  const db = await getDatabase();
  const deja = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM sport_bilans WHERE semaine = ? AND plan_id = ?", lundi, plan.id);
  return deja?.n ? null : lundi;
}

/** Trop facile / OK / trop dur : la semaine suivante gagne ou perd une série par exercice. */
export async function enregistrerBilan(ressenti: "facile" | "ok" | "dur", aujourdhui: string = getAujourdhui()): Promise<void> {
  const plan = await planActif();
  const lundi = semaineDuBilan(aujourdhui);
  if (!plan || !lundi) return;
  const db = await getDatabase();
  await db.runAsync("INSERT OR REPLACE INTO sport_bilans (semaine, plan_id, ressenti, cree_le) VALUES (?, ?, ?, ?)", lundi, plan.id, ressenti, new Date().toISOString());
  await db.runAsync(
    "UPDATE sport_plan_seances SET ajust = ? WHERE plan_id = ? AND statut = 'a_faire' AND jour >= ? AND jour <= ?",
    ajustementDuBilan(ressenti),
    plan.id,
    decalerJours(lundi, 7),
    decalerJours(lundi, 13),
  );
}

// ─── Vue d'ensemble ─────────────────────────────────────────────────────

export type ResumePlan = { faites: number; prevues: number; semaine: number; cycleTermine: boolean };

export function resumeDuPlan(plan: PlanActif): ResumePlan {
  const faites = plan.seances.filter((s) => s.statut === "faite").length;
  const prochaine = plan.seances.find((s) => s.statut === "a_faire");
  return { faites, prevues: plan.seances.length, semaine: prochaine ? prochaine.semaine : SEMAINES, cycleTermine: !prochaine };
}
