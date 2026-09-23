import { useColorScheme } from "react-native";
import type { Categorie } from "./catalogue";

/**
 * Couleurs par catégorie, accordées au thème terracotta/olive/crème.
 * Une source unique pour les pastilles, l'indicateur d'équilibre et le
 * camembert de Progression. Variante claire / sombre par catégorie.
 */

type CouleurCategorie = { clair: string; sombre: string };

const COULEURS: Record<Categorie, CouleurCategorie> = {
  sommeil: { clair: "#5b6b8a", sombre: "#8a97b5" }, // bleu-indigo apaisé
  mouvement: { clair: "#c07050", sombre: "#e8b89b" }, // terracotta
  organisation: { clair: "#7a8a4a", sombre: "#c7cd9c" }, // olive
  focus: { clair: "#c99a3a", sombre: "#e0c47a" }, // ocre / moutarde
  competences: { clair: "#9a6a8a", sombre: "#c9a3bd" }, // prune
};

export const LIBELLES_CATEGORIE: Record<Categorie, string> = {
  sommeil: "Sommeil",
  mouvement: "Mouvement",
  organisation: "Organisation",
  focus: "Focus",
  competences: "Compétences",
};

export const ICONES_CATEGORIE: Record<Categorie, string> = {
  sommeil: "🌙",
  mouvement: "🏃",
  organisation: "🗂️",
  focus: "🎯",
  competences: "🎨",
};

export const ORDRE_CATEGORIES: Categorie[] = [
  "sommeil",
  "mouvement",
  "organisation",
  "focus",
  "competences",
];

/** Hook : renvoie la couleur d'une catégorie selon le thème système. */
export function useCouleurCategorie(): (c: Categorie) => string {
  const scheme = useColorScheme();
  return (c: Categorie) =>
    scheme === "dark" ? COULEURS[c].sombre : COULEURS[c].clair;
}

/** Version non-hook, quand on a déjà le scheme (ex : rendu d'un graphe). */
export function couleurCategorie(c: Categorie, sombre: boolean): string {
  return sombre ? COULEURS[c].sombre : COULEURS[c].clair;
}
