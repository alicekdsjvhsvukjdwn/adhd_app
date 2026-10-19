import type { Zone } from "./seances";

/**
 * Bibliothèque d'exercices des séances guidées (lib/seances.ts). Sans accès
 * à la base : testable seul (tests/seances.test.mjs). Les étapes des skills
 * (lib/skills.ts) portent le même nom quand c'est le même mouvement.
 */

export type Exercice = {
  id: string;
  nom: string;
  zones: Zone[];
  consigne: string;
  /** Clé du bonhomme (components/FigureSkill.tsx). */
  figure: string;
  /** Tenir la position (secondes) ou enchaîner les répétitions. */
  mode: "s" | "reps";
};

export const EXERCICES: Exercice[] = [
  // ── Haut du corps ──
  { id: "pompes", nom: "Pompes", zones: ["haut", "complet"], consigne: "Corps gainé, poitrine à un poing du sol", figure: "pompe", mode: "reps" },
  { id: "pompes_genoux", nom: "Pompes sur les genoux", zones: ["haut", "complet"], consigne: "Hanches alignées, descendre en 2 s", figure: "pompe", mode: "reps" },
  { id: "pompes_inclinees", nom: "Pompes inclinées", zones: ["haut"], consigne: "Mains sur une table, poitrine jusqu'au bord", figure: "pompe", mode: "reps" },
  { id: "pike_pushups", nom: "Pike push-ups", zones: ["haut"], consigne: "Hanches hautes, tête entre les mains en bas", figure: "pike_taps", mode: "reps" },
  { id: "pike_taps", nom: "Pike shoulder taps", zones: ["haut", "complet"], consigne: "Hanches hautes, une main touche l'épaule opposée", figure: "pike_taps", mode: "reps" },
  { id: "dips_banc", nom: "Dips sur banc", zones: ["haut"], consigne: "Mains derrière toi sur une chaise, coudes vers l'arrière", figure: "dips", mode: "reps" },
  { id: "snow_angels", nom: "Reverse snow angels", zones: ["haut", "mobilite"], consigne: "À plat ventre, bras qui glissent des hanches au-dessus de la tête", figure: "snow_angels", mode: "reps" },
  // ── Bas du corps ──
  { id: "squat", nom: "Squat", zones: ["bas", "complet"], consigne: "Talons au sol, genoux dans l'axe des pieds", figure: "squat", mode: "reps" },
  { id: "fente", nom: "Fente", zones: ["bas", "complet"], consigne: "Grand pas, genou arrière près du sol, alterner", figure: "pistol", mode: "reps" },
  { id: "squat_bulgare", nom: "Squat bulgare", zones: ["bas"], consigne: "Pied arrière sur une chaise, changer à mi-temps", figure: "pistol", mode: "reps" },
  { id: "chaise", nom: "Chaise au mur", zones: ["bas"], consigne: "Dos au mur, cuisses parallèles au sol", figure: "squat", mode: "s" },
  { id: "pont", nom: "Pont fessier", zones: ["bas", "mobilite", "complet"], consigne: "Pousser dans les talons, serrer les fesses en haut", figure: "pont", mode: "reps" },
  // ── Abdos & gainage ──
  { id: "planche", nom: "Planche", zones: ["abdos", "complet"], consigne: "Coudes sous les épaules, fesses serrées", figure: "gainage", mode: "s" },
  { id: "planche_laterale", nom: "Planche latérale avec rotation", zones: ["abdos"], consigne: "Bras du dessus qui passe sous le corps puis s'ouvre, changer de côté à mi-temps", figure: "planche_laterale", mode: "reps" },
  { id: "hollow", nom: "Hollow body hold", zones: ["abdos"], consigne: "Bas du dos collé au sol, bras et jambes tendus", figure: "hollow", mode: "s" },
  { id: "dead_bug", nom: "Dead bug", zones: ["abdos", "mobilite"], consigne: "Bras et jambe opposés qui descendent, dos collé au sol", figure: "hollow", mode: "reps" },
  { id: "mountain", nom: "Mountain climbers", zones: ["abdos", "complet"], consigne: "En appui sur les mains, genoux vers la poitrine à tour de rôle", figure: "pompe", mode: "reps" },
  // ── Mobilité ──
  { id: "chat_vache", nom: "Chat-vache", zones: ["mobilite"], consigne: "À quatre pattes, dos rond puis dos creux, avec le souffle", figure: "chat_vache", mode: "reps" },
  { id: "squat_tenu", nom: "Squat tenu en bas", zones: ["mobilite"], consigne: "Talons au sol, coudes qui écartent les genoux", figure: "squat", mode: "s" },
  { id: "fente_basse", nom: "Fente basse", zones: ["mobilite"], consigne: "Genou arrière au sol, bassin vers l'avant, changer à mi-temps", figure: "pistol", mode: "s" },
];

export const exercice = (id: string) => EXERCICES.find((x) => x.id === id);
