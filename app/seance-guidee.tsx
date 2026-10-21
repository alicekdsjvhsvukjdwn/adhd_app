import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Pause, Play, SkipBack, SkipForward } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { FigureSkill } from "../components/FigureSkill";
import { Texte } from "../components/Texte";
import { enregistrerSeanceGuidee, getSeancePerso } from "../lib/db/seances-guidees";
import { exercice } from "../lib/exercices";
import { formatRestant } from "../lib/minuteur";
import { deroule, ID_REVEIL, type Seance } from "../lib/seances";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";

const ANNEAU = 240;
const TRAIT = 12;
const GRIS_BLEU = "#7C8DA6";

/**
 * Lecteur d'une séance guidée : effort, repos, effort… au minuteur.
 * Tout se calcule depuis l'heure de fin du segment en cours. Quitter en
 * cours de route enregistre ce qui est fait (au moins un exercice).
 */
export default function SeanceGuidee() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  useKeepAwake();
  const bip = useAudioPlayer(require("../assets/sons/bip.wav"));

  const [s, setS] = useState<Seance | null>(null);
  const [index, setIndex] = useState(0);
  const [fin, setFin] = useState(0);
  /** En pause : ms restantes du segment en cours. */
  const [pause, setPause] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const [bilan, setBilan] = useState<string | null>(null);
  // Lu au démontage : quitter l'écran enregistre aussi.
  const suivi = useRef({
    seance: null as Seance | null,
    debut: 0,
    pauses: 0,
    pauseDebut: null as number | null,
    faits: [] as string[],
    fini: false,
  });

  const segments = useMemo(() => (s ? deroule(s) : []), [s]);

  useEffect(() => {
    (id === ID_REVEIL ? getSeancePerso() : Promise.resolve(null)).then((x) => {
      if (!x || x.exercices.length === 0) return router.back();
      const n = Date.now();
      suivi.current.seance = x;
      suivi.current.debut = n;
      setS(x);
      setFin(n + deroule(x)[0].duree_s * 1000);
      setMaintenant(n);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /** Une seule fois : rien si aucun exercice fait jusqu'au bout. */
  const finir = async (terminee: boolean): Promise<number | null> => {
    const x = suivi.current;
    if (x.fini || !x.seance) return null;
    x.fini = true;
    if (x.faits.length === 0) return null;
    const n = Date.now();
    const duree = Math.round((n - x.debut - x.pauses - (x.pauseDebut ? n - x.pauseDebut : 0)) / 1000);
    return enregistrerSeanceGuidee(x.seance.id, duree, x.faits, terminee);
  };

  useEffect(
    () => () => {
      finir(false).catch(() => {});
    },
    [],
  );

  const signal = (vers: "effort" | "repos" | "fin") => {
    try {
      bip.seekTo(0);
      bip.play();
    } catch {
      // pas de son : la vibration suffit
    }
    if (vers === "repos") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const aller = (i: number) => {
    const seg = segments[i];
    const n = Date.now();
    signal(seg.type);
    setIndex(i);
    setMaintenant(n);
    if (pause !== null) setPause(seg.duree_s * 1000);
    else setFin(n + seg.duree_s * 1000);
  };

  const avancer = async () => {
    const seg = segments[index];
    if (seg.type === "effort") suivi.current.faits.push(seg.exercice);
    if (index + 1 < segments.length) return aller(index + 1);
    signal("fin");
    const points = await finir(true);
    setBilan(`Séance terminée${points ? ` · +${points} pts` : ""}`);
  };

  // ponytail: après un long arrière-plan, rattrape un segment par tick (250 ms).
  useEffect(() => {
    if (!s || pause !== null || bilan !== null) return;
    const iv = setInterval(() => {
      const n = Date.now();
      setMaintenant(n);
      if (n >= fin) avancer();
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, fin, pause, index, bilan]);

  const basculerPause = () => {
    const n = Date.now();
    const x = suivi.current;
    if (pause === null) {
      x.pauseDebut = n;
      setPause(Math.max(0, fin - n));
    } else {
      x.pauses += n - (x.pauseDebut ?? n);
      x.pauseDebut = null;
      setFin(n + pause);
      setMaintenant(n);
      setPause(null);
    }
  };

  if (!s || segments.length === 0) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;

  if (bilan) {
    return (
      <View style={[styles.finEcran, { backgroundColor: t.bgApp }]}>
        <View style={[styles.rondFin, { backgroundColor: t.accent }]}>
          <Check color={t.textOnAccent} size={36} strokeWidth={3} />
        </View>
        <Texte style={[styles.nom, { color: t.textPrimary }]}>{bilan}</Texte>
        <Texte style={[styles.consigne, { color: t.textMuted }]}>{s.nom}</Texte>
        <TouchableOpacity style={[styles.bouton, { backgroundColor: t.accent }]} onPress={() => router.back()}>
          <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Fermer</Texte>
        </TouchableOpacity>
      </View>
    );
  }

  const seg = segments[index];
  const ex = exercice(seg.exercice);
  const effort = seg.type === "effort";
  const couleur = effort ? t.accent : GRIS_BLEU;
  const restant = pause ?? Math.max(0, fin - maintenant);
  const part = Math.min(1, restant / (seg.duree_s * 1000));
  const r = (ANNEAU - TRAIT) / 2;
  const C = 2 * Math.PI * r;
  // En repos, l'exercice affiché est le prochain : « Ensuite » est celui d'après.
  const ensuite = segments.slice(index + (effort ? 1 : 2)).find((x) => x.type === "effort");
  const exEnsuite = ensuite ? exercice(ensuite.exercice) : null;
  const efforts = segments.filter((x) => x.type === "effort");
  const faitsAvant = segments.slice(0, index).filter((x) => x.type === "effort").length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Arrêter</Texte>
      </TouchableOpacity>

      {/* Un segment par exercice : faits, en cours, à venir */}
      <View style={styles.segments}>
        {efforts.map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < faitsAvant ? t.accent : i === faitsAvant && effort ? t.accentFonce : t.border },
            ]}
          />
        ))}
      </View>

      <View style={styles.ligneHaut}>
        <View style={[styles.pastille, { backgroundColor: avecAlpha(couleur, 0.18) }]}>
          <Texte style={[styles.pastilleTexte, { color: couleur }]}>{effort ? "EFFORT" : "REPOS"}</Texte>
        </View>
        {s.tours > 1 && (
          <Texte style={[styles.tour, { color: t.textMuted }]}>
            Tour {seg.tour}/{s.tours}
          </Texte>
        )}
      </View>

      <View style={styles.anneau}>
        <Svg width={ANNEAU} height={ANNEAU} style={StyleSheet.absoluteFill}>
          <Circle cx={ANNEAU / 2} cy={ANNEAU / 2} r={r} stroke={t.border} strokeWidth={TRAIT} fill="none" />
          <Circle
            cx={ANNEAU / 2}
            cy={ANNEAU / 2}
            r={r}
            stroke={couleur}
            strokeWidth={TRAIT}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - part)}
            transform={`rotate(-90 ${ANNEAU / 2} ${ANNEAU / 2})`}
          />
        </Svg>
        {ex && <FigureSkill skill={ex.figure} couleur={couleur} taille={88} />}
        <Texte style={[styles.temps, { color: t.textPrimary }]}>{formatRestant(restant)}</Texte>
      </View>

      <Texte style={[styles.nom, { color: t.textPrimary }]}>
        {effort ? ex?.nom : `Prépare-toi : ${ex?.nom}`}
      </Texte>
      <Texte style={[styles.consigne, { color: t.textSecondary }]}>{ex?.consigne}</Texte>

      <View style={[styles.ensuite, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        {exEnsuite && <FigureSkill skill={exEnsuite.figure} couleur={t.textMuted} taille={36} />}
        <View style={{ flex: 1 }}>
          <Texte style={[styles.surtitre, { color: t.textMuted }]}>ENSUITE</Texte>
          <Texte style={[styles.ensuiteNom, { color: t.textPrimary }]}>
            {exEnsuite ? exEnsuite.nom : "Fin de la séance"}
          </Texte>
        </View>
      </View>

      <View style={styles.commandes}>
        <TouchableOpacity
          onPress={() => index > 0 && aller(index - 1)}
          disabled={index === 0}
          style={[styles.petit, { borderColor: t.border, opacity: index === 0 ? 0.4 : 1 }]}
          accessibilityLabel="Précédent"
        >
          <SkipBack color={t.textPrimary} size={22} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={basculerPause}
          style={[styles.grand, { backgroundColor: couleur }]}
          accessibilityLabel={pause !== null ? "Reprendre" : "Pause"}
        >
          {pause !== null ? (
            <Play color={t.bgApp} size={30} fill={t.bgApp} style={{ marginLeft: 3 }} />
          ) : (
            <Pause color={t.bgApp} size={30} fill={t.bgApp} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => (index + 1 < segments.length ? aller(index + 1) : router.back())}
          style={[styles.petit, { borderColor: t.border }]}
          accessibilityLabel="Suivant"
        >
          <SkipForward color={t.textPrimary} size={22} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, alignItems: "center" },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg, alignSelf: "flex-start" },
  segments: { flexDirection: "row", gap: 3, alignSelf: "stretch" },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  ligneHaut: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  pastille: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pastilleTexte: { fontSize: typography.small, fontWeight: "800", letterSpacing: 1 },
  tour: { fontSize: typography.small, fontWeight: "600" },
  anneau: { width: ANNEAU, height: ANNEAU, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  temps: { fontSize: 40, fontWeight: "700", marginTop: spacing.xs },
  nom: { fontSize: typography.h2, fontWeight: "600", marginTop: spacing.xl, textAlign: "center" },
  consigne: { fontSize: typography.bodySmall, marginTop: spacing.xs, textAlign: "center", lineHeight: 20 },
  ensuite: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    alignSelf: "stretch",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  surtitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1 },
  ensuiteNom: { fontSize: typography.body, fontWeight: "600" },
  commandes: { flexDirection: "row", alignItems: "center", gap: spacing.xxl, marginTop: spacing.xl },
  petit: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  grand: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  finEcran: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  rondFin: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
});
