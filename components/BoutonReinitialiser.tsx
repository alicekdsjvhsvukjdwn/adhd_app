import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Texte } from "./Texte";
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
      "Routines, tâches, listes, historique, notes, sommeil, sport, points et récompenses seront supprimés. C'est définitif.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout effacer",
          style: "destructive",
          onPress: async () => {
            setEnCours(true);
            try {
              await toutReinitialiser();
              router.replace("/");
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
      style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.danger }]}
      onPress={confirmer}
      disabled={enCours}
    >
      <Texte style={[styles.titre, { color: t.danger }]}>
        {enCours ? "Réinitialisation…" : "Tout réinitialiser"}
      </Texte>
      <Texte style={[styles.texte, { color: t.textMuted }]}>
        Effacer toutes les données et repartir du début.
      </Texte>
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
