import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Curseur } from "../components/Curseur";
import { ChampTexte, Texte } from "../components/Texte";
import { ajouterPensee } from "../lib/db/esprit";
import { situationDepuisPensee } from "../lib/db/tcc";
import { EMOTIONS, emotionsEnTexte, PIEGES } from "../lib/esprit-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Etape = "situation" | "pensee" | "emotions" | "pieges" | "autre" | "apres";

const ETAPES: { cle: Etape; titre: string; aide: string }[] = [
  { cle: "situation", titre: "La situation", aide: "Où étais-tu, que se passait-il ? Quelques mots suffisent." },
  { cle: "pensee", titre: "La pensée qui est venue", aide: "Ce que tu t'es dit, tel quel, sans l'arranger." },
  { cle: "emotions", titre: "Ce que tu as ressenti", aide: "Une ou plusieurs émotions, et leur force." },
  { cle: "pieges", titre: "Des pièges de pensée ?", aide: "Si l'un d'eux te parle. Sinon, passe." },
  { cle: "autre", titre: "Une autre façon de voir", aide: "Ce que tu dirais à une amie, ou ce qui est aussi possible." },
  { cle: "apres", titre: "Et maintenant ?", aide: "La force de l'émotion, après avoir écrit tout ça." },
];

/**
 * Noter une pensée, en étapes courtes (colonnes de la TCC) : une par écran, « passer » partout.
 * Rien n'est obligatoire ; ce qui est noté peut être enregistré à tout moment.
 */
export default function Pensee() {
  const router = useRouter();
  const t = useTheme();
  const [i, setI] = useState(0);
  const [situation, setSituation] = useState("");
  const [pensee, setPensee] = useState("");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [avant, setAvant] = useState<number | null>(null);
  const [pieges, setPieges] = useState<string[]>([]);
  const [autre, setAutre] = useState("");
  const [apres, setApres] = useState<number | null>(null);
  const [enregistree, setEnregistree] = useState<{ id: number } | null>(null);

  const etape = ETAPES[i];
  const dernier = i === ETAPES.length - 1;

  const basculer = (liste: string[], valeur: string, set: (l: string[]) => void) =>
    set(liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur]);

  const enregistrer = async (apresFinal: number | null = apres) => {
    const id = await ajouterPensee({
      situation,
      pensee,
      emotions: emotionsEnTexte(emotions),
      intensite_avant: avant,
      pieges: pieges.join(","),
      autre_vision: autre,
      intensite_apres: apresFinal,
    });
    setEnregistree({ id });
  };

  /** La pensée devient une marche à tester sur l'échelle d'exposition, avec la pensée comme prédiction. */
  const tester = async () => {
    if (!enregistree) return;
    router.replace(`/exposition?situation=${await situationDepuisPensee(enregistree.id, { pensee, situation, avant })}` as never);
  };

  if (enregistree) {
    return (
      <View style={[styles.ecran, { backgroundColor: t.bgApp }]}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>C&apos;est noté.</Texte>
        {avant !== null && apres !== null && (
          <Texte style={[styles.aide, { color: t.textSecondary }]}>
            L&apos;émotion est passée de {avant} à {apres} sur 100.
          </Texte>
        )}
        {pensee.trim() ? (
          <TouchableOpacity onPress={tester} style={[styles.option, { borderColor: t.accent, backgroundColor: t.bgCard }]} accessibilityRole="button">
            <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>🧪 Tester cette pensée</Texte>
            <Texte style={{ color: t.textMuted, fontSize: typography.small }}>En faire une marche de mon échelle d&apos;exposition</Texte>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => router.back()} style={[styles.suivant, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Fermer</Texte>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <View style={styles.entete}>
          <TouchableOpacity onPress={() => (i === 0 ? router.back() : setI(i - 1))} hitSlop={12} accessibilityRole="button">
            <Texte style={{ color: t.accentText, fontSize: typography.body }}>{i === 0 ? "✕ Fermer" : "‹ Retour"}</Texte>
          </TouchableOpacity>
          <View style={styles.points}>
            {ETAPES.map((e, k) => (
              <View key={e.cle} style={[styles.pointEtape, { backgroundColor: k <= i ? t.accent : t.border }]} />
            ))}
          </View>
        </View>

        <Texte style={[styles.titre, { color: t.textPrimary }]}>{etape.titre}</Texte>
        <Texte style={[styles.aide, { color: t.textSecondary }]}>{etape.aide}</Texte>

        {etape.cle === "situation" && (
          <ChampTexte value={situation} onChangeText={setSituation} multiline autoFocus placeholder="Ex : en réunion, le matin" placeholderTextColor={t.textMuted} style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]} />
        )}
        {etape.cle === "pensee" && (
          <ChampTexte value={pensee} onChangeText={setPensee} multiline autoFocus placeholder="Ex : je suis nulle, ça ne marchera jamais" placeholderTextColor={t.textMuted} style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]} />
        )}
        {etape.cle === "emotions" && (
          <>
            <View style={styles.puces}>
              {EMOTIONS.map((e) => {
                const actif = emotions.includes(e);
                return (
                  <TouchableOpacity key={e} onPress={() => {
                      basculer(emotions, e, setEmotions);
                      if (avant === null) setAvant(50); // la force affichée est celle qui sera notée
                    }} style={[styles.puce, { borderColor: actif ? t.accent : t.border }, actif && { backgroundColor: t.accent }]} accessibilityRole="checkbox" accessibilityState={{ checked: actif }}>
                    <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.body }}>{e}</Texte>
                  </TouchableOpacity>
                );
              })}
            </View>
            {emotions.length > 0 && (
              <View style={{ marginTop: spacing.xl }}>
                <Curseur valeur={avant ?? 50} onChange={setAvant} libelle="Force de l'émotion, sur 100" />
              </View>
            )}
          </>
        )}
        {etape.cle === "pieges" && (
          <View style={styles.puces}>
            {PIEGES.map((p) => {
              const actif = pieges.includes(p);
              return (
                <TouchableOpacity key={p} onPress={() => basculer(pieges, p, setPieges)} style={[styles.puce, { borderColor: actif ? t.accent : t.border }, actif && { backgroundColor: t.accent }]} accessibilityRole="checkbox" accessibilityState={{ checked: actif }}>
                  <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.body }}>{p}</Texte>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {etape.cle === "autre" && (
          <ChampTexte value={autre} onChangeText={setAutre} multiline autoFocus placeholder="Ex : j'ai fait ce que j'ai pu avec ce que je savais" placeholderTextColor={t.textMuted} style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]} />
        )}
        {etape.cle === "apres" && (
          <View>
            {avant === null ? (
              <Texte style={[styles.aide, { color: t.textMuted }]}>Tu n&apos;as pas noté d&apos;émotion : rien à comparer. Tu peux enregistrer.</Texte>
            ) : (
              <>
                <Texte style={[styles.aide, { color: t.textMuted, textAlign: "center" }]}>Avant : {avant}</Texte>
                <Curseur valeur={apres ?? avant} onChange={setApres} libelle="Force de l'émotion après, sur 100" />
              </>
            )}
          </View>
        )}

        <View style={styles.boutons}>
          <TouchableOpacity onPress={() => (dernier ? enregistrer(null) : setI(i + 1))} hitSlop={8} accessibilityRole="button">
            <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Passer</Texte>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (dernier ? enregistrer(avant === null ? null : (apres ?? avant)) : setI(i + 1))} style={[styles.suivant, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>{dernier ? "Enregistrer" : "Suivant"}</Texte>
          </TouchableOpacity>
        </View>
        {i >= 1 && !dernier && (
          <TouchableOpacity onPress={() => enregistrer()} style={{ marginTop: spacing.xl }} hitSlop={8} accessibilityRole="button">
            <Texte style={{ color: t.accentText, fontSize: typography.small, textAlign: "center" }}>Enregistrer maintenant, sans finir</Texte>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { flexGrow: 1, paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl },
  points: { flexDirection: "row", gap: 6 },
  pointEtape: { width: 22, height: 6, borderRadius: 3 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  aide: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, minHeight: 120, textAlignVertical: "top" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xxl },
  suivant: { borderRadius: radius.pill, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
  option: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xl },
});
