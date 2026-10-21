import { useCleReset } from "../../lib/reset-onglet";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../../components/Texte";
import { BoutonReinitialiser } from "../../components/BoutonReinitialiser";
import { CarteDebutJour } from "../../components/CarteDebutJour";
import { CarteSauvegarde } from "../../components/CarteSauvegarde";
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
    titre: "Mes listes",
    description: "Les catégories de tes tâches : noms, icônes, couleurs.",
    route: "/listes",
  },
  {
    titre: "Agenda",
    description: "Tes rendez-vous Google Agenda, en lecture seule.",
    route: "/agenda",
  },
  {
    titre: "Rappels quotidiens",
    description: "Quand l'appli te fait signe.",
    route: "/rappels",
  },
];

function ProfilContenu() {
  const router = useRouter();
  const t = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Profil</Texte>

        {ENTREES.map((e) => (
          <TouchableOpacity
            key={e.route}
            style={[styles.entree, { backgroundColor: t.bgCard }]}
            onPress={() => router.push(e.route as never)}
          >
            <Texte style={[styles.entreeTitre, { color: t.textPrimary }]}>
              {e.titre}
            </Texte>
            <Texte style={[styles.entreeTexte, { color: t.textSecondary }]}>
              {e.description}
            </Texte>
          </TouchableOpacity>
        ))}

        <CarteDebutJour />

        <CarteSauvegarde />

        <BoutonReinitialiser />

        <TouchableOpacity
          style={styles.aide}
          onPress={() => Linking.openURL("tel:3114")}
        >
          <Texte style={[styles.aideTexte, { color: t.textMuted }]}>
            Si ça ne va vraiment pas : le 3114, numéro national de prévention du
            suicide, gratuit, 24 h/24. Toucher pour appeler.
          </Texte>
        </TouchableOpacity>

        <Texte style={[styles.version, { color: t.textMuted }]}>
          Version {Constants.expoConfig?.version}
          {process.env.EXPO_PUBLIC_BUILD ? ` · publiée le ${process.env.EXPO_PUBLIC_BUILD}` : ""}
        </Texte>

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
  version: { fontSize: typography.tiny, textAlign: "center", marginTop: spacing.lg },
  aide: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  aideTexte: { fontSize: typography.tiny, lineHeight: 17, textAlign: "center" },
});

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à son accueil (voir lib/reset-onglet.ts). */
export default function Profil() {
  return <ProfilContenu key={useCleReset("profil")} />;
}
