import { SQL_LIGNES_DE_BASE } from "../schema";
import { definirDebutJour } from "../dates";
import { getDatabase } from "./client";
import { lireMeta } from "./meta";
import { runMigrations } from "./migrations";

/**
 * Tout ce qu'il faut pour que la base soit utilisable : les migrations
 * (toutes les tables), puis les lignes de départ (stats, moments repères).
 *
 * Appelé au démarrage, après une réinitialisation et après une restauration.
 */
export async function initialiserBase(): Promise<void> {
  await runMigrations();
  const db = await getDatabase();
  await db.execAsync(SQL_LIGNES_DE_BASE);
  definirDebutJour(Number(await lireMeta("debut_jour")));
}
