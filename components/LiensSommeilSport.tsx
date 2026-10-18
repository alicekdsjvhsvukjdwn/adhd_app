import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import { Texte } from "./Texte";
import { liensSommeilSport, type LiensSommeilSport } from "../lib/db/progression";
import { phraseAttente, type Comparaison } from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const pourcent = (x: number) => `${Math.round(x * 100)} %`;
const surTrois = (x: number) => `${x.toFixed(1).replace(".", ",")}/3`;

/**
 * Section « Sommeil et sport » de Progression : des tendances, jamais des
 * causes, et seulement avec au moins 7 jours dans chaque groupe.
 */
export function LiensSommeilSport() {
  const t = useTheme();
  const [liens, setLiens] = useState<LiensSommeilSport | null>(null);

  useFocusEffect(
    useCallback(() => {
      liensSommeilSport().then(setLiens).catch(() => setLiens(null));
    }, []),
  );

  if (!liens) return null;

  const ligne = (
    titre: string,
    c: Comparaison,
    libA: string,
    libB: string,
    format: (x: number) => string,
  ) => (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
      {c.ok ? (
        <>
          <Texte style={[styles.texte, { color: t.textSecondary }]}>
            {libA} : {format(c.moyA)} ({c.nA} j) · {libB} : {format(c.moyB)} ({c.nB} j)
          </Texte>
          <Texte style={[styles.note, { color: t.textMuted }]}>
            Tendance observée sur tes jours, pas une cause.
          </Texte>
        </>
      ) : (
        <Texte style={[styles.texte, { color: t.textMuted }]}>{phraseAttente(c)}</Texte>
      )}
    </View>
  );

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Texte style={[styles.section, { color: t.textPrimary }]}>Sommeil et sport</Texte>
      {ligne(
        "Routines faites selon la nuit",
        liens.routinesSelonNuit,
        "Après une bonne nuit",
        "après une mauvaise",
        pourcent,
      )}
      {ligne(
        "Qualité du sommeil selon les écrans",
        liens.qualiteSelonEcrans,
        "Avec écrans",
        "sans",
        surTrois,
      )}
      {ligne(
        "Énergie choisie selon le sport",
        liens.energieSelonSeance,
        "Jours avec séance",
        "sans",
        surTrois,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  titre: { fontSize: typography.body, fontWeight: "600" },
  texte: { fontSize: typography.small, lineHeight: 19, marginTop: 4 },
  note: { fontSize: typography.tiny, marginTop: 4, fontStyle: "italic" },
});
