import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { toutReinitialiser } from "../lib/db/reinitialiser";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Carte « Tout réinitialiser » pour l'écran Profil.
 * Une confirmation explicite, et un rappel de l'option plus douce.
 */
export function BoutonReinitialiser() {
  const router = useRouter();
  const t = useTheme();
  const [enCours, setEnCours] = useState(false);

  const confirmer = () => {
    Alert.alert(
      "Tout effacer ?",
      "Routines, tâches, historique, check-ins, points et réglages seront supprimés, et l'appli repartira de zéro. C'est définitif.\n\nPour seulement choisir d'autres routines en gardant tes données, passe plutôt par « Idées de routines ».",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout effacer",
          style: "destructive",
          onPress: async () => {
            setEnCours(true);
            try {
              await toutReinitialiser();
              router.replace("/onboarding");
            } catch (e) {
              setEnCours(false);
              Alert.alert("La réinitialisation a échoué", String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.carte,
        { backgroundColor: t.bgCard, borderColor: t.danger },
      ]}
      onPress={confirmer}
      disabled={enCours}
    >
      <Text style={[styles.titre, { color: t.danger }]}>
        {enCours ? "Réinitialisation…" : "Tout réinitialiser"}
      </Text>
      <Text style={[styles.texte, { color: t.textMuted }]}>
        Effacer toutes les données et repartir du début.
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xxl,
  },
  titre: { fontSize: typography.h3, fontWeight: "600" },
  texte: { fontSize: typography.small, marginTop: 4 },
});
