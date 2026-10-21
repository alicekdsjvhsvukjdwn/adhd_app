import { useState } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { decalerJours } from "../lib/dates";
import { hhmmDe, minutesDe } from "../lib/suivi-regles";
import { dateCourte } from "../lib/tcc-resume";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { PlusMoins } from "./PlusMoins";
import { Texte } from "./Texte";

/** Choisir la date et l'heure d'une séance de TCC : des « − / + » plutôt qu'un calendrier. */
export function FeuilleSeance(props: {
  visible: boolean;
  aujourdhui: string;
  onValider: (date: string, heure: string) => void;
  onFermer: () => void;
}) {
  // Montée à l'ouverture seulement : elle repart d'une séance dans une semaine, 14:00.
  return props.visible ? <Feuille {...props} /> : null;
}

function Feuille({ aujourdhui, onValider, onFermer }: { aujourdhui: string; onValider: (date: string, heure: string) => void; onFermer: () => void }) {
  const t = useTheme();
  const [date, setDate] = useState(decalerJours(aujourdhui, 7));
  const [heure, setHeure] = useState("14:00");

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Prochaine séance</Texte>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>LE JOUR</Texte>
          <View style={styles.ligne}>
            <PlusMoins
              valeur={dateCourte(date)}
              libelle="Jour de la séance"
              onPas={(sens) => setDate((d) => (decalerJours(d, sens) < aujourdhui ? d : decalerJours(d, sens)))}
            />
            <TouchableOpacity onPress={() => setDate((d) => decalerJours(d, 7))} hitSlop={8}>
              <Texte style={{ color: t.accentText, fontSize: typography.small }}>+ 1 semaine</Texte>
            </TouchableOpacity>
          </View>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>L&apos;HEURE</Texte>
          <PlusMoins valeur={heure} libelle="Heure de la séance" onPas={(sens) => setHeure((h) => hhmmDe(minutesDe(h) + sens * 15))} />
          <View style={styles.boutons}>
            <TouchableOpacity onPress={onFermer} hitSlop={8}>
              <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onValider(date, heure)} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
              <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer</Texte>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  titre: { fontSize: typography.h2, fontWeight: "600" },
  etiquette: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
