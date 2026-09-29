import * as SQLite from "expo-sqlite";

const NOM_BASE = "routines_v2.db";

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
    ouverture = SQLite.openDatabaseAsync(NOM_BASE).then((instance) => {
      db = instance;
      return instance;
    });
  }

  return ouverture;
}

/**
 * Ferme la connexion et supprime le fichier de la base.
 * Le prochain getDatabase() repart d'une base vide.
 */
export async function supprimerBase(): Promise<void> {
  const instance = db ?? (ouverture ? await ouverture : null);
  db = null;
  ouverture = null;
  if (instance) await instance.closeAsync();
  await SQLite.deleteDatabaseAsync(NOM_BASE);
}
