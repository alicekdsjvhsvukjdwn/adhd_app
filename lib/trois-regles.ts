/**
 * « Mes 3 » sans accès à la base : testable seul (tests/trois.test.mjs).
 * Les poids du moteur ne changent que pour ces tâches-là ; les listes
 * gardent le classement habituel.
 */
import { POIDS, scoreTotal, type ComposantesScore } from "./moteur-regles";

export type ModeTrois = "choisis" | "appli" | "melange";
/** 0 = moins, 1 = comme d'habitude, 2 = plus. */
export type Curseur = 0 | 1 | 2;

export type PrefsTrois = {
  mode: ModeTrois;
  nombre: number;
  /** liste_id → jours de la semaine exclus (0 = dimanche, convention JS). */
  exclusions: Record<number, number[]>;
  curseurs: { echeance: Curseur; priorite: Curseur; varier: Curseur };
};

export const PREFS_DEFAUT: PrefsTrois = {
  mode: "melange",
  nombre: 3,
  exclusions: {},
  curseurs: { echeance: 1, priorite: 1, varier: 1 },
};

/** Valeurs lues en base : tout ce qui manque ou déraille retombe sur le défaut. */
export function prefsValides(brut: unknown): PrefsTrois {
  const b = (brut && typeof brut === "object" ? brut : {}) as Partial<PrefsTrois>;
  const cur = (v: unknown, d: Curseur): Curseur => (v === 0 || v === 1 || v === 2 ? v : d);
  const n = Number(b.nombre);
  return {
    mode: b.mode === "choisis" || b.mode === "appli" || b.mode === "melange" ? b.mode : PREFS_DEFAUT.mode,
    nombre: Number.isInteger(n) && n >= 1 && n <= 5 ? n : PREFS_DEFAUT.nombre,
    exclusions: b.exclusions && typeof b.exclusions === "object" ? b.exclusions : {},
    curseurs: {
      echeance: cur(b.curseurs?.echeance, 1),
      priorite: cur(b.curseurs?.priorite, 1),
      varier: cur(b.curseurs?.varier, 1),
    },
  };
}

const FACTEUR = [0.5, 1, 2] as const;
/** Pénalité de score par tâche déjà retenue dans la même liste. */
const PENALITE_LISTE = [0, 0.08, 0.2] as const;

/** Poids du moteur pour les 3 : échéance et priorité modulées, somme remise à 1. */
export function poidsTrois(c: PrefsTrois["curseurs"]): Record<keyof typeof POIDS, number> {
  const p: Record<keyof typeof POIDS, number> = { ...POIDS };
  p.urgence *= FACTEUR[c.echeance];
  p.importance *= FACTEUR[c.priorite];
  const somme = Object.values(p).reduce((s, x) => s + x, 0);
  for (const k of Object.keys(p) as (keyof typeof POIDS)[]) p[k] /= somme;
  return p;
}

/** Au-delà de ces minutes de rendez-vous, la journée est « chargée » / « très chargée ». */
export const CHARGE_FORTE_MIN = 240;
export const CHARGE_MOYENNE_MIN = 120;

/** Bonus ou malus selon la durée de la tâche quand la journée est chargée en rendez-vous. */
export function bonusCharge(dureeMin: number | null, chargeMin: number): number {
  if (dureeMin == null || chargeMin < CHARGE_MOYENNE_MIN) return 0;
  const f = chargeMin >= CHARGE_FORTE_MIN ? 1 : 0.5;
  if (dureeMin <= 15) return 0.15 * f;
  if (dureeMin <= 30) return 0.05 * f;
  return -0.1 * f;
}

export type CandidatTrois = {
  itemId: number;
  liste_id: number | null;
  duree_min: number | null;
  composantes: ComposantesScore;
};

/**
 * Candidats du jour dans l'ordre des 3 : listes exclues ce jour de la semaine
 * retirées, score recalculé avec les poids des 3 (+ charge du jour), puis
 * choix un par un en pénalisant une liste déjà représentée (curseur « varier »).
 */
export function ordreTrois<T extends CandidatTrois>(
  candidats: T[],
  prefs: PrefsTrois,
  jourSemaine: number,
  chargeMin: number,
): (T & { scoreTrois: number })[] {
  const poids = poidsTrois(prefs.curseurs);
  let reste = candidats
    .filter((c) => c.liste_id === null || !prefs.exclusions[c.liste_id]?.includes(jourSemaine))
    .map((c) => ({ ...c, scoreTrois: scoreTotal(c.composantes, poids) + bonusCharge(c.duree_min, chargeMin) }));
  const pen = PENALITE_LISTE[prefs.curseurs.varier];
  const ordre: (T & { scoreTrois: number })[] = [];
  const vues = new Map<number | null, number>();
  while (reste.length) {
    let meilleur = 0;
    let max = -Infinity;
    reste.forEach((c, i) => {
      const s = c.scoreTrois - pen * (vues.get(c.liste_id) ?? 0);
      if (s > max) {
        max = s;
        meilleur = i;
      }
    });
    const [pris] = reste.splice(meilleur, 1);
    ordre.push(pris);
    vues.set(pris.liste_id, (vues.get(pris.liste_id) ?? 0) + 1);
  }
  return ordre;
}

export type SourceTrois = "choisi" | "report" | "moteur";

/**
 * Les tâches d'un jour à la première ouverture.
 * - « l'appli choisit » : le moteur, rien d'autre ;
 * - choix fait la veille : ces tâches (+ le moteur pour compléter, en « mélange ») ;
 * - sinon : d'abord les tâches des 3 de la veille pas faites, puis le moteur.
 * `ordre` : ids encore à faire, dans l'ordre du moteur. Une tâche déjà faite ne revient pas.
 */
export function composerTrois(p: {
  mode: ModeTrois;
  nombre: number;
  choisis: number[];
  veille: number[];
  ordre: number[];
}): { itemId: number; source: SourceTrois }[] {
  const afaire = new Set(p.ordre);
  const sortie: { itemId: number; source: SourceTrois }[] = [];
  const prendre = (ids: number[], source: SourceTrois) => {
    for (const id of ids) {
      if (sortie.length >= p.nombre) return;
      if (afaire.has(id) && !sortie.some((s) => s.itemId === id)) sortie.push({ itemId: id, source });
    }
  };
  if (p.mode === "appli") {
    prendre(p.ordre, "moteur");
  } else if (p.choisis.length > 0) {
    prendre(p.choisis, "choisi");
    if (p.mode === "melange") prendre(p.ordre, "moteur");
  } else {
    prendre(p.veille, "report");
    prendre(p.ordre, "moteur");
  }
  return sortie;
}
