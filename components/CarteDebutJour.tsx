import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { definirDebutJour, getDebutJour } from "../lib/dates";
import { initialiserBase } from "../lib/db/demarrage";
import { ecrireMeta, lireMeta } from "../lib/db/meta";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const HEURES = [4, 5, 6, 7, 8];

/** Profil : à quelle heure la journée de l'appli commence (avant, ça compte encore pour la veille). */
export function CarteDebutJour() {
  const t = useTheme();
  const [heure, setHeure] = useState(getDebutJour());

  useEffect(() => {
    initialiserBase()
      .then(() => lireMeta("debut_jour"))
      .then((v) => {
        definirDebutJour(Number(v));
        setHeure(getDebutJour());
      })
      .catch(() => {});
  }, []);

  const choisir = (h: number) => {
    definirDebutJour(h);
    setHeure(h);
    ecrireMeta("debut_jour", String(h)).catch(() => {});
  };

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Début de la journée</Texte>
      <Texte style={[styles.texte, { color: t.textSecondary }]}>
        Avant cette heure, tout compte encore pour la veille.
      </Texte>
      <View style={styles.rangee}>
        {HEURES.map((h) => (
          <TouchableOpacity
            key={h}
            onPress={() => choisir(h)}
            style={[styles.puce, { borderColor: t.border }, h === heure && { backgroundColor: t.accentFonce }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: h === heure }}
          >
            <Texte style={{ color: h === heure ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small }}>
              {h} h
            </Texte>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  titre: { fontSize: typography.h3, fontWeight: "600", marginBottom: 4 },
  texte: { fontSize: typography.small, lineHeight: 19, marginBottom: spacing.md },
  rangee: { flexDirection: "row", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
});
