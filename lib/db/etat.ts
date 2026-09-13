import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

export type Fenetre = "matin" | "soir";
export type Niveau = 1 | 2 | 3;

export type Etat = {
  id: number;
  date: string;
  fenetre: Fenetre;
  energie: Niveau;
  focus: Niveau;
  humeur: Niveau;
  horodatage: string;
};

/** Bascule à 15h : avant, c'est le matin ; après, le soir. */
export const HEURE_BASCULE = 15;

export function fenetreCourante(d = new Date()): Fenetre {
  return d.getHours() < HEURE_BASCULE ? "matin" : "soir";
}

export async function getEtat(
  fenetre: Fenetre,
  date = getAujourdhui(),
): Promise<Etat | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Etat>(
    "SELECT * FROM etat WHERE date = ? AND fenetre = ?",
    date,
    fenetre,
  );
}

/** True si le check-in de la fenêtre en cours n'a pas encore été fait. */
export async function checkinManquant(): Promise<Fenetre | null> {
  const fenetre = fenetreCourante();
  const existant = await getEtat(fenetre);
  return existant ? null : fenetre;
}

export async function enregistrerEtat(params: {
  energie: Niveau;
  focus: Niveau;
  humeur: Niveau;
  fenetre?: Fenetre;
}) {
  const db = await getDatabase();
  const fenetre = params.fenetre ?? fenetreCourante();
  const date = getAujourdhui();

  const existant = await getEtat(fenetre, date);

  await db.runAsync(
    `INSERT INTO etat (date, fenetre, energie, focus, humeur, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, fenetre) DO UPDATE SET
       energie = excluded.energie,
       focus = excluded.focus,
       humeur = excluded.humeur,
       horodatage = excluded.horodatage`,
    date,
    fenetre,
    params.energie,
    params.focus,
    params.humeur,
    new Date().toISOString(),
  );

  // On ne recompte pas les points si la personne corrige son check-in.
  if (!existant) {
    const { addPoints } = await import("./stats");
    await addPoints(5);
  }

  const { logEvent } = await import("./events");
  await logEvent("etat_enregistre", null, {
    fenetre,
    energie: params.energie,
    focus: params.focus,
    humeur: params.humeur,
    correction: !!existant,
  });
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

export async function historiqueEtat(jours = 30): Promise<Etat[]> {
  const db = await getDatabase();
  const debut = new Date(Date.now() - jours * 86400000)
    .toISOString()
    .split("T")[0];
  return db.getAllAsync<Etat>(
    "SELECT * FROM etat WHERE date >= ? ORDER BY date DESC, fenetre",
    debut,
  );
}

/**
 * Moyennes par fenêtre sur la période : montre si les matins sont
 * systématiquement plus bas que les soirs, ou l'inverse.
 */
export async function moyennesParFenetre(jours = 30) {
  const db = await getDatabase();
  const debut = new Date(Date.now() - jours * 86400000)
    .toISOString()
    .split("T")[0];
  return db.getAllAsync<{
    fenetre: Fenetre;
    n: number;
    energie: number;
    focus: number;
    humeur: number;
  }>(
    `SELECT fenetre, COUNT(*) AS n,
            AVG(energie) AS energie, AVG(focus) AS focus, AVG(humeur) AS humeur
     FROM etat WHERE date >= ?
     GROUP BY fenetre`,
    debut,
  );
}
