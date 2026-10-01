import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Interrupteur « Jour difficile », valable pour la journée seulement :
 * la clé porte la date, donc le lendemain il repart désactivé.
 * Chaque changement est journalisé, pour garder l'historique des jours difficiles.
 *
 * Effets (dans les écrans) : routines en version courte, routines exigeantes
 * mises de côté, une seule tâche proposée, pas de suggestion.
 */

async function assurerMeta() {
  const db = await getDatabase();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);",
  );
}

const cle = () => `jour_difficile:${getAujourdhui()}`;

export async function estJourDifficile(): Promise<boolean> {
  await assurerMeta();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cle(),
  );
  return row?.valeur === "1";
}

export async function changerJourDifficile(actif: boolean): Promise<void> {
  if ((await estJourDifficile()) === actif) return;
  const db = await getDatabase();
  if (actif) {
    await db.runAsync(
      "INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, '1')",
      cle(),
    );
  } else {
    await db.runAsync("DELETE FROM meta WHERE cle = ?", cle());
  }
  const { logEvent } = await import("./events");
  await logEvent(
    actif ? "jour_difficile_active" : "jour_difficile_desactive",
    null,
    { date: getAujourdhui() },
  );
}
