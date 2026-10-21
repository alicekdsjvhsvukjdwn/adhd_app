import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

export type CandidatChoix = {
  itemId: number;
  nom: string;
  /** Couleur de la liste. */
  couleur: string;
  listeNom: string | null;
  duree_min: number | null;
};

type Props = {
  visible: boolean;
  titre: string;
  candidats: CandidatChoix[];
  max: number;
  initial: number[];
  onValider: (ids: number[]) => void;
  onFermer: () => void;
};

/** Feuille « Choisis tes 3 » : jusqu'à `max` tâches, les mieux placées par le moteur en premier. */
export function FeuilleChoixTrois(props: Props) {
  // Montée à l'ouverture seulement : le choix repart du choix enregistré à chaque fois.
  return props.visible ? <Feuille {...props} /> : null;
}

function Feuille({ titre, candidats, max, initial, onValider, onFermer }: Props) {
  const t = useTheme();
  const [choisis, setChoisis] = useState<number[]>(initial);

  const basculer = (id: number) =>
    setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < max ? [...c, id] : c));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
          <Texte style={[styles.sous, { color: t.textMuted }]}>
            {choisis.length}/{max} · les mieux placées d&apos;abord
          </Texte>
          <ScrollView style={{ maxHeight: 380 }}>
            {candidats.length === 0 && (
              <Texte style={[styles.sous, { color: t.textMuted }]}>Aucune tâche à choisir pour l&apos;instant.</Texte>
            )}
            {candidats.map((c) => {
              const rang = choisis.indexOf(c.itemId);
              const coche = rang >= 0;
              return (
                <TouchableOpacity
                  key={c.itemId}
                  onPress={() => basculer(c.itemId)}
                  style={[styles.ligne, { borderColor: coche ? t.accent : t.border, borderLeftColor: c.couleur }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: coche }}
                >
                  <View style={[styles.case, { borderColor: coche ? t.accent : t.textMuted, backgroundColor: coche ? t.accent : "transparent" }]}>
                    {coche && <Texte style={{ color: t.textOnAccent, fontSize: 12, fontWeight: "700" }}>{rang + 1}</Texte>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texte style={{ color: t.textPrimary, fontSize: typography.body }} numberOfLines={2}>
                      {c.nom}
                    </Texte>
                    <Texte style={{ color: t.textMuted, fontSize: typography.tiny }}>
                      {[c.listeNom, c.duree_min ? `${c.duree_min} min` : null].filter(Boolean).join(" · ")}
                    </Texte>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.boutons}>
            <TouchableOpacity onPress={onFermer} hitSlop={8}>
              <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onValider(choisis)}
              style={[styles.valider, { backgroundColor: t.accent }]}
              accessibilityRole="button"
            >
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
  sous: { fontSize: typography.small, marginTop: 2, marginBottom: spacing.md },
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
  case: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
