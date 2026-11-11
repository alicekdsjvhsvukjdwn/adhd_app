import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { CarteDebutJour } from "../components/CarteDebutJour";
import { Texte } from "../components/Texte";
import { spacing, typography, useTheme } from "../lib/theme";

/** Profil › Début de journée : l'heure où la journée de l'appli commence. */
export default function DebutJournee() {
  const router = useRouter();
  const t = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Début de journée</Texte>
      <CarteDebutJour />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
});
