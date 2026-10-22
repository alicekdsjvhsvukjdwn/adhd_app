import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { IconeProjet } from "../components/IconeProjet";
import { ChampTexte, Texte } from "../components/Texte";
import { ajouterType, listerTypes, modifierType, supprimerType, type TypeProjet } from "../lib/db/projets";
import { CLES_ICONES_TYPES, COULEURS_TYPES } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Mes types de projets : on en ajoute, on change le nom, l'icône ou la couleur, on en retire. */
export default function ProjetsTypes() {
  const t = useTheme();
  const router = useRouter();
  const [types, setTypes] = useState<TypeProjet[]>([]);
  const [edition, setEdition] = useState<{ id: number | null; nom: string; icone: string; couleur: string } | null>(null);

  const charger = useCallback(async () => setTypes(await listerTypes()), []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const enregistrer = async () => {
    if (!edition || !edition.nom.trim()) return;
    if (edition.id === null) await ajouterType(edition.nom, edition.icone, edition.couleur);
    else await modifierType(edition.id, edition.nom, edition.icone, edition.couleur);
    setEdition(null);
    await charger();
  };

  const retirer = (ty: TypeProjet) =>
    Alert.alert(`Retirer « ${ty.nom} » ?`, "Les projets de ce type passent dans « Autre ».", [
      { text: "Garder", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          await supprimerType(ty.id);
          await charger();
        },
      },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Mes types de projets</Texte>

      {types.map((ty) => (
        <View key={ty.id} style={[styles.ligne, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <IconeProjet nom={ty.icone} couleur={ty.couleur} />
          <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{ty.nom}</Texte>
          <TouchableOpacity onPress={() => setEdition({ id: ty.id, nom: ty.nom, icone: ty.icone, couleur: ty.couleur })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Modifier ${ty.nom}`}>
            <Texte style={{ color: t.accentText, fontSize: typography.bodySmall }}>Modifier</Texte>
          </TouchableOpacity>
          {types.length > 1 && (
            <TouchableOpacity onPress={() => retirer(ty)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${ty.nom}`}>
              <Texte style={{ color: t.danger, fontSize: typography.bodySmall }}>Retirer</Texte>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {edition === null ? (
        <TouchableOpacity onPress={() => setEdition({ id: null, nom: "", icone: "sparkles", couleur: COULEURS_TYPES[0] })} style={[styles.bouton, { borderColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontWeight: "600" }}>+ Nouveau type</Texte>
        </TouchableOpacity>
      ) : (
        <View style={[styles.formulaire, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <ChampTexte
            value={edition.nom}
            onChangeText={(v) => setEdition({ ...edition, nom: v })}
            placeholder="Nom du type"
            placeholderTextColor={t.textMuted}
            style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
            accessibilityLabel="Nom du type"
          />
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>ICÔNE</Texte>
          <View style={styles.choix}>
            {CLES_ICONES_TYPES.map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setEdition({ ...edition, icone: i })}
                style={[styles.case, { borderColor: edition.icone === i ? edition.couleur : t.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Icône ${i}`}
                accessibilityState={{ selected: edition.icone === i }}
              >
                <IconeProjet nom={i} couleur={edition.couleur} />
              </TouchableOpacity>
            ))}
          </View>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>COULEUR</Texte>
          <View style={styles.choix}>
            {COULEURS_TYPES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setEdition({ ...edition, couleur: c })}
                style={[styles.case, { backgroundColor: c, borderColor: edition.couleur === c ? t.textPrimary : "transparent", borderWidth: 3 }]}
                accessibilityRole="button"
                accessibilityLabel={`Couleur ${c}`}
                accessibilityState={{ selected: edition.couleur === c }}
              />
            ))}
          </View>
          <View style={styles.boutons}>
            <TouchableOpacity onPress={() => setEdition(null)} hitSlop={8}>
              <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
            </TouchableOpacity>
            <TouchableOpacity onPress={enregistrer} disabled={!edition.nom.trim()} style={[styles.valider, { backgroundColor: edition.nom.trim() ? t.accent : t.border }]} accessibilityRole="button">
              <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Enregistrer</Texte>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.md },
  formulaire: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },
  choix: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  case: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
