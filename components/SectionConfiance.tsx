import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { progresConfiance, type ProgresConfiance } from "../lib/db/tcc";
import { phraseAttente } from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const VERT = "#4ADE80";
const PREVU = "#FB923C";
const ROSE = "#F472B6";
const HAUT = 56;

const un = (x: number) => String(Math.round(x)).replace(".", ",");

/**
 * Progrès › Confiance & anxiété : marches franchies par semaine, anxiété prévue et réelle,
 * entrées du journal de confiance, et des liens prudents avec le sommeil et le sport (7 jours au moins
 * dans chaque groupe). Des tendances, jamais des causes.
 */
export function SectionConfiance() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [d, setD] = useState<ProgresConfiance | null>(null);

  useFocusEffect(
    useCallback(() => {
      progresConfiance(aujourdhui).then(setD);
    }, [aujourdhui]),
  );

  if (!d) return null;

  const barres = (serie: { debut: string; n: number }[], couleur: string, libelle: string) => {
    const max = Math.max(1, ...serie.map((s) => s.n));
    return (
      <View style={styles.barres} accessibilityLabel={libelle}>
        {serie.map((s) => (
          <View key={s.debut} style={styles.colonne}>
            <View style={{ height: HAUT, justifyContent: "flex-end" }}>
              <View style={{ height: (s.n / max) * HAUT, backgroundColor: couleur, borderRadius: 2 }} />
            </View>
            <Texte style={[styles.date, { color: t.textMuted }]}>{`${Number(s.debut.slice(8))}/${Number(s.debut.slice(5, 7))}`}</Texte>
          </View>
        ))}
      </View>
    );
  };

  const carte = (titre: string, enfant: React.ReactNode) => (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>{titre}</Texte>
      {enfant}
    </View>
  );

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Confiance &amp; anxiété</Texte>
      {d.vide ? (
        <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Rien pour l&apos;instant. Ça se passe dans Suivi › Esprit › Mon programme.</Texte>
      ) : (
        <>
          {carte("MARCHES FRANCHIES, PAR SEMAINE", barres(d.marches, VERT, "Marches franchies par semaine"))}
          {carte(
            "ANXIÉTÉ PRÉVUE ET RÉELLE",
            d.anxiete.some((a) => a.prevue !== null) ? (
              <>
                <View style={styles.barres} accessibilityLabel="Anxiété prévue et réelle par semaine">
                  {d.anxiete.map((a) => (
                    <View key={a.debut} style={styles.colonne}>
                      <View style={[styles.paire, { height: HAUT }]}>
                        <View style={{ height: ((a.prevue ?? 0) / 100) * HAUT, width: 8, backgroundColor: PREVU, borderRadius: 2 }} />
                        <View style={{ height: ((a.reelle ?? 0) / 100) * HAUT, width: 8, backgroundColor: VERT, borderRadius: 2 }} />
                      </View>
                      <Texte style={[styles.date, { color: t.textMuted }]}>{`${Number(a.debut.slice(8))}/${Number(a.debut.slice(5, 7))}`}</Texte>
                    </View>
                  ))}
                </View>
                <Texte style={{ color: t.textMuted, fontSize: typography.tiny, marginTop: 4 }}>
                  <Texte style={{ color: PREVU }}>■</Texte> prévue · <Texte style={{ color: VERT }}>■</Texte> réelle (moyenne sur 100)
                </Texte>
              </>
            ) : (
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Après ta première exposition.</Texte>
            ),
          )}
          {carte("JOURNAL DE CONFIANCE, LIGNES PAR SEMAINE", barres(d.confiance, ROSE, "Lignes du journal de confiance par semaine"))}
          <Texte style={[styles.sousTitre, { color: t.textPrimary }]}>Sommeil et sport</Texte>
          {d.liens.map((l) => (
            <View key={l.cle} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall, fontWeight: "600" }}>Anxiété réelle · {l.libelle}</Texte>
              {l.resultat.ok ? (
                <>
                  <Texte style={{ color: t.textSecondary, fontSize: typography.small, marginTop: 4 }}>
                    {un(l.resultat.moyA)} ({l.resultat.nA} j) · {un(l.resultat.moyB)} ({l.resultat.nB} j), sur 100
                  </Texte>
                  <Texte style={{ color: t.textMuted, fontSize: typography.tiny, fontStyle: "italic" }}>Tendance observée sur tes jours, pas une cause.</Texte>
                </>
              ) : (
                <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 4 }}>{phraseAttente(l.resultat)}</Texte>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  sousTitre: { fontSize: typography.h3, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.sm },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  barres: { flexDirection: "row", gap: 6 },
  colonne: { flex: 1, alignItems: "stretch" },
  paire: { flexDirection: "row", gap: 2, alignItems: "flex-end", justifyContent: "center" },
  date: { fontSize: 10, textAlign: "center", marginTop: 4 },
});
