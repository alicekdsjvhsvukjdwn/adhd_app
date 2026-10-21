import { buildPushPayload } from "@block65/webcrypto-web-push";
import { analyserIcs, type Evenement } from "./ics";
import { rappelsDus, TEXTES, type Envoyes, type Reglages, type TypeRappel } from "./rappels";

// Le Worker garde l'abonnement push et les heures choisies, plus l'adresse secrète de l'agenda
// (KV, jamais dans le dépôt) et les rendez-vous mis en cache 15 minutes. Aucune autre donnée de l'appli.

const CLE_AGENDA_URL = "agenda:url";
const CLE_AGENDA_CACHE = "agenda:cache";
const CACHE_MS = 15 * 60_000;
/** Seules les adresses iCal de Google Agenda sont acceptées (pas de requête vers n'importe où). */
const ICAL_GOOGLE = /^https:\/\/calendar\.google\.com\/calendar\/ical\/\S+\.ics$/;

type CacheAgenda = { maj: number; evenements: Evenement[] };

async function lireAgenda(env: Env): Promise<{ maj: number; evenements: Evenement[]; perime?: boolean } | null> {
  const url = ((await env.ABONNES.get(CLE_AGENDA_URL, "json")) as { url: string } | null)?.url;
  if (!url) return null;
  const cache = (await env.ABONNES.get(CLE_AGENDA_CACHE, "json")) as CacheAgenda | null;
  if (cache && Date.now() - cache.maj < CACHE_MS) return cache;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const aujourdhui = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    const frais: CacheAgenda = { maj: Date.now(), evenements: analyserIcs(await r.text(), aujourdhui) };
    await env.ABONNES.put(CLE_AGENDA_CACHE, JSON.stringify(frais));
    return frais;
  } catch {
    // Google injoignable : on rend le dernier état connu, signalé comme périmé.
    return cache ? { ...cache, perime: true } : null;
  }
}

type Env = {
  ABONNES: KVNamespace;
  /** Secret partagé avec l'appli (wrangler secret put CLE_PARTAGEE). */
  CLE_PARTAGEE: string;
  VAPID_PUBLIC: string;
  VAPID_PRIVATE: string;
  VAPID_SUBJECT: string;
  /** Adresse du site (CORS), ex. https://routines.pages.dev */
  ORIGINE: string;
};

type Abonne = {
  subscription: { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } };
  reglages: Reglages;
  fuseau: string;
  envoyes: Envoyes;
};

const cle = async (endpoint: string) => {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return "abo:" + [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const cors = (env: Env) => ({
  "Access-Control-Allow-Origin": env.ORIGINE,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
});

async function envoyer(env: Env, a: Abonne, type: TypeRappel): Promise<number> {
  const payload = await buildPushPayload(
    { data: JSON.stringify(TEXTES[type]), options: { ttl: 3600 } },
    a.subscription,
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC, privateKey: env.VAPID_PRIVATE },
  );
  return (await fetch(a.subscription.endpoint, payload)).status;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (req.headers.get("authorization") !== `Bearer ${env.CLE_PARTAGEE}`) {
      return new Response("non autorisé", { status: 401, headers: h });
    }
    const { pathname } = new URL(req.url);

    // Agenda : l'adresse secrète arrive une seule fois et reste ici ; l'appli lit ensuite les rendez-vous.
    if (pathname === "/agenda/url" && req.method === "POST") {
      const url = ((await req.json().catch(() => null)) as { url?: string } | null)?.url?.trim() ?? "";
      if (!ICAL_GOOGLE.test(url)) return new Response("adresse iCal Google invalide", { status: 400, headers: h });
      await env.ABONNES.put(CLE_AGENDA_URL, JSON.stringify({ url }));
      await env.ABONNES.delete(CLE_AGENDA_CACHE);
      return new Response("ok", { headers: h });
    }
    if (pathname === "/agenda/url" && req.method === "DELETE") {
      await env.ABONNES.delete(CLE_AGENDA_URL);
      await env.ABONNES.delete(CLE_AGENDA_CACHE);
      return new Response("ok", { headers: h });
    }
    if (pathname === "/agenda" && req.method === "GET") {
      const a = await lireAgenda(env);
      if (!a) return new Response("pas d'agenda", { status: 404, headers: h });
      return new Response(JSON.stringify(a), { headers: { ...h, "content-type": "application/json" } });
    }

    const corps = (await req.json().catch(() => null)) as any;
    if (!corps?.endpoint && !corps?.subscription?.endpoint) {
      return new Response("requête invalide", { status: 400, headers: h });
    }

    // S'abonner ou modifier les heures : même route, on garde les « déjà envoyé ».
    if (req.method === "POST" && pathname === "/abonnement") {
      const k = await cle(corps.subscription.endpoint);
      const avant = (await env.ABONNES.get(k, "json")) as Abonne | null;
      const a: Abonne = {
        subscription: corps.subscription,
        reglages: corps.reglages,
        fuseau: corps.fuseau || "Europe/Paris",
        envoyes: avant?.envoyes ?? {},
      };
      await env.ABONNES.put(k, JSON.stringify(a));
      return new Response("ok", { headers: h });
    }

    if (req.method === "DELETE" && pathname === "/abonnement") {
      await env.ABONNES.delete(await cle(corps.endpoint));
      return new Response("ok", { headers: h });
    }

    // Notification de test immédiate.
    if (req.method === "POST" && pathname === "/test") {
      const a = (await env.ABONNES.get(await cle(corps.endpoint), "json")) as Abonne | null;
      if (!a) return new Response("inconnu", { status: 404, headers: h });
      return new Response(String(await envoyer(env, a, "quotidien")), { headers: h });
    }

    return new Response("introuvable", { status: 404, headers: h });
  },

  // Toutes les 15 minutes : envoie ce qui est dû, une fois par jour chacun.
  async scheduled(_evt: unknown, env: Env): Promise<void> {
    const maintenant = new Date();
    let curseur: string | undefined;
    do {
      const page = await env.ABONNES.list({ prefix: "abo:", cursor: curseur });
      for (const { name } of page.keys) {
        const a = (await env.ABONNES.get(name, "json")) as Abonne | null;
        if (!a) continue;
        const dus = rappelsDus(maintenant, a.fuseau, a.reglages, a.envoyes);
        for (const type of dus) {
          const statut = await envoyer(env, a, type).catch(() => 0);
          if (statut === 404 || statut === 410) {
            // Abonnement expiré ou supprimé côté téléphone.
            await env.ABONNES.delete(name);
            break;
          }
          if (statut >= 200 && statut < 300) {
            a.envoyes[type] = maintenant.toLocaleDateString("en-CA", { timeZone: a.fuseau });
            await env.ABONNES.put(name, JSON.stringify(a));
          }
        }
      }
      curseur = page.list_complete ? undefined : page.cursor;
    } while (curseur);
  },
};
