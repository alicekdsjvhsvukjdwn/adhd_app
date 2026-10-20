import type { ConfigRappel } from "./db/stats";
import { activer, etatRappels, lireReglages, tester } from "./push-web";

/**
 * Version web des rappels (voir lib/push-web.ts et app/rappels.web.tsx).
 * Les rappels du téléphone sont programmés sur l'appareil ; ceux du web sont
 * envoyés par le serveur de rappels, avec leurs propres réglages. Les
 * fonctions de la version téléphone qui n'ont plus de sens ici ne font rien.
 */

export const CONTENU_RAPPEL = {
  title: "Un coup d'œil à tes routines ?",
  body: "Ouvre l'appli pour voir ce qui t'attend aujourd'hui.",
};

export const demanderPermissionNotifications = () => activer(lireReglages());
export const permissionAccordee = async () => (await etatRappels()) === "actif";
export const envoyerNotificationTest = tester;

// Les réglages de rappel de la base (téléphone) ne servent pas sur le web.
export async function reprogrammerRappel(_config: ConfigRappel) {}
export async function programmerRappelQuotidien(_heure: number, _minute?: number) {}
export async function annulerRappelQuotidien() {}

// Pas de minuteur de fin en notification : l'appli doit être ouverte (bip dans la page).
export async function programmerFinMinuteur(_fin: Date, _minutes: number) {}
export async function annulerFinMinuteur() {}

export function ecouterNotifications(): () => void {
  return () => {};
}
export async function annulerToutesLesNotifications() {
  const { desactiver } = await import("./push-web");
  await desactiver();
}
