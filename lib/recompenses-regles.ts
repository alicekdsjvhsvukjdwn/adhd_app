/**
 * Récompenses rangées par catégorie, sans accès à la base : testable seul
 * (tests/recompenses.test.mjs).
 */

export const CATEGORIES_RECOMPENSES = [
  { cle: "mer", nom: "Mer & dehors", couleur: "#22D3EE" },
  { cle: "bouffe", nom: "Bouffe & sorties", couleur: "#FB923C" },
  { cle: "temps", nom: "Temps pour moi", couleur: "#A78BFA" },
  { cle: "decouvertes", nom: "Activités & découvertes", couleur: "#FACC15" },
  { cle: "gros", nom: "Gros objectifs", couleur: "#60A5FA" },
] as const;

export type CategorieRecompense = (typeof CATEGORIES_RECOMPENSES)[number]["cle"];

/** Une clé inconnue (ancienne version, sauvegarde) tombe dans « Temps pour moi ». */
export const categorieRecompense = (cle: string) =>
  CATEGORIES_RECOMPENSES.find((c) => c.cle === cle) ?? CATEGORIES_RECOMPENSES[2];

/** Étagères affichées : les cinq, toujours, pour que « Idées » soit accessible même vide. */
export function etageres(): CategorieRecompense[] {
  return CATEGORIES_RECOMPENSES.map((c) => c.cle);
}

/** Carte allumée : le solde suffit. Sinon, part de la barre (0 à 1). */
export function etatRecompense(prix: number, solde: number): { accessible: boolean; part: number } {
  return { accessible: prix <= solde, part: Math.min(1, Math.max(0, solde / Math.max(1, prix))) };
}

/** Icônes au trait (clés stockées dans recompenses.icone ; un emoji ancien reste tel quel). */
export const ICONES_RECOMPENSES = [
  "cafe",
  "ecran",
  "gateau",
  "ticket",
  "musique",
  "montagne",
  "casque",
  "vinyle",
  "clavier",
  "lit",
  "livre",
  "cadeau",
  "etoile",
  "avion",
  "manette",
  "vague",
  "soleil",
  "glace",
  "couverts",
  "lune",
  "musee",
  "carte",
  "bateau",
  "film",
  "bain",
  "sandwich",
  "palette",
  "ville",
] as const;

export type IconeRecompense = (typeof ICONES_RECOMPENSES)[number];
