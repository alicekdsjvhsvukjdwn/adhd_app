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

/** Points (voir REGLES_POINTS) : une fois par nuit ; le sport (skills ou guidé), une fois par jour même partiel. */
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

/** Le soir commence à 18 h ; le matin à 4 h (avant, on se couche encore) ; l'après-midi à 12 h. */
export const HEURE_SOIR = 18;
export const HEURE_MATIN = 4;
export const HEURE_MIDI = 12;

const jourVoisin = (date: string, n: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** La nuit est datée du jour du lever : un coucher l'après-midi ou le soir donne le lendemain. */
export function jourDuLever(c: Coucher): string {
  return minutesDe(c.heure) < 12 * 60 ? c.date : jourVoisin(c.date, 1);
}

/** Oubli du soir : l'heure de coucher donnée au lever, pour la nuit qui finit `aujourdhui`. */
export function coucherPour(aujourdhui: string, heure: string): Coucher {
  return minutesDe(heure) < 12 * 60 ? { date: aujourdhui, heure } : { date: jourVoisin(aujourdhui, -1), heure };
}

/**
 * Ce que montre l'onglet Suivi :
 * - 18 h – 4 h : « Je vais dormir », ou « Couchée à … · ajuster » si c'est fait ;
 * - 4 h – 18 h, nuit du jour notée : le résumé de la nuit ;
 * - 4 h – 12 h : « Je me suis levée » ; 12 h – 18 h : « Noter mon heure de lever », discret.
 */
export type EtatSommeil = "dormir" | "couchee" | "lever" | "lever_discret" | "resume";

export function etatSommeil(p: { heure: number; enCours: Coucher | null; leverNote: boolean }): EtatSommeil {
  if (p.heure >= HEURE_SOIR || p.heure < HEURE_MATIN) return p.enCours ? "couchee" : "dormir";
  if (p.leverNote) return "resume";
  return p.heure < HEURE_MIDI ? "lever" : "lever_discret";
}

/** Raccourci « il y a 30 min » : à 0 h 10, 23 h 40 la veille. */
export function ilYa(aujourdhui: string, maintenantMin: number, minutes: number): Coucher {
  const m = maintenantMin - minutes;
  return { date: m < 0 ? jourVoisin(aujourdhui, -1) : aujourdhui, heure: hhmmDe(m) };
}

/**
 * Coucher ajusté : le jour le plus proche de maintenant (à ±12 h). À 0 h 10,
 * 23 h 40 est la veille ; à 23 h 50, 0 h 30 est le lendemain (nuit du jour qui suit).
 */
export function dateDuCoucher(aujourdhui: string, maintenantMin: number, heure: string): Coucher {
  const ecart = minutesDe(heure) - maintenantMin;
  const date = ecart > 720 ? jourVoisin(aujourdhui, -1) : ecart < -720 ? jourVoisin(aujourdhui, 1) : aujourdhui;
  return { date, heure };
}

/** « 23:12 » → « 23 h 12 ». */
export const heureLisible = (hhmm: string) => hhmm.replace(":", " h ");

/** Heure locale d'un instant : « 07:05 ». */
export const hhmmMaintenant = (d = new Date()) => hhmmDe(d.getHours() * 60 + d.getMinutes());

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
