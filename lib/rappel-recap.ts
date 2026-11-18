import * as Notifications from "expo-notifications";
import { demanderPermissionNotifications } from "./notifications";
import { minutesDe } from "./suivi-regles";

/**
 * « Ton récap de la semaine est prêt » : chaque dimanche à l'heure du récap, programmé sur l'appareil.
 * Le web a son propre fichier (rappel-recap.web.ts) : seule l'heure part au serveur de rappels.
 */
const ID_RECAP = "rappel-recap";

/** Programme (ou annule). Renvoie false si la permission est refusée. */
export async function programmerRappelRecap(r: { actif: boolean; heure: string }): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(ID_RECAP).catch(() => {});
  if (!r.actif) return true;
  if (!(await demanderPermissionNotifications())) return false;
  const min = minutesDe(r.heure);
  await Notifications.scheduleNotificationAsync({
    identifier: ID_RECAP,
    content: { title: "Ton récap de la semaine est prêt", body: "Six cartes pour voir ta semaine, à ton rythme.", sound: "default" },
    // weekday : 1 = dimanche.
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: Math.floor(min / 60), minute: min % 60 },
  });
  return true;
}
