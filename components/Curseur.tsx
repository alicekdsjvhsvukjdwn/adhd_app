import { useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { useTheme } from "../lib/theme";
import { Texte } from "./Texte";

/** Curseur 0–100 qu'on touche ou qu'on fait glisser (pas de dépendance : ni clavier ni pas à pas). */
export function Curseur({
  valeur,
  onChange,
  couleur,
  libelle,
}: {
  valeur: number;
  onChange: (v: number) => void;
  couleur?: string;
  libelle: string;
}) {
  const t = useTheme();
  const [largeur, setLargeur] = useState(0);
  const c = couleur ?? t.accent;

  const depuis = (e: GestureResponderEvent) => {
    if (largeur <= 0) return;
    onChange(Math.min(100, Math.max(0, Math.round((e.nativeEvent.locationX / largeur) * 100))));
  };

  return (
    <View>
      <Texte style={[styles.valeur, { color: c }]}>{valeur}</Texte>
      <View
        style={styles.zone}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={depuis}
        onResponderMove={depuis}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={libelle}
        accessibilityValue={{ min: 0, max: 100, now: valeur }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => onChange(Math.min(100, Math.max(0, valeur + (e.nativeEvent.actionName === "increment" ? 5 : -5))))}
      >
        <View style={[styles.piste, { backgroundColor: t.border }]} pointerEvents="none">
          <View style={{ width: `${valeur}%`, height: "100%", backgroundColor: c, borderRadius: 4 }} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.poignee, { left: `${valeur}%`, backgroundColor: c, borderColor: t.bgApp }]}
        />
      </View>
      <View style={styles.bornes}>
        <Texte style={{ color: t.textMuted, fontSize: 12 }}>0</Texte>
        <Texte style={{ color: t.textMuted, fontSize: 12 }}>100</Texte>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  valeur: { fontSize: 44, fontWeight: "600", textAlign: "center" },
  zone: { height: 44, justifyContent: "center" },
  piste: { height: 8, borderRadius: 4, overflow: "hidden" },
  poignee: { position: "absolute", width: 26, height: 26, borderRadius: 13, marginLeft: -13, borderWidth: 3, top: 9 },
  bornes: { flexDirection: "row", justifyContent: "space-between" },
});
