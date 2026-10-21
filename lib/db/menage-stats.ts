import { getDatabase } from "./client";
import { enPieces, type LignePiece } from "./menage";

/** Ménage : la roue du Progrès et les points de couleur du calendrier, lus dans menage_journal. */

const GRIS = "#8A9A98";
const SQL_PIECES = "SELECT id, nom, icone, ordre, couleur FROM menage_pieces ORDER BY ordre, id";

/** Tâches de ménage cochées entre deux jours (bornes comprises) : de quoi remplir la roue du Progrès. */
export async function menageFaitesEntre(debut: string, fin: string): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM menage_journal WHERE jour >= ? AND jour <= ?", debut, fin);
  return r?.n ?? 0;
}

/** Calendrier : couleurs des pièces où quelque chose a été fait, par jour (sans doublon). */
export async function menageParJour(debut: string, fin: string): Promise<Record<string, string[]>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ jour: string; piece_id: number }>(
    "SELECT DISTINCT jour, piece_id FROM menage_journal WHERE jour >= ? AND jour <= ? ORDER BY jour, piece_id",
    debut,
    fin,
  );
  const couleur = new Map(enPieces(await db.getAllAsync<LignePiece>(SQL_PIECES)).map((p) => [p.id, p.couleur]));
  const res: Record<string, string[]> = {};
  for (const r of rows) (res[r.jour] ??= []).push(couleur.get(r.piece_id) ?? GRIS);
  return res;
}

/** Ce qui a été fait ce jour-là en ménage : tâche, pièce, couleur. */
export async function menageFaitLe(jour: string): Promise<{ nom: string; piece: string; couleur: string }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ nom: string; piece_id: number }>(
    "SELECT t.nom AS nom, j.piece_id AS piece_id FROM menage_journal j JOIN menage_taches t ON t.id = j.tache_id WHERE j.jour = ? ORDER BY j.id",
    jour,
  );
  const pieces = enPieces(await db.getAllAsync<LignePiece>(SQL_PIECES));
  return rows.map((r) => {
    const p = pieces.find((x) => x.id === r.piece_id);
    return { nom: r.nom, piece: p?.nom ?? "", couleur: p?.couleur ?? GRIS };
  });
}
