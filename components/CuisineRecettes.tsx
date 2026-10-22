import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { faisabilite, tagsDe, tempsTotalRecette, TAGS_RECETTE } from "../lib/cuisine-regles";
import { ajouterManquantsAuxCourses } from "../lib/db/cuisine-courses";
import { basculerFavori, listerAliments, recettesAvecIngredients, type Aliment, type Recette } from "../lib/db/cuisine";
import { libelleDuree } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import type { IngredientRecette } from "../lib/cuisine-regles";
import { Texte } from "./Texte";

const VERT = "#4ADE80";

/** Cuisine › Recettes : mes recettes (favorites d'abord), filtrées par tag ; chacune dit ce qu'il manque. */
export function CuisineRecettes() {
  const t = useTheme();
  const router = useRouter();
  const [recettes, setRecettes] = useState<{ recette: Recette; ingredients: IngredientRecette[] }[]>([]);
  const [inventaire, setInventaire] = useState<Aliment[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    const [r, a] = await Promise.all([recettesAvecIngredients(), listerAliments()]);
    setRecettes(r);
    setInventaire(a);
    setCharge(true);
  }, []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const visibles = recettes.filter((r) => !tag || tagsDe(r.recette.tags).includes(tag));
  // « Avec ce que j'ai » : prêtes d'abord, puis celles où il manque 1 ou 2 ingrédients.
  const evaluees = recettes.filter((r) => r.ingredients.length > 0).map((r) => ({ ...r, f: faisabilite(r.ingredients, inventaire) }));
  const pretes = inventaire.length > 0 ? evaluees.filter((r) => r.f.niveau === "pret") : [];
  const presque = inventaire.length > 0 ? evaluees.filter((r) => r.f.niveau === "presque") : [];

  const manquantsAuxCourses = async (r: (typeof evaluees)[number]) => {
    const n = await ajouterManquantsAuxCourses(
      r.f.manque.map((i) => ({ nom: i.nom, aliment: i.aliment, quantite: i.quantite, unite: i.unite })),
      "recette",
    );
    setMessage(n > 0 ? `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses pour « ${r.recette.titre} ».` : "Déjà sur ta liste de courses.");
  };

  return (
    <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
      <View style={styles.ligne}>
        <TouchableOpacity onPress={() => router.push("/recette-edition" as never)} style={[styles.bouton, { backgroundColor: t.accent, flex: 1 }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>+ Nouvelle recette</Texte>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/recette-edition?coller=1" as never)} style={[styles.bouton, { borderColor: t.accent, borderWidth: 1, flex: 1 }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontWeight: "700" }}>Coller une recette</Texte>
        </TouchableOpacity>
      </View>

      {(pretes.length > 0 || presque.length > 0) && (
        <View>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>AVEC CE QUE J&apos;AI</Texte>
          {pretes.map((r) => (
            <TouchableOpacity key={r.recette.id} onPress={() => router.push(`/recette?id=${r.recette.id}` as never)} style={[styles.mini, { backgroundColor: t.bgCard, borderColor: VERT }]} accessibilityRole="button">
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600", flex: 1 }}>✅ {r.recette.titre}</Texte>
              <Texte style={{ color: VERT, fontSize: typography.small }}>tout est là</Texte>
            </TouchableOpacity>
          ))}
          {presque.map((r) => (
            <View key={r.recette.id} style={[styles.mini, { backgroundColor: t.bgCard, borderColor: t.border, flexDirection: "column", alignItems: "stretch", gap: 4 }]}>
              <TouchableOpacity onPress={() => router.push(`/recette?id=${r.recette.id}` as never)} accessibilityRole="button">
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{r.recette.titre}</Texte>
                <Texte style={{ color: t.textMuted, fontSize: typography.small }}>il manque : {r.f.manque.map((i) => i.nom).join(", ")}</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => manquantsAuxCourses(r)} hitSlop={8} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>+ Mettre ce qui manque dans les courses</Texte>
              </TouchableOpacity>
            </View>
          ))}
          {message ? <Texte style={{ color: t.textSecondary, fontSize: typography.small, marginTop: spacing.xs }}>{message}</Texte> : null}
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>TOUTES MES RECETTES</Texte>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles}>
        {[null, ...TAGS_RECETTE].map((x) => {
          const actif = tag === x;
          return (
            <TouchableOpacity key={x ?? "tout"} onPress={() => setTag(x)} style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
              <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{x ?? "Toutes"}</Texte>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {charge && recettes.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg }}>Pas encore de recette. Écris la tienne, ou colle-en une.</Texte>}
      {recettes.length > 0 && visibles.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg }}>Aucune recette avec ce tag.</Texte>}

      {visibles.map(({ recette: r, ingredients }) => {
        const f = faisabilite(ingredients, inventaire);
        const temps = tempsTotalRecette(r.prep_min, r.cuisson_min);
        return (
          <TouchableOpacity key={r.id} onPress={() => router.push(`/recette?id=${r.id}` as never)} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]} accessibilityRole="button" accessibilityLabel={r.titre}>
            {r.photo ? <Image source={{ uri: r.photo }} style={styles.photo} resizeMode="cover" /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{r.titre}</Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                {r.portions} portion{r.portions > 1 ? "s" : ""}
                {temps > 0 ? ` · ${libelleDuree(temps)}` : ""}
                {r.tags ? ` · ${tagsDe(r.tags).join(", ")}` : ""}
              </Texte>
              {ingredients.length > 0 && (
                <Texte style={{ color: f.niveau === "pret" ? VERT : t.textMuted, fontSize: typography.small, fontWeight: f.niveau === "pret" ? "700" : "400" }}>
                  {f.niveau === "pret" ? "✅ tout est là" : f.niveau === "presque" ? `il manque ${f.manque.length} ingrédient${f.manque.length > 1 ? "s" : ""}` : ""}
                </Texte>
              )}
            </View>
            <TouchableOpacity onPress={() => basculerFavori(r.id).then(charger)} hitSlop={10} accessibilityRole="button" accessibilityLabel={r.favori ? `Retirer ${r.titre} des favoris` : `Mettre ${r.titre} en favori`}>
              <Texte style={{ fontSize: 22, color: r.favori ? "#F472B6" : t.textMuted }}>{r.favori ? "❤" : "♡"}</Texte>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2, paddingTop: spacing.sm },
  ligne: { flexDirection: "row", gap: spacing.sm },
  bouton: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" },
  pastilles: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.md },
  pastille: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  carte: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  photo: { width: 64, height: 64, borderRadius: radius.md },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  mini: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
});
