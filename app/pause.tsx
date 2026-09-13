import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  demarrerSession,
  getRoutinesAvecStatutDuJour,
  ratioEstimation,
  tempsFocusDuJour,
  terminerSession,
  type RoutineAvecStatut,
} from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Mode = "choix" | "focus" | "respiration";

const DUREES = [5, 10, 20, 25, 45];

/** Cohérence cardiaque : 5 s d'inspiration, 5 s d'expiration. */
const PHASE_MS = 5000;

export default function Pause() {
  const router = useRouter();
  const t = useTheme();

  const [mode, setMode] = useState<Mode>("choix");
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);
  const [choisie, setChoisie] = useState<RoutineAvecStatut | null>(null);
  const [estimation, setEstimation] = useState(20);
  const [tempsJour, setTempsJour] = useState(0);
  const [ratio, setRatio] = useState<{ ratio: number; n: number } | null>(null);

  // Session en cours
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [ecoule, setEcoule] = useState(0);
  const [bilan, setBilan] = useState<{
    estimation: number;
    reelle: number;
  } | null>(null);

  const charger = useCallback(async () => {
    const [r, tj, re] = await Promise.all([
      getRoutinesAvecStatutDuJour(),
      tempsFocusDuJour(),
      ratioEstimation(),
    ]);
    setRoutines(r.filter((x) => !x.faitAujourdhui));
    setTempsJour(tj);
    setRatio(re);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Le temps se calcule à partir de l'horodatage de départ, pas d'un compteur
  // incrémenté : ça reste juste même si l'appli passe en arrière-plan.
  useEffect(() => {
    if (debut === null) return;
    const id = setInterval(() => {
      setEcoule((Date.now() - debut) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [debut]);

  const totalSec = estimation * 60;
  const restantSec = Math.max(0, totalSec - ecoule);
  const fraction = totalSec === 0 ? 0 : restantSec / totalSec;
  const auBout = debut !== null && restantSec === 0;

  const lancer = async () => {
    const id = await demarrerSession({
      type: "focus",
      itemId: choisie?.id ?? null,
      libelle: choisie?.nom ?? "Session libre",
      estimationMin: estimation,
    });
    setSessionId(id);
    setDebut(Date.now());
    setEcoule(0);
    setBilan(null);
  };

  const arreter = async () => {
    if (sessionId === null || debut === null) return;
    const reelle = (Date.now() - debut) / 60000;
    await terminerSession(sessionId, reelle, restantSec === 0);
    setBilan({ estimation, reelle });
    setSessionId(null);
    setDebut(null);
    setEcoule(0);
    await charger();
  };

  const formatTemps = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => (mode === "choix" ? router.back() : setMode("choix"))}
          style={styles.retour}
        >
          <Text style={[styles.retourTexte, { color: t.accent }]}>
            ← {mode === "choix" ? "Retour" : "Pause"}
          </Text>
        </TouchableOpacity>

        {mode === "choix" && (
          <ChoixMode
            t={t}
            tempsJour={tempsJour}
            onFocus={() => setMode("focus")}
            onRespiration={() => setMode("respiration")}
          />
        )}

        {mode === "focus" && (
          <View>
            <Text style={[styles.titre, { color: t.textPrimary }]}>
              {debut === null
                ? "Sur quoi ?"
                : (choisie?.nom ?? "Session libre")}
            </Text>

            {debut === null && (
              <>
                {choisie?.premiere_action && (
                  <Text
                    style={[styles.premiereAction, { color: t.accentText }]}
                  >
                    Première action : {choisie.premiere_action.toLowerCase()}
                  </Text>
                )}

                <View style={styles.liste}>
                  <TouchableOpacity
                    style={[
                      styles.choix,
                      {
                        backgroundColor: choisie === null ? t.accent : t.bgCard,
                        borderColor: t.border,
                      },
                    ]}
                    onPress={() => setChoisie(null)}
                  >
                    <Text
                      style={[
                        styles.choixTexte,
                        {
                          color:
                            choisie === null ? t.textOnAccent : t.textPrimary,
                        },
                      ]}
                    >
                      Autre chose
                    </Text>
                  </TouchableOpacity>

                  {routines.map((r) => {
                    const actif = choisie?.id === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.choix,
                          {
                            backgroundColor: actif ? t.accent : t.bgCard,
                            borderColor: t.border,
                          },
                        ]}
                        onPress={() => {
                          setChoisie(r);
                          if (r.duree_min) setEstimation(r.duree_min);
                        }}
                      >
                        <Text
                          style={[
                            styles.choixTexte,
                            { color: actif ? t.textOnAccent : t.textPrimary },
                          ]}
                        >
                          {r.nom}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: t.textMuted }]}>
                  Ça va prendre combien de temps ?
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {DUREES.map((d) => {
                    const actif = d === estimation;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.pastille,
                          {
                            backgroundColor: actif ? t.accent : t.bgCard,
                            borderColor: t.border,
                          },
                        ]}
                        onPress={() => setEstimation(d)}
                      >
                        <Text
                          style={[
                            styles.pastilleTexte,
                            { color: actif ? t.textOnAccent : t.textSecondary },
                          ]}
                        >
                          {d} min
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.note, { color: t.textMuted }]}>
                  C'est une estimation, pas un engagement. Tu peux arrêter quand
                  tu veux.
                </Text>

                <TouchableOpacity
                  style={[styles.bouton, { backgroundColor: t.accent }]}
                  onPress={lancer}
                >
                  <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
                    Lancer
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {debut !== null && (
              <>
                {/* Le temps restant se voit comme une surface qui diminue,
                    pas seulement comme un nombre. */}
                <View style={[styles.jauge, { backgroundColor: t.bgCard }]}>
                  <View
                    style={[
                      styles.jaugeRemplie,
                      {
                        backgroundColor: auBout ? t.success : t.accent,
                        height: `${fraction * 100}%`,
                      },
                    ]}
                  />
                  <View style={styles.jaugeTexte}>
                    <Text style={[styles.chrono, { color: t.textPrimary }]}>
                      {formatTemps(restantSec)}
                    </Text>
                    {auBout && (
                      <Text style={[styles.auBout, { color: t.textPrimary }]}>
                        Temps écoulé. Tu peux continuer ou t'arrêter.
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.bouton, { backgroundColor: t.accent }]}
                  onPress={arreter}
                >
                  <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
                    Terminer
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {bilan && (
              <View style={[styles.bilan, { backgroundColor: t.bgCard }]}>
                <Text style={[styles.bilanTitre, { color: t.textPrimary }]}>
                  {Math.round(bilan.reelle)} min de travail
                </Text>
                <Text style={[styles.bilanTexte, { color: t.textSecondary }]}>
                  Tu avais prévu {bilan.estimation} min.
                </Text>
              </View>
            )}

            {ratio && debut === null && (
              <Text style={[styles.note, { color: t.textMuted }]}>
                Sur tes {ratio.n} dernières sessions, tes tâches prennent en
                moyenne {ratio.ratio.toFixed(1)}× le temps prévu.
              </Text>
            )}
          </View>
        )}

        {mode === "respiration" && <Respiration t={t} />}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoixMode({
  t,
  tempsJour,
  onFocus,
  onRespiration,
}: {
  t: ReturnType<typeof useTheme>;
  tempsJour: number;
  onFocus: () => void;
  onRespiration: () => void;
}) {
  return (
    <View>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Pause</Text>

      {tempsJour > 0 && (
        <Text style={[styles.note, { color: t.textMuted }]}>
          {tempsJour} min de concentration aujourd'hui.
        </Text>
      )}

      <TouchableOpacity
        style={[styles.grosChoix, { backgroundColor: t.bgCard }]}
        onPress={onFocus}
      >
        <Text style={[styles.grosChoixTitre, { color: t.textPrimary }]}>
          Je démarre quelque chose
        </Text>
        <Text style={[styles.grosChoixTexte, { color: t.textSecondary }]}>
          Une seule tâche, un minuteur, et le droit de s'arrêter.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.grosChoix, { backgroundColor: t.bgCard }]}
        onPress={onRespiration}
      >
        <Text style={[styles.grosChoixTitre, { color: t.textPrimary }]}>
          J'ai besoin de redescendre
        </Text>
        <Text style={[styles.grosChoixTexte, { color: t.textSecondary }]}>
          Quelques minutes de respiration guidée.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Respiration({ t }: { t: ReturnType<typeof useTheme> }) {
  const [enCours, setEnCours] = useState(false);
  const [phase, setPhase] = useState<"inspire" | "expire">("inspire");
  const [cycles, setCycles] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [debut, setDebut] = useState<number | null>(null);

  const taille = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!enCours) return;

    let annule = false;

    const cycle = (vers: "inspire" | "expire") => {
      if (annule) return;
      setPhase(vers);
      Animated.timing(taille, {
        toValue: vers === "inspire" ? 1 : 0.35,
        duration: PHASE_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || annule) return;
        if (vers === "expire") setCycles((c) => c + 1);
        cycle(vers === "inspire" ? "expire" : "inspire");
      });
    };

    cycle("inspire");
    return () => {
      annule = true;
      taille.stopAnimation();
    };
  }, [enCours, taille]);

  const demarrer = async () => {
    const id = await demarrerSession({
      type: "regulation",
      libelle: "Respiration guidée",
    });
    setSessionId(id);
    setDebut(Date.now());
    setEnCours(true);
  };

  const arreter = async () => {
    setEnCours(false);
    if (sessionId !== null && debut !== null) {
      await terminerSession(sessionId, (Date.now() - debut) / 60000, true);
    }
    setSessionId(null);
    setDebut(null);
    taille.setValue(0.35);
  };

  return (
    <View>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Respirer</Text>

      <Text style={[styles.note, { color: t.textSecondary }]}>
        Suis le carré : il grandit quand tu inspires, il rétrécit quand tu
        expires. Si ton attention part ailleurs, c'est normal — reviens, c'est
        tout.
      </Text>

      <View style={styles.zoneRespiration}>
        <Animated.View
          style={[
            styles.carre,
            {
              backgroundColor: t.accent,
              transform: [{ scale: taille }],
            },
          ]}
        />
      </View>

      {enCours && (
        <>
          <Text style={[styles.phase, { color: t.textPrimary }]}>
            {phase === "inspire" ? "Inspire" : "Expire"}
          </Text>
          <Text style={[styles.note, { color: t.textMuted }]}>
            {cycles} respiration{cycles > 1 ? "s" : ""}
          </Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.bouton, { backgroundColor: t.accent }]}
        onPress={enCours ? arreter : demarrer}
      >
        <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
          {enCours ? "Terminer" : "Commencer"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  retour: { paddingVertical: spacing.sm },
  retourTexte: { fontSize: typography.bodySmall, fontWeight: "500" },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  grosChoix: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  grosChoixTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: 6,
  },
  grosChoixTexte: { fontSize: typography.small, lineHeight: 19 },
  premiereAction: { fontSize: typography.small, marginBottom: spacing.md },
  liste: { marginBottom: spacing.lg, gap: spacing.sm },
  choix: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  choixTexte: { fontSize: typography.body },
  label: {
    fontSize: typography.tiny,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 6,
  },
  pastille: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  pastilleTexte: { fontSize: typography.small },
  note: {
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  jauge: {
    height: 260,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    marginTop: spacing.lg,
  },
  jaugeRemplie: { width: "100%" },
  jaugeTexte: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  chrono: { fontSize: 52, fontWeight: "300" },
  auBout: {
    fontSize: typography.small,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
  bilan: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  bilanTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: 4,
  },
  bilanTexte: { fontSize: typography.small },
  zoneRespiration: {
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  carre: { width: 180, height: 180, borderRadius: radius.lg },
  phase: {
    fontSize: typography.h2,
    fontWeight: "500",
    textAlign: "center",
    marginTop: spacing.md,
  },
});
