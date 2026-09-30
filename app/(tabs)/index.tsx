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
import { BandeauEtat } from "../../components/BandeauEtat";
import { CalendrierMois } from "../../components/CalendrierMois";
import { CarteSuggestion } from "../../components/CarteSuggestion";
import { useRoutines } from "../../hooks/useRoutines";
import type { Categorie } from "../../lib/catalogue";
import { annulerCompletion, completer, getPreferences } from "../../lib/db";
import { completionsParCategorieJour } from "../../lib/db/categories";
import type { RoutineAvecStatut } from "../../lib/db/completions";
import { choisirEnergie, energieDuJour } from "../../lib/db/energie";
import { soldePoints } from "../../lib/db/recompenses";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
import {
  ICONES_CATEGORIE,
  ORDRE_CATEGORIES,
  useCouleurCategorie,
} from "../../lib/theme-categories";
import {
  versionPourEnergie,
  versionsDe,
  type Niveau,
  type Version,
} from "../../lib/versions";

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

const NIVEAUX: { niveau: Niveau; libelle: string }[] = [
  { niveau: 1, libelle: "🪫 Basse" },
  { niveau: 2, libelle: "🔋 Normale" },
  { niveau: 3, libelle: "⚡ Haute" },
];

const EXPLICATION_VERSION: Record<Version, string> = {
  courte: "Tes routines s'affichent en version courte.",
  normale: "Tes routines s'affichent en version normale.",
  longue: "Tes routines s'affichent en version longue.",
};

function blocDeRoutine(r: RoutineAvecStatut): string {
  const m = r.ancre_moment || r.moment;
  return (m && BLOC_PAR_MOMENT[m]) || "sans_ancre";
}

export default function Routines() {
  const { routines, stats, preferences, supprimer, recharger } = useRoutines();
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();

  const [energie, setEnergie] = useState<{
    niveau: Niveau | null;
    source: "choix" | "checkin" | null;
  }>({ niveau: null, source: null });
  const [equilibreJour, setEquilibreJour] = useState<Record<
    Categorie,
    number
  > | null>(null);
  const [solde, setSolde] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const prefs = await getPreferences();
        if (!prefs.onboardingFait) router.replace("/onboarding");
      })();
    }, [router]),
  );

  const chargerAnnexes = useCallback(async () => {
    setEnergie(await energieDuJour());
    setEquilibreJour(await completionsParCategorieJour());
    setSolde(await soldePoints());
  }, []);

  useFocusEffect(
    useCallback(() => {
      recharger();
      chargerAnnexes();
    }, [recharger, chargerAnnexes]),
  );

  const version = versionPourEnergie(energie.niveau);

  const onChoisirEnergie = async (n: Niveau) => {
    await choisirEnergie(n);
    setEnergie({ niveau: n, source: "choix" });
  };

  const onToggle = async (r: RoutineAvecStatut) => {
    if (r.faitAujourdhui) {
      await annulerCompletion(r.id);
    } else {
      await completer(r.id, "complet", undefined, version);
    }
    await recharger();
    await chargerAnnexes();
  };

  const onSupprimer = (r: RoutineAvecStatut) => {
    Alert.alert(
      "Supprimer cette routine ?",
      `« ${r.nom} » et son historique seront effacés.`,
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await supprimer(r.id);
            await chargerAnnexes();
          },
        },
      ],
    );
  };

  const parBloc = routines.reduce<Record<string, RoutineAvecStatut[]>>(
    (acc, r) => {
      (acc[blocDeRoutine(r)] ??= []).push(r);
      return acc;
    },
    {},
  );
  const blocs = ORDRE_BLOCS.filter((b) => parBloc[b]?.length > 0);
  const nbFaites = routines.filter((r) => r.faitAujourdhui).length;

  const sousTitreEnergie =
    energie.source === "checkin"
      ? `D'après ton dernier check-in. ${EXPLICATION_VERSION[version]}`
      : energie.source === "choix"
        ? EXPLICATION_VERSION[version]
        : "Choisis-la pour adapter tes routines : version courte, normale ou longue.";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Text style={[styles.titre, { color: t.textPrimary }]}>Routines</Text>

      {stats && preferences && preferences.gamification !== "aucune" && (
        <View style={[styles.bandeauStats, { backgroundColor: t.bgHighlight }]}>
          <Text style={[styles.statTexte, { color: t.accentText }]}>
            🔥 {stats.currentStreak} j
          </Text>
          {preferences.gamification === "complete" && (
            <>
              <Text style={[styles.statTexte, { color: t.accentText }]}>
                Niveau {stats.niveau}
              </Text>
              <TouchableOpacity onPress={() => router.push("/recompenses")}>
                <Text style={[styles.statTexte, { color: t.accentText }]}>
                  🎁 {solde ?? 0} pts
                </Text>
              </TouchableOpacity>
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

      {/* Énergie du jour : choisit la version des routines */}
      <View style={[styles.energie, { backgroundColor: t.bgCard }]}>
        <Text style={[styles.energieTitre, { color: t.textPrimary }]}>
          Ton énergie aujourd'hui
        </Text>
        <View style={styles.energieChoix}>
          {NIVEAUX.map((n) => {
            const actif = (energie.niveau ?? 2) === n.niveau;
            return (
              <TouchableOpacity
                key={n.niveau}
                onPress={() => onChoisirEnergie(n.niveau)}
                style={[
                  styles.energieBouton,
                  {
                    backgroundColor: actif ? t.accent : t.bgApp,
                    borderColor: actif ? t.accent : t.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.energieBoutonTexte,
                    { color: actif ? t.textOnAccent : t.textSecondary },
                  ]}
                >
                  {n.libelle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.energieAide, { color: t.textMuted }]}>
          {sousTitreEnergie}
        </Text>
      </View>

      {/* Domaines touchés aujourd'hui */}
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
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.titreLigne}>
        <Text style={[styles.titreBloc, { color: t.textPrimary }]}>
          Aujourd'hui
        </Text>
        <View style={styles.titreDroite}>
          {routines.length > 0 && (
            <Text style={[styles.compteur, { color: t.textMuted }]}>
              {nbFaites}/{routines.length}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.boutonAjout, { backgroundColor: t.accent }]}
            onPress={() => router.push("/mise-en-place")}
            accessibilityLabel="Ajouter des routines"
          >
            <Text style={[styles.boutonAjoutTexte, { color: t.textOnAccent }]}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {blocs.length === 0 ? (
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
        blocs.map((bloc) => (
          <View key={bloc} style={styles.section}>
            <Text style={[styles.sectionTitre, { color: t.accentText }]}>
              {LIBELLES_BLOCS[bloc]}
            </Text>
            {parBloc[bloc].map((r) => {
              const versions = versionsDe(r);
              // Cochée : on montre ce qui a été fait. Sinon : la version du jour.
              const v: Version =
                r.faitAujourdhui && r.versionDuJour
                  ? (r.versionDuJour as Version)
                  : version;
              const affichee = versions[v];
              return (
                <Swipeable
                  key={r.id}
                  renderRightActions={() => (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[
                          styles.action,
                          { backgroundColor: t.accentText },
                        ]}
                        onPress={() =>
                          router.push(`/nouvelle-tache?id=${r.id}`)
                        }
                      >
                        <Text
                          style={[
                            styles.actionTexte,
                            { color: t.textOnAccent },
                          ]}
                        >
                          Modifier
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.action, { backgroundColor: t.danger }]}
                        onPress={() => onSupprimer(r)}
                      >
                        <Text
                          style={[
                            styles.actionTexte,
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
                    onPress={() => onToggle(r)}
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
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.texteRoutine,
                          {
                            color: r.faitAujourdhui
                              ? t.textMuted
                              : t.textPrimary,
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
                        {affichee.nom}
                      </Text>
                      {v !== "normale" && versions.distincte[v] && (
                        <Text
                          style={[styles.versionTag, { color: t.textMuted }]}
                        >
                          version {v}
                          {affichee.duree ? ` · ${affichee.duree} min` : ""}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })}
          </View>
        ))
      )}

      <View style={{ marginTop: spacing.xl }}>
        <CalendrierMois type="routine" titre="Routines" />
      </View>
    </ScrollView>
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

  energie: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  energieTitre: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  energieChoix: { flexDirection: "row", gap: spacing.sm },
  energieBouton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  energieBoutonTexte: { fontSize: typography.small, fontWeight: "600" },
  energieAide: {
    fontSize: typography.tiny,
    marginTop: spacing.sm,
    lineHeight: 16,
  },

  equilibre: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: spacing.md,
  },
  equilibreItem: { alignItems: "center" },
  equilibrePastille: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  equilibreIcone: { fontSize: 17 },

  titreLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  titreBloc: { fontSize: typography.h2, fontWeight: "600" },
  titreDroite: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  compteur: { fontSize: typography.bodySmall, fontWeight: "600" },
  boutonAjout: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  boutonAjoutTexte: { fontSize: 22, lineHeight: 24, fontWeight: "500" },

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
  texteRoutine: { fontSize: typography.body },
  versionTag: { fontSize: typography.tiny, marginTop: 3 },

  actions: { flexDirection: "row" },
  action: {
    justifyContent: "center",
    alignItems: "center",
    width: 86,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  actionTexte: { fontWeight: "600", fontSize: typography.small },

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
});
