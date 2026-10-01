/**
 * Rangement de l'écran Routines : « que dois-je faire maintenant ? ».
 * Sans accès à la base ni au téléphone : testable seul (tests/etape3.test.mjs).
 */

export type Tranche = "matin" | "apres_midi" | "soir";

/** Moment de la journée d'une heure locale décimale (14.5 = 14 h 30). */
export function trancheDeHeure(h: number): Tranche {
  if (h < 12) return "matin";
  if (h < 18) return "apres_midi";
  return "soir";
}

export type CleSection = Tranche | "a_tout_moment" | "si_energie";

export const LIBELLES_SECTION: Record<CleSection, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  soir: "Soir",
  a_tout_moment: "À tout moment",
  si_energie: "Si l'énergie revient",
};

const ORDRE_SECTIONS: CleSection[] = [
  "matin",
  "apres_midi",
  "soir",
  "a_tout_moment",
  "si_energie",
];

/** Moments du catalogue et des moments repères, rangés dans les trois tranches. */
const TRANCHE_PAR_MOMENT: Record<string, Tranche> = {
  reveil: "matin",
  matin: "matin",
  midi: "apres_midi",
  apres_midi: "apres_midi",
  "apres-midi": "apres_midi",
  soir: "soir",
  coucher: "soir",
};

/** Difficulté à partir de laquelle une routine est mise de côté un jour difficile. */
export const EFFORT_EXIGEANT = 3;

export type RoutineRangeable = {
  faitAujourdhui: boolean;
  effort: number | null;
  moment: string | null;
  ancre_moment: string | null;
};

export type Section<R> = {
  cle: CleSection;
  libelle: string;
  /** Dépliée d'office : le moment en cours et « À tout moment ». */
  depliee: boolean;
  routines: R[];
};

/** Le moment repère prime sur le moment déclaré ; sans les deux, « À tout moment ». */
export function sectionDeRoutine(r: RoutineRangeable): Tranche | "a_tout_moment" {
  const m = r.ancre_moment || r.moment;
  return (m && TRANCHE_PAR_MOMENT[m]) || "a_tout_moment";
}

/**
 * Sections non vides, dans l'ordre de la journée. Dans chacune, ce qui
 * reste à faire d'abord, ce qui est fait ensuite (ordre d'origine conservé).
 * Un jour difficile, les routines exigeantes non faites vont dans
 * « Si l'énergie revient », repliée.
 */
export function organiserRoutines<R extends RoutineRangeable>(
  routines: R[],
  heure: number,
  jourDifficile: boolean,
): Section<R>[] {
  const enCours = trancheDeHeure(heure);
  const parSection = new Map<CleSection, R[]>();
  for (const r of routines) {
    const cle: CleSection =
      jourDifficile && !r.faitAujourdhui && (r.effort ?? 0) >= EFFORT_EXIGEANT
        ? "si_energie"
        : sectionDeRoutine(r);
    parSection.set(cle, [...(parSection.get(cle) ?? []), r]);
  }

  return ORDRE_SECTIONS.filter((cle) => parSection.has(cle)).map((cle) => {
    const liste = parSection.get(cle)!;
    return {
      cle,
      libelle: LIBELLES_SECTION[cle],
      depliee: cle === enCours || cle === "a_tout_moment",
      routines: [
        ...liste.filter((r) => !r.faitAujourdhui),
        ...liste.filter((r) => r.faitAujourdhui),
      ],
    };
  });
}
