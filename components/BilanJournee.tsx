import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { bilanDuJour, enregistrerBilan, type Niveau } from "../lib/db/etat";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * « Comment était ta journée ? » : un tap, facultatif, sans points ni rappel.
 * Toucher un autre choix remplace le bilan du jour. Le moteur ne le lit pas.
 */
const CHOIX: { niveau: Niveau; libelle: string }[] = [
  { niveau: 1, libelle: "🪫 Difficile" },
  { niveau: 2, libelle: "🔋 Moyenne" },
  { niveau: 3, libelle: "⚡ Bonne" },
];

export function BilanJournee() {
  const t = useTheme();
  const [choisi, setChoisi] = useState<Niveau | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      bilanDuJour().then((n) => {
        if (actif) setChoisi(n);
      });
      return () => {
        actif = false;
      };
    }, []),
  );

  const choisir = async (n: Niveau) => {
    setChoisi(n);
    await enregistrerBilan(n);
  };

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <Text style={[styles.titre, { color: t.textPrimary }]}>
        Comment était ta journée ?
      </Text>
      <View style={styles.choix}>
        {CHOIX.map((c) => {
          const actif = choisi === c.niveau;
          return (
            <TouchableOpacity
              key={c.niveau}
              onPress={() => choisir(c.niveau)}
              accessibilityState={{ selected: actif }}
              style={[
                styles.bouton,
                {
                  backgroundColor: actif ? t.accent : t.bgApp,
                  borderColor: actif ? t.accent : t.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.boutonTexte,
                  { color: actif ? t.textOnAccent : t.textSecondary },
                ]}
              >
                {c.libelle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  titre: { fontSize: typography.body, fontWeight: "600" },
  choix: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  bouton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  boutonTexte: { fontSize: typography.small, fontWeight: "600" },
});
