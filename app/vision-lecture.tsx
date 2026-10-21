import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Texte } from "../components/Texte";
import { ecransDeLecture, lectureTerminee } from "../lib/db/vision";
import { SECONDES_PAR_ECRAN, type EcranVision } from "../lib/vision-regles";
import { spacing, typography } from "../lib/theme";

/**
 * Ma vision en plein écran : les photos et les phrases défilent doucement (le matin ou le soir).
 * Toucher la moitié droite passe au suivant, la gauche revient en arrière ; le temps de lecture
 * coche la routine liée.
 */
export default function VisionLecture() {
  useKeepAwake();
  const router = useRouter();
  const [suite, setSuite] = useState<EcranVision[] | null>(null);
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const debut = useRef<number | null>(null);
  const termine = useRef(false);

  useEffect(() => {
    debut.current = Date.now();
    ecransDeLecture().then(setSuite);
  }, []);

  // Le défilement : un écran toutes les SECONDES_PAR_ECRAN secondes, en boucle ; repart à zéro quand on touche.
  useEffect(() => {
    if (!suite || suite.length < 2 || pause) return;
    const id = setTimeout(() => setI((k) => (k + 1) % suite.length), SECONDES_PAR_ECRAN * 1000);
    return () => clearTimeout(id);
  }, [suite, i, pause]);

  const quitter = async () => {
    if (!termine.current) {
      termine.current = true;
      await lectureTerminee((Date.now() - (debut.current ?? Date.now())) / 1000).catch(() => {});
    }
    router.back();
  };

  const aller = (sens: 1 | -1) => suite && suite.length > 0 && setI((k) => (k + sens + suite.length) % suite.length);
  const ecran = suite?.[i];

  return (
    <View style={styles.fond}>
      {suite === null ? null : !ecran ? (
        <View style={styles.centre}>
          <Texte style={styles.phrase}>Rien à lire pour l&apos;instant.</Texte>
          <Texte style={styles.domaine}>Ajoute des photos et des phrases dans Ma vision.</Texte>
        </View>
      ) : (
        <>
          {ecran.type === "photo" ? (
            <Image source={{ uri: ecran.data }} style={StyleSheet.absoluteFill} contentFit="contain" transition={600} />
          ) : (
            <View style={styles.centre}>
              <Texte style={styles.domaine}>{ecran.domaine.toUpperCase()}</Texte>
              <Texte style={styles.phrase}>{ecran.texte}</Texte>
            </View>
          )}
          {/* Moitié gauche : retour · moitié droite : suivant · appui long : pause */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={styles.zones}>
              <Pressable style={{ flex: 1 }} onPress={() => aller(-1)} onLongPress={() => setPause((p) => !p)} accessibilityLabel="Précédent" />
              <Pressable style={{ flex: 1 }} onPress={() => aller(1)} onLongPress={() => setPause((p) => !p)} accessibilityLabel="Suivant" />
            </View>
          </View>
          <View style={styles.progression} pointerEvents="none">
            {suite.map((_, k) => (
              <View key={k} style={[styles.trait, { opacity: k === i ? 1 : 0.25 }]} />
            ))}
          </View>
          {pause && (
            <Texte style={styles.pause} pointerEvents="none">
              En pause · appui long pour reprendre
            </Texte>
          )}
        </>
      )}
      <TouchableOpacity onPress={quitter} style={styles.fermer} hitSlop={16} accessibilityRole="button" accessibilityLabel="Fermer">
        <Texte style={{ color: "#fff", fontSize: 22 }}>✕</Texte>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "#000" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  domaine: { color: "#9AA9A7", fontSize: typography.small, letterSpacing: 2, marginBottom: spacing.lg, textAlign: "center" },
  phrase: { color: "#fff", fontSize: 30, lineHeight: 40, textAlign: "center", fontWeight: "500" },
  zones: { flex: 1, flexDirection: "row" },
  fermer: { position: "absolute", top: 56, right: spacing.xl, width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 22 },
  progression: { position: "absolute", bottom: 40, left: spacing.xl, right: spacing.xl, flexDirection: "row", gap: 3 },
  trait: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "#fff" },
  pause: { position: "absolute", bottom: 64, alignSelf: "center", color: "#fff", fontSize: typography.small, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
});
