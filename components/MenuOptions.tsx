import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import type { Option } from "./Options";
import { Texte } from "./Texte";

/** Menu d'actions ouvert par un appui long (iPhone, web et Expo Go). `options` vide : fermé. */
export function MenuOptions({
  titre,
  options,
  onFermer,
}: {
  titre: string;
  options: Option[];
  onFermer: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={options.length > 0} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.menu, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textMuted }]} numberOfLines={1}>
            {titre}
          </Texte>
          <ScrollView style={{ maxHeight: 380 }}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.libelle}
              style={[styles.ligne, { borderTopColor: t.border }]}
              onPress={() => {
                onFermer();
                o.onPress();
              }}
              accessibilityRole="button"
            >
              <Texte style={[styles.libelle, { color: o.danger ? t.danger : t.textPrimary }]}>{o.libelle}</Texte>
            </TouchableOpacity>
          ))}
          </ScrollView>
          <TouchableOpacity style={[styles.ligne, { borderTopColor: t.border }]} onPress={onFermer}>
            <Texte style={[styles.libelle, { color: t.textSecondary }]}>Fermer</Texte>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.xl },
  menu: { borderRadius: radius.lg, borderWidth: 1, paddingVertical: spacing.sm, maxWidth: 420, width: "100%", alignSelf: "center" },
  titre: { fontSize: typography.small, textAlign: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  ligne: { borderTopWidth: 1, paddingVertical: spacing.lg, alignItems: "center" },
  libelle: { fontSize: typography.body, fontWeight: "600" },
});
