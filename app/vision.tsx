import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { MenuOptions } from "../components/MenuOptions";
import type { Option } from "../components/Options";
import { ChampTexte, Texte } from "../components/Texte";
import {
  ajouterDomaineVision,
  ajouterPhotosVision,
  ajouterPhraseVision,
  definirRoutineVision,
  getRoutineVision,
  getVision,
  modifierPhraseVision,
  nombrePhotos,
  renommerDomaineVision,
  supprimerDomaineVision,
  supprimerPhotoVision,
  supprimerPhraseVision,
  type DomaineVision,
  type PhotoVision,
  type PhraseVision,
} from "../lib/db/vision";
import { routinesDisponibles } from "../lib/db/routine-liee";
import { choisirPhotos } from "../lib/photos";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { MAX_PHOTOS, placesPhotos } from "../lib/vision-regles";

const apres = (f: () => void) => setTimeout(f, 350);

type Saisie = { type: "domaine" | "phrase"; id?: number; domaineId?: number; texte: string } | null;

/** Ma vision : un tableau de manifestation par domaine de vie, avec des photos et des phrases au présent. */
export default function Vision() {
  const router = useRouter();
  const t = useTheme();
  const [domaines, setDomaines] = useState<DomaineVision[]>([]);
  const [photos, setPhotos] = useState<PhotoVision[]>([]);
  const [phrases, setPhrases] = useState<PhraseVision[]>([]);
  const [routines, setRoutines] = useState<{ id: number; nom: string }[]>([]);
  const [liee, setLiee] = useState<number | null>(null);
  const [saisie, setSaisie] = useState<Saisie>(null);
  const [menu, setMenu] = useState<{ titre: string; options: Option[] }>({ titre: "", options: [] });
  const [choixRoutine, setChoixRoutine] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const v = await getVision();
    setDomaines(v.domaines);
    setPhotos(v.photos);
    setPhrases(v.phrases);
    setRoutines(await routinesDisponibles());
    setLiee(await getRoutineVision());
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const ajouterPhotos = async (d: DomaineVision) => {
    const places = placesPhotos(await nombrePhotos());
    if (places === 0) {
      Alert.alert("La galerie est pleine", `Ma vision garde ${MAX_PHOTOS} photos au plus. Retires-en une pour en ajouter.`);
      return;
    }
    setOccupe(true);
    try {
      await ajouterPhotosVision(d.id, await choisirPhotos(places));
    } catch (e) {
      Alert.alert("Les photos n'ont pas pu être ajoutées", String(e));
    } finally {
      setOccupe(false);
      await charger();
    }
  };

  const optionsDomaine = (d: DomaineVision): Option[] => [
    { libelle: "Renommer", onPress: () => apres(() => setSaisie({ type: "domaine", id: d.id, texte: d.nom })) },
    {
      libelle: "Supprimer le domaine et son contenu",
      danger: true,
      onPress: async () => {
        await supprimerDomaineVision(d.id);
        await charger();
      },
    },
  ];

  const enregistrer = async () => {
    if (!saisie || !saisie.texte.trim()) return;
    const s = saisie;
    setSaisie(null);
    if (s.type === "domaine") {
      if (s.id) await renommerDomaineVision(s.id, s.texte);
      else await ajouterDomaineVision(s.texte);
    } else if (s.id) await modifierPhraseVision(s.id, s.texte);
    else if (s.domaineId) await ajouterPhraseVision(s.domaineId, s.texte);
    await charger();
  };

  const nomRoutine = routines.find((r) => r.id === liee)?.nom;

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Ma vision</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
          Des photos et des phrases au présent, comme si c&apos;était déjà vrai. {photos.length}/{MAX_PHOTOS} photos.
        </Texte>

        <TouchableOpacity onPress={() => router.push("/vision-lecture" as never)} style={[styles.lire, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontSize: typography.body, fontWeight: "700" }}>▶ Lire ma vision</Texte>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setChoixRoutine(true)} hitSlop={8} style={{ marginTop: spacing.md }} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontSize: typography.small }}>
            {nomRoutine ? `Routine liée : ${nomRoutine} (cochée après la lecture)` : "Lier une routine à la lecture"}
          </Texte>
        </TouchableOpacity>

        {domaines.map((d) => {
          const sesPhotos = photos.filter((p) => p.domaine_id === d.id);
          const sesPhrases = phrases.filter((p) => p.domaine_id === d.id);
          return (
            <View key={d.id} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <TouchableOpacity
                onLongPress={() => setMenu({ titre: d.nom, options: optionsDomaine(d) })}
                onPress={() => setMenu({ titre: d.nom, options: optionsDomaine(d) })}
                accessibilityRole="button"
                accessibilityHint="Renommer ou supprimer"
              >
                <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>{d.nom} ⋯</Texte>
              </TouchableOpacity>

              {sesPhotos.length > 0 && (
                <View style={styles.mosaique}>
                  {sesPhotos.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() =>
                        setMenu({
                          titre: "Cette photo",
                          options: [
                            {
                              libelle: "Retirer la photo",
                              danger: true,
                              onPress: async () => {
                                await supprimerPhotoVision(p.id);
                                await charger();
                              },
                            },
                          ],
                        })
                      }
                      style={styles.vignette}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`Photo de ${d.nom}`}
                    >
                      <Image source={{ uri: p.data }} style={styles.image} contentFit="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity onPress={() => ajouterPhotos(d)} disabled={occupe} hitSlop={8} style={{ marginTop: spacing.md }} accessibilityRole="button">
                <Texte style={{ color: occupe ? t.textMuted : t.accentText, fontSize: typography.small }}>{occupe ? "Préparation des photos…" : "＋ Des photos de ma galerie"}</Texte>
              </TouchableOpacity>

              {sesPhrases.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() =>
                    setMenu({
                      titre: f.texte,
                      options: [
                        { libelle: "Modifier", onPress: () => apres(() => setSaisie({ type: "phrase", id: f.id, texte: f.texte })) },
                        {
                          libelle: "Supprimer",
                          danger: true,
                          onPress: async () => {
                            await supprimerPhraseVision(f.id);
                            await charger();
                          },
                        },
                      ],
                    })
                  }
                  style={styles.phrase}
                  accessibilityRole="button"
                >
                  <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontStyle: "italic" }}>« {f.texte} »</Texte>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setSaisie({ type: "phrase", domaineId: d.id, texte: "" })} hitSlop={8} style={{ marginTop: spacing.sm }} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.small }}>＋ Une phrase au présent</Texte>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity onPress={() => setSaisie({ type: "domaine", texte: "" })} hitSlop={8} style={{ marginTop: spacing.lg }} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>＋ Un domaine</Texte>
        </TouchableOpacity>
      </ScrollView>

      <MenuOptions titre={menu.titre} options={menu.options} onFermer={() => setMenu({ titre: "", options: [] })} />

      <MenuOptions
        titre="Routine cochée après la lecture"
        options={
          choixRoutine
            ? [
                { libelle: "Aucune", onPress: async () => { await definirRoutineVision(null); await charger(); } },
                ...routines.map((r) => ({ libelle: r.nom, onPress: async () => { await definirRoutineVision(r.id); await charger(); } })),
              ]
            : []
        }
        onFermer={() => setChoixRoutine(false)}
      />

      <Modal visible={saisie !== null} transparent animationType="fade" onRequestClose={() => setSaisie(null)}>
        <Pressable style={styles.fond} onPress={() => setSaisie(null)}>
          <Pressable style={[styles.dialogue, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600", marginBottom: spacing.md }}>
              {saisie?.type === "domaine" ? (saisie.id ? "Renommer le domaine" : "Un domaine") : "Une phrase au présent"}
            </Texte>
            <ChampTexte
              value={saisie?.texte ?? ""}
              onChangeText={(texte) => setSaisie((s) => s && { ...s, texte })}
              placeholder={saisie?.type === "domaine" ? "Ex : Voyages" : "Ex : Je travaille sur l'eau"}
              placeholderTextColor={t.textMuted}
              autoFocus
              multiline={saisie?.type === "phrase"}
              style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
            />
            <View style={styles.boutons}>
              <TouchableOpacity onPress={() => setSaisie(null)} hitSlop={8}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={enregistrer} hitSlop={8} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.body, fontWeight: "700" }}>Enregistrer</Texte>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  lire: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg },
  mosaique: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  vignette: { width: "31.5%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  phrase: { paddingVertical: spacing.sm },
  fond: { flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: "rgba(0,0,0,0.5)" },
  dialogue: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, maxWidth: 420, width: "100%", alignSelf: "center" },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  boutons: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
});
