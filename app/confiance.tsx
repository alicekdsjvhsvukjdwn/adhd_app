import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { BocalConfiance } from "../components/BocalConfiance";
import { ChampTexte, Texte } from "../components/Texte";
import { useJourCourant } from "../hooks/useJourCourant";
import { ajouterConfiance, listerConfiance, supprimerConfiance, type EntreeConfiance } from "../lib/db/tcc";
import { dateCourte } from "../lib/esprit-regles";
import { MAX_CONFIANCE_PAR_JOUR, tirer } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Journal de confiance : chaque jour, 1 à 3 choses que j'ai bien faites ou une qualité que j'ai montrée,
 * en une ligne. Elles s'accumulent dans le bocal ; je peux les relire, au hasard aussi.
 */
export default function Confiance() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [entrees, setEntrees] = useState<EntreeConfiance[]>([]);
  const [texte, setTexte] = useState("");
  const [hasard, setHasard] = useState<EntreeConfiance | null>(null);
  const [relire, setRelire] = useState(false);

  const charger = useCallback(async () => setEntrees(await listerConfiance()), []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const duJour = entrees.filter((e) => e.jour === aujourdhui);
  const plein = duJour.length >= MAX_CONFIANCE_PAR_JOUR;

  const ajouter = async () => {
    if (!texte.trim() || plein) return;
    await ajouterConfiance(texte, aujourdhui);
    setTexte("");
    await charger();
  };

  const supprimer = (e: EntreeConfiance) =>
    Alert.alert("Supprimer cette ligne ?", e.texte, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimerConfiance(e.id);
          if (hasard?.id === e.id) setHasard(null);
          await charger();
        },
      },
    ]);

  const encoreUne = () => setHasard((h) => tirer(entrees, entrees.find((e) => e.id === h?.id) ?? null));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Journal de confiance</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
          Une chose que j&apos;ai bien faite aujourd&apos;hui, ou une qualité que j&apos;ai montrée. Même petite. Une ligne suffit.
        </Texte>

        <BocalConfiance ids={[...entrees].reverse().map((e) => e.id)} />

        <Texte style={[styles.etiquette, { color: t.textMuted }]}>AUJOURD&apos;HUI · {duJour.length}/{MAX_CONFIANCE_PAR_JOUR}</Texte>
        {duJour.map((e) => (
          <TouchableOpacity key={e.id} onLongPress={() => supprimer(e)} onPress={() => supprimer(e)} style={[styles.ligne, { borderColor: t.border, backgroundColor: t.bgCard }]} accessibilityHint="Toucher pour supprimer">
            <Texte style={{ color: t.textPrimary, fontSize: typography.body, flex: 1 }}>{e.texte}</Texte>
          </TouchableOpacity>
        ))}
        {plein ? (
          <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>Trois pour aujourd&apos;hui : c&apos;est largement assez. À demain !</Texte>
        ) : (
          <>
            <ChampTexte
              value={texte}
              onChangeText={setTexte}
              onSubmitEditing={ajouter}
              returnKeyType="done"
              maxLength={160}
              placeholder="Ex : j'ai dit bonjour au voisin"
              placeholderTextColor={t.textMuted}
              style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
            />
            <TouchableOpacity
              onPress={ajouter}
              disabled={!texte.trim()}
              style={[styles.bouton, { backgroundColor: texte.trim() ? t.accent : t.bgCard, borderColor: t.border }]}
              accessibilityRole="button"
            >
              <Texte style={{ color: texte.trim() ? t.textOnAccent : t.textMuted, fontWeight: "700" }}>Ajouter au bocal</Texte>
            </TouchableOpacity>
          </>
        )}

        {entrees.length > 0 && (
          <>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>RELIRE</Texte>
            <TouchableOpacity onPress={encoreUne} style={[styles.hasard, { borderColor: t.accent, backgroundColor: t.bgCard }]} accessibilityRole="button">
              {hasard ? (
                <>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{dateCourte(hasard.jour)}</Texte>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{hasard.texte}</Texte>
                  <Texte style={{ color: t.accentText, fontSize: typography.small, marginTop: 6 }}>Encore une</Texte>
                </>
              ) : (
                <Texte style={{ color: t.accentText, fontSize: typography.body }}>🎲 Une au hasard</Texte>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRelire(!relire)} hitSlop={8} style={{ marginTop: spacing.md }}>
              <Texte style={{ color: t.accentText, fontSize: typography.small }}>{relire ? "Masquer la liste" : `Tout relire (${entrees.length})`}</Texte>
            </TouchableOpacity>
            {relire &&
              entrees.map((e) => (
                <View key={e.id} style={[styles.ligne, { borderColor: t.border, backgroundColor: t.bgCard }]}>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small, width: 78 }}>{dateCourte(e.jour)}</Texte>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall, flex: 1 }}>{e.texte}</Texte>
                </View>
              ))}
          </>
        )}

        <TouchableOpacity onPress={() => router.push("/rappels" as never)} style={{ marginTop: spacing.xl }} hitSlop={8}>
          <Texte style={{ color: t.accentText, fontSize: typography.small }}>Régler le rappel du soir</Texte>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.md },
  hasard: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: 2 },
});
