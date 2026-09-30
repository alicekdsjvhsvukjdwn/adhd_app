import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Énergie qui choisit la version des routines aujourd'hui :
 * le choix fait à la main s'il existe, sinon le dernier check-in du jour,
 * sinon rien (version normale).
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
  source: "choix" | "checkin" | null;
}> {
  await assurerMeta();
  const db = await getDatabase();
  const choix = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cle(),
  );
  if (choix)
    return { niveau: Number(choix.valeur) as 1 | 2 | 3, source: "choix" };

  const etat = await db.getFirstAsync<{ energie: number }>(
    "SELECT energie FROM etat WHERE date = ? ORDER BY horodatage DESC LIMIT 1",
    getAujourdhui(),
  );
  if (etat) return { niveau: etat.energie as 1 | 2 | 3, source: "checkin" };
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
}
