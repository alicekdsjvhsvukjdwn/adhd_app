// Une graisse par import : seules les 8 utilisées entrent dans l'appli.
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { SpaceGrotesk_400Regular } from "@expo-google-fonts/space-grotesk/400Regular";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  View,
} from "react-native";
import { FournisseurTheme } from "../components/FournisseurTheme";
import { Texte } from "../components/Texte";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initialiserBase } from "../lib/db/demarrage";
import { getConfigRappel } from "../lib/db/stats";
import "../lib/alerte-web";
import { demarrerPwa } from "../lib/pwa-web";
import { ecouterNotifications, permissionAccordee, reprogrammerRappel } from "../lib/notifications";
import { spacing, typography, useTheme } from "../lib/theme";

export default function RootLayout() {
  return (
    <FournisseurTheme>
      <StatusBar style="light" />
      <Contenu />
    </FournisseurTheme>
  );
}

function Contenu() {
  const router = useRouter();
  const t = useTheme();
  // Une erreur de police ne bloque rien : l'appli s'affiche avec la police du système.
  const [policesChargees, erreurPolices] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Base de données : migrations, puis les tables annexes (voir demarrage.ts).
  // Rien ne s'affiche tant que ce n'est pas terminé.
  useEffect(() => {
    (async () => {
      try {
        await initialiserBase();
        setPret(true);
        // Remplace un ancien rappel au texte figé par le rappel générique.
        const rappel = await getConfigRappel();
        if (rappel.actif && (await permissionAccordee())) {
          reprogrammerRappel(rappel).catch(() => {});
        }
      } catch (e) {
        console.error("[db] initialisation impossible", e);
        setErreur(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") demarrerPwa((chemin) => router.navigate(chemin as never));
  }, [router]);

  useEffect(() => {
    return ecouterNotifications();
  }, []);

  if (erreur) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bgApp }}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 80 }}
      >
        <Texte style={{ fontSize: typography.h2, fontWeight: "600", color: t.textPrimary }}>
          Les données ne s&apos;ouvrent pas
        </Texte>
        <Texte style={{ fontSize: typography.body, color: t.textSecondary, marginTop: spacing.md }}>
          Rien n&apos;a été effacé. Ferme l&apos;appli complètement puis rouvre-la. Si ça
          recommence, note le message ci-dessous.
        </Texte>
        <Texte selectable style={{ fontSize: typography.bodySmall, color: t.textMuted, marginTop: spacing.lg }}>
          {erreur}
        </Texte>
      </ScrollView>
    );
  }

  if (!pret || !(policesChargees || erreurPolices)) {
    return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bgApp }}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bgApp } }}
      />
    </GestureHandlerRootView>
  );
}
