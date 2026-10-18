import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initialiserBase } from "../lib/db/demarrage";
import { logEvent } from "../lib/db/events";
import { getConfigRappel } from "../lib/db/stats";
import { permissionAccordee, reprogrammerRappel } from "../lib/notifications";
import { spacing, typography, useTheme } from "../lib/theme";

export default function RootLayout() {
  const t = useTheme();
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
    const subscriptionReception = Notifications.addNotificationReceivedListener(
      (notification) => {
        logEvent("notification_recue", null, {
          identifier: notification.request.identifier,
        }).catch(() => {});
      },
    );

    const subscriptionReponse =
      Notifications.addNotificationResponseReceivedListener((response) => {
        logEvent("notification_tapee", null, {
          identifier: response.notification.request.identifier,
        }).catch(() => {});
      });

    return () => {
      subscriptionReception.remove();
      subscriptionReponse.remove();
    };
  }, []);

  if (erreur) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bgApp }}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 80 }}
      >
        <Text style={{ fontSize: typography.h2, fontWeight: "600", color: t.textPrimary }}>
          Les données ne s'ouvrent pas
        </Text>
        <Text style={{ fontSize: typography.body, color: t.textSecondary, marginTop: spacing.md }}>
          Rien n'a été effacé. Ferme l'appli complètement puis rouvre-la. Si ça
          recommence, note le message ci-dessous.
        </Text>
        <Text selectable style={{ fontSize: typography.bodySmall, color: t.textMuted, marginTop: spacing.lg }}>
          {erreur}
        </Text>
      </ScrollView>
    );
  }

  if (!pret) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
