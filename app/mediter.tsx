import { useRouter } from "expo-router";
import { Moon, PersonStanding, Play, Square, Timer } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Texte } from "../components/Texte";
import { enregistrerMeditation } from "../lib/db/meditations";
import {
  aEnregistrer,
  dureeMinutes,
  formatSecondes,
  guidageA,
  LIBELLES_PHASE,
  MEDITATIONS,
  phaseA,
  POINTS_MEDITATION,
  secondesEcoulees,
  type Meditation,
} from "../lib/meditations";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";

const VIOLET = "#A78BFA";
const CERCLE = 210;

const ICONES: Record<Meditation["icone"], typeof Moon> = {
  pause: Timer,
  carre: Square,
  corps: PersonStanding,
  nuit: Moon,
};

/**
 * Méditer : une séance guidée (minuteur + texte, l'audio viendra plus tard).
 * Terminée, ou arrêtée après au moins 1 min : enregistrée, +5 pts une fois par jour.
 */
export default function Mediter() {
  const router = useRouter();
  const t = useTheme();
  const [choisie, setChoisie] = useState<Meditation>(MEDITATIONS[0]);
  const [debut, setDebut] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [souffle] = useState(() => new Animated.Value(0));
  // Séance en cours, lue au démontage (quitter l'écran enregistre aussi).
  const enCours = useRef<{ m: Meditation; debut: number } | null>(null);

  const ecoulees = debut ? secondesEcoulees(debut, maintenant, choisie.duree_s) : 0;

  const finir = async (terminee: boolean) => {
    const s = enCours.current;
    enCours.current = null;
    setDebut(null);
    if (!s) return;
    const duree = secondesEcoulees(s.debut, Date.now(), s.m.duree_s);
    if (!aEnregistrer(duree, s.m.duree_s)) {
      setMessage("Arrêtée avant 1 min : rien n'est noté. Ce n'est pas grave.");
      return;
    }
    const points = await enregistrerMeditation(s.m.id, duree, terminee);
    setMessage(
      `${terminee ? "Séance terminée" : `${formatSecondes(duree)} de méditation`}${points ? ` · +${points} pts` : ""}`,
    );
  };

  // Le minuteur : tout se calcule depuis l'heure de départ.
  useEffect(() => {
    if (!debut) return;
    const id = setInterval(() => {
      const n = Date.now();
      setMaintenant(n);
      if (secondesEcoulees(debut, n, choisie.duree_s) >= choisie.duree_s) finir(true);
    }, 500);
    return () => clearInterval(id);
  }, [debut, choisie]);

  // Le souffle : grandit à l'inspiration, rétrécit à l'expiration.
  useEffect(() => {
    if (!debut) {
      souffle.setValue(0);
      return;
    }
    const r = choisie.respiration;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(souffle, { toValue: 1, duration: r.inspire * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(r.bloque * 1000),
        Animated.timing(souffle, { toValue: 0, duration: r.expire * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(r.bloqueVide * 1000),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [debut, choisie, souffle]);

  // Écran quitté en cours de séance : enregistrée si au moins 1 min.
  useEffect(
    () => () => {
      finir(false).catch(() => {});
    },
    [],
  );

  const lancer = () => {
    const d = Date.now();
    enCours.current = { m: choisie, debut: d };
    setMessage(null);
    setMaintenant(d);
    setDebut(d);
  };

  const disque = (taille: number, alpha: number, min: number) => (
    <Animated.View
      style={[
        styles.disque,
        {
          width: taille,
          height: taille,
          backgroundColor: avecAlpha(VIOLET, alpha),
          transform: [{ scale: souffle.interpolate({ inputRange: [0, 1], outputRange: [min, 1] }) }],
        },
      ]}
    />
  );

  const phase = phaseA(choisie.respiration, ecoulees);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Méditer</Texte>

      {/* La séance choisie */}
      <View style={[styles.grande, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <View style={styles.cercle}>
          {disque(CERCLE, 0.12, 0.7)}
          {disque(CERCLE * 0.74, 0.22, 0.65)}
          {disque(CERCLE * 0.5, 0.4, 0.6)}
          <TouchableOpacity
            onPress={() => (debut ? finir(false) : lancer())}
            style={[styles.lecture, { backgroundColor: VIOLET }]}
            accessibilityRole="button"
            accessibilityLabel={debut ? "Arrêter" : `Commencer ${choisie.titre}`}
          >
            {debut ? (
              <Square color={t.bgApp} size={24} fill={t.bgApp} />
            ) : (
              <Play color={t.bgApp} size={28} fill={t.bgApp} style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
        </View>
        <Texte style={[styles.seanceTitre, { color: t.textPrimary }]}>{choisie.titre}</Texte>
        {debut ? (
          <>
            <Texte style={[styles.phase, { color: VIOLET }]}>
              {LIBELLES_PHASE[phase.phase]} · {formatSecondes(choisie.duree_s - ecoulees)}
            </Texte>
            <Texte style={[styles.guidage, { color: t.textSecondary }]}>
              {guidageA(choisie, ecoulees)}
            </Texte>
          </>
        ) : (
          <Texte style={[styles.sous, { color: t.textMuted }]}>
            {choisie.intention} · {dureeMinutes(choisie.duree_s)}
          </Texte>
        )}
        {message && !debut && (
          <Texte style={[styles.message, { color: t.textSecondary }]}>{message}</Texte>
        )}
      </View>

      <Texte style={[styles.surtitre, { color: t.textMuted }]}>SÉANCES GUIDÉES</Texte>
      {MEDITATIONS.map((m) => {
        const Icone = ICONES[m.icone];
        const active = m.id === choisie.id;
        return (
          <TouchableOpacity
            key={m.id}
            disabled={!!debut}
            onPress={() => {
              setChoisie(m);
              setMessage(null);
            }}
            style={[
              styles.ligne,
              {
                backgroundColor: active ? avecAlpha(VIOLET, 0.1) : t.bgCard,
                borderColor: active ? VIOLET : t.border,
                opacity: debut && !active ? 0.5 : 1,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.rond, { backgroundColor: avecAlpha(VIOLET, 0.15) }]}>
              <Icone color={VIOLET} size={20} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Texte style={[styles.ligneTitre, { color: t.textPrimary }]}>{m.titre}</Texte>
              <Texte style={[styles.sous, { color: t.textMuted }]}>
                {m.intention} · {dureeMinutes(m.duree_s)}
              </Texte>
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={[styles.ligne, styles.pointilles, { borderColor: t.border }]}>
        <Texte style={[styles.sous, { color: t.textMuted }]}>D&apos;autres séances à ajouter</Texte>
      </View>
      <Texte style={[styles.note, { color: t.textMuted }]}>
        +{POINTS_MEDITATION} pts une fois par jour, dès 1 min.
      </Texte>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  grande: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, alignItems: "center" },
  cercle: { width: CERCLE, height: CERCLE, alignItems: "center", justifyContent: "center" },
  disque: { position: "absolute", borderRadius: 999 },
  lecture: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  seanceTitre: { fontSize: typography.h2, fontWeight: "600", marginTop: spacing.lg },
  sous: { fontSize: typography.small, marginTop: 2 },
  phase: { fontSize: typography.body, fontWeight: "700", marginTop: spacing.xs },
  guidage: { fontSize: typography.bodySmall, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  message: { fontSize: typography.small, marginTop: spacing.md, textAlign: "center" },
  surtitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pointilles: { borderStyle: "dashed", justifyContent: "center" },
  rond: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  ligneTitre: { fontSize: typography.body, fontWeight: "600" },
  note: { fontSize: typography.tiny, marginTop: spacing.sm, textAlign: "center" },
});
