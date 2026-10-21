import { ecrireMeta, lireMeta } from "./db/meta";
import type { Evenement } from "./agenda-regles";

/**
 * Rendez-vous Google Agenda (lecture seule), via le Worker : l'adresse iCal
 * secrète lui est envoyée une seule fois et n'est jamais gardée dans l'appli.
 * Les derniers rendez-vous reçus restent en cache pour le hors-ligne.
 */

const URL_PUSH = process.env.EXPO_PUBLIC_PUSH_URL;
const CLE_PARTAGEE = process.env.EXPO_PUBLIC_PUSH_CLE;
const CLE_CACHE = "agenda_cache";
const CLE_ACTIF = "agenda_actif";

export type Agenda = { evenements: Evenement[]; maj: number; horsLigne: boolean };

export const agendaDisponible = () => !!URL_PUSH && !!CLE_PARTAGEE;

const appeler = (chemin: string, methode: "GET" | "POST" | "DELETE", corps?: unknown) =>
  fetch(`${URL_PUSH}${chemin}`, {
    method: methode,
    headers: { authorization: `Bearer ${CLE_PARTAGEE}`, ...(corps ? { "content-type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });

export const agendaActif = async () => (await lireMeta(CLE_ACTIF)) === "1";

/** Envoie l'adresse secrète au Worker, puis charge tout de suite les rendez-vous. */
export async function connecterAgenda(url: string): Promise<void> {
  if (!agendaDisponible()) throw new Error("Le serveur de rappels n'est pas configuré.");
  const r = await appeler("/agenda/url", "POST", { url: url.trim() });
  if (!r.ok) throw new Error(r.status === 400 ? "Ce n'est pas une adresse iCal de Google Agenda." : `Échec (${r.status})`);
  await ecrireMeta(CLE_ACTIF, "1");
  await ecrireMeta(CLE_CACHE, null);
}

export async function deconnecterAgenda(): Promise<void> {
  if (agendaDisponible()) await appeler("/agenda/url", "DELETE").catch(() => {});
  await ecrireMeta(CLE_ACTIF, null);
  await ecrireMeta(CLE_CACHE, null);
}

/** Rendez-vous à jour si le serveur répond, sinon les derniers connus ; null si aucun agenda. */
export async function chargerAgenda(): Promise<Agenda | null> {
  if (!(await agendaActif())) return null;
  try {
    if (!agendaDisponible()) throw new Error("non configuré");
    const r = await appeler("/agenda", "GET");
    if (!r.ok) throw new Error(String(r.status));
    const { evenements, maj, perime } = (await r.json()) as { evenements: Evenement[]; maj: number; perime?: boolean };
    await ecrireMeta(CLE_CACHE, JSON.stringify({ evenements, maj }));
    return { evenements, maj, horsLigne: !!perime };
  } catch {
    try {
      const c = JSON.parse((await lireMeta(CLE_CACHE)) ?? "null") as { evenements: Evenement[]; maj: number } | null;
      return c ? { ...c, horsLigne: true } : null;
    } catch {
      return null;
    }
  }
}

/** Derniers rendez-vous reçus (hors-ligne, ou en attendant le serveur) ; null si aucun agenda. */
export async function agendaEnCache(): Promise<Agenda | null> {
  if (!(await agendaActif())) return null;
  try {
    const c = JSON.parse((await lireMeta(CLE_CACHE)) ?? "null") as { evenements: Evenement[]; maj: number } | null;
    return c ? { ...c, horsLigne: true } : null;
  } catch {
    return null;
  }
}
