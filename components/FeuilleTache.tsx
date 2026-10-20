import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import type { Etape } from "../lib/db/etapes";
import type { Proposition } from "../lib/db/moteur";
import { LIBELLES_PRIORITE, libelleEcheance } from "../lib/regles-taches";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";
import { ChampTexte, Texte } from "./Texte";

type Props = {
  /** null = feuille fermée. */
  tache: Proposition | null;
  etapes: Etape[];
  /** Nom de la liste, avec son icône. */
  liste: string | null;
  couleur: string;
  /** Aujourd'hui, pour dire « demain », « dans 3 jours ». */
  jour: string;
  onFermer: () => void;
  onEtape: (e: Etape) => void;
  onTerminer: () => void;
  onAjouter: (nom: string) => Promise<void>;
  onModifier: () => void;
  onCommence: () => void;
  onHistorique: () => void;
};

/** Détail d'une tâche : étapes cochables, ajout rapide, terminer, modifier. */
export function FeuilleTache(p: Props) {
  const t = useTheme();
  const [nouvelle, setNouvelle] = useState("");
  const { tache } = p;

  const ajouter = async () => {
    const nom = nouvelle.trim();
    if (!nom) return;
    setNouvelle("");
    await p.onAjouter(nom);
  };

  const fermer = () => {
    setNouvelle("");
    p.onFermer();
  };

  return (
    <Modal visible={tache !== null} transparent animationType="slide" onRequestClose={fermer}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.fond} onPress={fermer}>
          {tache && (
            <Pressable
              style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}
            >
              <ScrollView keyboardShouldPersistTaps="handled">
                <Texte style={[styles.titre, { color: t.textPrimary }]}>{tache.nom}</Texte>
                <View style={styles.infos}>
                  {p.liste && (
                    <View style={styles.info}>
                      <View style={[styles.pastille, { backgroundColor: p.couleur }]} />
                      <Texte style={[styles.infoTexte, { color: t.textSecondary }]}>{p.liste}</Texte>
                    </View>
                  )}
                  <Texte style={[styles.infoTexte, { color: t.textSecondary }]}>
                    {tache.echeance ? libelleEcheance(tache.echeance, p.jour) : "Sans échéance"}
                  </Texte>
                  <Texte style={[styles.infoTexte, { color: t.textSecondary }]}>
                    Priorité {(LIBELLES_PRIORITE[tache.importance] ?? "Normale").toLowerCase()}
                  </Texte>
                </View>

                {p.etapes.length > 0 && (
                  <View style={styles.segments}>
                    {p.etapes.map((e) => (
                      <View
                        key={e.id}
                        style={[
                          styles.segment,
                          { backgroundColor: e.faite ? p.couleur : avecAlpha(p.couleur, 0.2) },
                        ]}
                      />
                    ))}
                  </View>
                )}
                {p.etapes.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.etape}
                    onPress={() => p.onEtape(e)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: e.faite === 1 }}
                  >
                    <View
                      style={[
                        styles.cercle,
                        {
                          borderColor: p.couleur,
                          backgroundColor: e.faite ? p.couleur : "transparent",
                        },
                      ]}
                    >
                      {e.faite ? <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>✓</Texte> : null}
                    </View>
                    <Texte
                      style={[
                        styles.etapeNom,
                        {
                          color: e.faite ? t.textMuted : t.textPrimary,
                          textDecorationLine: e.faite ? "line-through" : "none",
                        },
                      ]}
                    >
                      {e.nom}
                    </Texte>
                  </TouchableOpacity>
                ))}

                <View style={styles.ajout}>
                  <ChampTexte
                    style={[
                      styles.champ,
                      { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary },
                    ]}
                    placeholder="+ Ajouter une étape"
                    placeholderTextColor={t.textMuted}
                    value={nouvelle}
                    onChangeText={setNouvelle}
                    onSubmitEditing={ajouter}
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                </View>

                <View style={styles.boutons}>
                  <TouchableOpacity
                    style={[styles.bouton, { backgroundColor: t.accent }]}
                    onPress={p.onTerminer}
                  >
                    <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>C'est fait</Texte>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bouton, { borderColor: t.border, borderWidth: 1 }]}
                    onPress={p.onModifier}
                  >
                    <Texte style={[styles.boutonTexte, { color: t.textPrimary }]}>Modifier</Texte>
                  </TouchableOpacity>
                </View>
                <View style={styles.liens}>
                  <TouchableOpacity onPress={p.onCommence} hitSlop={8}>
                    <Texte style={[styles.lien, { color: t.accentText }]}>▶ Je commence</Texte>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={p.onHistorique} hitSlop={8}>
                    <Texte style={[styles.lien, { color: t.accentText }]}>Historique</Texte>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  titre: { fontSize: typography.h2, fontWeight: "700" },
  infos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  info: { flexDirection: "row", alignItems: "center", gap: 6 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  infoTexte: { fontSize: typography.small },
  segments: { flexDirection: "row", gap: 3, marginTop: spacing.lg },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  etape: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  cercle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  etapeNom: { flex: 1, fontSize: typography.body },
  ajout: { marginTop: spacing.sm },
  champ: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  boutons: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  bouton: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
  liens: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginTop: spacing.lg },
  lien: { fontSize: typography.small, fontWeight: "600" },
});
