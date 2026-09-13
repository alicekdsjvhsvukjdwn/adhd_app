import { useRouter } from "expo-router";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

export default function Jardin() {
  const router = useRouter();
  const t = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Jardin</Text>

      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        <Text style={[styles.texte, { color: t.textSecondary }]}>
          C'est ici que vivra le compagnon et sa maison : les objets débloqués
          apparaîtront au fur et à mesure.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.bouton, { backgroundColor: t.accent }]}
        onPress={() => router.push("/scene")}
      >
        <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
          Voir la scène (test)
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  carte: { borderRadius: radius.lg, padding: spacing.lg },
  texte: { fontSize: typography.small, lineHeight: 19 },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
});
