import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { BandeauEtat } from "../../components/BandeauEtat";
import { CarteSuggestion } from "../../components/CarteSuggestion";
import { useRoutines } from "../../hooks/useRoutines";
import { deviner, type Categorie } from "../../lib/catalogue";
import {
  addItem,
  annulerCompletion,
  deleteItem,
  getPreferences,
} from "../../lib/db";
import { completionsParCategorieJour } from "../../lib/db/categories";
import type { RoutineAvecStatut } from "../../lib/db/completions";
import { genererPropositions, type Proposition } from "../../lib/db/moteur";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
import {
  ICONES_CATEGORIE,
  ORDRE_CATEGORIES,
  useCouleurCategorie
} from "../../lib/theme-categories";

// Regroupe les moments fins du catalogue en trois blocs lisibles.
const BLOC_PAR_MOMENT: Record<string, string> = {
  reveil: "matin",
  matin: "matin",
  midi: "apres_midi",
  apres_midi: "apres_midi",
  "apres-midi": "apres_midi",
  soir: "soir",
  coucher: "soir",
};

const ORDRE_BLOCS = ["matin", "apres_midi", "soir", "sans_ancre"];

const LIBELLES_BLOCS: Record<string, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  soir: "Soir",
  sans_ancre: "À tout moment",
};

function blocDeRoutine(r: RoutineAvecStatut): string {
  const m = r.ancre_moment || r.moment;
  if (m && BLOC_PAR_MOMENT[m]) return BLOC_PAR_MOMENT[m];
  return "sans_ancre";
}

export default function Index() {
  const { routines, stats, preferences, toggle, supprimer, recharger } =
    useRoutines();

  const [taches, setTaches] = useState<Proposition[]>([]);
  const [equilibreJour, setEquilibreJour] = useState<Record<
    Categorie,
    number
  > | null>(null);

  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const prefs = await getPreferences();
        if (!prefs.onboardingFait) router.replace("/onboarding");
      })();
    }, [router]),
  );

  const chargerAnnexes = useCallback(async () => {
    const props = await genererPropositions();
    setTaches(props.filter((p) => p.propose));
    setEquilibreJour(await completionsParCategorieJour());
  }, []);

  useFocusEffect(
    useCallback(() => {
      recharger();
      chargerAnnexes();
    }, [recharger, chargerAnnexes]),
  );

  const onToggleRoutine = async (id: number, fait: boolean) => {
    await toggle(id, fait);
    await chargerAnnexes();
  };

  // Noter une tâche en une ligne.
  const [nouvelleTache, setNouvelleTache] = useState("");
  const [tacheNotee, setTacheNotee] = useState<string | null>(null);
  const minuteurNotee = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onNoterTache = async () => {
    const nom = nouvelleTache.trim();
    if (!nom) return;
    await addItem({
      nom,
      type: "tache",
      categorie: deviner(nom)?.categorie ?? null,
    });
    setNouvelleTache("");
    Keyboard.dismiss();
    setTacheNotee(nom);
    if (minuteurNotee.current) clearTimeout(minuteurNotee.current);
    minuteurNotee.current = setTimeout(() => setTacheNotee(null), 4000);
    await chargerAnnexes();
  };

  // Filet contre le tap par erreur : quelques secondes pour annuler.
  const [annulable, setAnnulable] = useState<{
    id: number;
    nom: string;
  } | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  const onCompleterTache = async (id: number, nom: string) => {
    await toggle(id, false);
    await chargerAnnexes();
    if (minuteur.current) clearTimeout(minuteur.current);
    setAnnulable({ id, nom });
    minuteur.current = setTimeout(() => setAnnulable(null), 6000);
  };

  const onAnnulerTache = async () => {
    if (!annulable) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    const id = annulable.id;
    setAnnulable(null);
    await annulerCompletion(id);
    await recharger();
    await chargerAnnexes();
  };

  const onSupprimerRoutine = (id: number, nom: string) => {
    Alert.alert(
      "Supprimer cette routine ?",
      `« ${nom} » et son historique seront effacés.`,
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await supprimer(id);
            await chargerAnnexes();
          },
        },
      ],
    );
  };

  const onSupprimerTache = (id: number, nom: string) => {
    Alert.alert("Supprimer cette tâche ?", nom, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteItem(id);
          await chargerAnnexes();
        },
      },
    ]);
  };

  // Regroupement des routines par bloc de moment.
  const parBloc = routines.reduce<Record<string, RoutineAvecStatut[]>>(
    (acc, r) => {
      const b = blocDeRoutine(r);
      (acc[b] ??= []).push(r);
      return acc;
    },
    {},
  );
  const blocsAvecRoutines = ORDRE_BLOCS.filter((b) => parBloc[b]?.length > 0);
  const nbRoutinesFaites = routines.filter((r) => r.faitAujourdhui).length;

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={[styles.container, { backgroundColor: t.bgApp }]}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        <Text style={[styles.titre, { color: t.textPrimary }]}>
          Aujourd'hui
        </Text>

        {stats && preferences && preferences.gamification !== "aucune" && (
          <View
            style={[styles.bandeauStats, { backgroundColor: t.bgHighlight }]}
          >
            <Text style={[styles.statTexte, { color: t.accentText }]}>
              🔥 {stats.currentStreak} j
            </Text>
            {preferences.gamification === "complete" && (
              <>
                <Text style={[styles.statTexte, { color: t.accentText }]}>
                  Niveau {stats.niveau}
                </Text>
                <Text style={[styles.statTexte, { color: t.accentText }]}>
                  {stats.points} pts
                </Text>
              </>
            )}
          </View>
        )}

        <BandeauEtat />

        <CarteSuggestion
          onDecision={async () => {
            await recharger();
            await chargerAnnexes();
          }}
        />

        {/* Indicateur d'équilibre : les catégories touchées aujourd'hui */}
        {equilibreJour && (
          <View style={styles.equilibre}>
            {ORDRE_CATEGORIES.map((c) => {
              const touche = (equilibreJour[c] ?? 0) > 0;
              return (
                <View key={c} style={styles.equilibreItem}>
                  <View
                    style={[
                      styles.equilibrePastille,
                      {
                        backgroundColor: touche ? couleurCat(c) : t.bgCard,
                        borderColor: couleurCat(c),
                      },
                    ]}
                  >
                    <Text style={styles.equilibreIcone}>
                      {ICONES_CATEGORIE[c]}
                    </Text>
                  </View>
                  <Text style={[styles.equilibreLabel, { color: t.textMuted }]}>
                    {equilibreJour[c] ?? 0}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Section routines, groupées par moment */}
        <View style={styles.titreRoutinesLigne}>
          <Text
            style={[
              styles.titreBloc,
              { color: t.textPrimary, marginBottom: 0 },
            ]}
          >
            Routines
          </Text>
          <View style={styles.titreDroite}>
            {routines.length > 0 && (
              <Text style={[styles.compteur, { color: t.textMuted }]}>
                {nbRoutinesFaites}/{routines.length}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.boutonAjout, { backgroundColor: t.accent }]}
              onPress={() => router.push("/mise-en-place")}
              accessibilityLabel="Ajouter des routines"
            >
              <Text
                style={[styles.boutonAjoutTexte, { color: t.textOnAccent }]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {blocsAvecRoutines.length === 0 ? (
          <TouchableOpacity
            style={[styles.vide, { backgroundColor: t.bgCard }]}
            onPress={() => router.push("/mise-en-place")}
          >
            <Text style={[styles.videTitre, { color: t.textPrimary }]}>
              Aucune routine pour l'instant
            </Text>
            <Text style={[styles.videTexte, { color: t.textSecondary }]}>
              Touche ici pour les mettre en place en quelques secondes.
            </Text>
          </TouchableOpacity>
        ) : (
          blocsAvecRoutines.map((bloc) => (
            <View key={bloc} style={styles.section}>
              <Text style={[styles.sectionTitre, { color: t.accentText }]}>
                {LIBELLES_BLOCS[bloc]}
              </Text>
              {parBloc[bloc].map((r) => (
                <Swipeable
                  key={r.id}
                  renderRightActions={() => (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[
                          styles.boutonSupprimer,
                          { backgroundColor: t.accentText },
                        ]}
                        onPress={() =>
                          router.push(`/nouvelle-tache?id=${r.id}`)
                        }
                      >
                        <Text
                          style={[
                            styles.texteSupprimer,
                            { color: t.textOnAccent },
                          ]}
                        >
                          Modifier
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.boutonSupprimer,
                          { backgroundColor: t.danger },
                        ]}
                        onPress={() => onSupprimerRoutine(r.id, r.nom)}
                      >
                        <Text
                          style={[
                            styles.texteSupprimer,
                            { color: t.textOnAccent },
                          ]}
                        >
                          Supprimer
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                >
                  <TouchableOpacity
                    style={[
                      styles.routine,
                      {
                        backgroundColor: r.faitAujourdhui
                          ? t.bgCardActive
                          : t.bgCard,
                      },
                    ]}
                    onPress={() => onToggleRoutine(r.id, r.faitAujourdhui)}
                  >
                    <View
                      style={[
                        styles.pastilleCat,
                        {
                          backgroundColor: r.categorie
                            ? couleurCat(r.categorie)
                            : t.border,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.texteRoutine,
                        {
                          color: r.faitAujourdhui ? t.textMuted : t.textPrimary,
                          textDecorationLine: r.faitAujourdhui
                            ? "line-through"
                            : "none",
                        },
                      ]}
                    >
                      {r.faitAujourdhui ? "✓ " : "○ "}
                      {r.ancre_nom ? (
                        <Text
                          style={{ color: t.accentText, fontWeight: "600" }}
                        >
                          {r.ancre_position === "avant" ? "Avant" : "Après"}{" "}
                          {r.ancre_nom.toLowerCase()} →{" "}
                        </Text>
                      ) : null}
                      {r.nom}
                    </Text>
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </View>
          ))
        )}

        {/* Section tâches ponctuelles, triées par le moteur */}
        <View style={styles.titreTachesLigne}>
          <Text
            style={[
              styles.titreBloc,
              { color: t.textPrimary, marginBottom: 0 },
            ]}
          >
            Tâches
          </Text>
        </View>

        {/* Noter une tâche en une ligne : l'appli devine le domaine et la trie */}
        <View style={styles.ajoutRapide}>
          <TextInput
            style={[
              styles.ajoutChamp,
              {
                backgroundColor: t.bgCard,
                borderColor: t.border,
                color: t.textPrimary,
              },
            ]}
            placeholder="Une tâche à noter"
            placeholderTextColor={t.textMuted}
            value={nouvelleTache}
            onChangeText={setNouvelleTache}
            onSubmitEditing={onNoterTache}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.ajoutBouton, { backgroundColor: t.accent }]}
            onPress={onNoterTache}
          >
            <Text style={[styles.ajoutBoutonTexte, { color: t.textOnAccent }]}>
              Noter
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ajoutPied}>
          {tacheNotee ? (
            <Text
              style={[styles.ajoutConfirmation, { color: t.textSecondary }]}
            >
              ✓ « {tacheNotee} » est notée.
            </Text>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={() => {
              const n = nouvelleTache.trim();
              setNouvelleTache("");
              router.push(
                n
                  ? `/nouvelle-tache?nom=${encodeURIComponent(n)}`
                  : "/nouvelle-tache",
              );
            }}
            hitSlop={8}
          >
            <Text style={[styles.ajoutOptions, { color: t.accentText }]}>
              Plus d'options
            </Text>
          </TouchableOpacity>
        </View>
        {taches.length === 0 ? (
          <Text style={[styles.tachesVide, { color: t.textMuted }]}>
            Aucune tâche en cours.
          </Text>
        ) : (
          taches.map((p) => (
            <Swipeable
              key={p.itemId}
              renderRightActions={() => (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[
                      styles.boutonSupprimerTache,
                      { backgroundColor: t.accentText },
                    ]}
                    onPress={() =>
                      router.push(`/nouvelle-tache?id=${p.itemId}`)
                    }
                  >
                    <Text
                      style={[styles.texteSupprimer, { color: t.textOnAccent }]}
                    >
                      Modifier
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.boutonSupprimerTache,
                      { backgroundColor: t.danger },
                    ]}
                    onPress={() => onSupprimerTache(p.itemId, p.nom)}
                  >
                    <Text
                      style={[styles.texteSupprimer, { color: t.textOnAccent }]}
                    >
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            >
              <TouchableOpacity
                style={[styles.carte, { backgroundColor: t.bgCard }]}
                onPress={() => onCompleterTache(p.itemId, p.nom)}
              >
                <View style={styles.carteEntete}>
                  <View
                    style={[
                      styles.puceRaison,
                      { backgroundColor: t.bgHighlight },
                    ]}
                  >
                    <Text
                      style={[styles.puceRaisonTexte, { color: t.accentText }]}
                    >
                      {p.exploration ? "🔄 " : ""}
                      {p.raison}
                    </Text>
                  </View>
                  {p.duree_min ? (
                    <Text style={[styles.carteDuree, { color: t.textMuted }]}>
                      {p.duree_min} min
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.carteNom, { color: t.textPrimary }]}>
                  ○ {p.nom}
                </Text>
                {p.premiere_action ? (
                  <Text
                    style={[
                      styles.cartePremiereAction,
                      { color: t.textSecondary },
                    ]}
                  >
                    Commencer par : {p.premiere_action}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </Swipeable>
          ))
        )}
      </ScrollView>

      {annulable && (
        <View
          style={[styles.bandeauAnnuler, { backgroundColor: t.textPrimary }]}
        >
          <Text
            style={[styles.bandeauTexte, { color: t.bgApp }]}
            numberOfLines={1}
          >
            ✓ {annulable.nom}
          </Text>
          <TouchableOpacity onPress={onAnnulerTache} hitSlop={10}>
            <Text style={[styles.bandeauAction, { color: t.bgApp }]}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  bandeauStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statTexte: { fontSize: typography.bodySmall, fontWeight: "600" },

  equilibre: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: spacing.md,
  },
  equilibreItem: { alignItems: "center", gap: 4 },
  equilibrePastille: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  equilibreIcone: { fontSize: 18 },
  equilibreLabel: { fontSize: typography.tiny, fontWeight: "600" },

  section: { marginBottom: spacing.lg },
  sectionTitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  routine: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pastilleCat: { width: 10, height: 10, borderRadius: 5 },
  texteRoutine: { fontSize: typography.body, flex: 1 },

  titreBlocLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  titreBloc: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  compteur: { fontSize: typography.bodySmall, fontWeight: "600" },
  titreRoutinesLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  titreDroite: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titreTachesLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  boutonAjout: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  boutonAjoutTexte: { fontSize: 22, lineHeight: 24, fontWeight: "500" },
  ajoutRapide: { flexDirection: "row", gap: spacing.sm },
  ajoutChamp: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  ajoutBouton: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  ajoutBoutonTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  ajoutPied: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: spacing.md,
    minHeight: 18,
  },
  ajoutConfirmation: {
    flex: 1,
    fontSize: typography.small,
    marginRight: spacing.md,
  },
  ajoutOptions: { fontSize: typography.small, fontWeight: "600" },
  tachesVide: { fontSize: typography.small, fontStyle: "italic" },

  carte: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  carteEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  puceRaison: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  puceRaisonTexte: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  carteDuree: { fontSize: typography.small },
  carteNom: { fontSize: typography.h3, fontWeight: "600" },
  cartePremiereAction: {
    fontSize: typography.small,
    marginTop: 6,
    lineHeight: 19,
  },

  vide: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  videTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  videTexte: { fontSize: typography.small, lineHeight: 19 },

  actions: { flexDirection: "row" },
  boutonSupprimer: {
    justifyContent: "center",
    alignItems: "center",
    width: 86,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  texteSupprimer: { fontWeight: "600", fontSize: typography.small },
  boutonSupprimerTache: {
    justifyContent: "center",
    alignItems: "center",
    width: 86,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    marginLeft: 4,
  },
  bandeauAnnuler: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bandeauTexte: { flex: 1, fontSize: typography.bodySmall },
  bandeauAction: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
