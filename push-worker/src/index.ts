import { buildPushPayload } from "@block65/webcrypto-web-push";
import { rappelsDus, TEXTES, type Envoyes, type Reglages, type TypeRappel } from "./rappels";

// Le Worker ne garde que l'abonnement push et les heures choisies. Aucune donnée de l'appli.

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
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
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
