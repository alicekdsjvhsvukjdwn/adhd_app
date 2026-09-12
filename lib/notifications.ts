import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logEvent, RoutineAvecStatut } from "./db";

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
 * Formule une routine sous forme "Si X, alors Y" en utilisant son ancre.
 */
function formulerRoutine(r: RoutineAvecStatut): string {
  if (!r.ancre_nom) return r.nom;
  const prefixe = r.ancre_position === "avant" ? "Avant" : "Après";
  return `${prefixe} ${r.ancre_nom.toLowerCase()} → ${r.nom}`;
}

/**
 * Génère le contenu du rappel quotidien à partir des routines non faites.
 * Retourne null si toutes les routines sont déjà faites (pas besoin de notif).
 */
export function construireContenuRappel(routines: RoutineAvecStatut[]): {
  title: string;
  body: string;
} | null {
  const nonFaites = routines.filter((r) => !r.faitAujourdhui);
  if (nonFaites.length === 0) return null;

  // On limite à 3 routines dans le body pour ne pas surcharger (principe TDAH-friendly)
  const aAfficher = nonFaites.slice(0, 3);
  const lignes = aAfficher.map(formulerRoutine);

  const restantes = nonFaites.length - aAfficher.length;
  const suffixe = restantes > 0 ? `\n... et ${restantes} de plus` : "";

  return {
    title:
      nonFaites.length === 1
        ? "Une routine t'attend"
        : `${nonFaites.length} routines à finir`,
    body: lignes.join("\n") + suffixe,
  };
}

/**
 * Programme un rappel quotidien récurrent à l'heure indiquée.
 * Annule le rappel précédent s'il existait.
 */
export async function programmerRappelQuotidien(
  heure: number, // 0-23
  minute: number = 0,
  contenu: { title: string; body: string },
) {
  // On annule les rappels précédents pour éviter les doublons
  await Notifications.cancelScheduledNotificationAsync(
    NOTIFICATION_ID_PREFIX,
  ).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID_PREFIX,
    content: {
      title: contenu.title,
      body: contenu.body,
      sound: "default",
    },
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
 * Annule le rappel quotidien.
 */
export async function annulerRappelQuotidien() {
  await Notifications.cancelScheduledNotificationAsync(
    NOTIFICATION_ID_PREFIX,
  ).catch(() => {});
}

/**
 * Récupère la liste des notifications programmées (utile pour le debug ou l'écran de réglages).
 */
export async function getRappelsProgrammes() {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Envoie une notification de test immédiatement (pour vérifier que ça marche
 * sans attendre l'heure programmée).
 */
export async function envoyerNotificationTest(contenu: {
  title: string;
  body: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: contenu.title,
      body: contenu.body,
      sound: "default",
    },
    trigger: null, // null = envoyer immédiatement
  });
}
