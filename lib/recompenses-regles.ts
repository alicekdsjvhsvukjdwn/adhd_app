/**
 * Récompenses rangées par catégorie, sans accès à la base : testable seul
 * (tests/recompenses.test.mjs).
 */

export const CATEGORIES_RECOMPENSES = [
  { cle: "plaisirs", nom: "Petits plaisirs", couleur: "#F87171" },
  { cle: "sorties", nom: "Sorties", couleur: "#FB923C" },
  { cle: "musique", nom: "Musique", couleur: "#FACC15" },
  { cle: "temps", nom: "Temps pour moi", couleur: "#A78BFA" },
  { cle: "gros", nom: "Gros objectifs", couleur: "#60A5FA" },
] as const;

export type CategorieRecompense = (typeof CATEGORIES_RECOMPENSES)[number]["cle"];

export const categorieRecompense = (cle: string) =>
  CATEGORIES_RECOMPENSES.find((c) => c.cle === cle) ?? CATEGORIES_RECOMPENSES[0];

/** Étagères affichées : celles qui ont des récompenses, et Petits plaisirs toujours. */
export function etageres(cles: string[]): CategorieRecompense[] {
  return CATEGORIES_RECOMPENSES.filter((c) => c.cle === "plaisirs" || cles.includes(c.cle)).map(
    (c) => c.cle,
  );
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
] as const;

export type IconeRecompense = (typeof ICONES_RECOMPENSES)[number];
