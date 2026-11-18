import { useCleReset } from "../../lib/reset-onglet";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Platform,
  Switch,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../../components/Texte";
import { joursDepuisSauvegarde } from "../../lib/fichiers";
import { ecrireMeta, lireMeta } from "../../lib/db/meta";
import { CLE_AFFICHER_TROIS } from "../../lib/journee-regles";
import { MODULES } from "../../lib/modules-visibles";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

type Entree = {
  titre: string;
  description: string;
  route: string;
};

/**
 * Profil : 5 lignes. « Sauvegarde et export » vient en premier, mise en avant (sa description est
 * calculée à l'affichage, voir plus bas). « Idées de routines » n'a qu'une entrée : en bas de la liste
 * de l'onglet Routines.
 */
const ENTREES: Entree[] = [
  {
    titre: "Zones du bonhomme",
    description: "Ce que veut dire chaque zone de « Ma journée », sa couleur, et les liens automatiques.",
    route: "/zones",
  },
  {
    titre: "Récap du dimanche",
    description: "L'heure du récap, sa notification et la piste pour la semaine.",
    route: "/recap-reglages",
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
    titre: "Rappels",
    description: "Quand l'appli te fait signe.",
    route: "/rappels",
  },
  {
    titre: "Début de journée",
    description: "L'heure où la journée de l'appli commence.",
    route: "/debut-journee",
  },
  // Sixième ligne seulement si le module est remis (lib/modules-visibles.ts).
  {
    titre: "Mes moments repères",
    description: "Les ancres auxquelles rattacher les routines.",
    route: "/ancres",
  },
].filter((e) => e.route !== "/ancres" || MODULES.ancres);

/** Sur le web, les données vivent dans le navigateur : la ligne rappelle l'âge de la dernière copie. */
function descriptionSauvegarde(): string {
  const jours = Platform.OS === "web" ? joursDepuisSauvegarde() : -1;
  if (jours === null) return "Pas encore de sauvegarde : exporte-en une.";
  if (jours > 7) return `Dernière sauvegarde il y a ${jours} jours : exporte-en une nouvelle.`;
  return "Exporter une copie de tes données, ou en restaurer une.";
}

function ProfilContenu() {
  const router = useRouter();
  const t = useTheme();
  const [sauvegarde, setSauvegarde] = useState(descriptionSauvegarde);
  const [trois, setTrois] = useState(false);

  // Au retour de l'écran Sauvegarde, la ligne suit l'export qui vient d'être fait.
  useFocusEffect(
    useCallback(() => {
      setSauvegarde(descriptionSauvegarde());
      lireMeta(CLE_AFFICHER_TROIS).then((v) => setTrois(v === "1"));
    }, []),
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Profil</Texte>

        <TouchableOpacity
          style={[styles.entree, styles.entreeEnAvant, { backgroundColor: t.bgCard, borderColor: t.accent }]}
          onPress={() => router.push("/sauvegarde" as never)}
        >
          <Texte style={[styles.entreeTitre, { color: t.accentText }]}>Sauvegarde et export</Texte>
          <Texte style={[styles.entreeTexte, { color: t.textSecondary }]}>{sauvegarde}</Texte>
        </TouchableOpacity>

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

        {/* Les 3 du jour et les bonus : cachés par défaut, rien n'est effacé. */}
        <View style={[styles.entree, styles.reglage, { backgroundColor: t.bgCard }]}>
          <View style={{ flex: 1 }}>
            <Texte style={[styles.entreeTitre, { color: t.textPrimary }]}>Afficher mes 3 priorités</Texte>
            <Texte style={[styles.entreeTexte, { color: t.textSecondary }]}>
              Les 3 du jour et les bonus, ouverts depuis « Ma journée ».
            </Texte>
          </View>
          <Switch
            value={trois}
            onValueChange={async (v) => {
              setTrois(v);
              await ecrireMeta(CLE_AFFICHER_TROIS, v ? "1" : null);
            }}
            accessibilityLabel="Afficher mes 3 priorités"
          />
        </View>

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
  entreeEnAvant: { borderWidth: 1 },
  reglage: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  entreeTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: 4,
  },
  entreeTexte: { fontSize: typography.small, lineHeight: 19 },
  version: { fontSize: typography.tiny, textAlign: "center", marginTop: spacing.lg },
});

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à son accueil (voir lib/reset-onglet.ts). */
export default function Profil() {
  return <ProfilContenu key={useCleReset("profil")} />;
}
