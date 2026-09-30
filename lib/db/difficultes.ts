import { getDatabase } from "./client";

/** Enregistre les difficultés choisies (sans doublon). */
export async function enregistrerDifficultes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const maintenant = new Date().toISOString();
  for (const id of ids) {
    await db.runAsync(
      "INSERT OR IGNORE INTO difficultes (difficulte_id, choisie_le) VALUES (?, ?)",
      id,
      maintenant,
    );
  }
}

/** Difficultés déjà choisies lors des mises en place précédentes. */
export async function difficultesChoisies(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ difficulte_id: string }>(
    "SELECT difficulte_id FROM difficultes",
  );
  return rows.map((r) => r.difficulte_id);
}