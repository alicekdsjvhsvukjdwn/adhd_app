import { getDatabase } from "./client";

export type MomentJournee = "matin" | "midi" | "apres_midi" | "soir";

export type Ancre = {
  id: number;
  nom: string;
  moment: MomentJournee;
  active: number; // 0 ou 1
};

export async function getAncres(): Promise<Ancre[]> {
  const db = await getDatabase();
  return db.getAllAsync<Ancre>(
    `SELECT * FROM ancres
     ORDER BY
       CASE moment
         WHEN 'matin' THEN 1
         WHEN 'midi' THEN 2
         WHEN 'apres_midi' THEN 3
         WHEN 'soir' THEN 4
       END,
       nom`,
  );
}

export async function toggleAncre(id: number, active: number) {
  const db = await getDatabase();
  await db.runAsync("UPDATE ancres SET active = ? WHERE id = ?", active, id);
}

export async function addAncre(nom: string, moment: MomentJournee) {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO ancres (nom, moment, active) VALUES (?, ?, ?)",
    nom,
    moment,
    1, // les ancres ajoutées manuellement sont actives par défaut
  );
}
