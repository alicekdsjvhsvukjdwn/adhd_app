import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Texte } from "../../components/Texte";
import { BoutonReinitialiser } from "../../components/BoutonReinitialiser";
import { CarteSauvegarde } from "../../components/CarteSauvegarde";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

type Entree = {
  titre: string;
  description: string;
  route: string;
};

const ENTREES: Entree[] = [
  {
    titre: "Idées de routines",
    description: "À partir de ce qui est difficile en ce moment.",
    route: "/mise-en-place",
  },
  {
    titre: "Mes moments repères",
    description: "Les ancres auxquelles rattacher les routines.",
    route: "/ancres",
  },
  {
    titre: "Rappels quotidiens",
    description: "Quand l'appli te fait signe.",
    route: "/rappels",
  },
];

/** Web : les mesures de l'écran, pour comprendre un écart de mise en page sur l'iPhone. */
function MesuresWeb() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [, rafraichir] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = setInterval(() => rafraichir((n) => n + 1), 700);
    return () => clearInterval(id);
  }, []);
  if (Platform.OS !== "web") return null;
  const racine = document.getElementById("root")?.getBoundingClientRect();
  const essai2 = document.documentElement.classList.contains("mise2");
  const choisir = (deux: boolean) => {
    document.documentElement.classList.toggle("mise2", deux);
    try {
      localStorage.setItem("mise", deux ? "2" : "1");
    } catch {}
  };
  return (
    <>
      <Texte style={[styles.version, { color: t.textMuted }]} selectable>
        Mesures : fenêtre {window.innerWidth}×{window.innerHeight} · écran {screen.width}×{screen.height} ·
        zone sûre haut {insets.top} bas {insets.bottom} · page {Math.round(racine?.height ?? 0)} haut{" "}
        {Math.round(racine?.top ?? 0)} bas {Math.round(racine?.bottom ?? 0)} · standalone{" "}
        {window.matchMedia("(display-mode: standalone)").matches ? "oui" : "non"}
      </Texte>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.md, marginTop: spacing.sm }}>
        {[false, true].map((deux) => (
          <TouchableOpacity
            key={String(deux)}
            onPress={() => choisir(deux)}
            style={[styles.essai, { borderColor: essai2 === deux ? t.accent : t.border }]}
          >
            <Texte style={{ color: essai2 === deux ? t.accent : t.textMuted, fontSize: typography.small }}>
              Mise en page : essai {deux ? 2 : 1}
            </Texte>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

export default function Profil() {
  const router = useRouter();
  const t = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Profil</Texte>

        {ENTREES.map((e) => (
          <TouchableOpacity
            key={e.route}
            style={[styles.entree, { backgroundColor: t.bgCard }]}
            onPress={() => router.push(e.route as never)}
          >
            <Texte style={[styles.entreeTitre, { color: t.textPrimary }]}>
              {e.titre}
            </Texte>
            <Texte style={[styles.entreeTexte, { color: t.textSecondary }]}>
              {e.description}
            </Texte>
          </TouchableOpacity>
        ))}

        <CarteSauvegarde />

        <BoutonReinitialiser />

        <TouchableOpacity
          style={styles.aide}
          onPress={() => Linking.openURL("tel:3114")}
        >
          <Texte style={[styles.aideTexte, { color: t.textMuted }]}>
            Si ça ne va vraiment pas : le 3114, numéro national de prévention du
            suicide, gratuit, 24 h/24. Toucher pour appeler.
          </Texte>
        </TouchableOpacity>

        <Texte style={[styles.version, { color: t.textMuted }]}>
          Version {Constants.expoConfig?.version}
          {process.env.EXPO_PUBLIC_BUILD ? ` · publiée le ${process.env.EXPO_PUBLIC_BUILD}` : ""}
        </Texte>

        <MesuresWeb />

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  entree: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  entreeTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: 4,
  },
  entreeTexte: { fontSize: typography.small, lineHeight: 19 },
  essai: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  version: { fontSize: typography.tiny, textAlign: "center", marginTop: spacing.lg },
  aide: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  aideTexte: { fontSize: typography.tiny, lineHeight: 17, textAlign: "center" },
});
