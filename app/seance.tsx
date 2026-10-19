import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../components/Texte";
import { PlusMoins } from "../components/PlusMoins";
import {
  commencerSeance,
  enregistrerSerie,
  seanceProposee,
  terminerSeance,
  type ExerciceDuJour,
} from "../lib/db/sport";
import { critere } from "../lib/skills";
import { POINTS_SEANCE } from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const cle = (ex: ExerciceDuJour, n: number) => `${ex.skill.id}-${n}`;

/**
 * Séance : l'étape en cours de chaque skill actif, plus une série
 * d'entretien pour au plus 2 skills maîtrisés. On saisit ce qu'on a
 * vraiment fait avec +/−. Chaque série est enregistrée au relâchement :
 * une séance faite en partie compte (et garde ce qui est fait).
 */
export default function Seance() {
  const router = useRouter();
  const t = useTheme();
  const [exercices, setExercices] = useState<ExerciceDuJour[]>([]);
  const [realise, setRealise] = useState<Record<string, number>>({});
  const realiseRef = useRef(realise);
  realiseRef.current = realise;
  // Créée à la première série touchée : ouvrir l'écran ne crée rien.
  const seanceId = useRef<Promise<number> | null>(null);

  useEffect(() => {
    seanceProposee().then(setExercices);
  }, []);

  // Enregistrements à la file : deux appuis rapprochés ne créent pas deux fois la même série.
  const file = useRef<Promise<void>>(Promise.resolve());

  const sauver = (ex: ExerciceDuJour, n: number) => {
    seanceId.current ??= commencerSeance();
    const id = seanceId.current;
    file.current = file.current
      .then(async () =>
        enregistrerSerie(await id, ex, n, realiseRef.current[cle(ex, n)] ?? 0),
      )
      .catch((e) => Alert.alert("Série non enregistrée", String(e)));
  };

  /**
   * Clôt la séance une seule fois : séries à 0 retirées, et sans aucune
   * série faite, ni séance ni points (terminerSeance).
   */
  const fermer = async () => {
    await file.current;
    const id = seanceId.current;
    seanceId.current = null;
    if (id) await terminerSeance(await id);
  };

  const terminer = async () => {
    await fermer();
    router.back();
  };

  // Écran quitté autrement (« Retour », geste) : la séance est close quand même.
  useEffect(
    () => () => {
      fermer().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const aCommence = Object.values(realise).some((v) => v > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.contenu}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Séance</Texte>
      <Texte style={[styles.aide, { color: t.textMuted }]}>
        Note ce que tu as vraiment fait. Même une partie compte : +{POINTS_SEANCE} pts.
      </Texte>

      {exercices.length === 0 && (
        <Texte style={[styles.aide, { color: t.textSecondary }]}>
          Aucun skill en cours : choisis-en 3 ou 4 dans Mes skills (« Travailler ce skill »).
        </Texte>
      )}

      {exercices.map((ex) => {
        const u = ex.etape.unite === "s" ? "s" : "rép.";
        return (
          <View key={ex.skill.id} style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <Texte style={[styles.famille, { color: t.accentText }]}>
              {ex.skill.nom} ·{" "}
              {ex.entretien ? "entretien" : `étape ${ex.numero}/${ex.skill.etapes.length}`}
            </Texte>
            <Texte style={[styles.exercice, { color: t.textPrimary }]}>{ex.etape.nom}</Texte>
            <Texte style={[styles.objectif, { color: t.textSecondary }]}>
              Objectif : {critere(ex.etape)}
            </Texte>
            {Array.from({ length: ex.etape.series }, (_, i) => i + 1).map((n) => {
              const v = realise[cle(ex, n)] ?? 0;
              return (
                <View key={n} style={styles.serie}>
                  <Texte style={[styles.serieTexte, { color: t.textSecondary }]}>
                    Série {n}
                    {v >= ex.etape.objectif ? " ✓" : ""}
                  </Texte>
                  <PlusMoins
                    valeur={`${v} ${u}`}
                    libelle={`${ex.etape.nom}, série ${n}`}
                    onPas={(s) =>
                      setRealise((r) => ({
                        ...r,
                        [cle(ex, n)]: Math.max(0, (r[cle(ex, n)] ?? 0) + s),
                      }))
                    }
                    onRelache={() => sauver(ex, n)}
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.bouton, { backgroundColor: aCommence ? t.accent : t.border }]}
        onPress={terminer}
      >
        <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>
          {aCommence ? "Terminer la séance" : "Fermer"}
        </Texte>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  aide: { fontSize: typography.small, marginTop: 4, marginBottom: spacing.lg },
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  famille: { fontSize: typography.tiny, fontWeight: "700", textTransform: "uppercase" },
  exercice: { fontSize: typography.h3, fontWeight: "600", marginTop: 2 },
  objectif: { fontSize: typography.small, marginTop: 2, marginBottom: spacing.sm },
  serie: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  serieTexte: { fontSize: typography.body },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
});
