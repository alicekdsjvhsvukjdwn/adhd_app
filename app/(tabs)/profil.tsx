import { useRouter } from "expo-router";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

type Entree = {
  titre: string;
  description: string;
  route: string;
};

const ENTREES: Entree[] = [
  {
    titre: "Trouver une routine",
    description: "Par ce qui te pose problème, ou par recherche.",
    route: "/problemes",
  },
  {
    titre: "Mes moments repères",
    description: "Les ancres auxquelles rattacher les routines.",
    route: "/ancres",
  },
  {
    titre: "Rappels quotidiens",
    description: "Quand l'appli te fait signe.",
    route: "/rappels",
  },
  {
    titre: "Comment je vais",
    description: "Le point énergie, concentration, humeur.",
    route: "/etat",
  },
  {
    titre: "Refaire l'onboarding",
    description: "Rechoisir ton profil et tes préférences.",
    route: "/onboarding",
  },
];

export default function Profil() {
  const router = useRouter();
  const t = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.titre, { color: t.textPrimary }]}>Profil</Text>

        {ENTREES.map((e) => (
          <TouchableOpacity
            key={e.route}
            style={[styles.entree, { backgroundColor: t.bgCard }]}
            onPress={() => router.push(e.route as never)}
          >
            <Text style={[styles.entreeTitre, { color: t.textPrimary }]}>
              {e.titre}
            </Text>
            <Text style={[styles.entreeTexte, { color: t.textSecondary }]}>
              {e.description}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
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
  entree: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  entreeTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: 4,
  },
  entreeTexte: { fontSize: typography.small, lineHeight: 19 },
});
