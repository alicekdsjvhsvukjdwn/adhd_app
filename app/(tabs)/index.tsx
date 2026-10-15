import * as Haptics from "expo-haptics";
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
import { CalendrierMois } from "../../components/CalendrierMois";
import { CarteSuggestion } from "../../components/CarteSuggestion";
import type { Categorie } from "../../lib/catalogue";
import {
  annulerCompletion,
  completer,
  confirmationSuppression,
} from "../../lib/db";
import {
  routinesParCategorie,
  type RoutineResumee,
} from "../../lib/db/categories";
import type { RoutineAvecStatut } from "../../lib/db/completions";
import { choisirEnergie, energieDuJour } from "../../lib/db/energie";
import { soldePoints } from "../../lib/db/recompenses";
import { useRoutines } from "../../hooks/useRoutines";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
import {
  ICONES_CATEGORIE,
  LIBELLES_CATEGORIE,
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
const LIBELLES_BLOCS: Record<string, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  soir: "Soir",
  sans_ancre: "À tout moment",
};

const NIVEAUX: { niveau: Niveau; libelle: string }[] = [
  { niveau: 1, libelle: "🪫 Jour difficile" },
  { niveau: 2, libelle: "🔋 Normal" },
  { niveau: 3, libelle: "⚡ En forme" },
];

const EXPLICATION_VERSION: Record<Version, string> = {
  courte: "Tes routines s'affichent en version courte.",
  normale: "Tes routines s'affichent en version normale.",
  longue: "Tes routines s'affichent en version longue.",
};

const ORDRE_BLOC: Record<string, number> = {
  matin: 0,
  apres_midi: 1,
  soir: 2,
  sans_ancre: 3,
};

function blocDeRoutine(r: RoutineAvecStatut): string {
  const m = r.ancre_moment || r.moment;
  return (m && BLOC_PAR_MOMENT[m]) || "sans_ancre";
}

export default function Routines() {
  const { routines, stats, supprimer, recharger } = useRoutines();
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();

  const [energie, setEnergie] = useState<{
    niveau: Niveau | null;
    source: "choix" | null;
  }>({ niveau: null, source: null });
  const [solde, setSolde] = useState<number | null>(null);
  const [resume, setResume] = useState<{
    parCategorie: Record<Categorie, RoutineResumee[]>;
    sansDomaine: RoutineResumee[];
  } | null>(null);
  const [voirNonPrevues, setVoirNonPrevues] = useState(false);

  const chargerAnnexes = useCallback(async () => {
    setEnergie(await energieDuJour());
    setSolde(await soldePoints());
    setResume(await routinesParCategorie());
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
    Haptics.selectionAsync().catch(() => {});
    if (r.faitAujourdhui) {
      await annulerCompletion(r.id);
    } else {
      await completer(r.id, "complet", undefined, version);
    }
    await recharger();
    await chargerAnnexes();
  };

  const onSupprimer = (r: { id: number; nom: string }) => {
    const { titre, message } = confirmationSuppression("routine", r.nom);
    Alert.alert(titre, message, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimer(r.id);
          await chargerAnnexes();
        },
      },
    ]);
  };

  const actionsRoutine = (r: { id: number; nom: string }) => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.accentText }]}
        onPress={() => router.push(`/nouvelle-tache?id=${r.id}`)}
      >
        <Text style={[styles.actionTexte, { color: t.textOnAccent }]}>
          Modifier
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.danger }]}
        onPress={() => onSupprimer(r)}
      >
        <Text style={[styles.actionTexte, { color: t.textOnAccent }]}>
          Supprimer
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Énergie basse : les routines exigeantes non faites passent dans un groupe à part.
  const energieBasse = energie.niveau === 1;
  const estMiseDeCote = (r: RoutineAvecStatut) =>
    energieBasse && (r.effort ?? 0) >= 3 && !r.faitAujourdhui;
  const miseDeCote = routines.filter(estMiseDeCote);

  // Rangement par domaine ; dans chaque domaine, du matin au soir.
  const parDomaine = routines
    .filter((r) => !estMiseDeCote(r))
    .reduce<Record<string, RoutineAvecStatut[]>>((acc, r) => {
      (acc[r.categorie ?? "sans"] ??= []).push(r);
      return acc;
    }, {});
  for (const liste of Object.values(parDomaine)) {
    liste.sort((a, b) => ORDRE_BLOC[blocDeRoutine(a)] - ORDRE_BLOC[blocDeRoutine(b)]);
  }
  const domaines = [...ORDRE_CATEGORIES, "sans"].filter((d) => parDomaine[d]?.length > 0);
  const domainesVides = ORDRE_CATEGORIES.filter((c) => !resume || resume.parCategorie[c].length === 0);
  const toutesParDomaine = (d: string) =>
    routines.filter((r) => (r.categorie ?? "sans") === d);
  const nbFaites = routines.filter((r) => r.faitAujourdhui).length;
  // Routines actives mais pas prévues aujourd'hui (certains jours, hebdo) :
  // l'accueil reste le seul endroit pour les modifier ou les supprimer.
  const idsDuJour = new Set(routines.map((r) => r.id));
  const nonPrevues = resume
    ? [...Object.values(resume.parCategorie).flat(), ...resume.sansDomaine].filter(
        (r) => !idsDuJour.has(r.id),
      )
    : [];

  const ligneRoutine = (r: RoutineAvecStatut) => {
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
                  renderRightActions={() => actionsRoutine(r)}
                >
                  <TouchableOpacity
                    style={[
                      styles.routine,
                      { backgroundColor: r.faitAujourdhui ? t.bgCardActive : t.bgCard },
                    ]}
                    onPress={() => onToggle(r)}
                  >
                    <View
                      style={[
                        styles.pastilleCat,
                        { backgroundColor: r.categorie ? couleurCat(r.categorie) : t.border },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.texteRoutine,
                          {
                            color: r.faitAujourdhui ? t.textMuted : t.textPrimary,
                            textDecorationLine: r.faitAujourdhui ? "line-through" : "none",
                          },
                        ]}
                      >
                        {r.faitAujourdhui ? "✓ " : "○ "}
                        {r.ancre_nom ? (
                          <Text style={{ color: t.accentText, fontWeight: "600" }}>
                            {r.ancre_position === "avant" ? "Avant" : "Après"}{" "}
                            {r.ancre_nom.toLowerCase()} →{" "}
                          </Text>
                        ) : null}
                        {affichee.nom}
                      </Text>
                      <Text style={[styles.versionTag, { color: t.textMuted }]}>
                        {LIBELLES_BLOCS[blocDeRoutine(r)]}
                        {v !== "normale" && versions.distincte[v]
                          ? ` · version ${v}${affichee.duree ? ` · ${affichee.duree} min` : ""}`
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
  };

  const sousTitreEnergie =
    energie.source === "choix"
      ? EXPLICATION_VERSION[version]
      : "Choisis-la pour adapter tes routines : version courte, normale ou longue.";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Text style={[styles.titre, { color: t.textPrimary }]}>Routines</Text>

      {stats && (
        <View style={[styles.bandeauStats, { backgroundColor: t.bgHighlight }]}>
          <Text style={[styles.statTexte, { color: t.accentText }]}>
            🔥 {stats.currentStreak} j
          </Text>
          <Text style={[styles.statTexte, { color: t.accentText }]}>
            Niveau {stats.niveau}
          </Text>
          <TouchableOpacity onPress={() => router.push("/recompenses")}>
            <Text style={[styles.statTexte, { color: t.accentText }]}>
              🎁 {solde ?? 0} pts
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pas de suggestion un jour difficile */}
      {!energieBasse && (
        <CarteSuggestion
          onDecision={async () => {
            await recharger();
            await chargerAnnexes();
          }}
        />
      )}

      {/* Énergie du jour : choisit la version des routines */}
      <View style={[styles.energie, { backgroundColor: t.bgCard }]}>
        <Text style={[styles.energieTitre, { color: t.textPrimary }]}>
          Comment est ta journée ?
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

      <View style={styles.titreLigne}>
        <Text style={[styles.titreBloc, { color: t.textPrimary }]}>Mes routines</Text>
        <View style={styles.titreDroite}>
          {routines.length > 0 && (
            <Text style={[styles.compteur, { color: t.textMuted }]}>
              {nbFaites}/{routines.length}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.boutonAjout, { backgroundColor: t.accent }]}
            onPress={() => router.push("/nouvelle-tache?type=routine")}
            accessibilityLabel="Ajouter une routine"
          >
            <Text style={[styles.boutonAjoutTexte, { color: t.textOnAccent }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {domaines.length === 0 && miseDeCote.length === 0 ? (
        <TouchableOpacity
          style={[styles.vide, { backgroundColor: t.bgCard }]}
          onPress={() => router.push("/mise-en-place")}
        >
          <Text style={[styles.videTitre, { color: t.textPrimary }]}>
            Aucune routine pour l'instant
          </Text>
          <Text style={[styles.videTexte, { color: t.textSecondary }]}>
            Touche ici pour choisir parmi des idées, ou + pour écrire la tienne.
          </Text>
        </TouchableOpacity>
      ) : (
        domaines.map((d) => {
          const estDomaine = d !== "sans";
          const couleur = estDomaine ? couleurCat(d as Categorie) : t.border;
          const toutes = toutesParDomaine(d);
          const faites = toutes.filter((r) => r.faitAujourdhui).length;
          return (
            <View key={d} style={styles.section}>
              <View style={[styles.domaineEntete, { borderLeftColor: couleur }]}>
                <Text style={[styles.domaineTitre, { color: t.textPrimary }]}>
                  {estDomaine
                    ? `${ICONES_CATEGORIE[d as Categorie]} ${LIBELLES_CATEGORIE[d as Categorie]}`
                    : "Sans domaine"}
                </Text>
                <Text
                  style={[
                    styles.domaineCompte,
                    { color: faites === toutes.length ? t.success : t.textMuted },
                  ]}
                >
                  {faites}/{toutes.length}
                </Text>
              </View>
              {parDomaine[d].map(ligneRoutine)}
            </View>
          );
        })
      )}

      {miseDeCote.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitre, { color: t.textMuted }]}>
            Si l'énergie revient
          </Text>
          <Text style={[styles.miseDeCoteAide, { color: t.textMuted }]}>
            Routines exigeantes : pas de pression aujourd'hui.
          </Text>
          <View style={{ opacity: 0.7 }}>{miseDeCote.map(ligneRoutine)}</View>
        </View>
      )}

      {nonPrevues.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setVoirNonPrevues(!voirNonPrevues)}
            accessibilityRole="button"
            accessibilityState={{ expanded: voirNonPrevues }}
            hitSlop={8}
          >
            <Text style={[styles.sectionTitre, { color: t.textMuted }]}>
              {voirNonPrevues ? "−" : "+"} Pas prévues aujourd'hui ·{" "}
              {nonPrevues.length}
            </Text>
          </TouchableOpacity>
          {voirNonPrevues &&
            nonPrevues.map((r) => (
              <Swipeable key={r.id} renderRightActions={() => actionsRoutine(r)}>
                <TouchableOpacity
                  style={[styles.routine, { backgroundColor: t.bgCard }]}
                  onPress={() => router.push(`/nouvelle-tache?id=${r.id}`)}
                  accessibilityHint="Ouvre la modification"
                >
                  <Text style={[styles.texteRoutine, { color: t.textSecondary, flex: 1 }]}>
                    {r.nom}
                  </Text>
                  <Text style={{ color: t.textMuted }}>›</Text>
                </TouchableOpacity>
              </Swipeable>
            ))}
        </View>
      )}

      {/* Ce qui manque */}
      {resume && domainesVides.length > 0 && routines.length > 0 && (
        <TouchableOpacity
          style={[styles.manque, { backgroundColor: t.bgCard }]}
          onPress={() => router.push("/mise-en-place")}
        >
          <Text style={[styles.manqueTitre, { color: t.textSecondary }]}>
            Pas encore de routine
          </Text>
          <Text style={[styles.manqueDomaines, { color: t.textPrimary }]}>
            {domainesVides
              .map((c) => `${ICONES_CATEGORIE[c]} ${LIBELLES_CATEGORIE[c]}`)
              .join(" · ")}
          </Text>
          <Text style={[styles.manqueLien, { color: t.accentText }]}>Trouver une idée</Text>
        </TouchableOpacity>
      )}

      <View style={{ marginTop: spacing.xl }}>
        <CalendrierMois type="routine" titre="Routines" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  bandeauStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statTexte: { fontSize: typography.bodySmall, fontWeight: "600" },

  energie: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  energieTitre: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.sm },
  energieChoix: { flexDirection: "row", gap: spacing.sm },
  energieBouton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  energieBoutonTexte: { fontSize: typography.small, fontWeight: "600" },
  energieAide: { fontSize: typography.tiny, marginTop: spacing.sm, lineHeight: 16 },

  equilibre: { flexDirection: "row", justifyContent: "space-around", marginVertical: spacing.md },
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

  vide: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  miseDeCoteAide: { fontSize: typography.tiny, marginBottom: spacing.sm },
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
    borderLeftWidth: 4,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  manque: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  manqueTitre: { fontSize: typography.tiny, fontWeight: "700", textTransform: "uppercase" },
  manqueDomaines: { fontSize: typography.small, marginTop: 4, lineHeight: 19 },
  manqueLien: { fontSize: typography.small, fontWeight: "600", marginTop: 6 },
  domaineTitre: { fontSize: typography.body, fontWeight: "600" },
  domaineCompte: { fontSize: typography.bodySmall, fontWeight: "700" },
  domaineNoms: { fontSize: typography.small, marginTop: 4, lineHeight: 18 },
  domaineVide: { fontSize: typography.small, marginTop: 4, fontWeight: "600" },
  videTitre: { fontSize: typography.h3, fontWeight: "600", marginBottom: spacing.sm },
  videTexte: { fontSize: typography.small, lineHeight: 19 },
});
