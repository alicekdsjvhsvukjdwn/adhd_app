import { TouchableOpacity } from "react-native";
import { useTheme } from "../lib/theme";
import { Texte } from "./Texte";

type Props = {
  /** La tâche est dans les 3 du jour. */
  active: boolean;
  /** Inutilisé : l'étoile ouvre le choix du jour. */
  jour?: string;
  onPress: () => void;
};

/** ☆ / ★ : planifier la tâche (aujourd'hui, demain, une date ; dans les 3 ou en bonus). ★ = déjà planifiée. */
export function Etoile({ active, onPress }: Props) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? "Planifiée : modifier ou retirer" : "Planifier pour un jour"}
    >
      <Texte style={{ fontSize: 22, color: active ? t.accent : t.textMuted }}>{active ? "★" : "☆"}</Texte>
    </TouchableOpacity>
  );
}
