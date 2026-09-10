import { getDatabase } from './client';

export type Routine = {
  id: number;
  nom: string;
  fait: number;
};

export async function initRoutines() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      fait INTEGER NOT NULL DEFAULT 0
    );
  `);
  const existing = await db.getAllAsync<Routine>('SELECT * FROM routines');
  if (existing.length === 0) {
    await db.runAsync("INSERT INTO routines (nom, fait) VALUES (?, ?)", "Boire un verre d'eau", 0);
    await db.runAsync("INSERT INTO routines (nom, fait) VALUES (?, ?)", "Faire le lit", 0);
    await db.runAsync("INSERT INTO routines (nom, fait) VALUES (?, ?)", "Sortir 10 min", 0);
  }
}

export async function getRoutines(): Promise<Routine[]> {
  const db = await getDatabase();
  return db.getAllAsync<Routine>('SELECT * FROM routines');
}

export async function addRoutine(nom: string) {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO routines (nom, fait) VALUES (?, ?)', nom, 0);
}

export async function deleteRoutine(id: number) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM routines WHERE id = ?', id);
}

export async function toggleRoutine(id: number, fait: number) {
  const db = await getDatabase();
  await db.runAsync('UPDATE routines SET fait = ? WHERE id = ?', fait, id);
}
