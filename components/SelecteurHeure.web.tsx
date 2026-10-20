import { createElement, useState } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { hhmmMaintenant } from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const RACCOURCIS: { libelle: string; min: number }[] = [
  { libelle: "Maintenant", min: 0 },
  { libelle: "il y a 15 min", min: 15 },
  { libelle: "il y a 30 min", min: 30 },
  { libelle: "il y a 1 h", min: 60 },
];

/**
 * Version web du sélecteur d'heure : mêmes raccourcis et même feuille du bas,
 * mais l'heure se choisit avec le champ « time » du navigateur (sombre).
 */
export function SelecteurHeure({
  visible,
  titre,
  heure,
  onValider,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  heure: string;
  onValider: (hhmm: string) => void;
  onFermer: () => void;
}) {
  const t = useTheme();
  const [valeur, setValeur] = useState(heure);

  // Chaque ouverture (ou nouvelle question) repart de l'heure proposée.
  const cle = visible ? `${titre}|${heure}` : "";
  const [cleAvant, setCleAvant] = useState(cle);
  if (cle !== cleAvant) {
    setCleAvant(cle);
    if (visible) setValeur(heure);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer} accessibilityLabel="Fermer" />
      <View style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <View style={[styles.poignee, { backgroundColor: t.border }]} />
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
        <View style={styles.pastilles}>
          {RACCOURCIS.map((r) => (
            <TouchableOpacity
              key={r.libelle}
              onPress={() => setValeur(hhmmMaintenant(new Date(Date.now() - r.min * 60_000)))}
              style={[styles.pastille, { borderColor: t.border, backgroundColor: t.bgApp }]}
            >
              <Texte style={[styles.pastilleTexte, { color: t.textSecondary }]}>{r.libelle}</Texte>
            </TouchableOpacity>
          ))}
        </View>
        {createElement("input", {
          type: "time",
          value: valeur,
          step: 300,
          "aria-label": "Heure",
          onChange: (e: { target: { value: string } }) => e.target.value && setValeur(e.target.value),
          style: {
            alignSelf: "center",
            marginTop: 16,
            fontSize: 40,
            fontFamily: "inherit",
            textAlign: "center",
            color: t.textPrimary,
            backgroundColor: t.bgApp,
            border: `1px solid ${t.border}`,
            borderRadius: radius.md,
            padding: "8px 16px",
            colorScheme: "dark",
          },
        })}
        <TouchableOpacity
          onPress={() => onValider(valeur)}
          style={[styles.valider, { backgroundColor: t.accent }]}
        >
          <Texte style={[styles.validerTexte, { color: t.textOnAccent }]}>Valider</Texte>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: {
    borderTopLeftRadius: radius.lg * 2,
    borderTopRightRadius: radius.lg * 2,
    borderWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  poignee: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.lg },
  titre: { fontSize: typography.h3, fontWeight: "600", textAlign: "center" },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center", marginTop: spacing.lg },
  pastille: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  pastilleTexte: { fontSize: typography.small, fontWeight: "600" },
  valider: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.lg },
  validerTexte: { fontSize: typography.body, fontWeight: "700" },
});
