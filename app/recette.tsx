import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { BoutonMenu } from "../components/BoutonMenu";
import { FeuilleCuisine } from "../components/FeuilleCuisine";
import { Texte } from "../components/Texte";
import { libelleQuantite, presenceIngredients, quantitePourPortions, tagsDe, tempsTotalRecette } from "../lib/cuisine-regles";
import { ajouterManquantsAuxCourses } from "../lib/db/cuisine-courses";
import { basculerFavori, dupliquerRecette, lireRecette, listerAliments, supprimerRecette, type RecetteComplete } from "../lib/db/cuisine";
import { libelleDuree } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const VERT = "#4ADE80";

/** La fiche d'une recette : portions réglables (quantités recalculées), ingrédients ✓ / ✗ selon mon inventaire, étapes. */
export default function Recette() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recetteId = Number(id);
  const [r, setR] = useState<RecetteComplete | null>(null);
  const [inventaire, setInventaire] = useState<{ nom: string; toujours_la: number }[]>([]);
  const [portions, setPortions] = useState<number | null>(null);
  const [cuisine, setCuisine] = useState(false);
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    const [x, inv] = await Promise.all([lireRecette(recetteId), listerAliments()]);
    setR(x);
    setInventaire(inv);
    setPortions((p) => p ?? x?.recette.portions ?? null);
  }, [recetteId]);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (!r || portions === null) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;
  const { recette, ingredients, etapes } = r;
  const presences = presenceIngredients(ingredients, inventaire);
  const manque = presences.filter((p) => !p.present).length;
  const temps = tempsTotalRecette(recette.prep_min, recette.cuisson_min);

  const options = [
    { libelle: "Modifier", onPress: () => router.push(`/recette-edition?id=${recetteId}` as never) },
    {
      libelle: "Dupliquer",
      onPress: async () => {
        const copie = await dupliquerRecette(recetteId);
        if (copie !== null) router.replace(`/recette?id=${copie}` as never);
      },
    },
    {
      libelle: "Supprimer",
      danger: true,
      onPress: () =>
        Alert.alert(`Supprimer « ${recette.titre} » ?`, "", [
          { text: "Garder", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: async () => {
              await supprimerRecette(recetteId);
              router.back();
            },
          },
        ]),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <View style={styles.entete}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>← Recettes</Texte>
        </TouchableOpacity>
        <View style={styles.ligne}>
          <TouchableOpacity onPress={() => basculerFavori(recetteId).then(charger)} hitSlop={10} accessibilityRole="button" accessibilityLabel={recette.favori ? "Retirer des favoris" : "Mettre en favori"}>
            <Texte style={{ fontSize: 24, color: recette.favori ? "#F472B6" : t.textMuted }}>{recette.favori ? "❤" : "♡"}</Texte>
          </TouchableOpacity>
          <BoutonMenu options={options} titre={recette.titre} />
        </View>
      </View>

      {recette.photo ? <Image source={{ uri: recette.photo }} style={styles.photo} resizeMode="cover" /> : null}
      <Texte style={[styles.titre, { color: t.textPrimary }]}>{recette.titre}</Texte>
      <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>
        {[recette.prep_min ? `préparation ${libelleDuree(recette.prep_min)}` : "", recette.cuisson_min ? `cuisson ${libelleDuree(recette.cuisson_min)}` : "", temps ? `soit ${libelleDuree(temps)}` : ""].filter(Boolean).join(" · ")}
      </Texte>
      {recette.tags ? <Texte style={{ color: t.textSecondary, fontSize: typography.small, marginTop: 2 }}>{tagsDe(recette.tags).join(" · ")}</Texte> : null}

      <TouchableOpacity onPress={() => router.push(`/cuisiner?id=${recetteId}&portions=${portions}` as never)} style={[styles.cuisiner, { backgroundColor: t.accent }]} accessibilityRole="button">
        <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Je cuisine</Texte>
      </TouchableOpacity>

      <Texte style={[styles.etiquette, { color: t.textMuted }]}>PORTIONS</Texte>
      <View style={styles.ligne}>
        <TouchableOpacity onPress={() => setPortions(Math.max(1, portions - 1))} style={[styles.rond, { borderColor: t.border }]} accessibilityRole="button" accessibilityLabel="Une portion de moins">
          <Texte style={{ color: t.textPrimary, fontSize: 22 }}>−</Texte>
        </TouchableOpacity>
        <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", minWidth: 36, textAlign: "center" }}>{portions}</Texte>
        <TouchableOpacity onPress={() => setPortions(portions + 1)} style={[styles.rond, { borderColor: t.border }]} accessibilityRole="button" accessibilityLabel="Une portion de plus">
          <Texte style={{ color: t.textPrimary, fontSize: 22 }}>+</Texte>
        </TouchableOpacity>
        {portions !== recette.portions && <Texte style={{ color: t.textMuted, fontSize: typography.small }}>(recette pour {recette.portions})</Texte>}
      </View>

      <TouchableOpacity onPress={() => setCuisine(true)} style={[styles.cuisine, { borderColor: t.accent }]} accessibilityRole="button">
        <Texte style={{ color: t.accentText, fontWeight: "700", fontSize: typography.body }}>J&apos;ai cuisiné</Texte>
      </TouchableOpacity>

      <Texte style={[styles.etiquette, { color: t.textMuted }]}>INGRÉDIENTS{ingredients.length > 0 ? (manque === 0 ? " · TOUT EST LÀ" : ` · IL MANQUE ${manque}`) : ""}</Texte>
      {presences.map(({ ingredient: i, present }, k) => (
        <View key={k} style={[styles.ingredient, { borderColor: t.border }]}>
          <Texte style={{ color: present ? VERT : t.danger, fontWeight: "700", width: 22 }} accessibilityLabel={present ? "dans l'inventaire" : "manque"}>
            {present ? "✓" : "✗"}
          </Texte>
          <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>
            {[libelleQuantite(quantitePourPortions(i.quantite, recette.portions, portions)), i.unite, i.nom].filter(Boolean).join(" ")}
          </Texte>
        </View>
      ))}

      {manque > 0 && (
        <>
          <TouchableOpacity
            onPress={async () => {
              const n = await ajouterManquantsAuxCourses(
                presences.filter((p) => !p.present).map((p) => ({ nom: p.ingredient.nom, aliment: p.ingredient.aliment, quantite: quantitePourPortions(p.ingredient.quantite, recette.portions, portions), unite: p.ingredient.unite })),
                "recette",
              );
              setMessage(n > 0 ? `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses.` : "Déjà sur ta liste de courses.");
            }}
            style={{ marginTop: spacing.md }}
            accessibilityRole="button"
          >
            <Texte style={{ color: t.accentText, fontWeight: "600", fontSize: typography.bodySmall }}>+ Mettre ce qui manque dans les courses</Texte>
          </TouchableOpacity>
          {message ? <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 4 }}>{message}</Texte> : null}
        </>
      )}

      <Texte style={[styles.etiquette, { color: t.textMuted }]}>ÉTAPES</Texte>
      {etapes.map((e, k) => (
        <View key={k} style={styles.etape}>
          <Texte style={{ color: t.accentText, fontWeight: "700", width: 26 }}>{k + 1}.</Texte>
          <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body, lineHeight: 22 }}>{e.texte}</Texte>
        </View>
      ))}

      {recette.notes ? (
        <>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>NOTES</Texte>
          <Texte style={{ color: t.textSecondary, fontSize: typography.body, lineHeight: 22 }}>{recette.notes}</Texte>
        </>
      ) : null}
      <FeuilleCuisine recetteId={recetteId} portions={portions} visible={cuisine} onFerme={() => { setCuisine(false); charger(); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  photo: { width: "100%", height: 200, borderRadius: radius.lg, marginBottom: spacing.md },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  cuisine: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm },
  cuisiner: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  rond: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ingredient: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  etape: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
});
