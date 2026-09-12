import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { logEvent } from "../lib/db";

export default function RootLayout() {
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
