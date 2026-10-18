/**
 * Couleurs des listes de tâches : 8 nuances de bleu, vert, bleu-vert, cyan
 * et indigo, aux luminosités bien espacées (×1,18 au moins de l'une à la
 * suivante) pour se distinguer sur le fond noir. En base, on garde la clé.
 * Le texte posé dessus est le fond de l'appli (≥ 4,5:1 sur chacune).
 * Sans accès au téléphone : testable seul (tests/theme.test.mjs).
 */

export const COULEURS_LISTES = {
  indigo: "#6568F1",
  foret: "#159946",
  bleu: "#5392F7",
  sarcelle: "#14B6A4",
  lavande: "#A5ADFA",
  cyan: "#65D2E4",
  vert: "#88E9AC",
  glacier: "#B3F3FC",
} as const;

export type CleCouleur = keyof typeof COULEURS_LISTES;

/** Ordre de distribution aux nouvelles listes : voisines de teinte et de luminosité éloignées. */
export const CLES_COULEURS: CleCouleur[] = [
  "bleu",
  "vert",
  "indigo",
  "cyan",
  "foret",
  "lavande",
  "sarcelle",
  "glacier",
];

/** Anciennes clés (avant la version 21) → nouvelles. Une à une : deux listes restent distinctes. */
export const ANCIENNES_CLES: Record<string, CleCouleur> = {
  bleu: "bleu",
  orange: "cyan",
  vert: "vert",
  violet: "indigo",
  rose: "lavande",
  sarcelle: "sarcelle",
  ocre: "foret",
  ardoise: "glacier",
};

/** Texte posé sur une pastille remplie de la couleur. */
const TEXTE_SUR = "#05080A";

/** Première couleur pas encore prise, sinon on recommence la palette. */
export function couleurLibre(prises: (string | null)[]): CleCouleur {
  return (
    CLES_COULEURS.find((c) => !prises.includes(c)) ??
    CLES_COULEURS[prises.length % CLES_COULEURS.length]
  );
}

/** Couleur d'une liste (et texte à poser dessus). */
export function couleurListe(cle: string | null): { fond: string; texte: string } {
  const c = COULEURS_LISTES[(cle ?? "") as CleCouleur] ?? COULEURS_LISTES.glacier;
  return { fond: c, texte: TEXTE_SUR };
}

/** Gardé sous forme de hook pour les écrans : la couleur ne dépend plus du thème. */
export const useCouleurListe = () => couleurListe;
