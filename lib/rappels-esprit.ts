import * as Notifications from "expo-notifications";
import { ecrireMeta, lireMeta } from "./db/meta";
import { demanderPermissionNotifications } from "./notifications";
import { minutesDe } from "./suivi-regles";

/**
 * Rappels de l'Esprit, version téléphone : tout est programmé sur l'appareil, rien ne part
 * sur un serveur. Le web a son propre fichier (rappels-esprit.web.ts).
 *  - « 30 secondes pour toi » : chaque soir, à l'heure choisie ;
 *  - ma séance avec moi-même : chaque semaine, le jour et l'heure choisis.
 */

export type RappelEsprit = { actif: boolean; heure: string };

const DEFAUT: RappelEsprit = { actif: false, heure: "21:30" };
const ID_ESPRIT = "rappel-esprit";
const ID_SEANCE = "rappel-seance-moi";
const ID_ANCIEN_SEANCE = "rappel-seance-tcc";

export async function lireRappelEsprit(): Promise<RappelEsprit> {
  try {
    return { ...DEFAUT, ...JSON.parse((await lireMeta("rappel_esprit")) ?? "{}") };
  } catch {
    return DEFAUT;
  }
}

/** Enregistre et programme (ou annule). Renvoie false si la permission est refusée. */
export async function ecrireRappelEsprit(c: RappelEsprit): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(ID_ESPRIT).catch(() => {});
  if (c.actif) {
    if (!(await demanderPermissionNotifications())) return false;
    const min = minutesDe(c.heure);
    await Notifications.scheduleNotificationAsync({
      identifier: ID_ESPRIT,
      content: { title: "30 secondes pour toi ?", body: "Un tap pour dire comment ça va.", sound: "default" },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: Math.floor(min / 60),
        minute: min % 60,
        repeats: true,
      },
    });
  }
  await ecrireMeta("rappel_esprit", JSON.stringify(c));
  return true;
}

/**
 * Programme (ou annule) le rappel hebdomadaire de ma séance avec moi-même, sur l'appareil.
 * `jour` : 0 = dimanche. Renvoie false si la permission est refusée.
 */
export async function programmerRappelSeanceMoi(r: { actif: boolean; jour: number; heure: string }): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(ID_SEANCE).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(ID_ANCIEN_SEANCE).catch(() => {}); // ancien rappel de la TCC avec thérapeute
  if (!r.actif) return true;
  if (!(await demanderPermissionNotifications())) return false;
  const min = minutesDe(r.heure);
  await Notifications.scheduleNotificationAsync({
    identifier: ID_SEANCE,
    content: { title: "Ta séance avec toi", body: "Un quart d'heure pour faire le point, à ton rythme.", sound: "default" },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: r.jour + 1, hour: Math.floor(min / 60), minute: min % 60 },
  });
  return true;
}
