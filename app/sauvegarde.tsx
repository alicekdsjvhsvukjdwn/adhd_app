import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { BoutonReinitialiser } from "../components/BoutonReinitialiser";
import { CarteSauvegarde } from "../components/CarteSauvegarde";
import { Texte } from "../components/Texte";
import { spacing, typography, useTheme } from "../lib/theme";

/** Profil › Sauvegarde et export : exporter, restaurer, CSV ; « Tout réinitialiser », discret, tout en bas. */
export default function Sauvegarde() {
  const router = useRouter();
  const t = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Sauvegarde et export</Texte>
      <CarteSauvegarde />
      <BoutonReinitialiser />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600" },
});
