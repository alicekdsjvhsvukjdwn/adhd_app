import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Bilan de la journée : « Comment était ta journée ? », en un tap,
 * dans Progression. Facultatif, sans points ni rappel, et jamais lu
 * par le moteur de tri.
 *
 * Il est rangé dans la table `etat` avec l'énergie seule (concentration et
 * humeur à NULL). Les anciens check-ins complets restent dans la même table.
 */

export { trancheDeHeure, type Tranche } from "../routines-maintenant";
export type Niveau = 1 | 2 | 3;

export type Etat = {
  id: number;
  date: string;
  /** Heure locale décimale : 14.5 = 14 h 30. */
  heure: number;
  energie: Niveau;
  /** NULL pour un bilan de la journée. */
  focus: Niveau | null;
  humeur: Niveau | null;
  horodatage: string;
};

export function heureLocale(d = new Date()): number {
  return d.getHours() + d.getMinutes() / 60;
}

/** Bilan déjà donné aujourd'hui, ou null. */
export async function bilanDuJour(): Promise<Niveau | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ energie: Niveau }>(
    `SELECT energie FROM etat
     WHERE date = ? AND focus IS NULL
     ORDER BY horodatage DESC LIMIT 1`,
    getAujourdhui(),
  );
  return row?.energie ?? null;
}

/** Un seul bilan par jour : toucher un autre choix remplace le premier. */
export async function enregistrerBilan(energie: Niveau): Promise<void> {
  const db = await getDatabase();
  const maintenant = new Date();
  const date = getAujourdhui();
  const heure = heureLocale(maintenant);

  const existant = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM etat WHERE date = ? AND focus IS NULL",
    date,
  );
  if (existant) {
    await db.runAsync(
      "UPDATE etat SET energie = ?, heure = ?, horodatage = ? WHERE id = ?",
      energie,
      heure,
      maintenant.toISOString(),
      existant.id,
    );
  } else {
    await db.runAsync(
      `INSERT INTO etat (date, heure, energie, focus, humeur, horodatage)
       VALUES (?, ?, ?, NULL, NULL, ?)`,
      date,
      heure,
      energie,
      maintenant.toISOString(),
    );
  }

  const { logEvent } = await import("./events");
  await logEvent("etat_enregistre", null, {
    bilan: true,
    energie,
    correction: !!existant,
  });
}
