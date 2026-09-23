import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Check-in d'état : énergie, concentration, humeur (1 = bas, 3 = haut).
 *
 * Pas de créneau fixe : la question revient selon le temps écoulé, au plus
 * 3 fois par jour et avec au moins 3 h d'écart. Quelques mesures courtes
 * et espacées valent mieux que beaucoup de réponses expédiées.
 * L'heure exacte est enregistrée ; le moment de la journée est déduit après coup.
 */

export type Tranche = "matin" | "apres_midi" | "soir";
/** Ancien nom, conservé pour ne pas casser les imports existants. */
export type Fenetre = Tranche;
export type Niveau = 1 | 2 | 3;

export type Etat = {
  id: number;
  date: string;
  /** Heure locale décimale : 14.5 = 14 h 30. */
  heure: number;
  energie: Niveau;
  focus: Niveau;
  humeur: Niveau;
  horodatage: string;
};

/** Au plus ce nombre d'invitations (et de check-ins récompensés) par jour. */
export const MAX_CHECKINS_PAR_JOUR = 3;
/** Écart minimal entre deux invitations, en heures. */
export const ECART_MIN_H = 3;
/** En dessous de cet écart, un nouveau check-in corrige le précédent. */
const CORRECTION_MIN = 30;

export function heureLocale(d = new Date()): number {
  return d.getHours() + d.getMinutes() / 60;
}

export function trancheDeHeure(h: number): Tranche {
  if (h < 12) return "matin";
  if (h < 18) return "apres_midi";
  return "soir";
}

/** Conservé pour compatibilité : moment de la journée actuel. */
export function fenetreCourante(d = new Date()): Fenetre {
  return trancheDeHeure(heureLocale(d));
}

export async function checkinsDuJour(date = getAujourdhui()): Promise<Etat[]> {
  const db = await getDatabase();
  return db.getAllAsync<Etat>(
    "SELECT * FROM etat WHERE date = ? ORDER BY horodatage",
    date,
  );
}

/**
 * État le plus récent, utilisé par le moteur pour l'adéquation
 * entre l'effort d'un item et la capacité du moment.
 * Null tant que rien n'a été saisi : le scoring doit rester fonctionnel sans.
 */
export async function etatRecent(): Promise<Etat | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Etat>(
    "SELECT * FROM etat ORDER BY horodatage DESC LIMIT 1",
  );
}

/** Faut-il proposer un check-in maintenant ? */
export async function checkinPropose(): Promise<boolean> {
  const db = await getDatabase();
  const duJour = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM etat WHERE date = ?",
    getAujourdhui(),
  );
  if ((duJour?.n ?? 0) >= MAX_CHECKINS_PAR_JOUR) return false;

  const dernier = await etatRecent();
  if (!dernier) return true;
  const ecartH =
    (Date.now() - new Date(dernier.horodatage).getTime()) / 3600000;
  return ecartH >= ECART_MIN_H;
}

/** Conservé pour compatibilité : le moment courant si un check-in est proposé. */
export async function checkinManquant(): Promise<Fenetre | null> {
  return (await checkinPropose()) ? fenetreCourante() : null;
}

/** Conservé pour compatibilité : dernier check-in du jour dans ce moment. */
export async function getEtat(
  fenetre: Fenetre,
  date = getAujourdhui(),
): Promise<Etat | null> {
  const duJour = await checkinsDuJour(date);
  const dans = duJour.filter((e) => trancheDeHeure(e.heure) === fenetre);
  return dans.length > 0 ? dans[dans.length - 1] : null;
}

export async function enregistrerEtat(params: {
  energie: Niveau;
  focus: Niveau;
  humeur: Niveau;
  /** Ignoré : conservé pour ne pas casser les appels existants. */
  fenetre?: Fenetre;
}) {
  const db = await getDatabase();
  const maintenant = new Date();
  const date = getAujourdhui();
  const heure = heureLocale(maintenant);

  const dernier = await etatRecent();
  const correction =
    !!dernier &&
    (maintenant.getTime() - new Date(dernier.horodatage).getTime()) / 60000 <
      CORRECTION_MIN;

  if (correction && dernier) {
    // Refaire le check-in juste après : on corrige, on n'empile pas.
    await db.runAsync(
      `UPDATE etat
       SET energie = ?, focus = ?, humeur = ?, heure = ?, horodatage = ?
       WHERE id = ?`,
      params.energie,
      params.focus,
      params.humeur,
      heure,
      maintenant.toISOString(),
      dernier.id,
    );
  } else {
    const avant = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM etat WHERE date = ?",
      date,
    );
    await db.runAsync(
      `INSERT INTO etat (date, heure, energie, focus, humeur, horodatage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      date,
      heure,
      params.energie,
      params.focus,
      params.humeur,
      maintenant.toISOString(),
    );
    // Points limités aux check-ins proposés : pas de course aux points.
    if ((avant?.n ?? 0) < MAX_CHECKINS_PAR_JOUR) {
      const { addPoints } = await import("./stats");
      await addPoints(5);
    }
  }

  const { logEvent } = await import("./events");
  await logEvent("etat_enregistre", null, {
    heure,
    tranche: trancheDeHeure(heure),
    energie: params.energie,
    focus: params.focus,
    humeur: params.humeur,
    correction,
  });
}

export async function historiqueEtat(jours = 30): Promise<Etat[]> {
  const db = await getDatabase();
  const debut = new Date(Date.now() - jours * 86400000)
    .toISOString()
    .split("T")[0];
  return db.getAllAsync<Etat>(
    "SELECT * FROM etat WHERE date >= ? ORDER BY horodatage DESC",
    debut,
  );
}

/** Conservé pour compatibilité : moyennes par moment de la journée. */
export async function moyennesParFenetre(jours = 30) {
  const lignes = await historiqueEtat(jours);
  const acc = new Map<
    Fenetre,
    { n: number; energie: number; focus: number; humeur: number }
  >();
  for (const e of lignes) {
    const t = trancheDeHeure(e.heure);
    const v = acc.get(t) ?? { n: 0, energie: 0, focus: 0, humeur: 0 };
    v.n += 1;
    v.energie += e.energie;
    v.focus += e.focus;
    v.humeur += e.humeur;
    acc.set(t, v);
  }
  return [...acc.entries()].map(([fenetre, v]) => ({
    fenetre,
    n: v.n,
    energie: v.energie / v.n,
    focus: v.focus / v.n,
    humeur: v.humeur / v.n,
  }));
}
