import type { Reglages } from "../push-worker/src/rappels";

/**
 * Rappels de la version web (Web Push). Le navigateur donne un abonnement ;
 * le Worker (push-worker/) le garde avec les heures et envoie les rappels.
 * Seuls l'abonnement et les heures partent : aucune donnée de l'appli.
 */

const URL_PUSH = process.env.EXPO_PUBLIC_PUSH_URL;
const CLE_PARTAGEE = process.env.EXPO_PUBLIC_PUSH_CLE;
const VAPID_PUBLIQUE = process.env.EXPO_PUBLIC_VAPID_PUBLIC;
const FUSEAU = "Europe/Paris";
const CLE_REGLAGES = "rappels-web";

export type EtatRappels =
  | "indisponible" // ce navigateur ne sait pas faire de Web Push
  | "pas-installee" // iPhone : l'appli doit d'abord être sur l'écran d'accueil
  | "non-configure" // serveur de rappels pas encore publié
  | "refuse" // notifications refusées dans les réglages
  | "inactif"
  | "actif";

export const REGLAGES_DEFAUT: Reglages = {
  quotidien: { actif: false, heure: "20:00" },
  soir: { actif: false, heure: "22:30" },
};

/** Ouverte depuis l'écran d'accueil (et non dans un onglet de Safari). */
export function installee(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function lireReglages(): Reglages {
  try {
    return { ...REGLAGES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE_REGLAGES) ?? "{}") };
  } catch {
    return REGLAGES_DEFAUT;
  }
}

function ecrireReglages(r: Reglages) {
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(r));
  } catch {}
}

async function abonnementActuel(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function etatRappels(): Promise<EtatRappels> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // Sur iPhone, ces API n'existent que dans l'appli installée.
    return /iPhone|iPad/.test(navigator.userAgent) && !installee() ? "pas-installee" : "indisponible";
  }
  if (!installee() && /iPhone|iPad/.test(navigator.userAgent)) return "pas-installee";
  if (!URL_PUSH || !CLE_PARTAGEE || !VAPID_PUBLIQUE) return "non-configure";
  if (Notification.permission === "denied") return "refuse";
  return Notification.permission === "granted" && (await abonnementActuel()) ? "actif" : "inactif";
}

const base64VersOctets = (b64: string) => {
  const brut = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
};

async function appeler(methode: "POST" | "DELETE", chemin: string, corps: unknown) {
  const r = await fetch(`${URL_PUSH}${chemin}`, {
    method: methode,
    headers: { authorization: `Bearer ${CLE_PARTAGEE}`, "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`Le serveur de rappels a répondu ${r.status}.`);
  return r;
}

/** Envoie l'abonnement et les heures au serveur. */
export async function synchroniser(reglages: Reglages): Promise<void> {
  ecrireReglages(reglages);
  const sub = await abonnementActuel();
  if (!sub) return;
  await appeler("POST", "/abonnement", { subscription: sub.toJSON(), reglages, fuseau: FUSEAU });
}

/**
 * À appeler depuis un tap : demande la permission, s'abonne, envoie les heures.
 * Renvoie false si la permission est refusée.
 */
export async function activer(reglages: Reglages): Promise<boolean> {
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64VersOctets(VAPID_PUBLIQUE!) as BufferSource,
    }));
  ecrireReglages(reglages);
  await appeler("POST", "/abonnement", { subscription: sub.toJSON(), reglages, fuseau: FUSEAU });
  return true;
}

/** Se désabonne, côté serveur puis côté navigateur. */
export async function desactiver(): Promise<void> {
  const sub = await abonnementActuel();
  if (!sub) return;
  await appeler("DELETE", "/abonnement", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

/** Fait envoyer une notification tout de suite par le serveur. */
export async function tester(): Promise<void> {
  const sub = await abonnementActuel();
  if (sub) await appeler("POST", "/test", { endpoint: sub.endpoint });
}
