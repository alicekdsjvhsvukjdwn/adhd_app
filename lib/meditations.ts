/**
 * Méditer : catalogue des séances guidées et règles du minuteur, sans
 * accès à la base : testable seul (tests/mediter.test.mjs).
 * Les contenus audio viendront plus tard (champ `audio`).
 */

export type Respiration = { inspire: number; bloque: number; expire: number; bloqueVide: number };

export type Meditation = {
  id: string;
  titre: string;
  intention: string;
  duree_s: number;
  /** Clé d'icône (components/IconeMeditation). */
  icone: "pause" | "carre" | "corps" | "nuit";
  respiration: Respiration;
  /** Texte de guidage, chaque ligne à partir de `a_s` secondes. */
  guidage: { a_s: number; texte: string }[];
  audio: string | null;
};

const CALME: Respiration = { inspire: 4, bloque: 0, expire: 6, bloqueVide: 0 };

export const MEDITATIONS: Meditation[] = [
  {
    id: "pause",
    titre: "Pause d'une minute",
    intention: "Souffler",
    duree_s: 60,
    icone: "pause",
    respiration: CALME,
    guidage: [
      { a_s: 0, texte: "Pose ce que tu fais. Laisse tes épaules descendre." },
      { a_s: 15, texte: "Inspire par le nez, suis le cercle qui grandit." },
      { a_s: 35, texte: "Expire plus longtemps que tu n'inspires." },
      { a_s: 50, texte: "Encore deux souffles. Puis reprends doucement." },
    ],
    audio: null,
  },
  {
    id: "carre",
    titre: "Respiration carrée",
    intention: "Se recentrer",
    duree_s: 180,
    icone: "carre",
    respiration: { inspire: 4, bloque: 4, expire: 4, bloqueVide: 4 },
    guidage: [
      { a_s: 0, texte: "Inspire 4 · bloque 4 · expire 4 · bloque 4." },
      { a_s: 30, texte: "Suis le cercle, sans forcer." },
      { a_s: 90, texte: "Si tu perds le compte, reprends simplement au début." },
      { a_s: 150, texte: "Dernière minute. Garde le même rythme." },
    ],
    audio: null,
  },
  {
    id: "corps",
    titre: "Scan du corps",
    intention: "Revenir au corps",
    duree_s: 600,
    icone: "corps",
    respiration: CALME,
    guidage: [
      { a_s: 0, texte: "Installe-toi, assise ou allongée. Ferme les yeux si tu veux." },
      { a_s: 45, texte: "Les pieds : le poids, la température, le contact." },
      { a_s: 120, texte: "Les jambes, les genoux, les cuisses. Rien à changer, juste remarquer." },
      { a_s: 210, texte: "Le ventre et le dos. Le souffle qui les fait bouger." },
      { a_s: 300, texte: "Les mains, les bras, les épaules. Laisse-les lourdes." },
      { a_s: 390, texte: "La nuque, la mâchoire, le front. Desserre." },
      { a_s: 480, texte: "Tout le corps d'un coup, comme une seule chose qui respire." },
      { a_s: 560, texte: "Bouge doucement les doigts. Ouvre les yeux quand tu veux." },
    ],
    audio: null,
  },
  {
    id: "nuit",
    titre: "Avant de dormir",
    intention: "Lâcher la journée",
    duree_s: 480,
    icone: "nuit",
    respiration: { inspire: 4, bloque: 0, expire: 8, bloqueVide: 0 },
    guidage: [
      { a_s: 0, texte: "Allonge-toi. Lumière basse, téléphone posé." },
      { a_s: 40, texte: "Expire deux fois plus longtemps que tu n'inspires." },
      { a_s: 150, texte: "Une pensée arrive ? Note-la mentalement : « plus tard ». Reviens au souffle." },
      { a_s: 300, texte: "Laisse le lit porter tout ton poids." },
      { a_s: 420, texte: "Continue seule, au rythme du cercle." },
    ],
    audio: null,
  },
];

/** Points (voir REGLES_POINTS) : une fois par jour. */
export const POINTS_MEDITATION = 5;
/** Arrêtée avant : rien n'est enregistré. */
export const MIN_ENREGISTREE_S = 60;

/** Secondes écoulées, bornées à la durée de la séance. */
export const secondesEcoulees = (debutMs: number, maintenantMs: number, duree_s: number) =>
  Math.min(duree_s, Math.max(0, Math.floor((maintenantMs - debutMs) / 1000)));

/** Une séance terminée, ou arrêtée après au moins 1 min, est enregistrée. */
export const aEnregistrer = (ecoulees_s: number, duree_s: number) =>
  ecoulees_s >= Math.min(MIN_ENREGISTREE_S, duree_s);

/** Ligne de guidage à afficher à `t` secondes. */
export function guidageA(m: Meditation, t: number): string {
  let texte = m.guidage[0]?.texte ?? "";
  for (const g of m.guidage) if (g.a_s <= t) texte = g.texte;
  return texte;
}

export type Phase = "inspire" | "bloque" | "expire" | "bloqueVide";

/** Phase du souffle à `t` secondes, et sa progression (0 → 1). */
export function phaseA(r: Respiration, t: number): { phase: Phase; part: number } {
  const phases: [Phase, number][] = (
    [
      ["inspire", r.inspire],
      ["bloque", r.bloque],
      ["expire", r.expire],
      ["bloqueVide", r.bloqueVide],
    ] as [Phase, number][]
  ).filter(([, d]) => d > 0);
  const cycle = phases.reduce((s, [, d]) => s + d, 0);
  let x = ((t % cycle) + cycle) % cycle;
  for (const [phase, d] of phases) {
    if (x < d) return { phase, part: x / d };
    x -= d;
  }
  return { phase: phases[0][0], part: 0 };
}

export const LIBELLES_PHASE: Record<Phase, string> = {
  inspire: "Inspire",
  bloque: "Bloque",
  expire: "Expire",
  bloqueVide: "Bloque",
};

/** « 3 min », « 1 min 30 », « 0:45 » pour le restant. */
export const dureeMinutes = (s: number) => `${Math.round(s / 60)} min`;
export const formatSecondes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
