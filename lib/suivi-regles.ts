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

export const QUALITES = { 1: "mauvaise", 2: "moyenne", 3: "bonne" } as const;
export type Qualite = 1 | 2 | 3;

/** Points (voir REGLES_POINTS) : une fois par nuit, une fois par séance même partielle. */
export const POINTS_NUIT = 5;
export const POINTS_SEANCE = 10;

/** Une nuit ne rapporte que si elle est des 7 derniers jours (aujourd'hui compris). */
export const JOURS_NUIT_POINTS = 7;

/** La nuit du `date` rapporte-t-elle des points, notée `aujourdhui` (dates YYYY-MM-DD) ? */
export function nuitRapporte(date: string, aujourdhui: string): boolean {
  const ecartJ = Math.round((Date.parse(aujourdhui) - Date.parse(date)) / 86400000);
  return ecartJ >= 0 && ecartJ < JOURS_NUIT_POINTS;
}

// ─── Sommeil en un geste ────────────────────────────────────────────────

/**
 * Nuit en cours (meta nuit_en_cours) : jour et heure locaux du coucher,
 * « AAAA-MM-JJ HH:MM ». Pas d'ISO UTC : le jour du lever se lit sans fuseau.
 */
export type Coucher = { date: string; heure: string };

export const lireCoucher = (v: string | null): Coucher | null =>
  v && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v) ? { date: v.slice(0, 10), heure: v.slice(11) } : null;

export const ecrireCoucher = (c: Coucher) => `${c.date} ${c.heure}`;

/** Avant cette heure le soir, un tap sans nuit en cours veut dire « je viens de me lever ». */
export const HEURE_SOIR = 18;
/** Avant 4 h, on se couche encore (pas un lever). */
export const HEURE_MATIN = 4;
/** Nuit en cours encore ouverte à partir de 11 h : le lever a été oublié. */
export const HEURE_LEVER_OUBLIE = 11;

/** La nuit est datée du jour du lever : un coucher l'après-midi ou le soir donne le lendemain. */
export function jourDuLever(c: Coucher): string {
  if (minutesDe(c.heure) < 12 * 60) return c.date;
  const d = new Date(c.date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Oubli du soir : l'heure de coucher donnée au lever, pour la nuit qui finit `aujourdhui`. */
export function coucherPour(aujourdhui: string, heure: string): Coucher {
  if (minutesDe(heure) < 12 * 60) return { date: aujourdhui, heure };
  const d = new Date(aujourdhui + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return { date: d.toISOString().slice(0, 10), heure };
}

/**
 * Le grand bouton. Nuit en cours : « Je me lève ». Sinon, en journée
 * (4 h – 18 h) tant que la nuit du jour n'est pas notée : « Je me lève »
 * aussi (le coucher a été oublié). Sinon : « Je vais dormir ».
 */
export function boutonSommeil(p: {
  enCours: Coucher | null;
  heure: number;
  nuitDuJourNotee: boolean;
}): "dormir" | "lever" {
  if (p.enCours) return "lever";
  if (p.heure >= HEURE_MATIN && p.heure < HEURE_SOIR && !p.nuitDuJourNotee) return "lever";
  return "dormir";
}

/**
 * Lever oublié : la nuit en cours est encore ouverte à partir de 11 h le
 * jour du lever (ou plus tard encore).
 */
export function leverOublie(enCours: Coucher | null, aujourdhui: string, heure: number): boolean {
  if (!enCours) return false;
  const lever = jourDuLever(enCours);
  return aujourdhui > lever || (aujourdhui === lever && heure >= HEURE_LEVER_OUBLIE);
}

/** Échelle commune des barres de la semaine : 21 h en haut, 11 h en bas. */
export const ECHELLE_DEBUT = 21 * 60;
export const ECHELLE_DUREE = 14 * 60;

/** Position d'une heure sur l'échelle (0 = 21 h, 1 = 11 h), bornée. Après 18 h = avant minuit. */
export function positionEchelle(hhmm: string): number {
  const m = minutesDe(hhmm);
  const depuis = m >= HEURE_SOIR * 60 ? m - ECHELLE_DEBUT : m + 24 * 60 - ECHELLE_DEBUT;
  return Math.min(1, Math.max(0, depuis / ECHELLE_DUREE));
}

export type BarreNuit = { date: string; haut: number; bas: number; pale: boolean } | { date: string; vide: true };

/**
 * Une barre par jour de `jours` : du coucher (haut) au lever (bas).
 * Mauvaise nuit (qualité 1 réellement donnée) : plus pâle. Sans nuit : vide.
 */
export function barresSemaine(
  nuits: { date: string; coucher: string; lever: string; qualite: number; reponses: number }[],
  jours: string[],
): BarreNuit[] {
  return jours.map((date) => {
    const n = nuits.find((x) => x.date === date);
    if (!n) return { date, vide: true as const };
    return {
      date,
      haut: positionEchelle(n.coucher),
      bas: positionEchelle(n.lever),
      pale: n.reponses === 1 && n.qualite === 1,
    };
  });
}

/** Réponses du matin gardées en meta jusqu'à ce qu'il y ait les deux. */
export type ReponsesMatin = { qualite?: Qualite; ecrans?: 0 | 1 };

export const reponsesCompletes = (r: ReponsesMatin): r is { qualite: Qualite; ecrans: 0 | 1 } =>
  r.qualite !== undefined && r.ecrans !== undefined;

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
