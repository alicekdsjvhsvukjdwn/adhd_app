import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Frown, Meh, Moon, Smartphone, Smile, Sun } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Texte } from "../components/Texte";
import { getAujourdhui } from "../lib/db/completions";
import { getNuit, getReponses, repondre, type Nuit } from "../lib/db/sommeil";
import {
  dureeLisible,
  nuitRapporte,
  POINTS_NUIT,
  reponsesCompletes,
  type Qualite,
  type ReponsesMatin,
} from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const INDIGO = "#818CF8";
const BLEU_CLAIR = "#7DD3FC";

const VISAGES: { q: Qualite; libelle: string; Icone: typeof Smile }[] = [
  { q: 1, libelle: "Mauvaise", Icone: Frown },
  { q: 2, libelle: "Moyenne", Icone: Meh },
  { q: 3, libelle: "Bonne", Icone: Smile },
];

/**
 * Le matin, juste après « Je me suis levée » : la nuit, puis 2 questions.
 * Chaque tap est gardé tout de suite ; la nuit est complète (et rapporte
 * ses points) quand les deux réponses sont données.
 */
export default function Matin() {
  const router = useRouter();
  const t = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? getAujourdhui();

  const [nuit, setNuit] = useState<Nuit | null>(null);
  const [reponses, setReponses] = useState<ReponsesMatin>({});

  const charger = useCallback(async () => {
    setNuit(await getNuit(date));
    setReponses(await getReponses(date));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const choisir = async (r: ReponsesMatin) => {
    setReponses((x) => ({ ...x, ...r }));
    await repondre(date, r);
    await charger();
  };

  const complete = reponsesCompletes(reponses);

  const choix = (actif: boolean, onPress: () => void, libelle: string, contenu: React.ReactNode) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[
        styles.choix,
        { backgroundColor: actif ? t.bgCardActive : t.bgCard, borderColor: actif ? t.accent : t.border },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={libelle}
    >
      {contenu}
      <Texte style={[styles.choixTexte, { color: actif ? t.textPrimary : t.textSecondary }]}>
        {libelle}
      </Texte>
    </TouchableOpacity>
  );

  const telephone = (barre: boolean, couleur: string) => (
    <View>
      <Smartphone color={couleur} size={30} strokeWidth={1.8} />
      {barre && (
        <Svg width={30} height={30} style={StyleSheet.absoluteFill}>
          <Line x1={3} y1={27} x2={27} y2={3} stroke={couleur} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>

      <Texte style={[styles.surtitre, { color: t.textMuted }]}>TA NUIT</Texte>
      {nuit && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.duree, { color: t.textPrimary }]}>{dureeLisible(nuit.duree_min)}</Texte>
          <View style={styles.nuitLigne}>
            <Moon color={INDIGO} size={20} strokeWidth={1.8} />
            <View style={[styles.nuitBarre, { backgroundColor: INDIGO }]} />
            <Sun color={BLEU_CLAIR} size={20} strokeWidth={1.8} />
          </View>
          <View style={styles.heures}>
            <Texte style={[styles.heure, { color: t.textSecondary }]}>{nuit.coucher}</Texte>
            <TouchableOpacity onPress={() => router.push(`/sommeil?date=${date}`)} hitSlop={8}>
              <Texte style={[styles.lien, { color: t.accentText }]}>corriger</Texte>
            </TouchableOpacity>
            <Texte style={[styles.heure, { color: t.textSecondary }]}>{nuit.lever}</Texte>
          </View>
        </View>
      )}

      <Texte style={[styles.question, { color: t.textPrimary }]}>Comment était ta nuit ?</Texte>
      <View style={styles.ligne}>
        {VISAGES.map(({ q, libelle, Icone }) =>
          choix(
            reponses.qualite === q,
            () => choisir({ qualite: q }),
            libelle,
            <Icone color={reponses.qualite === q ? t.accent : t.textSecondary} size={36} strokeWidth={1.6} />,
          ),
        )}
      </View>

      <Texte style={[styles.question, { color: t.textPrimary }]}>Écrans juste avant de dormir ?</Texte>
      <View style={styles.ligne}>
        {choix(
          reponses.ecrans === 1,
          () => choisir({ ecrans: 1 }),
          "Oui",
          telephone(false, reponses.ecrans === 1 ? t.accent : t.textSecondary),
        )}
        {choix(
          reponses.ecrans === 0,
          () => choisir({ ecrans: 0 }),
          "Non",
          telephone(true, reponses.ecrans === 0 ? t.accent : t.textSecondary),
        )}
      </View>

      {complete && (
        <>
          <Texte style={[styles.fini, { color: t.success }]}>
            ✓ Nuit notée{nuitRapporte(date, getAujourdhui()) ? ` · +${POINTS_NUIT} pts` : ""}
          </Texte>
          <TouchableOpacity
            style={[styles.bouton, { backgroundColor: t.accent }]}
            onPress={() => router.back()}
          >
            <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Bonne journée</Texte>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  surtitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  duree: { fontSize: 40, fontWeight: "600" },
  nuitLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  nuitBarre: { flex: 1, height: 10, borderRadius: 5 },
  heures: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  heure: { fontSize: typography.small, fontWeight: "600" },
  lien: { fontSize: typography.small, fontWeight: "600" },
  question: { fontSize: typography.h3, fontWeight: "600", marginTop: spacing.xl, marginBottom: spacing.md },
  ligne: { flexDirection: "row", gap: spacing.sm },
  choix: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  choixTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  fini: { fontSize: typography.body, fontWeight: "600", marginTop: spacing.xl, textAlign: "center" },
  bouton: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.md },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
});
