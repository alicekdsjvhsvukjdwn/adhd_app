import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Texte } from "../components/Texte";
import { useJourCourant } from "../hooks/useJourCourant";
import { decalerJours } from "../lib/dates";
import { libelleCourse, type IngredientCalcule } from "../lib/cuisine-regles";
import { listerRecettes, type Recette } from "../lib/db/cuisine";
import { calculerMealPrep, changerPortionsMealPrep, choisirPourMealPrep, definirBatch, lireMealPrep, mealPrepVersCourses, retirerDuMealPrep, type MealPrep } from "../lib/db/cuisine-courses";
import { getItems, type Item } from "../lib/db/items";
import { MODULES } from "../lib/modules-visibles";
import { lundiDeSemaine } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

/**
 * Meal prep de la semaine : je choisis les recettes et les portions, l'appli additionne, retire mon inventaire et envoie le reste aux courses.
 * Frigo & placards masqué (lib/modules-visibles.ts) : l'inventaire est considéré vide (tout part aux courses), et c'est
 * ici qu'on trouve ses recettes : en créer, en coller, ouvrir une fiche.
 */
export default function MealPrepEcran() {
  const t = useTheme();
  const router = useRouter();
  const aujourdhui = useJourCourant();
  const [decalage, setDecalage] = useState(0);
  const semaine = decalerJours(lundiDeSemaine(aujourdhui), decalage * 7);
  const [prep, setPrep] = useState<MealPrep | null>(null);
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [routines, setRoutines] = useState<Item[]>([]);
  const [calcul, setCalcul] = useState<{ total: IngredientCalcule[]; manquants: IngredientCalcule[] }>({ total: [], manquants: [] });
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    const [p, r, it, c] = await Promise.all([lireMealPrep(semaine), listerRecettes(), getItems("actif"), calculerMealPrep(semaine)]);
    setPrep(p);
    setRecettes(r);
    setRoutines(it.filter((i) => i.type === "routine"));
    setCalcul(c);
  }, [semaine]);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (!prep) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;
  const choisies = new Set(prep.lignes.map((l) => l.recette_id));
  const jourDe = (i: number) => decalerJours(semaine, i);
  const libelleSemaine = `${Number(semaine.slice(8))}/${Number(semaine.slice(5, 7))} → ${Number(decalerJours(semaine, 6).slice(8))}/${Number(decalerJours(semaine, 6).slice(5, 7))}`;

  const envoyer = async () => {
    const n = await mealPrepVersCourses(semaine);
    setMessage(
      n > 0
        ? `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses.`
        : MODULES.frigo
          ? "Rien à ajouter : tu as déjà tout, ou c'est déjà sur la liste."
          : "Rien à ajouter : c'est déjà sur la liste.",
    );
    await charger();
  };
  const ouvrir = (recetteId: number) => router.push(`/recette?id=${recetteId}` as never);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Courses</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Meal prep</Texte>
      <View style={styles.ligne}>
        <TouchableOpacity onPress={() => setDecalage((d) => d - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Semaine précédente">
          <Texte style={{ color: t.accentText, fontSize: 22 }}>‹</Texte>
        </TouchableOpacity>
        <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{decalage === 0 ? "Cette semaine" : decalage === 1 ? "La semaine prochaine" : "Semaine"} · {libelleSemaine}</Texte>
        <TouchableOpacity onPress={() => setDecalage((d) => d + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Semaine suivante">
          <Texte style={{ color: t.accentText, fontSize: 22 }}>›</Texte>
        </TouchableOpacity>
      </View>

      <Texte style={[styles.etiquette, { color: t.textMuted }]}>MES RECETTES DE LA SEMAINE</Texte>
      {prep.lignes.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Aucune pour l&apos;instant. Choisis-en dans la liste ci-dessous.</Texte>}
      {prep.lignes.map((l) => (
        <View key={l.id} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => ouvrir(l.recette_id)} disabled={MODULES.frigo} accessibilityRole="button" accessibilityLabel={`Ouvrir ${l.titre}`}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{l.titre}</Texte>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changerPortionsMealPrep(l.id, l.portions - 1).then(charger)} style={[styles.rond, { borderColor: t.border }]} accessibilityRole="button" accessibilityLabel={`Une portion de moins pour ${l.titre}`}>
            <Texte style={{ color: t.textPrimary, fontSize: 18 }}>−</Texte>
          </TouchableOpacity>
          <Texte style={{ color: t.textPrimary, minWidth: 54, textAlign: "center" }}>{l.portions} portion{l.portions > 1 ? "s" : ""}</Texte>
          <TouchableOpacity onPress={() => changerPortionsMealPrep(l.id, l.portions + 1).then(charger)} style={[styles.rond, { borderColor: t.border }]} accessibilityRole="button" accessibilityLabel={`Une portion de plus pour ${l.titre}`}>
            <Texte style={{ color: t.textPrimary, fontSize: 18 }}>+</Texte>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => retirerDuMealPrep(l.id).then(charger)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${l.titre}`}>
            <Texte style={{ color: t.textMuted, fontSize: 20 }}>×</Texte>
          </TouchableOpacity>
        </View>
      ))}

      {MODULES.frigo ? (
        <>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>AJOUTER UNE RECETTE</Texte>
          <View style={styles.puces}>
            {recettes.filter((r) => !choisies.has(r.id)).map((r) => (
              <TouchableOpacity key={r.id} onPress={() => choisirPourMealPrep(semaine, r.id, r.portions).then(charger)} style={[styles.puce, { borderColor: t.border }]} accessibilityRole="button" accessibilityLabel={`Ajouter ${r.titre} au meal prep`}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>+ {r.titre}</Texte>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          {/* Toutes mes recettes : un tap sur le nom ouvre la fiche, « + Ajouter » la met dans la semaine. */}
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>MES RECETTES</Texte>
          <View style={styles.boutons}>
            <TouchableOpacity onPress={() => router.push("/recette-edition" as never)} style={[styles.bouton, { backgroundColor: t.accent }]} accessibilityRole="button">
              <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>+ Nouvelle recette</Texte>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/recette-edition?coller=1" as never)} style={[styles.bouton, { borderColor: t.accent, borderWidth: 1 }]} accessibilityRole="button">
              <Texte style={{ color: t.accentText, fontWeight: "700" }}>Coller une recette</Texte>
            </TouchableOpacity>
          </View>
          {recettes.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Pas encore de recette. Écris la tienne, ou colle-en une.</Texte>}
          {recettes.map((r) => (
            <View key={r.id} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => ouvrir(r.id)} accessibilityRole="button" accessibilityLabel={`Ouvrir ${r.titre}`}>
                <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{r.titre}</Texte>
              </TouchableOpacity>
              {choisies.has(r.id) ? (
                <Texte style={{ color: t.textMuted, fontSize: typography.small }}>✓ dans la semaine</Texte>
              ) : (
                <TouchableOpacity onPress={() => choisirPourMealPrep(semaine, r.id, r.portions).then(charger)} style={[styles.puce, { borderColor: t.border }]} accessibilityRole="button" accessibilityLabel={`Ajouter ${r.titre} au meal prep`}>
                  <Texte style={{ color: t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>+ Ajouter</Texte>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      {prep.lignes.length > 0 && (
        <>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>
            CE QU&apos;IL FAUT ACHETER ({MODULES.frigo ? `${calcul.manquants.length} sur ${calcul.total.length}` : calcul.manquants.length})
          </Texte>
          {calcul.manquants.length === 0 ? (
            <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>{MODULES.frigo ? "Tu as déjà tout dans ton inventaire." : "Ces recettes n'ont pas d'ingrédients notés."}</Texte>
          ) : (
            calcul.manquants.map((m, k) => (
              <Texte key={k} style={{ color: t.textPrimary, fontSize: typography.body, paddingVertical: 2 }}>
                {[libelleCourse(m.quantite, m.unite), m.aliment || m.nom].filter(Boolean).join(" ")}
              </Texte>
            ))
          )}
          <TouchableOpacity onPress={envoyer} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>{MODULES.frigo ? "Ajouter le reste aux courses" : "Ajouter aux courses"}</Texte>
          </TouchableOpacity>
          {message ? <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.sm }}>{message}</Texte> : null}
        </>
      )}

      <Texte style={[styles.etiquette, { color: t.textMuted }]}>MON JOUR DE BATCH COOKING (FACULTATIF)</Texte>
      <View style={styles.puces}>
        {JOURS.map((j, i) => {
          const actif = prep.jour_batch === jourDe(i);
          return (
            <TouchableOpacity key={j} onPress={() => definirBatch(semaine, actif ? "" : jourDe(i), actif ? null : prep.routine_id).then(charger)} style={[styles.puce, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
              <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{j}</Texte>
            </TouchableOpacity>
          );
        })}
      </View>
      {prep.jour_batch !== "" && (
        <>
          <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.md }}>Routine liée (pour te le rappeler) :</Texte>
          {routines.length === 0 ? (
            <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Aucune routine pour l&apos;instant.</Texte>
          ) : (
            <View style={styles.puces}>
              {routines.map((r) => {
                const actif = prep.routine_id === r.id;
                return (
                  <TouchableOpacity key={r.id} onPress={() => definirBatch(semaine, prep.jour_batch, actif ? null : r.id).then(charger)} style={[styles.puce, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
                    <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{r.nom}</Texte>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  carte: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rond: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  boutons: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  bouton: { flex: 1, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" },
  valider: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
});
