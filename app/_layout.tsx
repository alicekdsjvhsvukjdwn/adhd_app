import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initAncres,
  initPreferences,
  initStats,
  logEvent,
  runMigrations,
} from "../lib/db";

export default function RootLayout() {
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Base de données : migrations d'abord, puis les tables annexes.
  // Rien ne s'affiche tant que ce n'est pas terminé.
  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        await Promise.all([initAncres(), initStats(), initPreferences()]);
        setPret(true);
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
    console.warn("Erreur d'initialisation de la base :", erreur);
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
