/**
 * Règles de l'onglet Suivi (sommeil, sport) et des liens dans Progression,
 * sans accès à la base : testables seules (tests/suivi.test.mjs).
 */

// ─── Sommeil ────────────────────────────────────────────────────────────

/** « 23:30 » → 1410 minutes depuis minuit. */
export function minutesDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 1410 → « 23:30 », sur 24 h (les minutes débordantes reviennent dans la journée). */
export function hhmmDe(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function decalerHeure(hhmm: string, deltaMin: number): string {
  return hhmmDe(minutesDe(hhmm) + deltaMin);
}

/**
 * Durée de la nuit en minutes. Un coucher après le lever sur l'horloge
 * (23:30 → 07:00) passe minuit. Coucher = lever : 0.
 */
export function dureeSommeilMin(coucher: string, lever: string): number {
  return (minutesDe(lever) - minutesDe(coucher) + 1440) % 1440;
}

/** 450 → « 7 h 30 ». */
export function dureeLisible(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Écart type de l'heure de coucher, en minutes. Les couchers avant midi
 * comptent comme « après minuit » (00:30 = 24:30), pour que 23:30 et
 * 00:30 soient à une heure d'écart et non à 23. Null sous 2 nuits.
 */
export function ecartTypeCoucherMin(couchers: string[]): number | null {
  if (couchers.length < 2) return null;
  const v = couchers.map((c) => {
    const m = minutesDe(c);
    return m < 720 ? m + 1440 : m;
  });
  const moy = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - moy) ** 2, 0) / v.length);
}

export function phraseRegularite(ecartMin: number | null): string {
  if (ecartMin === null) return "Régularité : il faut au moins 2 nuits.";
  const arrondi = Math.round(ecartMin);
  const mot =
    ecartMin <= 30
      ? "très régulier"
      : ecartMin <= 60
        ? "assez régulier"
        : ecartMin <= 90
          ? "plutôt irrégulier"
          : "irrégulier";
  return `Coucher ${mot} (± ${arrondi} min)`;
}

export const QUALITES = { 1: "mauvaise", 2: "moyenne", 3: "bonne" } as const;
export type Qualite = 1 | 2 | 3;

/** Points (voir REGLES_POINTS) : une fois par nuit, une fois par séance même partielle. */
export const POINTS_NUIT = 5;
export const POINTS_SEANCE = 10;

// ─── Sport : échelles de callisthénie ───────────────────────────────────

export type Famille = "pousser" | "tirer" | "jambes" | "gainage";
export type Unite = "reps" | "s";
export type Palier = {
  nom: string;
  /** Objectif bas et haut par série (répétitions ou secondes). */
  bas: number;
  haut: number;
  /** Palier qui demande une barre de traction. */
  barre?: boolean;
};

export const FAMILLES: Famille[] = ["pousser", "tirer", "jambes", "gainage"];
export const SERIES_PAR_EXERCICE = 3;
/** Séances réussies d'affilée au palier avant de proposer le suivant. */
export const SEANCES_POUR_MONTER = 2;
/** Rythme indicatif, sans jour imposé. */
export const SEANCES_PAR_SEMAINE = 3;

export const LIBELLES_FAMILLE: Record<Famille, string> = {
  pousser: "Pousser",
  tirer: "Tirer",
  jambes: "Jambes",
  gainage: "Gainage",
};

export const UNITE: Record<Famille, Unite> = {
  pousser: "reps",
  tirer: "reps",
  jambes: "reps",
  gainage: "s",
};

/** Paliers du plus facile au plus dur ; le palier n est ECHELLES[f][n - 1]. */
export const ECHELLES: Record<Famille, Palier[]> = {
  pousser: [
    { nom: "Pompes au mur", bas: 8, haut: 12 },
    { nom: "Pompes inclinées (table)", bas: 8, haut: 12 },
    { nom: "Pompes sur les genoux", bas: 8, haut: 12 },
    { nom: "Pompes", bas: 8, haut: 12 },
    { nom: "Pompes déclinées (pieds surélevés)", bas: 6, haut: 10 },
    { nom: "Pompes diamant", bas: 6, haut: 10 },
  ],
  tirer: [
    { nom: "Rowing sous une table", bas: 8, haut: 12 },
    { nom: "Rowing australien", bas: 8, haut: 12 },
    { nom: "Tractions négatives (5 s de descente)", bas: 3, haut: 6, barre: true },
    { nom: "Tractions pieds au sol (assistées par les jambes)", bas: 5, haut: 8, barre: true },
    { nom: "Tractions", bas: 3, haut: 8, barre: true },
  ],
  jambes: [
    { nom: "Squat", bas: 10, haut: 15 },
    { nom: "Fente (par jambe)", bas: 8, haut: 12 },
    { nom: "Squat bulgare (par jambe)", bas: 6, haut: 10 },
    { nom: "Pistol assisté (par jambe)", bas: 3, haut: 6 },
  ],
  gainage: [
    { nom: "Planche sur les genoux", bas: 20, haut: 40 },
    { nom: "Planche", bas: 30, haut: 60 },
    { nom: "Hollow hold", bas: 20, haut: 40 },
  ],
};

/** Nombre de paliers accessibles : sans barre, Tirer s'arrête aux rowings. */
export function nbPaliers(f: Famille, barre: boolean): number {
  return ECHELLES[f].filter((p) => barre || !p.barre).length;
}

export function palier(f: Famille, n: number): Palier {
  return ECHELLES[f][Math.max(1, Math.min(ECHELLES[f].length, n)) - 1];
}

/** « Je ne sais pas » : palier 2 pour Pousser (le mur est trop facile), 1 sinon. */
export function palierDepart(f: Famille, choix: number | "inconnu", barre: boolean): number {
  const n = choix === "inconnu" ? (f === "pousser" ? 2 : 1) : choix;
  return Math.max(1, Math.min(nbPaliers(f, barre), n));
}

/** Les 3 séries atteignent l'objectif haut. */
export function seanceReussie(realise: number[], haut: number): boolean {
  return (
    realise.length >= SERIES_PAR_EXERCICE &&
    realise.slice(0, SERIES_PAR_EXERCICE).every((r) => r >= haut)
  );
}

/**
 * Faut-il proposer le palier suivant ?
 * `seances` : les séances de cette famille AU PALIER ACTUEL, la plus récente
 * d'abord, avec leur fin (ISO) et les séries réalisées.
 * `dernierRefus` : horodatage du dernier refus de monter depuis ce palier.
 * Il faut 2 séances réussies d'affilée, toutes deux après le dernier refus.
 */
export function proposerMontee(params: {
  seances: { fin: string; realise: number[] }[];
  haut: number;
  palierActuel: number;
  palierMax: number;
  dernierRefus: string | null;
}): boolean {
  const { seances, haut, palierActuel, palierMax, dernierRefus } = params;
  if (palierActuel >= palierMax) return false;
  const recentes = seances.slice(0, SEANCES_POUR_MONTER);
  if (recentes.length < SEANCES_POUR_MONTER) return false;
  if (!recentes.every((s) => seanceReussie(s.realise, haut))) return false;
  if (dernierRefus && recentes.some((s) => s.fin <= dernierRefus)) return false;
  return true;
}

// ─── Liens dans Progression ─────────────────────────────────────────────

/** Jours minimum dans chaque groupe avant d'afficher une comparaison. */
export const SEUIL_JOURS = 7;

export type Comparaison =
  | { ok: true; moyA: number; moyB: number; nA: number; nB: number }
  | { ok: false; avancement: number };

const moyenne = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/** Compare deux groupes de valeurs journalières, ou dit où on en est (x/7). */
export function comparer(a: number[], b: number[]): Comparaison {
  if (a.length < SEUIL_JOURS || b.length < SEUIL_JOURS) {
    return { ok: false, avancement: Math.min(a.length, b.length, SEUIL_JOURS) };
  }
  return { ok: true, moyA: moyenne(a), moyB: moyenne(b), nA: a.length, nB: b.length };
}

export function phraseAttente(c: { avancement: number }): string {
  return `Pas encore assez de données (${c.avancement}/${SEUIL_JOURS})`;
}
