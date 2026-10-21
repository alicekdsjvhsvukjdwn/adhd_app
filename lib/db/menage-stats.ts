import { decalerJours } from "../dates";
import { faitesParSemaine, jauge, regularite, type FaitMenage, type TacheMenage } from "../menage-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { COLONNES_TACHE, enPieces, initialiserMenage, type LignePiece } from "./menage";

/** Ménage : statistiques du Progrès et points de couleur du calendrier, lus dans menage_journal. */

export type StatsMenage = {
  /** 8 semaines, la plus ancienne d'abord : tâches faites par pièce. */
  semaines: { debut: string; total: number; parts: { couleur: string; nom: string; n: number }[] }[];
  /** Pièces affichées : jauge actuelle et régularité sur 30 jours (null : pas encore assez d'historique). */
  pieces: { id: number; nom: string; couleur: string; jauge: number; regularite: number | null }[];
};

const GRIS = "#8A9A98";
const SQL_PIECES = "SELECT id, nom, icone, ordre, couleur FROM menage_pieces ORDER BY ordre, id";

export async function statsMenage(aujourdhui: string = getAujourdhui()): Promise<StatsMenage> {
  await initialiserMenage();
  const db = await getDatabase();
  const faits = await db.getAllAsync<FaitMenage>(
    "SELECT tache_id, piece_id, jour, echeance, a_temps FROM menage_journal WHERE jour >= ?",
    decalerJours(aujourdhui, -7 * 8),
  );
  // Toutes les pièces, supprimées comprises : leurs couleurs gardent les barres lisibles.
  const toutes = enPieces(await db.getAllAsync<LignePiece>(SQL_PIECES));
  const actives = new Set(
    (await db.getAllAsync<{ id: number }>("SELECT id FROM menage_pieces WHERE supprimee_le IS NULL")).map((p) => p.id),
  );
  const taches = await db.getAllAsync<TacheMenage & { cree_le: string }>(
    `SELECT ${COLONNES_TACHE}, cree_le FROM menage_taches WHERE supprimee_le IS NULL`,
  );
  const parId = new Map(toutes.map((p) => [p.id, p]));
  return {
    semaines: faitesParSemaine(faits, aujourdhui, 8).map((s) => ({
      debut: s.debut,
      total: s.total,
      parts: Object.entries(s.parPiece).map(([id, n]) => ({
        couleur: parId.get(Number(id))?.couleur ?? GRIS,
        nom: parId.get(Number(id))?.nom ?? "",
        n,
      })),
    })),
    pieces: toutes
      .filter((p) => actives.has(p.id))
      .map((p) => {
        const siennes = taches.filter((x) => x.piece_id === p.id);
        return {
          id: p.id,
          nom: p.nom,
          couleur: p.couleur,
          jauge: jauge(siennes, aujourdhui),
          regularite: regularite(siennes, faits, aujourdhui),
        };
      }),
  };
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
