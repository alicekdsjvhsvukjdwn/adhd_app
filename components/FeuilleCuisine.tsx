import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { NIVEAUX, type Baisse } from "../lib/cuisine-regles";
import { baissesDeLaRecette, jAiCuisine } from "../lib/db/cuisine-courses";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const nomNiveau = (n: string) => NIVEAUX.find((x) => x.cle === n)?.nom.toLowerCase() ?? n;

/**
 * « J'ai cuisiné » : propose de mettre l'inventaire à jour (ce que la recette a utilisé baisse d'un cran),
 * je confirme ligne par ligne, puis le repas est gardé (+5 points, une fois par jour).
 */
export function FeuilleCuisine({ recetteId, portions, visible, onFerme }: { recetteId: number; portions: number; visible: boolean; onFerme: () => void }) {
  const t = useTheme();
  const [baisses, setBaisses] = useState<Baisse[]>([]);
  const [gardees, setGardees] = useState<number[]>([]);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    baissesDeLaRecette(recetteId).then((b) => {
      setPoints(null);
      setBaisses(b);
      setGardees(b.map((x) => x.alimentId));
    });
  }, [visible, recetteId]);

  const valider = async () => {
    setPoints(await jAiCuisine(recetteId, portions, baisses.filter((b) => gardees.includes(b.alimentId))));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFerme}>
      <Pressable style={styles.fond} onPress={onFerme}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {points === null ? (
            <>
              <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600" }}>J&apos;ai cuisiné</Texte>
              {baisses.length > 0 ? (
                <>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 2 }}>Mettre l&apos;inventaire à jour ? Décoche ce qui n&apos;a pas bougé.</Texte>
                  <ScrollView style={{ maxHeight: 320, marginTop: spacing.md }}>
                    {baisses.map((b) => {
                      const coche = gardees.includes(b.alimentId);
                      return (
                        <TouchableOpacity
                          key={b.alimentId}
                          onPress={() => setGardees((g) => (coche ? g.filter((x) => x !== b.alimentId) : [...g, b.alimentId]))}
                          style={[styles.ligne, { borderColor: coche ? t.accent : t.border }]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: coche }}
                        >
                          <View style={[styles.case, { borderColor: coche ? t.accent : t.border, backgroundColor: coche ? t.accent : "transparent" }]} />
                          <View style={{ flex: 1 }}>
                            <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{b.nom}</Texte>
                            <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                              {nomNiveau(b.de)} → {nomNiveau(b.vers)}
                            </Texte>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : (
                <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.sm }}>Rien à mettre à jour dans ton inventaire. Le repas est quand même noté.</Texte>
              )}
              <View style={styles.boutons}>
                <TouchableOpacity onPress={onFerme} hitSlop={8}>
                  <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
                </TouchableOpacity>
                <TouchableOpacity onPress={valider} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
                  <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Valider</Texte>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600" }}>C&apos;est noté</Texte>
              <Texte style={{ color: t.textSecondary, fontSize: typography.body, marginTop: spacing.sm }}>{points > 0 ? `+${points} points. Bon appétit !` : "Bon appétit !"}</Texte>
              <TouchableOpacity onPress={onFerme} style={[styles.valider, { backgroundColor: t.accent, alignSelf: "flex-start", marginTop: spacing.lg }]} accessibilityRole="button">
                <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Fermer</Texte>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  case: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
