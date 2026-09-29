import * as Notifications from "expo-notifications";
import { getDatabase, supprimerBase } from "./client";
import { runMigrations } from "./migrations";

/**
 * Remet l'appli dans l'état d'une première installation :
 * routines, tâches, historique, check-ins, points, réglages, rappels.
 */
export async function toutReinitialiser(): Promise<void> {
  // Les rappels programmés vivent hors de la base : on les annule à part.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // pas de permission, ou rien de programmé : sans importance
  }

  try {
    await supprimerBase();
  } catch {
    // Si le fichier ne peut pas être supprimé (connexion encore utilisée),
    // on vide la base de l'intérieur : même résultat.
    const db = await getDatabase();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const t of tables) {
      await db.execAsync(`DROP TABLE IF EXISTS "${t.name}"`);
    }
    await db.execAsync("PRAGMA user_version = 0");
  }

  // Recrée les tables comme au premier lancement.
  await runMigrations();
}
