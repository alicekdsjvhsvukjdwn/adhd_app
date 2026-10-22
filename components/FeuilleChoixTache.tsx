import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { ChampTexte, Texte } from "./Texte";

export type TacheChoix = { itemId: number; nom: string; duree_min: number | null };

export type GroupeChoix = {
  titre: string;
  /** Couleur de la liste. */
  couleur: string;
  taches: TacheChoix[];
};

/** Créer une tâche directement dans l'emplacement : un titre, une liste, Entrée ; « Plus d'options » ouvre le formulaire complet. */
export type CreationChoix = {
  listes: { id: number; nom: string; couleur: string }[];
  /** Liste choisie au départ. */
  listeParDefaut: number | null;
  onCreer: (nom: string, listeId: number | null) => void;
  onPlusOptions: (nom: string, listeId: number | null) => void;
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
  /** En haut de la feuille : « Nouvelle tâche… ». */
  creation?: CreationChoix;
};

/** Feuille « Choisir » : un tap sur une tâche la met dans l'emplacement (ajout ou remplacement). */
export function FeuilleChoixTache({ visible, titre, suggestions, groupes, onChoisir, onFermer, creation }: Props) {
  const t = useTheme();
  const [nom, setNom] = useState("");
  const [liste, setListe] = useState<number | null | undefined>(undefined);
  const listeChoisie = liste === undefined ? (creation?.listeParDefaut ?? creation?.listes[0]?.id ?? null) : liste;
  const creer = () => {
    const n = nom.trim();
    if (!n || !creation) return;
    setNom("");
    setListe(undefined);
    creation.onCreer(n, listeChoisie);
  };
  const tout = [suggestions, ...groupes].filter((g) => g.taches.length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
          {creation && (
            <View style={styles.creation}>
              <ChampTexte
                value={nom}
                onChangeText={setNom}
                placeholder="Nouvelle tâche…"
                placeholderTextColor={t.textMuted}
                style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
                returnKeyType="done"
                onSubmitEditing={creer}
                accessibilityLabel="Nouvelle tâche"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles} keyboardShouldPersistTaps="handled">
                {creation.listes.map((l) => {
                  const actif = listeChoisie === l.id;
                  return (
                    <TouchableOpacity key={l.id} onPress={() => setListe(l.id)} style={[styles.liste, { borderColor: actif ? l.couleur : t.border, backgroundColor: actif ? l.couleur : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }} accessibilityLabel={`Liste ${l.nom}`}>
                      <Texte style={{ color: actif ? "#000" : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{l.nom}</Texte>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.creationBas}>
                <TouchableOpacity onPress={() => { const n = nom.trim(); setNom(""); creation.onPlusOptions(n, listeChoisie); }} hitSlop={8} accessibilityRole="button">
                  <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>Plus d&apos;options</Texte>
                </TouchableOpacity>
                <TouchableOpacity onPress={creer} disabled={!nom.trim()} style={[styles.creer, { backgroundColor: nom.trim() ? t.accent : t.border }]} accessibilityRole="button" accessibilityLabel="Créer et placer la tâche">
                  <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.small }}>Créer</Texte>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  creation: { marginBottom: spacing.sm },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  pastilles: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  liste: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  creationBas: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  creer: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
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
