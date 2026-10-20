import { useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";
import type { Option } from "./Options";

export type { Option };

/**
 * Bouton « ⋯ » qui ouvre la liste des actions d'une carte. Sur iPhone, le
 * glisser de côté marche mal dans Safari : ce bouton est toujours là.
 */
export function BoutonOptions({
  options,
  titre,
  style,
}: {
  options: Option[];
  titre?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOuvert(true)}
        hitSlop={6}
        style={[styles.bouton, style]}
        accessibilityRole="button"
        accessibilityLabel="Plus d'actions"
      >
        <Texte style={{ color: t.textMuted, fontSize: 22, lineHeight: 24 }}>⋯</Texte>
      </TouchableOpacity>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.fond} onPress={() => setOuvert(false)}>
          <Pressable style={[styles.menu, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            {titre ? (
              <Texte style={[styles.titre, { color: t.textMuted }]} numberOfLines={1}>
                {titre}
              </Texte>
            ) : null}
            {options.map((o) => (
              <TouchableOpacity
                key={o.libelle}
                style={[styles.ligne, { borderTopColor: t.border }]}
                onPress={() => {
                  setOuvert(false);
                  o.onPress();
                }}
              >
                <Texte style={[styles.libelle, { color: o.danger ? t.danger : t.textPrimary }]}>
                  {o.libelle}
                </Texte>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.ligne, { borderTopColor: t.border }]}
              onPress={() => setOuvert(false)}
            >
              <Texte style={[styles.libelle, { color: t.textSecondary }]}>Fermer</Texte>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Web : la carte et, à sa droite, le bouton « ⋯ » (pas de glisser). */
export function Glissable({
  options,
  titre,
  children,
}: {
  renderRightActions?: () => ReactNode;
  options: Option[];
  titre?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.rangee}>
      <View style={{ flex: 1 }}>{children}</View>
      <BoutonOptions options={options} titre={titre} style={styles.cote} />
    </View>
  );
}

const styles = StyleSheet.create({
  bouton: { minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" },
  cote: { marginLeft: 2 },
  rangee: { flexDirection: "row", alignItems: "center" },
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.xl },
  menu: { borderRadius: radius.lg, borderWidth: 1, paddingVertical: spacing.sm, maxWidth: 420, width: "100%", alignSelf: "center" },
  titre: { fontSize: typography.small, textAlign: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  ligne: { borderTopWidth: 1, paddingVertical: spacing.lg, alignItems: "center" },
  libelle: { fontSize: typography.body, fontWeight: "600" },
});
