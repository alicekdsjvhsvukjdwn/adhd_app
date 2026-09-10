import { getDatabase } from "./client";

export type MomentJournee = "matin" | "midi" | "apres_midi" | "soir";

export type Ancre = {
  id: number;
  nom: string;
  moment: MomentJournee;
  active: number; // 0 ou 1
};

const ANCRES_PRE_REMPLIES: Omit<Ancre, "id" | "active">[] = [
  { nom: "Le réveil", moment: "matin" },
  { nom: "Le café du matin", moment: "matin" },
  { nom: "Le brossage de dents", moment: "matin" },
  { nom: "Le départ de chez moi", moment: "matin" },
  { nom: "Le déjeuner", moment: "midi" },
  { nom: "Le retour chez moi", moment: "apres_midi" },
  { nom: "Le dîner", moment: "soir" },
  { nom: "Le coucher", moment: "soir" },
];

export async function initAncres() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ancres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      moment TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0
    );
  `);
  const existing = await db.getAllAsync<Ancre>("SELECT * FROM ancres");
  if (existing.length === 0) {
    for (const a of ANCRES_PRE_REMPLIES) {
      await db.runAsync(
        "INSERT INTO ancres (nom, moment, active) VALUES (?, ?, ?)",
        a.nom,
        a.moment,
        0,
      );
    }
  }
}

export async function getAncres(): Promise<Ancre[]> {
  await initAncres();
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

export async function getAncresActives(): Promise<Ancre[]> {
  await initAncres();
  const db = await getDatabase();
  return db.getAllAsync<Ancre>(
    `SELECT * FROM ancres WHERE active = 1
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
