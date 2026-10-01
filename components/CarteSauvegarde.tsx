import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getConfigRappel } from "../lib/db";
import {
  choisirSauvegarde,
  exporterSauvegarde,
  restaurerSauvegarde,
} from "../lib/db/sauvegarde";
import { reprogrammerRappel } from "../lib/notifications";
import { nombreItems } from "../lib/sauvegarde-format";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Carte « Mes données » pour l'écran Profil : exporter une sauvegarde,
 * ou en restaurer une (après confirmation, tout est remplacé).
 */
export function CarteSauvegarde() {
  const t = useTheme();
  const [enCours, setEnCours] = useState(false);

  const exporter = async () => {
    setEnCours(true);
    try {
      await exporterSauvegarde();
    } catch (e) {
      Alert.alert("L'export a échoué", String(e));
    } finally {
      setEnCours(false);
    }
  };

  const restaurer = async () => {
    setEnCours(true);
    try {
      const v = await choisirSauvegarde();
      if (!v) return;
      if (!v.ok) {
        Alert.alert("Impossible de restaurer", v.erreur);
        return;
      }
      const s = v.sauvegarde;
      const date = s.creee_le
        ? new Date(s.creee_le).toLocaleDateString("fr-FR")
        : "date inconnue";
      Alert.alert(
        "Remplacer toutes tes données ?",
        `Tout ce qui est dans l'appli sera remplacé par la sauvegarde du ${date} (${nombreItems(s)} routines et tâches). C'est définitif.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Remplacer",
            style: "destructive",
            onPress: async () => {
              setEnCours(true);
              try {
                await restaurerSauvegarde(s);
                // Les rappels vivent hors de la base : on les recale sur la config restaurée.
                await reprogrammerRappel(await getConfigRappel()).catch(
                  () => {},
                );
                Alert.alert("C'est restauré", "Tes données sont revenues.");
              } catch (e) {
                Alert.alert(
                  "La restauration a échoué",
                  `Rien n'a été modifié.\n\n${String(e)}`,
                );
              } finally {
                setEnCours(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Impossible de lire ce fichier", String(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Mes données</Text>
      <Text style={[styles.texte, { color: t.textSecondary }]}>
        Une copie de tout ce que tu as noté, à garder où tu veux (Fichiers,
        Drive, mail). Elle contient aussi tes check-ins : garde-la pour toi.
      </Text>
      <View style={styles.boutons}>
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: t.accent }]}
          onPress={exporter}
          disabled={enCours}
        >
          <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
            Exporter
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bouton, { borderColor: t.border, borderWidth: 1 }]}
          onPress={restaurer}
          disabled={enCours}
        >
          <Text style={[styles.boutonTexte, { color: t.textPrimary }]}>
            Restaurer
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  titre: { fontSize: typography.h3, fontWeight: "600" },
  texte: { fontSize: typography.small, lineHeight: 19, marginTop: 4 },
  boutons: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  bouton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
});
