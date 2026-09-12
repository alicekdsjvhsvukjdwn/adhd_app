import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { logEvent } from "../lib/db";

export default function RootLayout() {
  useEffect(() => {
    // Écoute quand une notification est REÇUE alors que l'app est ouverte
    const subscriptionReception = Notifications.addNotificationReceivedListener(
      (notification) => {
        logEvent("notification_recue", null, {
          identifier: notification.request.identifier,
        }).catch(() => {});
      },
    );

    // Écoute quand l'utilisateur TAPE sur une notification (ouvre l'app depuis la notif)
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack />
    </GestureHandlerRootView>
  );
}
