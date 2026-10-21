import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { libelleFrequence } from "../lib/menage-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { PlusMoins } from "./PlusMoins";
import { ChampTexte, Texte } from "./Texte";

export type SaisieMenage = { type: "piece" | "tache"; id?: number; nom: string; freq: number } | null;

const RACCOURCIS: [number, string][] = [
  [1, "Chaque jour"],
  [2, "2 jours"],
  [3, "3 jours"],
  [7, "Semaine"],
  [14, "2 semaines"],
  [30, "Mois"],
];

/** Formulaire d'une pièce (le nom) ou d'une tâche de ménage (le nom et la fréquence). */
export function FeuilleMenage({
  saisie,
  onEnregistrer,
  onFermer,
}: {
  saisie: SaisieMenage;
  onEnregistrer: (s: NonNullable<SaisieMenage>) => void;
  onFermer: () => void;
}) {
  // Montée à l'ouverture seulement : le formulaire repart de la saisie reçue à chaque fois.
  return saisie ? <Formulaire saisie={saisie} onEnregistrer={onEnregistrer} onFermer={onFermer} /> : null;
}

function Formulaire({
  saisie,
  onEnregistrer,
  onFermer,
}: {
  saisie: NonNullable<SaisieMenage>;
  onEnregistrer: (s: NonNullable<SaisieMenage>) => void;
  onFermer: () => void;
}) {
  const t = useTheme();
  const [nom, setNom] = useState(saisie.nom);
  const [freq, setFreq] = useState(saisie.freq);
  const tache = saisie.type === "tache";
  const valide = nom.trim().length > 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.fond} onPress={onFermer}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>
              {saisie.id ? "Modifier" : "Ajouter"} {tache ? "une tâche" : "une pièce"}
            </Texte>
            <ChampTexte
              value={nom}
              onChangeText={setNom}
              placeholder={tache ? "Ex : passer l'aspirateur" : "Ex : balcon"}
              placeholderTextColor={t.textMuted}
              autoFocus
              style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
            />
            {tache && (
              <>
                <Texte style={[styles.etiquette, { color: t.textMuted }]}>ÇA REVIENT</Texte>
                <View style={styles.rangee}>
                  {RACCOURCIS.map(([n, libelle]) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setFreq(n)}
                      style={[styles.puce, { borderColor: t.border }, freq === n && { backgroundColor: t.accentFonce }]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: freq === n }}
                    >
                      <Texte style={{ color: freq === n ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small }}>
                        {libelle}
                      </Texte>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.plusMoins}>
                  <PlusMoins
                    valeur={`${freq} j`}
                    libelle="Fréquence en jours"
                    onPas={(sens) => setFreq((f) => Math.min(365, Math.max(1, f + sens)))}
                  />
                  <Texte style={{ color: t.textSecondary, fontSize: typography.small, flex: 1 }}>{libelleFrequence(freq)}</Texte>
                </View>
              </>
            )}
            <View style={styles.boutons}>
              <TouchableOpacity onPress={onFermer} hitSlop={8}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => valide && onEnregistrer({ ...saisie, nom: nom.trim(), freq })}
                disabled={!valide}
                style={[styles.valider, { backgroundColor: t.accent, opacity: valide ? 1 : 0.4 }]}
                accessibilityRole="button"
              >
                <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer</Texte>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  etiquette: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  rangee: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  plusMoins: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
