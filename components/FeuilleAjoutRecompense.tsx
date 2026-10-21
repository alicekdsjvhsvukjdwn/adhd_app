import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { IDEES_RECOMPENSES, type IdeeRecompense } from "../lib/catalogue-recompenses";
import { CATEGORIES_RECOMPENSES, type CategorieRecompense } from "../lib/recompenses-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { IconeRecompense } from "./IconeRecompense";
import { Texte } from "./Texte";

type Props = {
  /** null = fermée ; sinon l'étagère d'où on vient (ses propositions viennent en premier). */
  categorie: CategorieRecompense | null;
  /** Noms des récompenses déjà là. */
  existantes: string[];
  onCreer: (categorie: CategorieRecompense) => void;
  onAjouter: (idee: IdeeRecompense, categorie: CategorieRecompense) => Promise<void>;
  onFermer: () => void;
};

/** « + Ajouter » : créer la mienne, ou prendre une proposition en un tap. */
export function FeuilleAjoutRecompense({ categorie, existantes, onCreer, onAjouter, onFermer }: Props) {
  const t = useTheme();
  const [ajoutees, setAjoutees] = useState<Set<string>>(new Set());
  const cle = (nom: string) => nom.trim().toLowerCase();
  const deja = new Set([...existantes.map(cle), ...ajoutees]);
  const depart = categorie ?? "mer";
  const ordre = [...CATEGORIES_RECOMPENSES].sort((a, b) => Number(b.cle === depart) - Number(a.cle === depart));

  const ajouter = async (idee: IdeeRecompense, cat: CategorieRecompense) => {
    setAjoutees((s) => new Set(s).add(cle(idee.nom)));
    await onAjouter(idee, cat);
  };

  return (
    <Modal visible={categorie !== null} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Ajouter une récompense</Texte>
          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => onCreer(depart)}
              style={[styles.creer, { backgroundColor: t.accent }]}
              accessibilityRole="button"
            >
              <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Créer la mienne</Texte>
            </TouchableOpacity>

            {ordre.map((cat) => (
              <View key={cat.cle}>
                <View style={styles.groupe}>
                  <View style={[styles.point, { backgroundColor: cat.couleur }]} />
                  <Texte style={[styles.groupeTitre, { color: t.textPrimary }]}>{cat.nom}</Texte>
                </View>
                {cat.cle === "gros" ? (
                  <TouchableOpacity
                    onPress={() => onCreer("gros")}
                    style={[styles.ligne, { borderColor: cat.couleur }]}
                    accessibilityRole="button"
                  >
                    <Texte style={{ color: cat.couleur, fontWeight: "600", fontSize: typography.body }}>+ Créer un gros objectif</Texte>
                  </TouchableOpacity>
                ) : (
                  IDEES_RECOMPENSES[cat.cle].map((idee) => {
                    const faite = deja.has(cle(idee.nom));
                    return (
                      <View key={idee.nom} style={[styles.ligne, { borderColor: t.border }]}>
                        <IconeRecompense icone={idee.icone} couleur={cat.couleur} taille={22} />
                        <View style={{ flex: 1 }}>
                          <Texte style={{ color: t.textPrimary, fontSize: typography.body }} numberOfLines={2}>
                            {idee.nom}
                          </Texte>
                          <Texte style={{ color: cat.couleur, fontSize: typography.small, fontWeight: "600" }}>{idee.prix} pts</Texte>
                        </View>
                        <TouchableOpacity
                          onPress={() => ajouter(idee, cat.cle)}
                          disabled={faite}
                          hitSlop={8}
                          style={[styles.plus, faite ? { borderColor: t.border } : { backgroundColor: cat.couleur, borderColor: cat.couleur }]}
                          accessibilityRole="button"
                          accessibilityLabel={faite ? `${idee.nom} : déjà ajoutée` : `Ajouter ${idee.nom}`}
                        >
                          <Texte style={{ color: faite ? t.textMuted : t.bgApp, fontWeight: "700", fontSize: typography.small }}>
                            {faite ? "Ajoutée ✓" : "+"}
                          </Texte>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onFermer} hitSlop={8} style={styles.fermer}>
            <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Fermer</Texte>
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
  creer: { alignItems: "center", borderRadius: radius.md, paddingVertical: spacing.md },
  groupe: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg, marginBottom: spacing.sm },
  point: { width: 10, height: 10, borderRadius: 5 },
  groupeTitre: { fontSize: typography.body, fontWeight: "700" },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  plus: { minWidth: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  fermer: { alignSelf: "center", marginTop: spacing.lg },
});
