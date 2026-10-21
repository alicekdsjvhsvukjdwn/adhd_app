import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

export type TacheChoix = { itemId: number; nom: string; duree_min: number | null };

export type GroupeChoix = {
  titre: string;
  /** Couleur de la liste. */
  couleur: string;
  taches: TacheChoix[];
};

type Props = {
  visible: boolean;
  titre: string;
  /** Les suggestions du moteur, en premier. */
  suggestions: GroupeChoix;
  /** Toutes les autres tâches à faire, groupées par liste. */
  groupes: GroupeChoix[];
  onChoisir: (itemId: number) => void;
  onFermer: () => void;
};

/** Feuille « Choisir » : un tap sur une tâche la met dans l'emplacement (ajout ou remplacement). */
export function FeuilleChoixTache({ visible, titre, suggestions, groupes, onChoisir, onFermer }: Props) {
  const t = useTheme();
  const tout = [suggestions, ...groupes].filter((g) => g.taches.length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
          <ScrollView style={{ maxHeight: 460 }}>
            {tout.length === 0 && (
              <Texte style={[styles.vide, { color: t.textMuted }]}>Aucune tâche à choisir pour l&apos;instant.</Texte>
            )}
            {tout.map((g, i) => (
              <View key={`${i}-${g.titre}`}>
                <View style={styles.groupe}>
                  <View style={[styles.pastille, { backgroundColor: g.couleur }]} />
                  <Texte style={[styles.groupeTitre, { color: t.textMuted }]}>{g.titre.toUpperCase()}</Texte>
                </View>
                {g.taches.map((c) => (
                  <TouchableOpacity
                    key={c.itemId}
                    onPress={() => onChoisir(c.itemId)}
                    style={[styles.ligne, { borderColor: t.border, borderLeftColor: g.couleur }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Choisir ${c.nom}`}
                  >
                    <Texte style={{ color: t.textPrimary, fontSize: typography.body, flex: 1 }} numberOfLines={2}>
                      {c.nom}
                    </Texte>
                    {c.duree_min ? (
                      <Texte style={{ color: t.textMuted, fontSize: typography.tiny }}>{c.duree_min} min</Texte>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onFermer} hitSlop={8} style={styles.annuler}>
            <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  vide: { fontSize: typography.small, marginVertical: spacing.md },
  groupe: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, marginBottom: spacing.sm },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  groupeTitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 0.5 },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  annuler: { alignSelf: "center", marginTop: spacing.lg },
});
