import { useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Texte } from "./Texte";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Délai avant le défilement continu, puis intervalle entre deux pas. */
const ATTENTE_MS = 400;
const INTERVALLE_MS = 90;

/**
 * Boutons − et + autour d'une valeur, sans clavier.
 * Un appui = un pas ; un appui long fait défiler en continu.
 * `onPas` doit faire une mise à jour fonctionnelle (setX(v => …)) :
 * il est rappelé pendant le défilement. `onRelache` part au relâchement.
 */
export function PlusMoins({
  valeur,
  onPas,
  onRelache,
  libelle,
  grand = false,
}: {
  valeur: string;
  onPas: (sens: 1 | -1) => void;
  onRelache?: () => void;
  libelle: string;
  grand?: boolean;
}) {
  const t = useTheme();
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repetition = useRef<ReturnType<typeof setInterval> | null>(null);
  const pas = useRef(onPas);
  pas.current = onPas;

  const arreter = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (repetition.current) clearInterval(repetition.current);
    minuteur.current = null;
    repetition.current = null;
  };
  useEffect(() => arreter, []);

  const bouton = (sens: 1 | -1) => (
    <Pressable
      onPressIn={() => {
        pas.current(sens);
        minuteur.current = setTimeout(() => {
          repetition.current = setInterval(() => pas.current(sens), INTERVALLE_MS);
        }, ATTENTE_MS);
      }}
      onPressOut={() => {
        arreter();
        onRelache?.();
      }}
      style={({ pressed }) => [
        styles.bouton,
        { backgroundColor: pressed ? t.bgHighlight : t.bgApp, borderColor: t.border },
      ]}
      accessibilityLabel={`${sens > 0 ? "Plus" : "Moins"} : ${libelle}`}
      hitSlop={4}
    >
      <Texte style={[styles.signe, { color: t.accentText }]}>{sens > 0 ? "+" : "−"}</Texte>
    </Pressable>
  );

  return (
    <View
      style={styles.ligne}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={libelle}
      accessibilityValue={{ text: valeur }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        pas.current(e.nativeEvent.actionName === "increment" ? 1 : -1);
        onRelache?.();
      }}
    >
      {bouton(-1)}
      <Texte
        style={[
          styles.valeur,
          { color: t.textPrimary, fontSize: grand ? typography.h1 : typography.h3 },
        ]}
      >
        {valeur}
      </Texte>
      {bouton(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bouton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  signe: { fontSize: 24, fontWeight: "600", lineHeight: 28 },
  valeur: { minWidth: 76, textAlign: "center", fontWeight: "600", fontVariant: ["tabular-nums"] },
});
