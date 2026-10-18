import type { Categorie } from "./catalogue";

/**
 * Couleurs des domaines, fixes : un arc-en-ciel, une teinte bien distincte
 * par domaine. Une source unique pour l'anneau des routines, la rangée des
 * domaines, Progression et le formulaire. Le texte posé sur une pastille
 * pleine est le fond de l'appli, foncé (≥ 4,5:1, tests/theme.test.mjs).
 */
export const COULEURS_CATEGORIE: Record<Categorie, string> = {
  emotions: "#F87171",
  mouvement: "#FB923C",
  competences: "#FACC15",
  organisation: "#4ADE80",
  focus: "#60A5FA",
  sommeil: "#A78BFA",
};

export const LIBELLES_CATEGORIE: Record<Categorie, string> = {
  sommeil: "Sommeil",
  mouvement: "Mouvement",
  organisation: "Organisation",
  focus: "Focus",
  competences: "Compétences",
  emotions: "Émotions",
};

export const ICONES_CATEGORIE: Record<Categorie, string> = {
  sommeil: "🌙",
  mouvement: "🌿",
  organisation: "🗂️",
  focus: "🎯",
  competences: "🎨",
  emotions: "💭",
};

/** Ordre de l'anneau et de la rangée des domaines, dans le sens des aiguilles d'une montre. */
export const ORDRE_CATEGORIES: Categorie[] = [
  "emotions",
  "mouvement",
  "competences",
  "organisation",
  "focus",
  "sommeil",
];

export const couleurCategorie = (c: Categorie) => COULEURS_CATEGORIE[c];

/** Gardé sous forme de hook pour les écrans : la couleur ne dépend plus du thème. */
export const useCouleurCategorie = () => couleurCategorie;
