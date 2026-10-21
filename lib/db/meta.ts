import { getDatabase } from "./client";

/** Petites valeurs clé/valeur (table meta). */
export async function lireMeta(cle: string): Promise<string | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ valeur: string }>("SELECT valeur FROM meta WHERE cle = ?", cle);
  return r?.valeur ?? null;
}

export async function ecrireMeta(cle: string, valeur: string | null): Promise<void> {
  const db = await getDatabase();
  if (valeur === null) await db.runAsync("DELETE FROM meta WHERE cle = ?", cle);
  else await db.runAsync("INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)", cle, valeur);
}
