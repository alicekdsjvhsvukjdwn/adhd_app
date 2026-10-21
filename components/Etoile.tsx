import { TouchableOpacity } from "react-native";
import { useTheme } from "../lib/theme";
import { Texte } from "./Texte";

type Props = {
  /** La tâche est dans les 3 du jour. */
  active: boolean;
  /** « aujourd'hui » ou « demain ». */
  jour: string;
  onPress: () => void;
};

/** ☆ / ★ « Pour aujourd'hui » : ajoute la tâche aux 3 du jour ou la retire. */
export function Etoile({ active, jour, onPress }: Props) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? `Retirer des 3 pour ${jour}` : `Pour ${jour}`}
    >
      <Texte style={{ fontSize: 22, color: active ? t.accent : t.textMuted }}>{active ? "★" : "☆"}</Texte>
    </TouchableOpacity>
  );
}
