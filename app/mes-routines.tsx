import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { CarteSuggestion } from "../components/CarteSuggestion";
import type { Categorie } from "../lib/catalogue";
import { confirmationSuppression, deleteItem } from "../lib/db";
import {
  routinesParCategorie,
  type RoutineResumee,
} from "../lib/db/categories";
import { estJourDifficile } from "../lib/db/jour-difficile";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import {
  ICONES_CATEGORIE,
  LIBELLES_CATEGORIE,
  ORDRE_CATEGORIES,
  useCouleurCategorie,
} from "../lib/theme-categories";

/**
 * Gérer ses routines : toutes les routines actives par domaine (prévues
 * aujourd'hui ou non), la suggestion d'ajustement, modifier et supprimer.
 * Toucher = modifier ; glisser vers la gauche = supprimer (avec confirmation).
 */
export default function MesRoutines() {
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();

  const [resume, setResume] = useState<{
    parCategorie: Record<Categorie, RoutineResumee[]>;
    sansDomaine: RoutineResumee[];
  } | null>(null);
  const [jourDifficile, setJourDifficile] = useState(false);

  const charger = useCallback(async () => {
    setResume(await routinesParCategorie());
    setJourDifficile(await estJourDifficile());
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const onSupprimer = (r: RoutineResumee) => {
    const { titre, message } = confirmationSuppression("routine", r.nom);
    Alert.alert(titre, message, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteItem(r.id);
          await charger();
        },
      },
    ]);
  };

  const ligne = (r: RoutineResumee) => (
    <Swipeable
      key={r.id}
      renderRightActions={() => (
        <TouchableOpacity
          style={[styles.supprimer, { backgroundColor: t.danger }]}
          onPress={() => onSupprimer(r)}
        >
          <Text style={[styles.supprimerTexte, { color: t.textOnAccent }]}>
            Supprimer
          </Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={[styles.ligne, { backgroundColor: t.bgApp }]}
        onPress={() => router.push(`/nouvelle-tache?id=${r.id}`)}
        accessibilityHint="Ouvre la modification"
      >
        <Text style={[styles.ligneNom, { color: t.textPrimary }]}>{r.nom}</Text>
        <Text style={[styles.chevron, { color: t.textMuted }]}>›</Text>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.retour, { color: t.accentText }]}>← Retour</Text>
      </TouchableOpacity>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Mes routines</Text>

      {!jourDifficile && <CarteSuggestion onDecision={charger} />}

      <Text style={[styles.aide, { color: t.textMuted }]}>
        Touche une routine pour la modifier, glisse-la vers la gauche pour la
        supprimer.
      </Text>

      {resume &&
        ORDRE_CATEGORIES.map((c) => {
          const liste = resume.parCategorie[c];
          return (
            <View
              key={c}
              style={[
                styles.domaine,
                { backgroundColor: t.bgCard, borderLeftColor: couleurCat(c) },
              ]}
            >
              <View style={styles.domaineEntete}>
                <Text style={[styles.domaineTitre, { color: t.textPrimary }]}>
                  {ICONES_CATEGORIE[c]} {LIBELLES_CATEGORIE[c]}
                </Text>
                <Text style={[styles.domaineCompte, { color: t.textMuted }]}>
                  {liste.length}
                </Text>
              </View>
              {liste.length === 0 ? (
                <TouchableOpacity
                  onPress={() => router.push("/mise-en-place")}
                  hitSlop={6}
                >
                  <Text style={[styles.domaineVide, { color: t.accentText }]}>
                    Rien pour l&apos;instant · Trouver une idée
                  </Text>
                </TouchableOpacity>
              ) : (
                liste.map(ligne)
              )}
            </View>
          );
        })}

      {resume && resume.sansDomaine.length > 0 && (
        <View
          style={[
            styles.domaine,
            { backgroundColor: t.bgCard, borderLeftColor: t.border },
          ]}
        >
          <View style={styles.domaineEntete}>
            <Text style={[styles.domaineTitre, { color: t.textPrimary }]}>
              Sans domaine
            </Text>
            <Text style={[styles.domaineCompte, { color: t.textMuted }]}>
              {resume.sansDomaine.length}
            </Text>
          </View>
          {resume.sansDomaine.map(ligne)}
          <Text style={[styles.aide, { color: t.textMuted, marginTop: 4 }]}>
            Touche une routine pour lui donner un domaine.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
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
  aide: {
    fontSize: typography.small,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  domaine: {
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  domaineEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  domaineTitre: { fontSize: typography.bodySmall, fontWeight: "600" },
  domaineCompte: { fontSize: typography.bodySmall, fontWeight: "700" },
  domaineVide: { fontSize: typography.small, marginTop: 4, fontWeight: "600" },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: 4,
    minHeight: 44,
  },
  ligneNom: { flex: 1, fontSize: typography.body },
  chevron: { fontSize: typography.h3, marginLeft: spacing.sm },
  supprimer: {
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    borderRadius: radius.sm,
    marginTop: 4,
    marginLeft: 4,
  },
  supprimerTexte: { fontWeight: "600", fontSize: typography.small },
});
