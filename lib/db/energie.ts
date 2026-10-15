import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { recalculerPointsEtapesDuJour } from "./etapes";
import { changerJourDifficile } from "./jour-difficile";

/**
 * Énergie qui choisit la version des routines aujourd'hui : le choix fait
 * à la main sur l'onglet Routines (Jour difficile / Normal / En forme),
 * sinon rien (version normale). Le bilan de la journée n'est jamais lu ici.
 *
 * « Jour difficile » active aussi l'interrupteur de lib/db/jour-difficile.ts,
 * lu par l'onglet Tâches (une seule tâche) et l'historique des jours difficiles.
 */

async function assurerMeta() {
  const db = await getDatabase();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);",
  );
}

const cle = () => `energie_routines:${getAujourdhui()}`;

export async function energieDuJour(): Promise<{
  niveau: 1 | 2 | 3 | null;
  source: "choix" | null;
}> {
  await assurerMeta();
  const db = await getDatabase();
  const choix = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cle(),
  );
  if (choix)
    return { niveau: Number(choix.valeur) as 1 | 2 | 3, source: "choix" };
  return { niveau: null, source: null };
}

export async function choisirEnergie(niveau: 1 | 2 | 3): Promise<void> {
  await assurerMeta();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)",
    cle(),
    String(niveau),
  );
  await changerJourDifficile(niveau === 1);
  // Les routines à étapes déjà cochées suivent le barème du nouvel état.
  await recalculerPointsEtapesDuJour();
}
