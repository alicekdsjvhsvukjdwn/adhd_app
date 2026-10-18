/**
 * Moments de la journée : une seule table de correspondance pour toute
 * l'appli, une seule orthographe (apres_midi). Sans accès à la base :
 * testable seul (tests/etape3.test.mjs).
 */

/** Valeurs stockées dans items.moment et ancres.moment. */
export type Moment = "reveil" | "matin" | "midi" | "apres_midi" | "soir" | "coucher";

/** Les trois parties de la journée affichées. */
export type Tranche = "matin" | "apres_midi" | "soir";

export const LIBELLES_MOMENT: Record<Moment, string> = {
  reveil: "Au réveil",
  matin: "Matin",
  midi: "Midi",
  apres_midi: "Après-midi",
  soir: "Soir",
  coucher: "Au coucher",
};

export const LIBELLES_TRANCHE: Record<Tranche | "a_tout_moment", string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  soir: "Soir",
  a_tout_moment: "À tout moment",
};

export const ORDRE_TRANCHES: (Tranche | "a_tout_moment")[] = [
  "matin",
  "apres_midi",
  "soir",
  "a_tout_moment",
];

const TRANCHE: Record<Moment, Tranche> = {
  reveil: "matin",
  matin: "matin",
  midi: "apres_midi",
  apres_midi: "apres_midi",
  soir: "soir",
  coucher: "soir",
};

/** Heure « idéale » d'un moment, pour le moteur quand l'observation manque. */
export const HEURE_PAR_MOMENT: Record<Moment, number> = {
  reveil: 7,
  matin: 9,
  midi: 12.5,
  apres_midi: 15.5,
  soir: 19,
  coucher: 22,
};

/**
 * Valeur à stocker : l'ancienne orthographe « apres-midi » est corrigée,
 * « indifferent » (catalogue) et l'inconnu deviennent « pas de moment ».
 */
export function momentStocke(m: string | null | undefined): Moment | null {
  const v = m === "apres-midi" ? "apres_midi" : m;
  return v && v in TRANCHE ? (v as Moment) : null;
}

/** Tranche d'un moment, ou null sans moment. */
export function trancheDuMoment(m: string | null | undefined): Tranche | null {
  const v = momentStocke(m);
  return v ? TRANCHE[v] : null;
}

/** Tranche d'une heure locale décimale (14.5 = 14 h 30). */
export function trancheDeHeure(h: number): Tranche {
  if (h < 12) return "matin";
  if (h < 18) return "apres_midi";
  return "soir";
}

/** Le moment repère prime sur le moment déclaré ; sans les deux, « À tout moment ». */
export function trancheDeRoutine(r: {
  moment: string | null;
  ancre_moment: string | null;
}): Tranche | "a_tout_moment" {
  return trancheDuMoment(r.ancre_moment || r.moment) ?? "a_tout_moment";
}

/** Difficulté à partir de laquelle une routine est mise de côté un jour difficile. */
export const EFFORT_EXIGEANT = 3;

/** Jour difficile : une routine exigeante pas encore faite passe dans « Si l'énergie revient ». */
export function miseDeCote(
  r: { effort: number | null; faitAujourdhui: boolean },
  jourDifficile: boolean,
): boolean {
  return jourDifficile && !r.faitAujourdhui && (r.effort ?? 0) >= EFFORT_EXIGEANT;
}
