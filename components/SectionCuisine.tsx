import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { suiviCuisine, type SuiviCuisine } from "../lib/db/cuisine-courses";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const HAUT = 56;

/** Progrès › Cuisine : repas cuisinés par semaine, recettes les plus faites, aliments jetés ou finis. Des repères, pas des notes. */
export function SectionCuisine() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [d, setD] = useState<SuiviCuisine | null>(null);

  useFocusEffect(
    useCallback(() => {
      suiviCuisine(aujourdhui).then(setD);
    }, [aujourdhui]),
  );

  if (!d) return null;
  const max = Math.max(1, ...d.semaines.map((s) => s.n));
  const carte = (titre: string, enfant: React.ReactNode) => (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>{titre}</Texte>
      {enfant}
    </View>
  );

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Cuisine</Texte>
      {carte(
        "REPAS CUISINÉS, PAR SEMAINE",
        d.total === 0 ? (
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Pas encore de repas noté. « J&apos;ai cuisiné » sur une recette apparaît ici.</Texte>
        ) : (
          <View style={styles.barres} accessibilityLabel="Repas cuisinés par semaine">
            {d.semaines.map((s) => (
              <View key={s.lundi} style={styles.colonne}>
                <View style={{ height: HAUT, justifyContent: "flex-end" }}>
                  <View style={{ height: (s.n / max) * HAUT, backgroundColor: t.accent, borderRadius: 2 }} />
                </View>
                <Texte style={[styles.date, { color: t.textMuted }]}>{`${Number(s.lundi.slice(8))}/${Number(s.lundi.slice(5, 7))}`}</Texte>
              </View>
            ))}
          </View>
        ),
      )}
      {d.top.length > 0 &&
        carte(
          "RECETTES LES PLUS FAITES",
          d.top.map((r) => (
            <View key={r.titre} style={styles.ligne}>
              <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{r.titre}</Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{r.n} fois</Texte>
            </View>
          )),
        )}
      {(d.jetes.length > 0 || d.finis > 0) &&
        carte(
          "ALIMENTS JETÉS",
          <>
            {d.jetes.length === 0 ? (
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Rien de jeté : bravo.</Texte>
            ) : (
              d.jetes.map((a) => (
                <View key={a.nom} style={styles.ligne}>
                  <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{a.nom}</Texte>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{a.n} fois</Texte>
                </View>
              ))
            )}
            {d.finis > 0 && <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>{d.finis} aliment{d.finis > 1 ? "s" : ""} fini{d.finis > 1 ? "s" : ""} jusqu&apos;au bout.</Texte>}
          </>,
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  barres: { flexDirection: "row", gap: 6 },
  colonne: { flex: 1, alignItems: "stretch" },
  date: { fontSize: 10, textAlign: "center", marginTop: 4 },
  ligne: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
});
