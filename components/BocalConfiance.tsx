import { StyleSheet, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const BILLES = ["#F472B6", "#FB923C", "#FACC15", "#4ADE80", "#22D3EE", "#60A5FA", "#A78BFA"];
/** Nombre de billes dessinées : le bocal « déborde » au-delà, le total reste écrit. */
const MAX_VISIBLES = 70;

/** Le bocal : une bille par chose bien faite, qui s'ajoute au fond comme le reste s'accumule. */
export function BocalConfiance({ ids }: { ids: number[] }) {
  const t = useTheme();
  const visibles = ids.slice(-MAX_VISIBLES);
  return (
    <View accessibilityLabel={`Bocal de confiance : ${ids.length} chose${ids.length > 1 ? "s" : ""} bien faite${ids.length > 1 ? "s" : ""}`}>
      <View style={[styles.couvercle, { backgroundColor: t.border }]} />
      <View style={[styles.bocal, { borderColor: t.border, backgroundColor: t.bgCard }]}>
        {/* wrap-reverse : les billes se posent par le bas */}
        <View style={styles.billes}>
          {visibles.map((id, i) => (
            <View key={id} style={[styles.bille, { backgroundColor: BILLES[(id + i) % BILLES.length] }]} />
          ))}
        </View>
        {ids.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.small, textAlign: "center" }}>Il se remplira, bille après bille.</Texte>}
      </View>
      <Texte style={{ color: t.textSecondary, fontSize: typography.small, textAlign: "center", marginTop: spacing.sm }}>
        {ids.length === 0 ? "Ton bocal est vide pour l'instant." : `${ids.length} chose${ids.length > 1 ? "s" : ""} bien faite${ids.length > 1 ? "s" : ""}, gardée${ids.length > 1 ? "s" : ""} ici.`}
      </Texte>
    </View>
  );
}

const styles = StyleSheet.create({
  couvercle: { height: 8, width: "62%", alignSelf: "center", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bocal: { minHeight: 190, borderWidth: 2, borderRadius: radius.lg, borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: spacing.md, justifyContent: "flex-end" },
  billes: { flexDirection: "row", flexWrap: "wrap-reverse", justifyContent: "center", gap: 4, alignContent: "flex-start" },
  bille: { width: 22, height: 22, borderRadius: 11 },
});
