import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { statsMenage, type StatsMenage } from "../lib/db/menage-stats";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const HAUT = 90;

/** Mot pour une part de 0 à 1 : pas de chiffre brut. */
const motJauge = (p: number) => (p >= 0.8 ? "au top" : p >= 0.5 ? "bien" : p >= 0.25 ? "en route" : "à relancer");

/** Progrès › Ménage : tâches faites par semaine (par pièce), puis pour chaque pièce sa jauge et sa régularité. */
export function SectionMenage() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [d, setD] = useState<StatsMenage | null>(null);

  useFocusEffect(
    useCallback(() => {
      statsMenage(aujourdhui).then(setD);
    }, [aujourdhui]),
  );

  if (!d) return null;
  const max = Math.max(1, ...d.semaines.map((s) => s.total));
  const vide = d.semaines.every((s) => s.total === 0);

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Ménage</Texte>
      <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <Texte style={[styles.etiquette, { color: t.textMuted }]}>TÂCHES FAITES, 8 SEMAINES</Texte>
        {vide ? (
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Rien de coché pour l&apos;instant. Ça se passe dans l&apos;onglet Ménage.</Texte>
        ) : (
          <View style={styles.barres} accessibilityLabel="Tâches de ménage faites par semaine, par pièce">
            {d.semaines.map((s) => (
              <View key={s.debut} style={styles.colonne}>
                <View style={{ height: HAUT, justifyContent: "flex-end" }}>
                  {s.parts.map((p) => (
                    <View key={p.nom + p.couleur} style={{ height: (p.n / max) * HAUT, backgroundColor: p.couleur }} />
                  ))}
                </View>
                <Texte style={[styles.date, { color: t.textMuted }]}>{`${Number(s.debut.slice(8))}/${Number(s.debut.slice(5, 7))}`}</Texte>
              </View>
            ))}
          </View>
        )}
      </View>

      {d.pieces.map((p) => (
        <View key={p.id} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border, borderLeftColor: p.couleur, borderLeftWidth: 4 }]}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{p.nom}</Texte>
          <Jauge libelle="En ce moment" part={p.jauge} couleur={p.couleur} mot={motJauge(p.jauge)} />
          {p.regularite === null ? (
            <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.sm }]}>RÉGULARITÉ · pas encore assez de recul</Texte>
          ) : (
            <Jauge libelle="Régularité, 30 jours" part={p.regularite} couleur={p.couleur} mot={motJauge(p.regularite)} />
          )}
        </View>
      ))}
    </View>
  );
}

function Jauge({ libelle, part, couleur, mot }: { libelle: string; part: number; couleur: string; mot: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={styles.ligne}>
        <Texte style={[styles.etiquette, { color: t.textMuted }]}>{libelle.toUpperCase()}</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.tiny }}>{mot}</Texte>
      </View>
      <View style={[styles.jauge, { backgroundColor: t.bgApp }]}>
        <View style={{ width: `${Math.round(part * 100)}%`, height: "100%", backgroundColor: couleur, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  etiquette: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 0.8 },
  barres: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  colonne: { flex: 1, alignItems: "stretch" },
  date: { fontSize: 10, textAlign: "center", marginTop: 4 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  jauge: { height: 6, borderRadius: 3, overflow: "hidden" },
});
