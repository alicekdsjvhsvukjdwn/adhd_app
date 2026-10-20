import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logEvent } from "./db/events";
import type { ConfigRappel } from "./db/stats";

// Configuration globale : comment les notifications s'affichent quand l'app est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = "rappels-routines";
const NOTIFICATION_ID_PREFIX = "rappel-quotidien";

/**
 * Demande la permission d'envoyer des notifications à l'utilisateur.
 * Retourne true si accordée, false sinon.
 */
export async function demanderPermissionNotifications(): Promise<boolean> {
  // Android nécessite un "channel" pour catégoriser les notifications
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Rappels de routines",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

/**
 * Vérifie si la permission est déjà accordée (sans la redemander).
 */
export async function permissionAccordee(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/**
 * Texte du rappel quotidien. Générique : une notification répétée chaque
 * jour ne peut pas savoir ce qui est déjà fait, une liste serait vite fausse.
 */
export const CONTENU_RAPPEL = {
  title: "Un coup d'œil à tes routines ?",
  body: "Ouvre l'appli pour voir ce qui t'attend aujourd'hui.",
};

/**
 * Programme un rappel quotidien récurrent à l'heure indiquée.
 * Annule le rappel précédent s'il existait.
 */
export async function programmerRappelQuotidien(
  heure: number, // 0-23
  minute: number = 0,
) {
  // On annule les rappels précédents pour éviter les doublons
  await Notifications.cancelScheduledNotificationAsync(
    NOTIFICATION_ID_PREFIX,
  ).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID_PREFIX,
    content: { ...CONTENU_RAPPEL, sound: "default" },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: heure,
      minute: minute,
      repeats: true,
    },
  });

  await logEvent("rappel_programme", null, { heure, minute });
}

/**
 * Met le rappel en accord avec la config : programmé si actif, annulé sinon.
 * Appelé par l'écran Rappels et après une restauration de sauvegarde.
 */
export async function reprogrammerRappel(config: ConfigRappel) {
  if (!config.actif) {
    await annulerRappelQuotidien();
    return;
  }
  await programmerRappelQuotidien(config.heure, config.minute);
}

/**
 * Écoute les notifications reçues et touchées ; renvoie la fonction qui arrête l'écoute.
 */
export function ecouterNotifications(): () => void {
  const reception = Notifications.addNotificationReceivedListener((notification) => {
    logEvent("notification_recue", null, {
      identifier: notification.request.identifier,
    }).catch(() => {});
  });
  const reponse = Notifications.addNotificationResponseReceivedListener((response) => {
    logEvent("notification_tapee", null, {
      identifier: response.notification.request.identifier,
    }).catch(() => {});
  });
  return () => {
    reception.remove();
    reponse.remove();
  };
}

/** Annule tout ce qui est programmé (réinitialisation de l'appli). */
export async function annulerToutesLesNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

const ID_FIN_MINUTEUR = "fin-minuteur";

/**
 * Prévient à la fin du minuteur de « Je commence », seulement si la
 * permission est déjà accordée : on ne la demande pas au moment de se lancer.
 */
export async function programmerFinMinuteur(fin: Date, minutes: number) {
  if (!(await permissionAccordee())) return;
  await annulerFinMinuteur();
  await Notifications.scheduleNotificationAsync({
    identifier: ID_FIN_MINUTEUR,
    content: {
      title: "Le temps est passé",
      body: `Les ${minutes} minutes sont passées. Continuer ou t'arrêter, les deux vont bien.`,
      sound: "default",
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fin },
  });
}

export async function annulerFinMinuteur() {
  await Notifications.cancelScheduledNotificationAsync(ID_FIN_MINUTEUR).catch(
    () => {},
  );
}

/**
 * Annule le rappel quotidien.
 */
export async function annulerRappelQuotidien() {
  await Notifications.cancelScheduledNotificationAsync(
    NOTIFICATION_ID_PREFIX,
  ).catch(() => {});
}

/**
 * Envoie une notification de test immédiatement (pour vérifier que ça marche
 * sans attendre l'heure programmée).
 */
export async function envoyerNotificationTest() {
  await Notifications.scheduleNotificationAsync({
    content: { ...CONTENU_RAPPEL, sound: "default" },
    trigger: null, // null = envoyer immédiatement
  });
}
