import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

const NOM_BASE = "routines_v2.db";

/**
 * Web : au rechargement ou à la réouverture de l'appli, l'ancienne page peut
 * encore tenir le fichier quelques instants ; on réessaie avant d'abandonner.
 */
async function ouvrir(): Promise<SQLite.SQLiteDatabase> {
  for (let essai = 1; ; essai++) {
    try {
      return await SQLite.openDatabaseAsync(NOM_BASE);
    } catch (e) {
      if (Platform.OS !== "web" || essai >= 10) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

let db: SQLite.SQLiteDatabase | null = null;
// Web : une page mise de côté dans le cache arrière/avant du navigateur est gelée mais
// garde la base verrouillée, et la page suivante ne peut plus l'ouvrir. Un écouteur
// « unload » (même vide) rend la page inéligible à ce cache ; au cas où elle y serait
// quand même, on la recharge à son retour.
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("unload", () => {});
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.location.reload();
  });
}

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
    ouverture = ouvrir().then((instance) => {
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
