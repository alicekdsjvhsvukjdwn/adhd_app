import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  moyennesParFenetre,
  ratioEstimation,
  tauxCompletion,
  tempsFocusDuJour,
  type Fenetre,
} from "../../lib/db";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

type Moyennes = {
  fenetre: Fenetre;
  n: number;
  energie: number;
  focus: number;
  humeur: number;
};

export default function Progression() {
  const t = useTheme();

  const [taux, setTaux] = useState(0);
  const [tempsJour, setTempsJour] = useState(0);
  const [ratio, setRatio] = useState<{ ratio: number; n: number } | null>(null);
  const [moyennes, setMoyennes] = useState<Moyennes[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [tc, tj, re, mf] = await Promise.all([
          tauxCompletion(14),
          tempsFocusDuJour(),
          ratioEstimation(),
          moyennesParFenetre(30),
        ]);
        setTaux(tc);
        setTempsJour(tj);
        setRatio(re);
        setMoyennes(mf as Moyennes[]);
      })();
    }, []),
  );

  const niveauMot = (v: number) =>
    v < 1.7 ? "plutôt bas" : v < 2.4 ? "moyen" : "plutôt haut";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.titre, { color: t.textPrimary }]}>
          Ce qui avance
        </Text>

        <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
          <Text style={[styles.grand, { color: t.textPrimary }]}>
            {Math.round(taux * 100)} %
          </Text>
          <Text style={[styles.legende, { color: t.textSecondary }]}>
            de tes routines tenues sur les deux dernières semaines
          </Text>
        </View>

        {tempsJour > 0 && (
          <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <Text style={[styles.grand, { color: t.textPrimary }]}>
              {tempsJour} min
            </Text>
            <Text style={[styles.legende, { color: t.textSecondary }]}>
              de concentration aujourd'hui
            </Text>
          </View>
        )}

        {ratio && (
          <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <Text style={[styles.grand, { color: t.textPrimary }]}>
              {ratio.ratio.toFixed(1)}×
            </Text>
            <Text style={[styles.legende, { color: t.textSecondary }]}>
              le temps prévu, en moyenne, sur {ratio.n} sessions. Un écart
              n'est pas un défaut : c'est une donnée pour mieux estimer la
              prochaine fois.
            </Text>
          </View>
        )}

        {moyennes.length > 0 && (
          <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <Text style={[styles.carteTitre, { color: t.textPrimary }]}>
              Comment tu vas, selon le moment
            </Text>
            {moyennes.map((m) => (
              <Text
                key={m.fenetre}
                style={[styles.ligne, { color: t.textSecondary }]}
              >
                {m.fenetre === "matin" ? "Le matin" : "Le soir"} · énergie{" "}
                {niveauMot(m.energie)}, concentration {niveauMot(m.focus)}
              </Text>
            ))}
            <Text style={[styles.legende, { color: t.textMuted }]}>
              Sur 30 jours. Utile pour placer les routines exigeantes au bon
              moment.
            </Text>
          </View>
        )}

        {taux === 0 && !ratio && moyennes.length === 0 && (
          <Text style={[styles.vide, { color: t.textSecondary }]}>
            Rien à afficher pour l'instant. Les chiffres apparaissent au fur et
            à mesure que tu utilises l'appli.
          </Text>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  carte: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  carteTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  grand: { fontSize: 40, fontWeight: "300", marginBottom: 4 },
  legende: { fontSize: typography.small, lineHeight: 19 },
  ligne: { fontSize: typography.body, marginBottom: 4 },
  vide: { fontSize: typography.bodySmall, lineHeight: 20 },
});
