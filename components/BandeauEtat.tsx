import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { checkinPropose } from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Bandeau d'invitation au check-in d'état.
 *
 * Règles : une seule ligne, jamais un modal, et refusable. Il apparaît
 * au plus 3 fois par jour, avec au moins 3 h d'écart (voir etat.ts).
 * Écarté par la croix, il ne revient pas avant une heure : une invitation
 * qui revient aussitôt après un refus devient du harcèlement.
 */
const PAUSE_APRES_REFUS_MS = 60 * 60 * 1000;
let ecarteJusqua = 0;

export function BandeauEtat() {
  const router = useRouter();
  const t = useTheme();
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      checkinPropose().then((propose) => {
        if (actif) setVisible(propose && Date.now() >= ecarteJusqua);
      });
      return () => {
        actif = false;
      };
    }, []),
  );

  if (!visible) return null;

  return (
    <View style={[styles.bandeau, { backgroundColor: t.bgCard }]}>
      <TouchableOpacity
        style={styles.principal}
        onPress={() => router.push("/etat")}
      >
        <Text style={[styles.texte, { color: t.textPrimary }]}>
          Comment ça va, là ?
        </Text>
        <Text style={[styles.sousTexte, { color: t.textMuted }]}>
          Trois taps
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fermer}
        onPress={() => {
          ecarteJusqua = Date.now() + PAUSE_APRES_REFUS_MS;
          setVisible(false);
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
