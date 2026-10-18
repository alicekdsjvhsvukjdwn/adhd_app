import { useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte, ChampTexte } from "./Texte";
import { enregistrerNote, type Note } from "../lib/db/carnet";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const CHAMPS: { cle: keyof Note; libelle: string; exemple: string; lignes?: boolean }[] = [
  { cle: "fait", libelle: "Ce que j'ai fait", exemple: "Ex : appelé, rendez-vous pris" },
  { cle: "retenu", libelle: "Ce que j'en retiens", exemple: "Ex : plus simple le matin" },
  { cle: "idees", libelle: "Idées (une par ligne)", exemple: "Ex : préparer les papiers", lignes: true },
];

/**
 * Note facultative sur une tâche faite. Ne bloque rien, ne rapporte rien :
 * « Plus tard » ferme sans rien écrire.
 */
export function ZoneNote({
  itemId,
  date,
  initiale,
  titre,
  onFerme,
}: {
  itemId: number;
  date: string;
  initiale?: Note;
  titre?: string;
  onFerme: (enregistree: boolean) => void;
}) {
  const t = useTheme();
  const [note, setNote] = useState<Note>(
    initiale ?? { fait: null, retenu: null, idees: null },
  );
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await enregistrerNote(itemId, date, note);
      onFerme(true);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View style={[styles.zone, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      {titre ? <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte> : null}
      {CHAMPS.map((c) => (
        <View key={c.cle}>
          <Texte style={[styles.libelle, { color: t.textSecondary }]}>{c.libelle}</Texte>
          <ChampTexte
            style={[
              styles.champ,
              { borderColor: t.border, color: t.textPrimary, backgroundColor: t.bgApp },
              c.lignes && { minHeight: 56, textAlignVertical: "top" },
            ]}
            value={note[c.cle] ?? ""}
            onChangeText={(v) => setNote({ ...note, [c.cle]: v })}
            placeholder={c.exemple}
            placeholderTextColor={t.textMuted}
            multiline={c.lignes}
            maxLength={500}
            accessibilityLabel={c.libelle}
          />
        </View>
      ))}
      <View style={styles.boutons}>
        <TouchableOpacity onPress={() => onFerme(false)} hitSlop={8} disabled={enCours}>
          <Texte style={[styles.plusTard, { color: t.textMuted }]}>Plus tard</Texte>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: t.accent }]}
          onPress={enregistrer}
          disabled={enCours}
        >
          <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Enregistrer</Texte>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  titre: { fontSize: typography.body, fontWeight: "600", marginBottom: 4 },
  libelle: { fontSize: typography.small, fontWeight: "600", marginTop: spacing.sm, marginBottom: 4 },
  champ: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: typography.bodySmall,
  },
  boutons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  plusTard: { fontSize: typography.bodySmall, fontWeight: "600" },
  bouton: { borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.lg },
  boutonTexte: { fontSize: typography.bodySmall, fontWeight: "700" },
});
