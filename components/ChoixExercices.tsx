import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { faisable, filtrer } from "../lib/exercices";
import type { Materiel } from "../lib/materiel";
import { zone, type Zone } from "../lib/seances";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
import { ChampTexte, Texte } from "./Texte";

const ZONES: { cle: Zone; nom: string }[] = [
  { cle: "haut", nom: "Haut" },
  { cle: "bas", nom: "Bas" },
  { cle: "abdos", nom: "Abdos" },
  { cle: "mobilite", nom: "Mobilité" },
];

/** Feuille « Ajouter un exercice » : recherche, zones, un tap ajoute. Le matériel manquant est grisé. */
export function ChoixExercices({
  visible,
  materiel,
  onChoisir,
  onFermer,
}: {
  visible: boolean;
  materiel: Materiel;
  onChoisir: (id: string) => void;
  onFermer: () => void;
}) {
  const t = useTheme();
  const [texte, setTexte] = useState("");
  const [zoneChoisie, setZoneChoisie] = useState<Zone | null>(null);
  const liste = filtrer({ texte, zone: zoneChoisie }, materiel);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.fond} onPress={onFermer}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>Ajouter un exercice</Texte>
            <ChampTexte
              value={texte}
              onChangeText={setTexte}
              placeholder="Chercher un exercice ou un muscle"
              placeholderTextColor={t.textMuted}
              autoCapitalize="none"
              style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
            />
            <View style={styles.puces}>
              {ZONES.map((z) => {
                const actif = zoneChoisie === z.cle;
                return (
                  <TouchableOpacity
                    key={z.cle}
                    onPress={() => setZoneChoisie(actif ? null : z.cle)}
                    style={[styles.puce, { borderColor: actif ? zone(z.cle).couleur : t.border }, actif && { backgroundColor: zone(z.cle).couleur }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: actif }}
                  >
                    <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{z.nom}</Texte>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {liste.map((e) => {
                const ok = faisable(e, materiel);
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => ok && onChoisir(e.id)}
                    disabled={!ok}
                    style={[styles.ligne, { borderColor: t.border, opacity: ok ? 1 : 0.45 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${e.nom}${ok ? "" : ", matériel manquant"}`}
                  >
                    <FigureSkill skill={e.figure} couleur={zone(e.zones[0]).couleur} taille={36} />
                    <View style={{ flex: 1 }}>
                      <Texte style={{ color: t.textPrimary, fontSize: typography.body }} numberOfLines={1}>
                        {e.nom}
                      </Texte>
                      <Texte style={{ color: t.textMuted, fontSize: typography.tiny }}>
                        niveau {e.niveau}
                        {ok ? "" : " · matériel manquant"}
                      </Texte>
                    </View>
                    <Texte style={{ color: t.accentText, fontSize: 22 }}>＋</Texte>
                  </TouchableOpacity>
                );
              })}
              {liste.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Aucun exercice.</Texte>}
            </ScrollView>
            <TouchableOpacity onPress={onFermer} hitSlop={8} style={styles.fermer}>
              <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Fermer</Texte>
            </TouchableOpacity>
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
  puces: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, paddingVertical: spacing.sm },
  fermer: { alignSelf: "center", marginTop: spacing.lg },
});
