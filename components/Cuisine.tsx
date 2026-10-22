import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { CuisineCourses } from "./CuisineCourses";
import { CuisineFrigo } from "./CuisineFrigo";
import { CuisineRecettes } from "./CuisineRecettes";
import { Texte } from "./Texte";

const PARTIES = [
  ["frigo", "Frigo & placards"],
  ["recettes", "Recettes"],
  ["courses", "Courses"],
] as const;

/** Ménage › Cuisine : Frigo & placards · Recettes · Courses. */
export function Cuisine() {
  const t = useTheme();
  const [partie, setPartie] = useState<(typeof PARTIES)[number][0]>("frigo");
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.onglets}>
        {PARTIES.map(([cle, libelle]) => {
          const actif = partie === cle;
          return (
            <TouchableOpacity key={cle} onPress={() => setPartie(cle)} style={[styles.onglet, { borderBottomColor: actif ? t.accent : "transparent" }]} accessibilityRole="tab" accessibilityState={{ selected: actif }}>
              <Texte style={{ color: actif ? t.textPrimary : t.textMuted, fontSize: typography.bodySmall, fontWeight: "700" }}>{libelle}</Texte>
            </TouchableOpacity>
          );
        })}
      </View>
      {partie === "frigo" ? <CuisineFrigo /> : partie === "recettes" ? <CuisineRecettes /> : <CuisineCourses />}
    </View>
  );
}

const styles = StyleSheet.create({
  onglets: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.xl, marginTop: spacing.md },
  onglet: { paddingVertical: spacing.sm, borderBottomWidth: 2, borderRadius: radius.sm },
});
