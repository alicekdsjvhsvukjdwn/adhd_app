import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

/** Une action du menu « ⋯ » d'une carte (web). */
export type Option = { libelle: string; onPress: () => void; danger?: boolean };

/**
 * Carte qu'on glisse vers la gauche pour modifier ou supprimer.
 * Sur le web, voir Options.web.tsx : un bouton « ⋯ » remplace le glisser.
 */
export function Glissable({
  renderRightActions,
  children,
}: {
  renderRightActions: () => ReactNode;
  options: Option[];
  titre?: string;
  children: ReactNode;
}) {
  return <Swipeable renderRightActions={renderRightActions}>{children}</Swipeable>;
}

/** Bouton « ⋯ » posé sur une carte : seulement sur le web. */
export function BoutonOptions(_: { options: Option[]; titre?: string; style?: StyleProp<ViewStyle> }) {
  return null;
}
