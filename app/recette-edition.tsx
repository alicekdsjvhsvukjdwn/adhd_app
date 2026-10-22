import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ChampTexte, Texte } from "../components/Texte";
import { decouperRecette, minuteurDeLEtape, nomDeCatalogue, TAGS_RECETTE, tagsDe, type IngredientRecette } from "../lib/cuisine-regles";
import { enregistrerRecette, lireRecette } from "../lib/db/cuisine";
import { choisirPhotos } from "../lib/photos";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Ligne = { nom: string; quantite: string; unite: string; aliment: string };

const versLigne = (i: IngredientRecette): Ligne => ({ nom: i.nom, quantite: i.quantite === null ? "" : String(i.quantite).replace(".", ","), unite: i.unite, aliment: i.aliment });
const nombre = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

/**
 * Écrire une recette à la main (?id= pour modifier), ou en coller une (?coller=1) :
 * le texte est découpé au mieux en ingrédients et en étapes, puis affiché ici pour être vérifié avant l'enregistrement.
 */
export default function RecetteEdition() {
  const t = useTheme();
  const router = useRouter();
  const p = useLocalSearchParams<{ id?: string; coller?: string }>();
  const recetteId = p.id ? Number(p.id) : null;
  const [collage, setCollage] = useState(p.coller === "1" && recetteId === null);
  const [texteColle, setTexteColle] = useState("");
  const [titre, setTitre] = useState("");
  const [photo, setPhoto] = useState("");
  const [portions, setPortions] = useState("2");
  const [prep, setPrep] = useState("");
  const [cuisson, setCuisson] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [ingredients, setIngredients] = useState<Ligne[]>([]);
  const [etapes, setEtapes] = useState<string[]>([]);

  useEffect(() => {
    if (recetteId === null) return;
    lireRecette(recetteId).then((r) => {
      if (!r) return;
      setTitre(r.recette.titre);
      setPhoto(r.recette.photo);
      setPortions(String(r.recette.portions));
      setPrep(r.recette.prep_min ? String(r.recette.prep_min) : "");
      setCuisson(r.recette.cuisson_min ? String(r.recette.cuisson_min) : "");
      setTags(tagsDe(r.recette.tags));
      setNotes(r.recette.notes);
      setIngredients(r.ingredients.map(versLigne));
      setEtapes(r.etapes.map((e) => e.texte));
    });
  }, [recetteId]);

  const decouper = () => {
    const r = decouperRecette(texteColle);
    if (r.titre) setTitre(r.titre);
    setIngredients(r.ingredients.map(versLigne));
    setEtapes(r.etapes);
    setCollage(false);
  };

  const enregistrer = async () => {
    if (!titre.trim()) return;
    const id = await enregistrerRecette({
      id: recetteId ?? undefined,
      titre,
      photo,
      portions: Number(portions) || 1,
      prep_min: Number(prep) || 0,
      cuisson_min: Number(cuisson) || 0,
      tags: tags.join(", "),
      notes,
      ingredients: ingredients
        .filter((i) => i.nom.trim())
        // Un nom du catalogue reconnu relie l'ingrédient à l'inventaire.
        .map((i) => ({ nom: i.nom.trim(), quantite: nombre(i.quantite), unite: i.unite.trim(), aliment: i.aliment || nomDeCatalogue(i.nom.trim())?.nom || "" })),
      etapes: etapes.filter((e) => e.trim()).map((texte) => ({ texte, minuteur_min: minuteurDeLEtape(texte) })),
    });
    if (id !== null) {
      if (recetteId === null) router.replace(`/recette?id=${id}` as never);
      else router.back();
    }
  };

  const champ = [styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }];
  const etiquette = (s: string) => <Texte style={[styles.etiquette, { color: t.textMuted }]}>{s}</Texte>;
  const modifLigne = (i: number, patch: Partial<Ligne>) => setIngredients((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  if (collage) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
          </TouchableOpacity>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Coller une recette</Texte>
          <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.md }}>
            Colle le texte (titre, ingrédients, étapes). L&apos;appli le découpe au mieux, et tu vérifies avant d&apos;enregistrer.
          </Texte>
          <ChampTexte value={texteColle} onChangeText={setTexteColle} multiline placeholder={"Dahl express\nIngrédients\n250 g de lentilles corail\n1 oignon\nPréparation\n1. Faire revenir l'oignon…"} placeholderTextColor={t.textMuted} style={[...champ, { minHeight: 260, textAlignVertical: "top" }]} accessibilityLabel="Texte de la recette" />
          <TouchableOpacity onPress={decouper} disabled={!texteColle.trim()} style={[styles.valider, { backgroundColor: texteColle.trim() ? t.accent : t.border }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Découper</Texte>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCollage(false)} style={{ alignSelf: "center", marginTop: spacing.lg }}>
            <Texte style={{ color: t.textSecondary }}>Écrire à la main</Texte>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{recetteId === null ? "Nouvelle recette" : "Modifier la recette"}</Texte>
        {texteColle !== "" && <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Découpée au mieux : vérifie les quantités et les étapes avant d&apos;enregistrer.</Texte>}

        {etiquette("TITRE")}
        <ChampTexte value={titre} onChangeText={setTitre} placeholder="Dahl de lentilles corail" placeholderTextColor={t.textMuted} style={champ} accessibilityLabel="Titre" />

        {etiquette("PHOTO (FACULTATIF)")}
        {photo ? (
          <View>
            <Image source={{ uri: photo }} style={styles.apercu} resizeMode="cover" />
            <TouchableOpacity onPress={() => setPhoto("")} style={{ marginTop: spacing.sm }}>
              <Texte style={{ color: t.danger, fontSize: typography.bodySmall }}>Retirer la photo</Texte>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={async () => {
              const [x] = await choisirPhotos(1);
              if (x) setPhoto(x);
            }}
            style={[styles.ajout, { borderColor: t.border }]}
            accessibilityRole="button"
          >
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>Ajouter une photo</Texte>
          </TouchableOpacity>
        )}

        <View style={styles.ligne}>
          {[
            ["PORTIONS", portions, setPortions],
            ["PRÉPA (MIN)", prep, setPrep],
            ["CUISSON (MIN)", cuisson, setCuisson],
          ].map(([lib, val, set]) => (
            <View key={lib as string} style={{ flex: 1 }}>
              {etiquette(lib as string)}
              <ChampTexte value={val as string} onChangeText={(v) => (set as (s: string) => void)(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" style={champ} accessibilityLabel={lib as string} />
            </View>
          ))}
        </View>

        {etiquette("TAGS")}
        <View style={styles.puces}>
          {TAGS_RECETTE.map((x) => {
            const actif = tags.includes(x);
            return (
              <TouchableOpacity key={x} onPress={() => setTags((l) => (actif ? l.filter((y) => y !== x) : [...l, x]))} style={[styles.puce, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
                <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{x}</Texte>
              </TouchableOpacity>
            );
          })}
        </View>

        {etiquette("INGRÉDIENTS")}
        {ingredients.map((l, i) => (
          <View key={i} style={styles.ligneIng}>
            <ChampTexte value={l.quantite} onChangeText={(v) => modifLigne(i, { quantite: v })} keyboardType="decimal-pad" placeholder="Qté" placeholderTextColor={t.textMuted} style={[...champ, { width: 62 }]} accessibilityLabel={`Quantité ${i + 1}`} />
            <ChampTexte value={l.unite} onChangeText={(v) => modifLigne(i, { unite: v })} placeholder="Unité" placeholderTextColor={t.textMuted} style={[...champ, { width: 72 }]} accessibilityLabel={`Unité ${i + 1}`} />
            <ChampTexte value={l.nom} onChangeText={(v) => modifLigne(i, { nom: v, aliment: nomDeCatalogue(v)?.nom ?? "" })} placeholder="Ingrédient" placeholderTextColor={t.textMuted} style={[...champ, { flex: 1 }]} accessibilityLabel={`Ingrédient ${i + 1}`} />
            <TouchableOpacity onPress={() => setIngredients((x) => x.filter((_, k) => k !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer l'ingrédient ${i + 1}`}>
              <Texte style={{ color: t.textMuted, fontSize: 20 }}>×</Texte>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setIngredients((x) => [...x, { nom: "", quantite: "", unite: "", aliment: "" }])} style={[styles.bouton, { borderColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontWeight: "600" }}>+ Ingrédient</Texte>
        </TouchableOpacity>

        {etiquette("ÉTAPES")}
        {etapes.map((e, i) => (
          <View key={i} style={styles.ligneIng}>
            <Texte style={{ color: t.textMuted, width: 22, fontWeight: "700" }}>{i + 1}.</Texte>
            <ChampTexte value={e} onChangeText={(v) => setEtapes((x) => x.map((y, k) => (k === i ? v : y)))} multiline placeholder="Faire revenir l'oignon…" placeholderTextColor={t.textMuted} style={[...champ, { flex: 1, textAlignVertical: "top" }]} accessibilityLabel={`Étape ${i + 1}`} />
            <TouchableOpacity onPress={() => setEtapes((x) => x.filter((_, k) => k !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer l'étape ${i + 1}`}>
              <Texte style={{ color: t.textMuted, fontSize: 20 }}>×</Texte>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setEtapes((x) => [...x, ""])} style={[styles.bouton, { borderColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontWeight: "600" }}>+ Étape</Texte>
        </TouchableOpacity>

        {etiquette("NOTES")}
        <ChampTexte value={notes} onChangeText={setNotes} multiline placeholder="Astuces, variantes, conservation…" placeholderTextColor={t.textMuted} style={[...champ, { minHeight: 80, textAlignVertical: "top" }]} accessibilityLabel="Notes" />

        <TouchableOpacity onPress={enregistrer} disabled={!titre.trim()} style={[styles.valider, { backgroundColor: titre.trim() ? t.accent : t.border }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer</Texte>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  ligne: { flexDirection: "row", gap: spacing.sm },
  ligneIng: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  apercu: { width: "100%", height: 180, borderRadius: radius.lg },
  ajout: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  valider: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xl },
});
