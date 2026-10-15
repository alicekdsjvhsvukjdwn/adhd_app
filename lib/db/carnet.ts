import { SQL_CARNET } from "../regles-taches";
import { getDatabase } from "./client";

/**
 * Carnet : ce que j'ai fait, ce que j'en retiens, les idées, pour une
 * tâche faite un jour donné. Facultatif, sans points.
 */

export type Note = { fait: string | null; retenu: string | null; idees: string | null };
export type FoisFaite = Note & { completion_id: number; date: string };
export type NoteCarnet = Note & { item_id: number; nom: string; date: string };

const vide = (s: string | null) => (s?.trim() ? s.trim() : null);

export async function enregistrerNote(itemId: number, date: string, n: Note): Promise<void> {
  const db = await getDatabase();
  const maintenant = new Date().toISOString();
  await db.runAsync(
    SQL_CARNET.enregistrer,
    itemId,
    date,
    itemId,
    date,
    vide(n.fait),
    vide(n.retenu),
    vide(n.idees),
    maintenant,
    maintenant,
  );
}

export async function foisFaites(itemId: number): Promise<FoisFaite[]> {
  const db = await getDatabase();
  return db.getAllAsync<FoisFaite>(SQL_CARNET.foisFaites, itemId);
}

export async function carnetListe(listeId: number): Promise<NoteCarnet[]> {
  const db = await getDatabase();
  return db.getAllAsync<NoteCarnet>(SQL_CARNET.carnetListe, listeId);
}
