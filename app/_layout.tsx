import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { logEvent } from "../lib/db";
import { initialiserBase } from "../lib/db/demarrage";

export default function RootLayout() {
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Base de données : migrations, puis les tables annexes (voir demarrage.ts).
  // Rien ne s'affiche tant que ce n'est pas terminé.
  useEffect(() => {
    (async () => {
      try {
        await initialiserBase();
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
