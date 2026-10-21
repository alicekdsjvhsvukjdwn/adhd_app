import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Texte } from "../components/Texte";
import { FICHES } from "../lib/tcc-fiches";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Apprendre : des fiches d'une minute, factuelles et neutres. Chacune renvoie vers l'outil qui sert à l'appliquer. */
export default function Apprendre() {
  const router = useRouter();
  const t = useTheme();
  const [ouverte, setOuverte] = useState<string | null>(null);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Apprendre</Texte>
      <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
        Une minute par fiche. Des repères généraux sur l&apos;anxiété sociale, pas un avis médical : si ça te pèse beaucoup, en parler à un ou une
        professionnelle peut aider.
      </Texte>

      {FICHES.map((f) => {
        const ouvert = ouverte === f.id;
        return (
          <View key={f.id} style={[styles.fiche, { backgroundColor: t.bgCard, borderColor: ouvert ? t.accent : t.border }]}>
            <TouchableOpacity onPress={() => setOuverte(ouvert ? null : f.id)} accessibilityRole="button" accessibilityState={{ expanded: ouvert }}>
              <View style={styles.entete}>
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600", flex: 1 }}>{f.titre}</Texte>
                <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{ouvert ? "−" : "+"}</Texte>
              </View>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{f.resume}</Texte>
            </TouchableOpacity>
            {ouvert && (
              <View style={{ marginTop: spacing.md }}>
                {f.texte.map((p, i) => (
                  <Texte key={i} style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 21, marginBottom: spacing.sm }}>
                    {p}
                  </Texte>
                ))}
                <TouchableOpacity
                  onPress={() => router.push(f.outil.route as never)}
                  style={[styles.outil, { borderColor: t.accent }]}
                  accessibilityRole="button"
                >
                  <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>{f.outil.libelle} →</Texte>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  fiche: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  entete: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  outil: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm },
});
