// Choix des rappels à envoyer. Fonction pure : aucun accès réseau ni KV,
// utilisée par le Worker et testée dans tests/rappels-web.test.mjs.

export type TypeRappel = "quotidien" | "soir";

export type Reglages = {
  quotidien: { actif: boolean; heure: string };
  soir: { actif: boolean; heure: string };
};

/** Date locale (AAAA-MM-JJ) du dernier envoi de chaque rappel. */
export type Envoyes = Partial<Record<TypeRappel, string>>;

/** Un rappel en retard de plus que ça n'est plus envoyé : il serait hors de propos. */
export const TOLERANCE_MIN = 60;

export const TEXTES: Record<TypeRappel, { title: string; body: string; url: string }> = {
  quotidien: {
    title: "Un coup d'œil à tes routines ?",
    body: "Ouvre l'appli pour voir ce qui t'attend aujourd'hui.",
    url: "/",
  },
  soir: {
    title: "C'est l'heure de Je vais dormir ?",
    body: "Un geste pour noter ton coucher.",
    url: "/suivi",
  },
};

/** Date et minute du jour dans le fuseau demandé. */
export function heureLocale(maintenant: Date, fuseau: string): { date: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: fuseau,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(maintenant)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/**
 * Rappels dus maintenant : actifs, heure atteinte (depuis moins de
 * TOLERANCE_MIN minutes) et pas déjà envoyés aujourd'hui, jour du fuseau.
 */
export function rappelsDus(
  maintenant: Date,
  fuseau: string,
  reglages: Reglages,
  envoyes: Envoyes,
): TypeRappel[] {
  const { date, minutes } = heureLocale(maintenant, fuseau);
  return (["quotidien", "soir"] as const).filter((type) => {
    const r = reglages[type];
    if (!r?.actif || envoyes[type] === date) return false;
    const [h, m] = r.heure.split(":").map(Number);
    const retard = minutes - (h * 60 + m);
    return retard >= 0 && retard < TOLERANCE_MIN;
  });
}
