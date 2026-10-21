import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { humeurProgres } from "../lib/db/humeur-stats";
import { couleurHumeur } from "../lib/esprit-regles";
import { phraseAttente } from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";
import { VisageHumeur } from "./VisageHumeur";

type Donnees = Awaited<ReturnType<typeof humeurProgres>>;

const un = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/** Progrès › Humeur : courbe sur 30 jours, et des liens prudents (7 jours au moins dans chaque groupe). */
export function SectionHumeur() {
  const t = useTheme();
  const [d, setD] = useState<Donnees | null>(null);

  useFocusEffect(
    useCallback(() => {
      humeurProgres().then(setD);
    }, []),
  );

  if (!d) return null;

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Humeur</Texte>
      {d.notes === 0 ? (
        <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Rien de noté ces 30 derniers jours. Ça se passe dans Suivi › Esprit.</Texte>
      ) : (
        <>
          <View style={styles.ligne}>
            {d.moyenne !== null && <VisageHumeur niveau={d.moyenne} taille={36} />}
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, flex: 1 }}>
              {d.notes} notes en 30 jours{d.moyenne !== null ? ` · moyenne ${un(d.moyenne)} sur 5` : ""}
            </Texte>
          </View>
          <View style={[styles.courbe, { backgroundColor: t.bgCard, borderColor: t.border }]} accessibilityLabel="Humeur des 30 derniers jours">
            {d.courbe.map((c) => (
              <View key={c.jour} style={styles.colonne}>
                {c.moy !== null && <View style={{ height: `${(c.moy / 5) * 100}%`, backgroundColor: couleurHumeur(c.moy), borderRadius: 2 }} />}
              </View>
            ))}
          </View>
        </>
      )}

      <Texte style={[styles.sousTitre, { color: t.textMuted }]}>LIENS POSSIBLES</Texte>
      {d.liens.map((l) => (
        <View key={l.cle} style={[styles.lien, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>{l.libelle}</Texte>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, marginTop: 2 }}>
            {l.resultat.ok ? `${un(l.resultat.moyA)} · ${un(l.resultat.moyB)} sur 5 (${l.resultat.nA} et ${l.resultat.nB} jours)` : phraseAttente(l.resultat)}
          </Texte>
        </View>
      ))}
      <Texte style={{ color: t.textMuted, fontSize: typography.small, lineHeight: 17, marginTop: spacing.sm }}>
        Ce sont des repères sur tes propres notes, pas des explications.
      </Texte>
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  sousTitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  courbe: { flexDirection: "row", gap: 2, height: 80, alignItems: "flex-end", borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  colonne: { flex: 1, height: "100%", justifyContent: "flex-end" },
  lien: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});
