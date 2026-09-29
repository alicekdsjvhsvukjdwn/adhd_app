import { initAncres } from "./ancres";
import { runMigrations } from "./migrations";
import { initPreferences } from "./preferences";
import { initStats } from "./stats";

/**
 * Tout ce qu'il faut pour que la base soit utilisable : les migrations
 * d'abord, puis les tables créées hors migrations (moments repères,
 * statistiques, préférences) avec leurs valeurs de départ.
 *
 * Appelé au démarrage ET après une réinitialisation : c'est le seul
 * endroit à tenir à jour quand une nouvelle table apparaît.
 */
export async function initialiserBase(): Promise<void> {
  await runMigrations();
  await Promise.all([initAncres(), initStats(), initPreferences()]);
}
