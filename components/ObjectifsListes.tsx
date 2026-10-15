import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getListes, suiviObjectif, type SuiviObjectif } from "../lib/db/listes";
import { spacing, typography, useTheme } from "../lib/theme";
import { useCouleurListe } from "../lib/theme-listes";
import { BarresObjectif } from "./BarresObjectif";

/** Progression : les listes qui ont un objectif, période par période. */
export function ObjectifsListes() {
  const t = useTheme();
  const couleurListe = useCouleurListe();
  const [suivis, setSuivis] = useState<
    { titre: string; couleur: string | null; suivi: SuiviObjectif }[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      (async () => {
        const res: { titre: string; couleur: string | null; suivi: SuiviObjectif }[] = [];
        for (const l of await getListes()) {
          const suivi = await suiviObjectif(l);
          if (suivi)
            res.push({ titre: `${l.icone ? `${l.icone} ` : ""}${l.nom}`, couleur: l.couleur, suivi });
        }
        if (actif) setSuivis(res);
      })().catch(() => {});
      return () => {
        actif = false;
      };
    }, []),
  );

  if (suivis.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[styles.section, { color: t.textPrimary }]}>Objectifs des listes</Text>
      {suivis.map((s) => (
        <BarresObjectif
          key={s.titre}
          titre={s.titre}
          suivi={s.suivi}
          couleur={couleurListe(s.couleur).fond}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
});
