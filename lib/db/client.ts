import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;
let ouverture: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ouvre la connexion, rien de plus : la création des tables est faite
 * une fois au démarrage par runMigrations() (voir app/_layout.tsx).
 * Ce module ne doit connaître aucune table, sinon on recrée un cycle d'imports.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  // Mémorise la promesse : deux appels simultanés ouvrent une seule connexion.
  if (!ouverture) {
    ouverture = SQLite.openDatabaseAsync("routines_v2.db").then((instance) => {
      db = instance;
      return instance;
    });
  }

  return ouverture;
}
