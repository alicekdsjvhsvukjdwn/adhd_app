import { useRouter } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BoutonReinitialiser } from "../../components/BoutonReinitialiser";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

type Entree = {
  titre: string;
  description: string;
  route: string;
};

const ENTREES: Entree[] = [
  {
    titre: "Idées de routines",
    description: "À partir de ce qui est difficile en ce moment.",
    route: "/mise-en-place",
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
    titre: "Réglages",
    description: "Points et séries affichés sur l'accueil.",
    route: "/reglages",
  },
];

export default function Profil() {
  const router = useRouter();
  const t = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: t.bgApp }]}>
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

        <BoutonReinitialiser />

        <TouchableOpacity
          style={styles.aide}
          onPress={() => Linking.openURL("tel:3114")}
        >
          <Text style={[styles.aideTexte, { color: t.textMuted }]}>
            Si ça ne va vraiment pas : le 3114, numéro national de prévention du
            suicide, gratuit, 24 h/24. Toucher pour appeler.
          </Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
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
  aide: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  aideTexte: { fontSize: typography.tiny, lineHeight: 17, textAlign: "center" },
});
