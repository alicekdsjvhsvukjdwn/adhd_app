import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
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
import {
  basculerEtapeRoutine,
  getEtapesRoutines,
  type EtapeRoutine,
} from "../../lib/db/etapes";
import { palierEtapes } from "../../lib/regles-taches";
import { useJourCourant } from "../../hooks/useJourCourant";
import { useRoutines } from "../../hooks/useRoutines";
import {
  LIBELLES_TRANCHE,
  miseDeCote as estExigeanteDuJour,
  ORDRE_TRANCHES,
  trancheDeRoutine,
} from "../../lib/moments";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
import {
  ICONES_CATEGORIE,
  LIBELLES_CATEGORIE,
  ORDRE_CATEGORIES,
  useCouleurCategorie,
} from "../../lib/theme-categories";

type Niveau = 1 | 2 | 3;

const NIVEAUX: { niveau: Niveau; libelle: string }[] = [
  { niveau: 1, libelle: "🪫 Jour difficile" },
  { niveau: 2, libelle: "🔋 Normal" },
  { niveau: 3, libelle: "⚡ En forme" },
];

const EXPLICATION_ENERGIE: Record<Niveau, string> = {
  1: "Les étapes essentielles suffisent, les routines exigeantes attendent, une seule tâche.",
  2: "Journée normale.",
  3: "C'est noté.",
};

export default function Routines() {
  const { routines, stats, supprimer, recharger } = useRoutines();
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  // Passage de minuit appli ouverte : tout se recharge pour le nouveau jour.
  const jour = useJourCourant();

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
  const [etapesRoutines, setEtapesRoutines] = useState<Record<number, EtapeRoutine[]>>({});

  // Étapes du jour des routines affichées (essentielles et bonus).
  useEffect(() => {
    let actif = true;
    getEtapesRoutines(routines.map((r) => r.id)).then((e) => {
      if (actif) setEtapesRoutines(e);
    });
    return () => {
      actif = false;
    };
  }, [routines]);

  const chargerAnnexes = useCallback(async () => {
    setEnergie(await energieDuJour());
    setSolde(await soldePoints());
    setResume(await routinesParCategorie());
  }, []);

  useFocusEffect(
    useCallback(() => {
      recharger();
      chargerAnnexes();
    }, [recharger, chargerAnnexes, jour]),
  );

  const onChoisirEnergie = async (n: Niveau) => {
    // L'écran suit le choix tout de suite : groupe « Si l'énergie revient »,
    // étapes affichées et suggestion se calculent
    // à partir de cet état. L'enregistrement vient après ; s'il échoue,
    // on revient au choix d'avant et on le dit.
    const avant = energie;
    setEnergie({ niveau: n, source: "choix" });
    try {
      await choisirEnergie(n);
    } catch (e) {
      setEnergie(avant);
      Alert.alert("Ton choix n'a pas été enregistré", String(e));
      return;
    }
    // Seuls les points dépendent de l'écriture (routines à étapes recalculées).
    setSolde(await soldePoints());
    await recharger();
  };

  const onEtapeRoutine = async (e: EtapeRoutine) => {
    Haptics.selectionAsync().catch(() => {});
    await basculerEtapeRoutine(e.id);
    await recharger();
    await chargerAnnexes();
  };

  const onToggle = async (r: RoutineAvecStatut) => {
    // Routine à étapes : ce sont les étapes qui se cochent.
    if (etapesRoutines[r.id]?.length) return;
    Haptics.selectionAsync().catch(() => {});
    if (r.faitAujourdhui) {
      await annulerCompletion(r.id);
    } else {
      await completer(r.id, "complet", undefined, "normale");
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
  const estMiseDeCote = (r: RoutineAvecStatut) => estExigeanteDuJour(r, energieBasse);
  const miseDeCote = routines.filter(estMiseDeCote);

  // Rangement par domaine ; dans chaque domaine, du matin au soir.
  const parDomaine = routines
    .filter((r) => !estMiseDeCote(r))
    .reduce<Record<string, RoutineAvecStatut[]>>((acc, r) => {
      (acc[r.categorie ?? "sans"] ??= []).push(r);
      return acc;
    }, {});
  for (const liste of Object.values(parDomaine)) {
    liste.sort(
      (a, b) =>
        ORDRE_TRANCHES.indexOf(trancheDeRoutine(a)) - ORDRE_TRANCHES.indexOf(trancheDeRoutine(b)),
    );
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
              const etapesR = etapesRoutines[r.id] ?? [];
              // Jour difficile : les essentielles seules (et les bonus déjà cochés).
              const etapesVisibles = energieBasse
                ? etapesR.filter((e) => e.essentielle === 1 || e.cochee)
                : etapesR;
              const palier = palierEtapes(
                etapesR.map((e) => ({ essentielle: e.essentielle === 1, cochee: e.cochee })),
              );
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
                    disabled={etapesR.length > 0}
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
                        {r.nom}
                      </Text>
                      <Text style={[styles.versionTag, { color: t.textMuted }]}>
                        {LIBELLES_TRANCHE[trancheDeRoutine(r)]}
                        {r.duree_min ? ` · ${r.duree_min} min` : ""}
                        {etapesR.length > 0
                          ? palier === 2
                            ? " · tout est fait"
                            : palier === 1
                              ? " · essentielles faites"
                              : ` · ${etapesR.filter((e) => e.cochee).length}/${etapesR.length} étapes`
                          : ""}
                      </Text>
                      {etapesVisibles.map((e) => (
                        <TouchableOpacity
                          key={e.id}
                          style={styles.etapeRoutine}
                          onPress={() => onEtapeRoutine(e)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: e.cochee }}
                          hitSlop={4}
                        >
                          <Text
                            style={[
                              styles.etapeRoutineTexte,
                              {
                                color: e.cochee ? t.textMuted : t.textPrimary,
                                textDecorationLine: e.cochee ? "line-through" : "none",
                              },
                            ]}
                          >
                            {e.cochee ? "✓" : "○"} {e.nom}
                            {e.essentielle ? "" : (
                              <Text style={{ color: t.textMuted, fontStyle: "italic" }}> · bonus</Text>
                            )}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
  };

  const sousTitreEnergie =
    energie.niveau !== null
      ? EXPLICATION_ENERGIE[energie.niveau]
      : "Un jour difficile ? Dis-le ici : l'appli en demandera moins.";

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
            // Rien de sélectionné tant que rien n'est choisi.
            const actif = energie.niveau === n.niveau;
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
  etapeRoutine: { paddingVertical: 6 },
  etapeRoutineTexte: { fontSize: typography.bodySmall },

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
