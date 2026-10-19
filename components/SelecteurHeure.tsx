import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { hhmmMaintenant, minutesDe } from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const RACCOURCIS: { libelle: string; min: number }[] = [
  { libelle: "Maintenant", min: 0 },
  { libelle: "il y a 15 min", min: 15 },
  { libelle: "il y a 30 min", min: 30 },
  { libelle: "il y a 1 h", min: 60 },
];

/** « 23:40 » → une Date du jour à cette heure (seules heures et minutes comptent). */
const versDate = (hhmm: string) => {
  const d = new Date();
  d.setHours(Math.floor(minutesDe(hhmm) / 60), minutesDe(hhmm) % 60, 0, 0);
  return d;
};

/**
 * Feuille du bas pour choisir une heure : raccourcis (maintenant, il y a
 * 15 / 30 min, 1 h), roue par pas de 5 min, Valider. Sur Android la roue
 * est une fenêtre système : elle s'ouvre d'un tap sur l'heure.
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

  const roueAndroid = () =>
    DateTimePickerAndroid.open({
      value: versDate(valeur),
      mode: "time",
      display: "spinner",
      is24Hour: true,
      minuteInterval: 5,
      onValueChange: (_, d) => setValeur(hhmmMaintenant(d)),
    });

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
        {Platform.OS === "ios" ? (
          <DateTimePicker
            value={versDate(valeur)}
            mode="time"
            display="spinner"
            minuteInterval={5}
            is24Hour
            locale="fr-FR"
            themeVariant="dark"
            onValueChange={(_, d) => setValeur(hhmmMaintenant(d))}
            style={styles.roue}
          />
        ) : (
          <TouchableOpacity onPress={roueAndroid} accessibilityLabel={`Changer l'heure, ${valeur}`}>
            <Texte style={[styles.heure, { color: t.textPrimary }]}>{valeur}</Texte>
            <Texte style={[styles.aide, { color: t.textMuted }]}>Toucher l&apos;heure pour la changer</Texte>
          </TouchableOpacity>
        )}
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
  roue: { alignSelf: "center", marginTop: spacing.sm },
  heure: { fontSize: 48, fontWeight: "600", textAlign: "center", marginTop: spacing.lg },
  aide: { fontSize: typography.tiny, textAlign: "center" },
  valider: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.lg },
  validerTexte: { fontSize: typography.body, fontWeight: "700" },
});
