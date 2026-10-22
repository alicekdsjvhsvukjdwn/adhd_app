import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Texte } from "../components/Texte";
import { libelleQuantite, quantitePourPortions } from "../lib/cuisine-regles";
import { lireRecette, type RecetteComplete } from "../lib/db/cuisine";
import { formatRestant } from "../lib/minuteur";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Mode « je cuisine » : écran allumé, une étape à la fois en grand, les ingrédients du bon nombre de portions
 * toujours accessibles, et un minuteur quand l'étape a une durée (l'heure de fin est retenue : l'écran peut se mettre en veille).
 */
export default function Cuisiner() {
  useKeepAwake();
  const t = useTheme();
  const router = useRouter();
  const p = useLocalSearchParams<{ id: string; portions?: string }>();
  const [r, setR] = useState<RecetteComplete | null>(null);
  const [i, setI] = useState(0);
  const [ingredients, setIngredients] = useState(false);
  const [fin, setFin] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(0);

  useEffect(() => {
    lireRecette(Number(p.id)).then(setR);
  }, [p.id]);

  useEffect(() => {
    if (fin === null) return;
    const tic = setInterval(() => setMaintenant(Date.now()), 500);
    return () => clearInterval(tic);
  }, [fin]);

  if (!r) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;
  const portions = Number(p.portions) || r.recette.portions;
  const etape = r.etapes[i];
  const dernier = i >= r.etapes.length - 1;
  const restant = fin === null ? 0 : Math.max(0, fin - maintenant);
  const sonne = fin !== null && maintenant > 0 && restant === 0;

  const aller = (k: number) => {
    setI(k);
    setFin(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <View style={styles.entete}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>← Quitter</Texte>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIngredients((v) => !v)} hitSlop={12} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>{ingredients ? "Masquer les ingrédients" : "Ingrédients"}</Texte>
        </TouchableOpacity>
      </View>
      <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
        {r.recette.titre} · {portions} portion{portions > 1 ? "s" : ""}
      </Texte>

      {ingredients && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {r.ingredients.map((x, k) => (
            <Texte key={k} style={{ color: t.textPrimary, fontSize: typography.body, paddingVertical: 2 }}>
              {[libelleQuantite(quantitePourPortions(x.quantite, r.recette.portions, portions)), x.unite, x.nom].filter(Boolean).join(" ")}
            </Texte>
          ))}
        </View>
      )}

      {etape ? (
        <>
          <Texte style={[styles.compteur, { color: t.accentText }]}>
            ÉTAPE {i + 1} SUR {r.etapes.length}
          </Texte>
          <Texte style={[styles.texte, { color: t.textPrimary }]}>{etape.texte}</Texte>

          {etape.minuteur_min > 0 && (
            <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: sonne ? t.accent : t.border, alignItems: "center", gap: spacing.md }]}>
              {fin === null ? (
                <TouchableOpacity
                  onPress={() => {
                    setMaintenant(Date.now());
                    setFin(Date.now() + etape.minuteur_min * 60_000);
                  }}
                  accessibilityRole="button"
                >
                  <Texte style={{ color: t.accentText, fontSize: typography.h3, fontWeight: "700" }}>⏱ Lancer {etape.minuteur_min} min</Texte>
                </TouchableOpacity>
              ) : (
                <>
                  <Texte style={{ color: t.textPrimary, fontSize: 48, fontWeight: "300", fontVariant: ["tabular-nums"] }}>{sonne ? "C'est prêt" : formatRestant(restant)}</Texte>
                  <TouchableOpacity onPress={() => setFin(null)} hitSlop={8}>
                    <Texte style={{ color: t.textSecondary }}>Arrêter le minuteur</Texte>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </>
      ) : (
        <Texte style={[styles.texte, { color: t.textSecondary }]}>Cette recette n&apos;a pas encore d&apos;étapes.</Texte>
      )}

      <View style={styles.navigation}>
        <TouchableOpacity onPress={() => aller(Math.max(0, i - 1))} disabled={i === 0} style={[styles.bouton, { borderColor: t.border, borderWidth: 1, opacity: i === 0 ? 0.4 : 1 }]} accessibilityRole="button">
          <Texte style={{ color: t.textPrimary, fontWeight: "600", fontSize: typography.body }}>Précédente</Texte>
        </TouchableOpacity>
        {dernier ? (
          <TouchableOpacity onPress={() => router.back()} style={[styles.bouton, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Terminé</Texte>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => aller(i + 1)} style={[styles.bouton, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Suivante</Texte>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  entete: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  carte: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  compteur: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xxl },
  texte: { fontSize: 26, lineHeight: 36, fontWeight: "500", marginTop: spacing.md },
  navigation: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xxl },
  bouton: { flex: 1, borderRadius: radius.pill, paddingVertical: spacing.lg, alignItems: "center" },
});
