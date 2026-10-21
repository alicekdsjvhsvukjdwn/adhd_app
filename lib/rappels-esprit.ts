import * as Notifications from "expo-notifications";
import { ecrireMeta, lireMeta } from "./db/meta";
import { rappelDeSeance } from "./esprit-regles";
import { demanderPermissionNotifications, permissionAccordee } from "./notifications";
import { minutesDe } from "./suivi-regles";

/**
 * Rappels de l'Esprit, version téléphone : tout est programmé sur l'appareil, rien ne part
 * sur un serveur. Le web a son propre fichier (rappels-esprit.web.ts).
 *  - « 30 secondes pour toi » : chaque soir, à l'heure choisie ;
 *  - la veille d'une séance de TCC, à 18 h.
 */

export type RappelEsprit = { actif: boolean; heure: string };

const DEFAUT: RappelEsprit = { actif: false, heure: "21:30" };
const ID_ESPRIT = "rappel-esprit";
const ID_SEANCE = "rappel-seance-tcc";

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

/** Programme la notification de la veille de la prochaine séance (null : plus de séance à venir). */
export async function programmerRappelSeance(seance: { date: string; heure: string } | null): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID_SEANCE).catch(() => {});
  const quand = seance ? rappelDeSeance(seance, new Date()) : null;
  if (!seance || !quand || !(await permissionAccordee())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: ID_SEANCE,
    content: { title: "Séance de TCC demain", body: `À ${seance.heure}. Tes notes sont prêtes dans l'appli.`, sound: "default" },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quand },
  });
}
