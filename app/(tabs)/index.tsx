import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRoutines } from "../../hooks/useRoutines";
import { annulerCompletion, completer, getPreferences } from "../../lib/db";
import type { RoutineAvecStatut } from "../../lib/db/completions";
import { heureLocale } from "../../lib/db/etat";
import {
  changerJourDifficile,
  estJourDifficile,
} from "../../lib/db/jour-difficile";
import { suggestionDuJour } from "../../lib/db/suggestions";
import {
  organiserRoutines,
  type CleSection,
} from "../../lib/routines-maintenant";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
import { versionDuJour, versionsDe, type Version } from "../../lib/versions";

/**
 * L'écran ne répond qu'à « que dois-je faire maintenant ? ».
 * Le moment en cours est déplié, les autres tiennent sur une ligne.
 * Tout ce qui sert à gérer les routines est dans « Mes routines ».
 */
export default function Routines() {
  const { routines, stats, preferences, recharger } = useRoutines();
  const router = useRouter();
  const t = useTheme();

  const [jourDifficile, setJourDifficile] = useState(false);
  const [suggestion, setSuggestion] = useState(false);
  const [heure, setHeure] = useState(heureLocale());
  // Sections ouvertes ou fermées à la main, par-dessus le choix par défaut.
  const [bascules, setBascules] = useState<
    Partial<Record<CleSection, boolean>>
  >({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const prefs = await getPreferences();
        if (!prefs.onboardingFait) router.replace("/onboarding");
      })();
    }, [router]),
  );

  const chargerAnnexes = useCallback(async () => {
    const jd = await estJourDifficile();
    setJourDifficile(jd);
    // Une suggestion ratée ne doit jamais bloquer l'écran.
    const s = jd ? null : await suggestionDuJour().catch(() => null);
    setSuggestion(s !== null);
    setHeure(heureLocale());
  }, []);

  useFocusEffect(
    useCallback(() => {
      recharger();
      chargerAnnexes();
    }, [recharger, chargerAnnexes]),
  );

  const version = versionDuJour(jourDifficile);

  const onToggle = async (r: RoutineAvecStatut) => {
    Haptics.selectionAsync().catch(() => {});
    if (r.faitAujourdhui) {
      await annulerCompletion(r.id);
    } else {
      await completer(r.id, "complet", undefined, version);
    }
    await recharger();
  };

  const onJourDifficile = async (actif: boolean) => {
    setJourDifficile(actif);
    await changerJourDifficile(actif);
    await chargerAnnexes();
  };

  const sections = organiserRoutines(routines, heure, jourDifficile);
  const nbFaites = routines.filter((r) => r.faitAujourdhui).length;
  const serie =
    preferences?.gamification !== "aucune" ? (stats?.currentStreak ?? 0) : 0;
  const resume = [
    serie >= 1 ? `Série de ${serie} jour${serie > 1 ? "s" : ""}` : null,
    nbFaites >= 1 ? `${nbFaites} faite${nbFaites > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const ligne = (r: RoutineAvecStatut) => {
    const fait = r.faitAujourdhui;
    // Cochée : ce qui a été fait. Sinon : la version du jour.
    const v: Version =
      fait && r.versionDuJour ? (r.versionDuJour as Version) : version;
    const action = versionsDe(r)[v].nom;
    const declencheur = r.ancre_nom
      ? `${r.ancre_position === "avant" ? "Avant" : "Après"} ${r.ancre_nom.toLowerCase()}`
      : null;
    return (
      <TouchableOpacity
        key={r.id}
        style={[styles.ligne, { backgroundColor: t.bgCard }]}
        onPress={() => onToggle(r)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: fait }}
        accessibilityLabel={declencheur ? `${action}, ${declencheur}` : action}
      >
        <View
          style={[
            styles.caseACocher,
            {
              borderColor: fait ? t.success : t.border,
              backgroundColor: fait ? t.success : "transparent",
            },
          ]}
        >
          {fait && (
            <Text style={[styles.coche, { color: t.textOnAccent }]}>✓</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.action,
              { color: fait ? t.textMuted : t.textPrimary },
            ]}
          >
            {action}
          </Text>
          {declencheur && (
            <Text style={[styles.declencheur, { color: t.textMuted }]}>
              {declencheur}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <View style={styles.entete}>
        <Text style={[styles.titre, { color: t.textPrimary }]}>Routines</Text>
        <TouchableOpacity
          style={[styles.boutonAjout, { backgroundColor: t.accent }]}
          onPress={() => router.push("/nouvelle-tache?type=routine")}
          accessibilityLabel="Ajouter une routine"
        >
          <Text style={[styles.boutonAjoutTexte, { color: t.textOnAccent }]}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.jourDifficile, { backgroundColor: t.bgCard }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.jourDifficileTitre, { color: t.textPrimary }]}>
            Jour difficile
          </Text>
          {jourDifficile && (
            <Text style={[styles.jourDifficileAide, { color: t.textMuted }]}>
              Tout en version courte aujourd&apos;hui.
            </Text>
          )}
        </View>
        <Switch
          value={jourDifficile}
          onValueChange={onJourDifficile}
          trackColor={{ true: t.accent }}
          accessibilityLabel="Jour difficile"
        />
      </View>

      {resume.length > 0 && (
        <Text style={[styles.resume, { color: t.textSecondary }]}>
          {resume.join(" · ")}
        </Text>
      )}

      {routines.length === 0 ? (
        <TouchableOpacity
          style={[styles.vide, { backgroundColor: t.bgCard }]}
          onPress={() => router.push("/mise-en-place")}
        >
          <Text style={[styles.videTitre, { color: t.textPrimary }]}>
            Aucune routine pour l&apos;instant
          </Text>
          <Text style={[styles.videTexte, { color: t.textSecondary }]}>
            Touche ici pour choisir parmi des idées, ou + pour écrire la tienne.
          </Text>
        </TouchableOpacity>
      ) : (
        sections.map((s) => {
          const ouverte = bascules[s.cle] ?? s.depliee;
          const n = s.routines.length;
          return (
            <View key={s.cle} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionEntete}
                onPress={() => setBascules({ ...bascules, [s.cle]: !ouverte })}
                accessibilityRole="button"
                accessibilityState={{ expanded: ouverte }}
              >
                <Text style={[styles.sectionTitre, { color: t.accentText }]}>
                  {s.libelle}
                  {!ouverte && (
                    <Text style={{ color: t.textMuted, fontWeight: "400" }}>
                      {" "}
                      · {n} routine{n > 1 ? "s" : ""}
                    </Text>
                  )}
                </Text>
                <Text style={[styles.chevron, { color: t.textMuted }]}>
                  {ouverte ? "−" : "+"}
                </Text>
              </TouchableOpacity>
              {ouverte && s.routines.map(ligne)}
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={styles.lienGerer}
        onPress={() => router.push("/mes-routines")}
        hitSlop={8}
      >
        <Text style={[styles.lienGererTexte, { color: t.accentText }]}>
          Gérer mes routines
          {suggestion && (
            <Text style={{ color: t.textSecondary, fontWeight: "400" }}>
              {" "}
              · 1 suggestion
            </Text>
          )}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  boutonAjout: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  boutonAjoutTexte: { fontSize: 24, lineHeight: 26, fontWeight: "500" },

  jourDifficile: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  jourDifficileTitre: { fontSize: typography.body, fontWeight: "600" },
  jourDifficileAide: { fontSize: typography.small, marginTop: 2 },
  resume: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },

  section: { marginBottom: spacing.md },
  sectionEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  sectionTitre: { fontSize: typography.body, fontWeight: "700" },
  chevron: { fontSize: typography.h3, paddingHorizontal: spacing.sm },

  ligne: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    minHeight: 56,
  },
  caseACocher: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  coche: { fontSize: 16, fontWeight: "700" },
  action: { fontSize: typography.h3, fontWeight: "500" },
  declencheur: { fontSize: typography.small, marginTop: 2 },

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

  lienGerer: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  lienGererTexte: { fontSize: typography.body, fontWeight: "600" },
});
