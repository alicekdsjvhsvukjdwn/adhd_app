import { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";
import { policeDe, TAILLE_TITRE, typography } from "../lib/theme";

/**
 * Police de l'appli posée sur un style : chaque graisse est une police à
 * part, donc fontWeight devient une famille (et n'est plus transmis, sinon
 * Android cherche une variante qui n'existe pas). Space Grotesk à partir
 * de la taille des titres, Manrope en dessous. Un fontFamily explicite gagne.
 */
function avecPolice(style: TextProps["style"]): TextStyle {
  const s = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (s.fontFamily) return s;
  const titre = (s.fontSize ?? typography.body) >= TAILLE_TITRE;
  return { ...s, fontFamily: policeDe(s.fontWeight, titre), fontWeight: undefined };
}

/** Texte de l'appli : remplace Text de react-native partout. */
export function Texte({ style, ...props }: TextProps) {
  return <Text {...props} style={avecPolice(style)} />;
}

/** Champ de saisie avec la police de l'appli. */
export const ChampTexte = forwardRef<TextInput, TextInputProps>(function ChampTexte(
  { style, ...props },
  ref,
) {
  return <TextInput ref={ref} {...props} style={avecPolice(style)} />;
});
