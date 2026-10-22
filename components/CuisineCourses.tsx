import { useFocusEffect, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { RAYONS } from "../lib/cuisine-catalogue";
import { achatsDesProjets, acheterPourProjet, ajouterCourse, cocherCourse, coursesFaites, listerCourses, remettreEnInventaire, retirerCourse, type AchatProjet, type Course } from "../lib/db/cuisine-courses";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { ChampTexte, Texte } from "./Texte";

/**
 * Cuisine › Courses : une seule liste, par rayon. Elle reçoit les « presque fini » du frigo, ce qui manque aux recettes
 * et au meal prep, mes ajouts, et (section « Projets ») le matériel à acheter des projets créatifs.
 */
export function CuisineCourses() {
  const t = useTheme();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [projets, setProjets] = useState<AchatProjet[]>([]);
  const [nom, setNom] = useState("");
  const [remis, setRemis] = useState<number[]>([]);

  const charger = useCallback(async () => {
    const [c, p] = await Promise.all([listerCourses(), achatsDesProjets()]);
    setCourses(c);
    setProjets(p);
  }, []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const ajouter = async () => {
    await ajouterCourse({ nom });
    setNom("");
    await charger();
  };
  const cochees = courses.filter((c) => c.cochee).length;

  const case_ = (coche: boolean, onPress: () => void, libelle: string) => (
    <TouchableOpacity onPress={onPress} style={[styles.case, { borderColor: coche ? t.accent : t.border, backgroundColor: coche ? t.accent : "transparent" }]} accessibilityRole="checkbox" accessibilityState={{ checked: coche }} accessibilityLabel={libelle} hitSlop={6}>
      {coche && <Check color={t.textOnAccent} size={14} />}
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.push("/meal-prep" as never)} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent }]} accessibilityRole="button">
        <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>Meal prep de la semaine</Texte>
        <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Choisis tes recettes : l&apos;appli ajoute aux courses ce qui te manque.</Texte>
      </TouchableOpacity>

      <ChampTexte
        value={nom}
        onChangeText={setNom}
        placeholder="Ajouter un article"
        placeholderTextColor={t.textMuted}
        style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
        returnKeyType="done"
        onSubmitEditing={ajouter}
        accessibilityLabel="Ajouter un article"
      />

      {courses.length === 0 && projets.length === 0 && (
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg, lineHeight: 20 }}>
          La liste est vide. Elle se remplit avec les aliments « presque fini », ce qui manque à tes recettes, et ce que tu ajoutes ici.
        </Texte>
      )}

      {RAYONS.map((rayon) => {
        const lignes = courses.filter((c) => c.rayon === rayon.cle);
        if (lignes.length === 0) return null;
        return (
          <View key={rayon.cle}>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>{rayon.nom.toUpperCase()}</Texte>
            {lignes.map((c) => (
              <View key={c.id} style={[styles.ligne, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                {case_(c.cochee === 1, () => cocherCourse(c.id).then(charger), c.nom)}
                <View style={{ flex: 1 }}>
                  <Texte style={{ color: c.cochee ? t.textMuted : t.textPrimary, fontSize: typography.body, textDecorationLine: c.cochee ? "line-through" : "none" }}>
                    {c.nom}
                    {c.quantite ? `  ·  ${c.quantite}` : ""}
                  </Texte>
                  {c.cochee === 1 && !remis.includes(c.id) && (
                    <TouchableOpacity
                      onPress={async () => {
                        await remettreEnInventaire(c.id);
                        setRemis((r) => [...r, c.id]);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remettre ${c.nom} dans l'inventaire`}
                    >
                      <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>+ Remettre dans l&apos;inventaire</Texte>
                    </TouchableOpacity>
                  )}
                  {c.cochee === 1 && remis.includes(c.id) && <Texte style={{ color: t.textMuted, fontSize: typography.small }}>dans l&apos;inventaire</Texte>}
                </View>
                <TouchableOpacity onPress={() => retirerCourse(c.id).then(charger)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${c.nom}`}>
                  <Texte style={{ color: t.textMuted, fontSize: 20 }}>×</Texte>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      })}

      {projets.length > 0 && (
        <View>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>PROJETS</Texte>
          {projets.map((p) => (
            <View key={p.id} style={[styles.ligne, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {case_(false, () => acheterPourProjet(p.id).then(charger), p.nom)}
              <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{p.nom}</Texte>
            </View>
          ))}
        </View>
      )}

      {cochees > 0 && (
        <TouchableOpacity
          onPress={async () => {
            await coursesFaites();
            setRemis([]);
            await charger();
          }}
          style={[styles.faites, { backgroundColor: t.accent }]}
          accessibilityRole="button"
        >
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Courses faites ({cochees})</Texte>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2, paddingTop: spacing.sm },
  carte: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: 2, marginBottom: spacing.md },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  case: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  faites: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xl },
});
