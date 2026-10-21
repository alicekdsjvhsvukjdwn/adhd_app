import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Curseur } from "../components/Curseur";
import { Texte } from "../components/Texte";
import { listerPensees, majPensee, supprimerPensee, type Pensee } from "../lib/db/esprit";
import { situationDepuisPensee } from "../lib/db/tcc";
import { dateCourte, emotionsDe } from "../lib/esprit-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Mon journal : les pensées notées, filtrables par émotion. Aucun point, aucun conseil. */
export default function Journal() {
  const router = useRouter();
  const t = useTheme();
  const [toutes, setToutes] = useState<Pensee[]>([]);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<number | null>(null);

  const charger = useCallback(async () => setToutes(await listerPensees()), []);
  const tester = async (e: Pensee) => {
    setOuverte(null);
    router.push(`/exposition?situation=${await situationDepuisPensee(e)}` as never);
  };
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const emotions = [...new Set(toutes.flatMap((p) => emotionsDe(p.emotions)))].sort((a, b) => a.localeCompare(b, "fr"));
  const liste = filtre ? toutes.filter((p) => emotionsDe(p.emotions).includes(filtre)) : toutes;
  const p = toutes.find((x) => x.id === ouverte) ?? null;

  const changer = async (patch: Partial<Pensee>) => {
    if (!p) return;
    await majPensee(p.id, patch);
    await charger();
  };

  const supprimer = () => {
    if (!p) return;
    Alert.alert("Supprimer cette entrée ?", "Elle ne pourra pas être récupérée.", [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimerPensee(p.id);
          setOuverte(null);
          await charger();
        },
      },
    ]);
  };

  const champ = (titre: string, texte: string) =>
    texte ? (
      <View style={{ marginBottom: spacing.md }}>
        <Texte style={[styles.etiquette, { color: t.textMuted }]}>{titre}</Texte>
        <Texte style={{ color: t.textPrimary, fontSize: typography.body, lineHeight: 22 }}>{texte}</Texte>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={styles.ecran}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <View style={styles.entete}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Mon journal</Texte>
          <TouchableOpacity onPress={() => router.push("/pensee" as never)} style={[styles.plus, { backgroundColor: t.accent }]} accessibilityRole="button" accessibilityLabel="Noter une pensée">
            <Texte style={{ color: t.textOnAccent, fontSize: 26, lineHeight: 30 }}>+</Texte>
          </TouchableOpacity>
        </View>

        {emotions.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtres}>
            {[null, ...emotions].map((e) => (
              <TouchableOpacity
                key={e ?? "toutes"}
                onPress={() => setFiltre(e)}
                style={[styles.puce, { borderColor: filtre === e ? t.accent : t.border }, filtre === e && { backgroundColor: t.accent }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: filtre === e }}
              >
                <Texte style={{ color: filtre === e ? t.textOnAccent : t.textSecondary, fontSize: typography.small }}>{e ?? "Toutes"}</Texte>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {liste.length === 0 && (
          <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg }}>
            {toutes.length === 0 ? "Rien pour l'instant. « + » pour noter une pensée." : "Aucune entrée avec cette émotion."}
          </Texte>
        )}
        {liste.map((e) => (
          <TouchableOpacity key={e.id} onPress={() => setOuverte(e.id)} style={[styles.entree, { backgroundColor: t.bgCard, borderColor: t.border }]} accessibilityRole="button">
            <View style={styles.ligne}>
              <Texte style={{ color: t.textMuted, fontSize: typography.small, flex: 1 }}>
                {dateCourte(e.jour)} · {e.heure}
              </Texte>
            </View>
            <Texte style={{ color: t.textPrimary, fontSize: typography.body, marginTop: 2 }} numberOfLines={2}>
              {e.pensee || e.situation || "(entrée sans texte)"}
            </Texte>
            <View style={styles.ligne}>
              <Texte style={{ color: t.textSecondary, fontSize: typography.small, flex: 1 }}>{emotionsDe(e.emotions).join(", ")}</Texte>
              {e.intensite_avant !== null && (
                <Texte style={{ color: t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>
                  {e.intensite_avant}
                  {e.intensite_apres !== null ? ` → ${e.intensite_apres}` : ""}
                </Texte>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={p !== null} transparent animationType="slide" onRequestClose={() => setOuverte(null)}>
        <Pressable style={styles.fond} onPress={() => setOuverte(null)}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            {p && (
              <ScrollView>
                <Texte style={{ color: t.textMuted, fontSize: typography.small, marginBottom: spacing.md }}>
                  {dateCourte(p.jour)} · {p.heure}
                </Texte>
                {champ("SITUATION", p.situation)}
                {champ("PENSÉE", p.pensee)}
                {champ("ÉMOTIONS", emotionsDe(p.emotions).join(", "))}
                {champ("PIÈGES DE PENSÉE", p.pieges.split(",").filter(Boolean).join(", "))}
                {champ("UNE AUTRE FAÇON DE VOIR", p.autre_vision)}
                {p.intensite_avant !== null && (
                  <View style={{ marginBottom: spacing.md }}>
                    <Texte style={[styles.etiquette, { color: t.textMuted }]}>FORCE DE L&apos;ÉMOTION APRÈS</Texte>
                    <Curseur
                      valeur={p.intensite_apres ?? p.intensite_avant}
                      onChange={(v) => changer({ intensite_apres: v })}
                      libelle="Force de l'émotion après, sur 100"
                    />
                    <Texte style={{ color: t.textMuted, fontSize: typography.small, textAlign: "center" }}>Avant : {p.intensite_avant}</Texte>
                  </View>
                )}
                {p.pensee ? (
                  <TouchableOpacity
                    onPress={() => tester(p)}
                    style={[styles.option, { borderColor: t.accent }]}
                    accessibilityRole="button"
                  >
                    <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>🧪 Tester cette pensée</Texte>
                    <Texte style={{ color: t.textMuted, fontSize: typography.small }}>En faire une marche de mon échelle d&apos;exposition</Texte>
                  </TouchableOpacity>
                ) : null}
                <View style={[styles.ligne, { marginTop: spacing.lg }]}>
                  <TouchableOpacity onPress={supprimer} hitSlop={8}>
                    <Texte style={{ color: t.danger, fontSize: typography.body }}>Supprimer</Texte>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setOuverte(null)} hitSlop={8}>
                    <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Fermer</Texte>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  filtres: { gap: spacing.sm, paddingVertical: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  entree: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, gap: 4 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { maxHeight: "85%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 },
  option: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
