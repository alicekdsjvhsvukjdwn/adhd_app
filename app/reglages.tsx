import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    getPreferences,
    updateAxe,
    type IntensiteGamification,
} from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const OPTIONS: {
  valeur: IntensiteGamification;
  titre: string;
  texte: string;
}[] = [
  {
    valeur: "complete",
    titre: "Complet",
    texte: "Série de jours, niveau et points.",
  },
  {
    valeur: "discrete",
    titre: "Discret",
    texte: "Seulement la série de jours.",
  },
  {
    valeur: "aucune",
    titre: "Aucun",
    texte: "Ni points ni série : juste ce qu'il y a à faire.",
  },
];

export default function Reglages() {
  const router = useRouter();
  const t = useTheme();
  const [choix, setChoix] = useState<IntensiteGamification | null>(null);

  useEffect(() => {
    getPreferences().then((p) => setChoix(p.gamification));
  }, []);

  const choisir = async (v: IntensiteGamification) => {
    setChoix(v);
    await updateAxe("gamification", v);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.contenu}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.retour, { color: t.accentText }]}>← Retour</Text>
      </TouchableOpacity>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Réglages</Text>

      <Text style={[styles.section, { color: t.textPrimary }]}>
        Points et séries
      </Text>
      <Text style={[styles.intro, { color: t.textSecondary }]}>
        Ce que l'accueil affiche pour suivre tes efforts.
      </Text>

      {OPTIONS.map((o) => {
        const actif = choix === o.valeur;
        return (
          <TouchableOpacity
            key={o.valeur}
            onPress={() => choisir(o.valeur)}
            style={[
              styles.option,
              {
                backgroundColor: actif ? t.bgHighlight : t.bgCard,
                borderColor: actif ? t.accent : "transparent",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.optionTitre,
                  { color: actif ? t.accentText : t.textPrimary },
                ]}
              >
                {o.titre}
              </Text>
              <Text style={[styles.optionTexte, { color: t.textSecondary }]}>
                {o.texte}
              </Text>
            </View>
            {actif && (
              <Text style={[styles.coche, { color: t.accent }]}>✓</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  retour: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  section: { fontSize: typography.h3, fontWeight: "600" },
  intro: { fontSize: typography.small, marginTop: 4, marginBottom: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionTitre: { fontSize: typography.body, fontWeight: "600" },
  optionTexte: { fontSize: typography.small, marginTop: 2 },
  coche: { fontSize: 18, fontWeight: "700" },
});
