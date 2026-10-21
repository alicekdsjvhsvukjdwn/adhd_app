import { useFocusEffect, useRouter } from "expo-router";
import { Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { seanceDuJour, type SeanceDuPlan as Donnees } from "../lib/db/plan-sport";
import { dureeEstimee, minutesDe } from "../lib/seances-sport";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

/** Sport › Workout : la séance du jour proposée par mon plan (rien s'il n'y a pas de plan ou si c'est un jour de repos). */
export function SeanceDuPlan() {
  const t = useTheme();
  const router = useRouter();
  const aujourdhui = useJourCourant();
  const [s, setS] = useState<Donnees | null>(null);

  useFocusEffect(
    useCallback(() => {
      seanceDuJour(aujourdhui).then(setS).catch(() => setS(null));
    }, [aujourdhui]),
  );

  if (!s) return null;
  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent }]}>
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>SÉANCE DU JOUR · MON PLAN</Texte>
      <View style={styles.ligne}>
        <View style={{ flex: 1 }}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>{s.nom}</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
            {s.lignes.length} exercices · environ {minutesDe(dureeEstimee(s.lignes))} min{s.courte ? " · version courte (jour difficile)" : ""}
          </Texte>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/seance-sport?source=plan&id=${s.planSeance.id}${s.courte ? "&courte=1" : ""}` as never)}
          style={[styles.lecture, { backgroundColor: t.accent }]}
          accessibilityRole="button"
          accessibilityLabel={`Commencer ${s.nom}`}
        >
          <Play color={t.textOnAccent} size={22} fill={t.textOnAccent} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lecture: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
