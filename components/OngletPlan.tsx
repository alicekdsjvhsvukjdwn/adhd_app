import { StyleSheet, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

/** Sport › Plan : le coach arrive (objectif, test de niveau, programme de 6 semaines). */
export function OngletPlan() {
  const t = useTheme();
  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>Bientôt : mon plan</Texte>
      <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginTop: spacing.sm }}>
        Tu choisiras un objectif, tu feras un test de niveau rapide, et l&apos;appli te proposera un programme de 6 semaines sur tes jours et
        avec ton matériel. En attendant, tu peux fouiller la bibliothèque (Exercices) et régler ton matériel avec ⚙️.
      </Texte>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg },
});
