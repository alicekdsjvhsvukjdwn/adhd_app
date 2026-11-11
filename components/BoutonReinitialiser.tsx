import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Texte } from "./Texte";
import { toutReinitialiser } from "../lib/db/reinitialiser";
import { spacing, typography, useTheme } from "../lib/theme";

/**
 * « Tout réinitialiser » : un lien discret, tout en bas de Sauvegarde et export.
 * Rien n'est effacé sans la confirmation explicite.
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
    <TouchableOpacity style={styles.lien} onPress={confirmer} disabled={enCours} hitSlop={8} accessibilityRole="button">
      <Texte style={[styles.texte, { color: t.textMuted }]}>
        {enCours ? "Réinitialisation…" : "Tout réinitialiser"}
      </Texte>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  lien: { alignSelf: "center", marginTop: spacing.xxxl * 2, paddingVertical: spacing.sm },
  texte: { fontSize: typography.small, textDecorationLine: "underline" },
});
