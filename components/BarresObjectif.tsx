import { StyleSheet, Text, View } from "react-native";
import type { SuiviObjectif } from "../lib/db/listes";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const HAUTEUR = 64;
/** Hauteur des étiquettes sous les barres (14 + 2 de marge). */
const SOUS_BARRES = 16;
const MOIS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

const etiquette = (debut: string, periode: "semaine" | "mois") =>
  periode === "mois"
    ? MOIS[Number(debut.slice(5, 7)) - 1]
    : `${Number(debut.slice(8))}/${Number(debut.slice(5, 7))}`;

/**
 * Objectif d'une liste : une barre par période (8 semaines ou 6 mois),
 * la ligne d'objectif, et les périodes d'affilée où il est atteint.
 */
export function BarresObjectif({
  suivi,
  titre,
  couleur,
}: {
  suivi: SuiviObjectif;
  titre?: string;
  /** Couleur de la liste ; sinon l'accent. */
  couleur?: string;
}) {
  const t = useTheme();
  const max = Math.max(suivi.cible, ...suivi.periodes.map((p) => p.fait), 1);
  const enCours = suivi.periodes[suivi.periodes.length - 1];
  const unite = suivi.periode === "semaine" ? "semaine" : "mois";
  const accessible = suivi.periodes.map((p) => p.fait).join(", ");

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <Text style={[styles.titre, { color: t.textPrimary }]}>
        {titre ? `${titre} · ` : ""}
        {suivi.cible} par {unite}
      </Text>
      <Text style={[styles.sous, { color: t.textSecondary }]}>
        {enCours.fait}/{suivi.cible} {suivi.periode === "semaine" ? "cette semaine" : "ce mois-ci"}
        {suivi.serie > 0
          ? ` · atteint ${suivi.serie} ${suivi.periode === "semaine" ? "semaine" : "mois"}${suivi.serie > 1 && suivi.periode === "semaine" ? "s" : ""} d'affilée`
          : ""}
      </Text>

      <View
        style={styles.graphique}
        accessible
        accessibilityLabel={`Tâches faites par ${unite}, de la plus ancienne à la plus récente : ${accessible}. Objectif ${suivi.cible}.`}
      >
        <View
          style={[
            styles.ligneObjectif,
            { bottom: SOUS_BARRES + (suivi.cible / max) * HAUTEUR, borderColor: t.textMuted },
          ]}
        />
        {suivi.periodes.map((p) => {
          const atteint = p.fait >= suivi.cible;
          return (
            <View key={p.debut} style={styles.colonne}>
              <View style={{ height: HAUTEUR, justifyContent: "flex-end" }}>
                <View
                  style={{
                    height: Math.max(2, (p.fait / max) * HAUTEUR),
                    borderRadius: 3,
                    backgroundColor: couleur ?? (atteint ? t.success : t.accent),
                    // Atteint : plein ; pas (encore) atteint : atténué.
                    opacity: atteint ? 1 : 0.45,
                  }}
                />
              </View>
              <Text style={[styles.etiquette, { color: t.textMuted }]}>
                {etiquette(p.debut, suivi.periode)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  titre: { fontSize: typography.body, fontWeight: "600" },
  sous: { fontSize: typography.small, marginTop: 2, marginBottom: spacing.md },
  graphique: { flexDirection: "row", gap: 6, alignItems: "flex-end" },
  ligneObjectif: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  colonne: { flex: 1, alignItems: "stretch" },
  etiquette: { fontSize: 10, textAlign: "center", marginTop: 2, height: 14 },
});
