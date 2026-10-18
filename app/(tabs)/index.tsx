import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { AnneauDomaines } from "../../components/AnneauDomaines";
import { CarteSuggestion } from "../../components/CarteSuggestion";
import { PastilleDomaine } from "../../components/PastilleDomaine";
import { Texte } from "../../components/Texte";
import { useJourCourant } from "../../hooks/useJourCourant";
import { useRoutines } from "../../hooks/useRoutines";
import {
  DOMAINES,
  domaineParDefaut,
  remplissage,
  selectionDe,
  type Domaine,
  type RoutineAnneau,
  type Selection,
} from "../../lib/anneau";
import { annulerCompletion, completer, confirmationSuppression } from "../../lib/db";
import { routinesParCategorie, type RoutineResumee } from "../../lib/db/categories";
import type { RoutineAvecStatut } from "../../lib/db/completions";
import { choisirEnergie, energieDuJour } from "../../lib/db/energie";
import { basculerEtapeRoutine, getEtapesRoutines, type EtapeRoutine } from "../../lib/db/etapes";
import { suggestionDuJour, type Suggestion } from "../../lib/db/suggestions";
import {
  LIBELLES_TRANCHE,
  miseDeCote as estExigeanteDuJour,
  momentStocke,
  trancheDeRoutine,
} from "../../lib/moments";
import { palierEtapes } from "../../lib/regles-taches";
import { heureDecimale, radius, spacing, typography, useTheme } from "../../lib/theme";
import { COULEURS_CATEGORIE, LIBELLES_CATEGORIE } from "../../lib/theme-categories";

type Niveau = 1 | 2 | 3;

const NIVEAUX: { niveau: Niveau; libelle: string }[] = [
  { niveau: 1, libelle: "Difficile" },
  { niveau: 2, libelle: "Normal" },
  { niveau: 3, libelle: "En forme" },
];

const CINQ_MINUTES = 5 * 60_000;

/**
 * Routines : tout tient sur un écran. L'anneau des domaines, la rangée des
 * domaines, puis les routines du domaine choisi (seule zone qui défile).
 */
export default function Routines() {
  const { routines, supprimer, recharger } = useRoutines();
  const router = useRouter();
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  // Passage de minuit appli ouverte : tout se recharge pour le nouveau jour.
  const jour = useJourCourant();

  const [energie, setEnergie] = useState<Niveau | null>(null);
  const [nonPrevues, setNonPrevues] = useState<{
    parCategorie: Record<Domaine, RoutineResumee[]>;
    sansDomaine: RoutineResumee[];
  } | null>(null);
  const [voirNonPrevues, setVoirNonPrevues] = useState(false);
  const [etapesRoutines, setEtapesRoutines] = useState<Record<number, EtapeRoutine[]>>({});
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [voirSuggestion, setVoirSuggestion] = useState(false);
  /** Domaine touché, valable pour son jour ; sinon, celui de la prochaine routine à faire. */
  const [choix, setChoixJour] = useState<{ jour: string; selection: Selection } | null>(null);
  const setChoix = (selection: Selection) => setChoixJour({ jour, selection });
  const [heure, setHeure] = useState(heureDecimale);

  // La bille avance : toutes les 5 minutes et au retour au premier plan.
  useEffect(() => {
    const maj = () => setHeure(heureDecimale());
    const minuteur = setInterval(maj, CINQ_MINUTES);
    const abonnement = AppState.addEventListener("change", (e) => {
      if (e === "active") maj();
    });
    return () => {
      clearInterval(minuteur);
      abonnement.remove();
    };
  }, []);

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
    setEnergie((await energieDuJour()).niveau);
    setNonPrevues(await routinesParCategorie());
    // Une suggestion ratée ne doit jamais bloquer l'écran.
    setSuggestion(await suggestionDuJour().catch(() => null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setHeure(heureDecimale());
      recharger();
      chargerAnnexes();
    }, [recharger, chargerAnnexes, jour]),
  );

  const onChoisirEnergie = async (n: Niveau) => {
    // L'écran suit le choix tout de suite ; s'il n'est pas enregistré, on revient en arrière.
    const avant = energie;
    setEnergie(n);
    try {
      await choisirEnergie(n);
    } catch (e) {
      setEnergie(avant);
      Alert.alert("Ton choix n'a pas été enregistré", String(e));
      return;
    }
    await recharger();
  };

  const onEtapeRoutine = async (e: EtapeRoutine) => {
    Haptics.selectionAsync().catch(() => {});
    await basculerEtapeRoutine(e.id);
    await recharger();
  };

  const onToggle = async (r: RoutineAvecStatut) => {
    // Routine à étapes : ce sont les étapes qui se cochent.
    if (etapesRoutines[r.id]?.length) return;
    Haptics.selectionAsync().catch(() => {});
    if (r.faitAujourdhui) await annulerCompletion(r.id);
    else await completer(r.id, "complet", undefined, "normale");
    await recharger();
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
        style={[styles.action, { backgroundColor: t.accentFonce }]}
        onPress={() => router.push(`/nouvelle-tache?id=${r.id}`)}
      >
        <Texte style={[styles.actionTexte, { color: t.textOnAccentFonce }]}>Modifier</Texte>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.danger }]}
        onPress={() => onSupprimer(r)}
      >
        <Texte style={[styles.actionTexte, { color: t.bgApp }]}>Supprimer</Texte>
      </TouchableOpacity>
    </View>
  );

  // ── Calculs de l'anneau ──────────────────────────────────────────────
  const jourDifficile = energie === 1;
  const pourAnneau: RoutineAnneau[] = routines.map((r) => {
    const etapes = etapesRoutines[r.id] ?? [];
    return {
      categorie: r.categorie,
      faitAujourdhui: r.faitAujourdhui,
      palier: etapes.length
        ? palierEtapes(etapes.map((e) => ({ essentielle: e.essentielle === 1, cochee: e.cochee })))
        : null,
      moment: momentStocke(r.ancre_moment || r.moment),
    };
  });
  const remplissages = Object.fromEntries(
    DOMAINES.map((d) => [d, remplissage(pourAnneau, d, jourDifficile)]),
  ) as Record<Domaine, number | null>;
  // Nouveau jour : on revient au domaine de la prochaine routine.
  const selection: Selection =
    choix?.jour === jour ? choix.selection : domaineParDefaut(pourAnneau, t.moment);
  const aDesAutres =
    routines.some((r) => selectionDe(r.categorie) === "autres") ||
    (nonPrevues?.sansDomaine.length ?? 0) > 0;

  // ── Routines du domaine choisi ───────────────────────────────────────
  const duDomaine = routines.filter((r) => selectionDe(r.categorie) === selection);
  const exigeantes = duDomaine.filter((r) => estExigeanteDuJour(r, jourDifficile));
  const principales = duDomaine.filter((r) => !estExigeanteDuJour(r, jourDifficile));
  const idsDuJour = new Set(routines.map((r) => r.id));
  const pasPrevues = (
    selection === "autres"
      ? (nonPrevues?.sansDomaine ?? [])
      : (nonPrevues?.parCategorie[selection] ?? [])
  ).filter((r) => !idsDuJour.has(r.id));

  // L'anneau prend la place qu'il peut, sans faire défiler la page.
  const tailleAnneau = Math.min(260, width - spacing.xl * 2, Math.max(170, height * 0.32));

  const carteRoutine = (r: RoutineAvecStatut) => {
    const etapesR = etapesRoutines[r.id] ?? [];
    // Jour difficile : les essentielles seules (et les bonus déjà cochés).
    const etapesVisibles = jourDifficile
      ? etapesR.filter((e) => e.essentielle === 1 || e.cochee)
      : etapesR;
    const couleur = selection === "autres" ? t.accent : COULEURS_CATEGORIE[selection];
    return (
      <Swipeable key={r.id} renderRightActions={() => actionsRoutine(r)}>
        <TouchableOpacity
          style={[
            styles.carte,
            {
              backgroundColor: r.faitAujourdhui ? t.bgCardActive : t.bgCard,
              borderColor: t.border,
            },
          ]}
          onPress={() => onToggle(r)}
          disabled={etapesR.length > 0}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: r.faitAujourdhui }}
        >
          <View
            style={[
              styles.case,
              {
                borderColor: couleur,
                backgroundColor: r.faitAujourdhui ? couleur : "transparent",
              },
            ]}
          >
            {r.faitAujourdhui && (
              <Texte style={[styles.coche, { color: t.bgApp }]}>✓</Texte>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Texte
              style={[
                styles.nom,
                {
                  color: r.faitAujourdhui ? t.textSecondary : t.textPrimary,
                  textDecorationLine: r.faitAujourdhui ? "line-through" : "none",
                },
              ]}
            >
              {r.ancre_nom
                ? `${r.ancre_position === "avant" ? "Avant" : "Après"} ${r.ancre_nom.toLowerCase()} → `
                : ""}
              {r.nom}
            </Texte>
            <Texte style={[styles.moment, { color: t.textMuted }]}>
              {LIBELLES_TRANCHE[trancheDeRoutine(r)]}
              {r.duree_min ? ` · ${r.duree_min} min` : ""}
            </Texte>
            {etapesVisibles.length > 0 && (
              <View style={styles.etapes}>
                {etapesVisibles.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => onEtapeRoutine(e)}
                    style={[
                      styles.etape,
                      {
                        borderColor: e.cochee ? couleur : t.border,
                        backgroundColor: e.cochee ? couleur : "transparent",
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: e.cochee }}
                    hitSlop={4}
                  >
                    <Texte
                      style={[
                        styles.etapeTexte,
                        {
                          color: e.cochee ? t.bgApp : t.textPrimary,
                          textDecorationLine: e.cochee ? "line-through" : "none",
                        },
                      ]}
                    >
                      {e.nom}
                      {e.essentielle ? "" : " · bonus"}
                    </Texte>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={[styles.ecran, { backgroundColor: t.bgApp }]}>
      {/* Titre et énergie du jour */}
      <View style={styles.entete}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Routines</Texte>
        <View style={[styles.energie, { borderColor: t.border, backgroundColor: t.bgCard }]}>
          {NIVEAUX.map((n) => {
            // Rien de sélectionné tant que rien n'est choisi.
            const actif = energie === n.niveau;
            return (
              <TouchableOpacity
                key={n.niveau}
                onPress={() => onChoisirEnergie(n.niveau)}
                style={[styles.energieBouton, actif && { backgroundColor: t.accentFonce }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif }}
              >
                <Texte
                  style={[
                    styles.energieTexte,
                    { color: actif ? t.textOnAccentFonce : t.textSecondary },
                  ]}
                >
                  {n.libelle}
                </Texte>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* L'anneau */}
      <View style={styles.anneau}>
        <AnneauDomaines
          taille={tailleAnneau}
          remplissages={remplissages}
          selection={selection}
          heure={heure}
          onSelection={setChoix}
        />
      </View>

      {/* Suggestion : une pastille, seulement s'il y en a une (pas un jour difficile) */}
      {suggestion && !jourDifficile && (
        <TouchableOpacity
          onPress={() => setVoirSuggestion(true)}
          style={[styles.pastilleSuggestion, { borderColor: t.accent }]}
          hitSlop={6}
        >
          <Texte style={[styles.pastilleSuggestionTexte, { color: t.accent }]}>
            💬 Une suggestion
          </Texte>
        </TouchableOpacity>
      )}

      {/* Les domaines */}
      <View style={styles.domaines}>
        {[...DOMAINES, ...(aDesAutres ? (["autres"] as const) : [])].map((d) => {
          const actif = d === selection;
          const couleur = d === "autres" ? t.textSecondary : COULEURS_CATEGORIE[d];
          const part =
            d === "autres" ? remplissage(pourAnneau, "autres", jourDifficile) : remplissages[d];
          return (
            <TouchableOpacity
              key={d}
              onPress={() => setChoix(d)}
              style={[
                styles.domaine,
                actif && { backgroundColor: t.bgCard, borderColor: t.border },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
            >
              <PastilleDomaine couleur={couleur} part={part} fond={t.bgApp} />
              <Texte
                style={[
                  styles.domaineNom,
                  { color: actif ? t.textPrimary : t.textMuted },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {d === "autres" ? "Autres" : LIBELLES_CATEGORIE[d]}
              </Texte>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Les routines du domaine : seule zone qui défile */}
      <ScrollView style={styles.liste} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {duDomaine.length === 0 ? (
          <View style={[styles.vide, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={[styles.videTexte, { color: t.textSecondary }]}>
              Rien de prévu ici aujourd&apos;hui.
            </Texte>
            <TouchableOpacity onPress={() => router.push("/mise-en-place")} hitSlop={8}>
              <Texte style={[styles.lien, { color: t.accent }]}>Idées de routines</Texte>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {principales.map(carteRoutine)}
            {exigeantes.length > 0 && (
              <View style={{ opacity: 0.5 }}>
                <Texte style={[styles.aide, { color: t.textMuted }]}>
                  Exigeantes : pas de pression aujourd&apos;hui.
                </Texte>
                {exigeantes.map(carteRoutine)}
              </View>
            )}
          </>
        )}

        {pasPrevues.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => setVoirNonPrevues(!voirNonPrevues)}
              accessibilityRole="button"
              accessibilityState={{ expanded: voirNonPrevues }}
              hitSlop={8}
            >
              <Texte style={[styles.lien, { color: t.textSecondary }]}>
                {voirNonPrevues ? "−" : "+"} Pas prévues aujourd&apos;hui
              </Texte>
            </TouchableOpacity>
            {voirNonPrevues &&
              pasPrevues.map((r) => (
                <Swipeable key={r.id} renderRightActions={() => actionsRoutine(r)}>
                  <TouchableOpacity
                    style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}
                    onPress={() => router.push(`/nouvelle-tache?id=${r.id}`)}
                    accessibilityHint="Ouvre la modification"
                  >
                    <Texte style={[styles.nom, { color: t.textSecondary, flex: 1 }]}>{r.nom}</Texte>
                    <Texte style={{ color: t.textMuted }}>›</Texte>
                  </TouchableOpacity>
                </Swipeable>
              ))}
          </>
        )}

        <TouchableOpacity
          onPress={() =>
            router.push(
              selection === "autres"
                ? "/nouvelle-tache?type=routine"
                : `/nouvelle-tache?type=routine&domaine=${selection}`,
            )
          }
          hitSlop={8}
        >
          <Texte style={[styles.lien, { color: t.accent }]}>+ Ajouter une routine ici</Texte>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={voirSuggestion && suggestion !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVoirSuggestion(false)}
      >
        <Pressable style={styles.fond} onPress={() => setVoirSuggestion(false)}>
          <Pressable>
            {suggestion && (
              <CarteSuggestion
                suggestion={suggestion}
                onDecision={async () => {
                  setVoirSuggestion(false);
                  setSuggestion(null);
                  await recharger();
                  await chargerAnnexes();
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingTop: 56, paddingHorizontal: spacing.xl },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  energie: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.pill,
    padding: 2,
  },
  energieBouton: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  energieTexte: { fontSize: typography.tiny, fontWeight: "600" },

  anneau: { alignItems: "center", marginTop: spacing.md },
  pastilleSuggestion: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  pastilleSuggestionTexte: { fontSize: typography.tiny, fontWeight: "600" },

  domaines: { flexDirection: "row", gap: 4, marginTop: spacing.md },
  domaine: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  domaineNom: { fontSize: 10, fontWeight: "600" },

  liste: { flex: 1, marginTop: spacing.md },
  carte: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  case: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  coche: { fontSize: typography.small, fontWeight: "700" },
  nom: { fontSize: typography.body, fontWeight: "500" },
  moment: { fontSize: typography.tiny, marginTop: 2 },
  etapes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  etape: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  etapeTexte: { fontSize: typography.small, fontWeight: "500" },
  aide: { fontSize: typography.tiny, marginVertical: spacing.sm },
  vide: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  videTexte: { fontSize: typography.bodySmall },
  lien: { fontSize: typography.bodySmall, fontWeight: "600", marginTop: spacing.md },

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

  fond: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
});
