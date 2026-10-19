/**
 * Séances guidées : une liste d'exercices (lib/exercices.ts) enchaînés au
 * minuteur, effort puis repos, sur un ou plusieurs tours. Sans accès à la
 * base : testable seul (tests/seances.test.mjs).
 */

export type Zone = "haut" | "bas" | "abdos" | "mobilite" | "complet";

export const ZONES: { cle: Zone; nom: string; couleur: string }[] = [
  { cle: "haut", nom: "Haut du corps", couleur: "#60A5FA" },
  { cle: "bas", nom: "Bas du corps", couleur: "#FB923C" },
  { cle: "abdos", nom: "Abdos & gainage", couleur: "#FACC15" },
  { cle: "mobilite", nom: "Mobilité", couleur: "#4ADE80" },
  { cle: "complet", nom: "Corps complet", couleur: "#A78BFA" },
];

export const zone = (cle: Zone) => ZONES.find((z) => z.cle === cle)!;

export type Seance = {
  id: string;
  nom: string;
  /** null : la séance perso (Ma routine du matin). */
  zone: Zone | null;
  exercices: string[];
  effort_s: number;
  repos_s: number;
  tours: number;
  /** Vidéo de référence (séance perso), vide sinon. */
  lien?: string;
};

export const DUREES = [5, 10, 20, 30] as const;

/** Format de chaque durée : exercices par tour, tours, effort / repos. */
const FORMATS: Record<(typeof DUREES)[number], { n: number; tours: number; effort: number; repos: number }> = {
  5: { n: 5, tours: 1, effort: 45, repos: 15 },
  10: { n: 5, tours: 2, effort: 40, repos: 20 },
  20: { n: 5, tours: 4, effort: 40, repos: 20 },
  30: { n: 6, tours: 5, effort: 30, repos: 30 },
};

/** Exercices de chaque zone, dans l'ordre ; les courtes séances prennent les premiers. */
const LISTES: Record<Zone, string[]> = {
  haut: ["pompes_genoux", "snow_angels", "pike_taps", "dips_banc", "pompes_inclinees", "pike_pushups"],
  bas: ["squat", "pont", "fente", "chaise", "squat_bulgare", "squat_tenu"],
  abdos: ["planche", "dead_bug", "planche_laterale", "mountain", "hollow", "pont"],
  mobilite: ["chat_vache", "snow_angels", "squat_tenu", "pont", "fente_basse", "dead_bug"],
  complet: ["squat", "pompes_genoux", "pont", "mountain", "fente", "planche"],
};

export const SEANCES: Seance[] = ZONES.flatMap((z) =>
  DUREES.map((d) => {
    const f = FORMATS[d];
    return {
      id: `${z.cle}-${d}`,
      nom: `${z.nom} · ${d} min`,
      zone: z.cle,
      exercices: LISTES[z.cle].slice(0, f.n),
      effort_s: f.effort,
      repos_s: f.repos,
      tours: f.tours,
    };
  }),
);

export const ID_REVEIL = "reveil";

/** Ma routine du matin, tant qu'elle n'a pas été modifiée. */
export const REVEIL_DEFAUT: Seance = {
  id: ID_REVEIL,
  nom: "Réveil du corps",
  zone: null,
  exercices: ["pike_taps", "snow_angels", "pont", "planche_laterale", "hollow", "squat"],
  effort_s: 45,
  repos_s: 15,
  tours: 1,
  lien: "",
};

export const seance = (id: string) => SEANCES.find((s) => s.id === id);

export const couleurSeance = (s: Seance, accent: string) => (s.zone ? zone(s.zone).couleur : accent);

/** Durée prévue en secondes (repos compris). */
export const dureeSeance = (s: Seance) => s.tours * s.exercices.length * (s.effort_s + s.repos_s);

/** « 6 min ». */
export const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

export type Segment = {
  type: "effort" | "repos";
  /** L'exercice fait (effort) ou celui qui suit (repos). */
  exercice: string;
  duree_s: number;
  tour: number;
};

/** Effort, repos, effort… ; pas de repos après le dernier effort. */
export function deroule(s: Seance): Segment[] {
  const res: Segment[] = [];
  for (let tour = 1; tour <= s.tours; tour++) {
    for (const ex of s.exercices) {
      if (res.length > 0 && s.repos_s > 0) res.push({ type: "repos", exercice: ex, duree_s: s.repos_s, tour });
      res.push({ type: "effort", exercice: ex, duree_s: s.effort_s, tour });
    }
  }
  return res;
}

/** « Faite aujourd'hui », « Faite hier », sinon rien. */
export function faiteLe(derniere: string | null, aujourdhui: string, hier: string): string | null {
  if (derniere === aujourdhui) return "Faite aujourd'hui";
  if (derniere === hier) return "Faite hier";
  return null;
}
