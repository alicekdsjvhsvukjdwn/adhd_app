import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { checkinManquant, type Fenetre } from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Bandeau d'invitation au check-in d'état.
 *
 * Règles : une seule ligne, jamais un modal, et refusable. Un écarté reste
 * écarté jusqu'au changement de fenêtre (matin/soir) ou au redémarrage —
 * une invitation qui revient après un refus devient du harcèlement.
 */
let ecarteePour: Fenetre | null = null;

export function BandeauEtat() {
  const router = useRouter();
  const t = useTheme();
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkinManquant().then((f) => {
        setFenetre(f && f !== ecarteePour ? f : null);
      });
    }, []),
  );

  if (!fenetre) return null;

  return (
    <View style={[styles.bandeau, { backgroundColor: t.bgCard }]}>
      <TouchableOpacity
        style={styles.principal}
        onPress={() => router.push("/etat")}
      >
        <Text style={[styles.texte, { color: t.textPrimary }]}>
          Comment ça va, {fenetre === "matin" ? "ce matin" : "ce soir"} ?
        </Text>
        <Text style={[styles.sousTexte, { color: t.textMuted }]}>
          Trois taps
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fermer}
        onPress={() => {
          ecarteePour = fenetre;
          setFenetre(null);
        }}
        hitSlop={12}
      >
        <Text style={[styles.fermerTexte, { color: t.textMuted }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  principal: { flex: 1 },
  texte: { fontSize: typography.bodySmall, fontWeight: "500" },
  sousTexte: { fontSize: typography.tiny, marginTop: 2 },
  fermer: { paddingLeft: spacing.md },
  fermerTexte: { fontSize: typography.body },
});
