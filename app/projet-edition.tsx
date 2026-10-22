import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { IconeProjet } from "../components/IconeProjet";
import { ChampTexte, Texte } from "../components/Texte";
import { creerProjet, lireProjet, listerTypes, modifierProjet, type TypeProjet } from "../lib/db/projets";
import { choisirPhotos } from "../lib/photos";
import { lignesDe } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Nouveau projet (nom, type, photo facultative, pourquoi, premières étapes) ou modification d'un projet (?id=). */
export default function ProjetEdition() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const projetId = id ? Number(id) : null;
  const [types, setTypes] = useState<TypeProjet[]>([]);
  const [nom, setNom] = useState("");
  const [typeId, setTypeId] = useState<number | null>(null);
  const [pourquoi, setPourquoi] = useState("");
  const [couverture, setCouverture] = useState("");
  const [etapes, setEtapes] = useState("");

  useFocusEffect(
    useCallback(() => {
      listerTypes().then(setTypes);
    }, []),
  );
  useEffect(() => {
    if (projetId === null) return;
    lireProjet(projetId).then((p) => {
      if (!p) return;
      setNom(p.nom);
      setTypeId(p.type_id);
      setPourquoi(p.pourquoi);
      setCouverture(p.couverture);
    });
  }, [projetId]);

  const typeChoisi = typeId ?? types[0]?.id ?? 0;

  const photo = async () => {
    const [p] = await choisirPhotos(1);
    if (p) setCouverture(p);
  };

  const enregistrer = async () => {
    if (!nom.trim()) return;
    if (projetId === null) {
      const nouveau = await creerProjet({ nom, type_id: typeChoisi, pourquoi, couverture, etapes: lignesDe(etapes) });
      if (nouveau !== null) router.replace(`/projet?id=${nouveau}` as never);
    } else {
      await modifierProjet(projetId, { nom, type_id: typeChoisi, pourquoi, couverture });
      router.back();
    }
  };

  const champ = [styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{projetId === null ? "Nouveau projet" : "Modifier le projet"}</Texte>

        <Texte style={[styles.etiquette, { color: t.textMuted }]}>NOM</Texte>
        <ChampTexte value={nom} onChangeText={setNom} placeholder="Réveil lumineux, portrait de Mila…" placeholderTextColor={t.textMuted} style={champ} accessibilityLabel="Nom du projet" />

        <Texte style={[styles.etiquette, { color: t.textMuted }]}>TYPE</Texte>
        <View style={styles.puces}>
          {types.map((ty) => {
            const actif = ty.id === typeChoisi;
            return (
              <TouchableOpacity
                key={ty.id}
                onPress={() => setTypeId(ty.id)}
                style={[styles.puce, { borderColor: actif ? ty.couleur : t.border, backgroundColor: actif ? ty.couleur + "33" : "transparent" }]}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <IconeProjet nom={ty.icone} couleur={ty.couleur} taille={16} />
                <Texte style={{ color: t.textPrimary, fontSize: typography.small, fontWeight: "600" }}>{ty.nom}</Texte>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => router.push("/projets-types" as never)} hitSlop={8}>
          <Texte style={{ color: t.accentText, fontSize: typography.small, marginTop: spacing.sm }}>Gérer mes types</Texte>
        </TouchableOpacity>

        <Texte style={[styles.etiquette, { color: t.textMuted }]}>PHOTO (FACULTATIF)</Texte>
        {couverture ? (
          <View>
            <Image source={{ uri: couverture }} style={styles.apercu} resizeMode="cover" />
            <View style={styles.ligne}>
              <TouchableOpacity onPress={photo}>
                <Texte style={{ color: t.accentText, fontSize: typography.bodySmall }}>Changer</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCouverture("")}>
                <Texte style={{ color: t.danger, fontSize: typography.bodySmall }}>Retirer</Texte>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={photo} style={[styles.ajout, { borderColor: t.border }]} accessibilityRole="button">
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>Ajouter une photo</Texte>
          </TouchableOpacity>
        )}

        <Texte style={[styles.etiquette, { color: t.textMuted }]}>POURQUOI JE LE FAIS (UNE LIGNE)</Texte>
        <ChampTexte value={pourquoi} onChangeText={setPourquoi} placeholder="Me réveiller en douceur" placeholderTextColor={t.textMuted} style={champ} accessibilityLabel="Pourquoi" />

        {projetId === null && (
          <>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>PREMIÈRES ÉTAPES (UNE PAR LIGNE, FACULTATIF)</Texte>
            <ChampTexte
              value={etapes}
              onChangeText={setEtapes}
              multiline
              placeholder={"Choisir les composants\nCommander\nFaire clignoter une LED"}
              placeholderTextColor={t.textMuted}
              style={[champ, { minHeight: 110, textAlignVertical: "top" }]}
              accessibilityLabel="Premières étapes"
            />
          </>
        )}

        <TouchableOpacity
          onPress={enregistrer}
          disabled={!nom.trim()}
          style={[styles.valider, { backgroundColor: nom.trim() ? t.accent : t.border }]}
          accessibilityRole="button"
        >
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>{projetId === null ? "Créer le projet" : "Enregistrer"}</Texte>
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
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  apercu: { width: "100%", height: 180, borderRadius: radius.lg },
  ligne: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.sm },
  ajout: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  valider: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xl },
});
