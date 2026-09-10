import * as SQLite from 'expo-sqlite';
import { initRoutines } from './routines';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('routines.db');
    await initRoutines();
  }
  return db;
}
