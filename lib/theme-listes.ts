import { useColorScheme } from "react-native";

/**
 * Couleurs des listes de tâches : palette fixe, une teinte par liste.
 * En base, on garde la clé (« bleu »), pas la couleur : la même liste
 * reste lisible en clair et en sombre. Contrastes vérifiés ≥ 4,5:1 :
 * texte blanc sur la teinte claire, texte sombre sur la teinte sombre,
 * et teinte contre le fond de l'appli.
 */

export const COULEURS_LISTES = {
  bleu: { clair: "#3f5f8f", sombre: "#9db6dd" },
  orange: { clair: "#a3502a", sombre: "#f0b48c" },
  vert: { clair: "#4a7236", sombre: "#a9cf8f" },
  violet: { clair: "#6e4f9a", sombre: "#c4b0e6" },
  rose: { clair: "#a3416a", sombre: "#eba9c4" },
  sarcelle: { clair: "#2c6e6a", sombre: "#8fd1cb" },
  ocre: { clair: "#80621a", sombre: "#e3c77a" },
  ardoise: { clair: "#555b66", sombre: "#b8bec8" },
} as const;

export type CleCouleur = keyof typeof COULEURS_LISTES;
export const CLES_COULEURS = Object.keys(COULEURS_LISTES) as CleCouleur[];

/** Texte posé sur une pastille remplie de la couleur. */
const TEXTE_SUR = { clair: "#ffffff", sombre: "#1f1a14" };

/** Première couleur pas encore prise, sinon on recommence la palette. */
export function couleurLibre(prises: (string | null)[]): CleCouleur {
  return (
    CLES_COULEURS.find((c) => !prises.includes(c)) ??
    CLES_COULEURS[prises.length % CLES_COULEURS.length]
  );
}

/** Hook : couleur d'une liste (et texte à poser dessus) selon le thème. */
export function useCouleurListe(): (cle: string | null) => { fond: string; texte: string } {
  const sombre = useColorScheme() === "dark";
  return (cle) => {
    const c = COULEURS_LISTES[(cle ?? "ardoise") as CleCouleur] ?? COULEURS_LISTES.ardoise;
    return {
      fond: sombre ? c.sombre : c.clair,
      texte: sombre ? TEXTE_SUR.sombre : TEXTE_SUR.clair,
    };
  };
}
