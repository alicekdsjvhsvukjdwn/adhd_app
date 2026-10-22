import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ajouterEntree, basculerEtape, listerEtapes } from "../lib/db/projets";
import { choisirPhotos } from "../lib/photos";
import { etapesFeuilles, etapesOrdonnees, libelleDuree, type EtapeProjet } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { ChampTexte, Texte } from "./Texte";

/**
 * « J'ai avancé » : après une séance (ou quand je le dis), deux appuis : cocher ce qui est fait, une photo, une ligne.
 * `minutes` : le temps de la séance si elle vient du minuteur. Tout est facultatif.
 */
export function FeuilleAvance({ projetId, minutes, visible, onFerme }: { projetId: number; minutes: number; visible: boolean; onFerme: () => void }) {
  const t = useTheme();
  const [etapes, setEtapes] = useState<EtapeProjet[]>([]);
  const [cochees, setCochees] = useState<number[]>([]);
  const [photo, setPhoto] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    listerEtapes(projetId).then((e) => {
      setEtapes(e);
      setCochees([]);
      setPhoto("");
      setNote("");
    });
  }, [visible, projetId]);

  const feuilles = new Set(etapesFeuilles(etapes).map((e) => e.id));
  const afaire = etapesOrdonnees(etapes).filter((e) => feuilles.has(e.id) && e.faite === 0);

  const enregistrer = async () => {
    for (const id of cochees) await basculerEtape(id, true);
    if (minutes > 0 || note.trim() || photo) await ajouterEntree(projetId, { note, minutes, photos: photo ? [photo] : [] });
    onFerme();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFerme}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.fond} onPress={onFerme}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600" }}>J&apos;ai avancé</Texte>
            {minutes > 0 && <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 2 }}>{libelleDuree(minutes)} ajoutées au journal</Texte>}
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {afaire.length > 0 && <Texte style={[styles.etiquette, { color: t.textMuted }]}>CE QUI EST FAIT</Texte>}
              {afaire.map((e) => {
                const coche = cochees.includes(e.id);
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setCochees((c) => (coche ? c.filter((x) => x !== e.id) : [...c, e.id]))}
                    style={[styles.ligne, { borderColor: coche ? t.accent : t.border }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: coche }}
                  >
                    <View style={[styles.case, { borderColor: coche ? t.accent : t.border, backgroundColor: coche ? t.accent : "transparent" }]} />
                    <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{e.nom}</Texte>
                  </TouchableOpacity>
                );
              })}
              <Texte style={[styles.etiquette, { color: t.textMuted }]}>UNE PHOTO, UNE LIGNE (FACULTATIF)</Texte>
              {photo ? (
                <TouchableOpacity onPress={() => setPhoto("")} accessibilityLabel="Retirer la photo">
                  <Image source={{ uri: photo }} style={styles.apercu} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={async () => {
                    const [p] = await choisirPhotos(1);
                    if (p) setPhoto(p);
                  }}
                  style={[styles.bouton, { borderColor: t.border }]}
                  accessibilityRole="button"
                >
                  <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>Ajouter une photo</Texte>
                </TouchableOpacity>
              )}
              <ChampTexte
                value={note}
                onChangeText={setNote}
                placeholder="Une ligne sur ce que j'ai fait"
                placeholderTextColor={t.textMuted}
                style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
                accessibilityLabel="Une ligne sur ce que j'ai fait"
              />
            </ScrollView>
            <View style={styles.boutons}>
              <TouchableOpacity onPress={onFerme} hitSlop={8}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Passer</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={enregistrer} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
                <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Enregistrer</Texte>
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
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  case: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  apercu: { width: "100%", height: 140, borderRadius: radius.md },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, marginTop: spacing.md },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
