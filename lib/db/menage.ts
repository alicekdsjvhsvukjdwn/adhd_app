import { decalerJours } from "../dates";
import {
  aTemps,
  cleLibre,
  cocher,
  couleurPiece,
  CLES_MENAGE,
  PIECES_DEFAUT,
  POINTS_MENAGE,
  type TacheMenage,
} from "../menage-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { estJourDifficile } from "./jour-difficile";
import { ecrireMeta, lireMeta } from "./meta";
import { addPoints } from "./stats";

/**
 * Ménage par pièce. Les pièces et tâches de départ sont créées à la première
 * ouverture seulement (meta menage_init) : supprimer toutes les pièces ne les fait pas revenir.
 */

/** `couleur` : la couleur de la pièce, déjà résolue (hex). `cle` : sa clé en base. */
export type Piece = { id: number; nom: string; icone: string; ordre: number; couleur: string; cle: string };

const nowIso = () => new Date().toISOString();

export type LignePiece = { id: number; nom: string; icone: string; ordre: number; couleur: string };
export const enPieces = (l: LignePiece[]): Piece[] => l.map((p, i) => ({ ...p, cle: p.couleur, couleur: couleurPiece(p.couleur, i) }));

export const COLONNES_TACHE = "id, piece_id, nom, freq_jours, prochaine_le, fait_le, avant_le, points_donnes";

export async function initialiserMenage(): Promise<void> {
  if ((await lireMeta("menage_init")) !== null) return;
  const db = await getDatabase();
  const auj = getAujourdhui();
  const maintenant = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const [i, p] of PIECES_DEFAUT.entries()) {
      const r = await db.runAsync("INSERT INTO menage_pieces (nom, icone, ordre, couleur) VALUES (?, ?, ?, ?)", p.nom, p.icone, i, CLES_MENAGE[i % CLES_MENAGE.length]);
      for (const [j, [nom, freq]] of p.taches.entries()) {
        // Les échéances de départ sont étalées pour que tout ne tombe pas le premier jour.
        await db.runAsync(
          "INSERT INTO menage_taches (piece_id, nom, freq_jours, prochaine_le, ordre, cree_le) VALUES (?, ?, ?, ?, ?, ?)",
          r.lastInsertRowId,
          nom,
          freq,
          decalerJours(auj, j % freq),
          j,
          maintenant,
        );
      }
    }
    await ecrireMeta("menage_init", "1");
  });
}

export async function getMenage(): Promise<{ pieces: Piece[]; taches: TacheMenage[]; jourDifficile: boolean }> {
  await initialiserMenage();
  const db = await getDatabase();
  return {
    pieces: enPieces(await db.getAllAsync<LignePiece>("SELECT id, nom, icone, ordre, couleur FROM menage_pieces WHERE supprimee_le IS NULL ORDER BY ordre, id")),
    taches: await db.getAllAsync<TacheMenage>(`SELECT ${COLONNES_TACHE} FROM menage_taches WHERE supprimee_le IS NULL ORDER BY ordre, id`),
    jourDifficile: await estJourDifficile(),
  };
}

export async function ajouterPiece(nom: string, icone = "maison"): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ m: number | null }>("SELECT MAX(ordre) AS m FROM menage_pieces");
  const prises = (await db.getAllAsync<{ couleur: string }>("SELECT couleur FROM menage_pieces WHERE supprimee_le IS NULL")).map((x) => x.couleur);
  const ajout = await db.runAsync(
    "INSERT INTO menage_pieces (nom, icone, ordre, couleur) VALUES (?, ?, ?, ?)",
    nom.trim(),
    icone,
    (r?.m ?? -1) + 1,
    cleLibre(prises),
  );
  return ajout.lastInsertRowId;
}

export async function renommerPiece(id: number, nom: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE menage_pieces SET nom = ? WHERE id = ?", nom.trim(), id);
}

export async function colorierPiece(id: number, cle: string): Promise<void> {
  const db = await getDatabase();
  if (CLES_MENAGE.includes(cle as never)) await db.runAsync("UPDATE menage_pieces SET couleur = ? WHERE id = ?", cle, id);
}

/** Retire la pièce et ses tâches : elles ne sont plus affichées, mais l'historique reste pour les stats. */
export async function supprimerPiece(id: number): Promise<void> {
  const db = await getDatabase();
  const quand = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE menage_taches SET supprimee_le = ? WHERE piece_id = ? AND supprimee_le IS NULL", quand, id);
    await db.runAsync("UPDATE menage_pieces SET supprimee_le = ? WHERE id = ?", quand, id);
  });
}

/** Monte (-1) ou descend (+1) une pièce : échange sa place avec sa voisine. */
export async function deplacerPiece(id: number, sens: -1 | 1): Promise<void> {
  const db = await getDatabase();
  const pieces = await db.getAllAsync<{ id: number }>("SELECT id FROM menage_pieces WHERE supprimee_le IS NULL ORDER BY ordre, id");
  const i = pieces.findIndex((p) => p.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= pieces.length) return;
  [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  await db.withTransactionAsync(async () => {
    for (const [ordre, p] of pieces.entries()) await db.runAsync("UPDATE menage_pieces SET ordre = ? WHERE id = ?", ordre, p.id);
  });
}

/** Une nouvelle tâche est à faire aujourd'hui. */
export async function ajouterTacheMenage(pieceId: number, nom: string, freqJours: number): Promise<void> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ m: number | null }>("SELECT MAX(ordre) AS m FROM menage_taches WHERE piece_id = ?", pieceId);
  await db.runAsync(
    "INSERT INTO menage_taches (piece_id, nom, freq_jours, prochaine_le, ordre, cree_le) VALUES (?, ?, ?, ?, ?, ?)",
    pieceId,
    nom.trim(),
    Math.max(1, Math.round(freqJours)),
    getAujourdhui(),
    (r?.m ?? -1) + 1,
    new Date().toISOString(),
  );
}

export async function modifierTacheMenage(id: number, nom: string, freqJours: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE menage_taches SET nom = ?, freq_jours = ? WHERE id = ?",
    nom.trim(),
    Math.max(1, Math.round(freqJours)),
    id,
  );
}

/** Retire la tâche (plus proposée) ; ses cochages passés restent dans l'historique. */
export async function supprimerTacheMenage(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE menage_taches SET supprimee_le = ? WHERE id = ?", nowIso(), id);
}

/** Coche une tâche : sa prochaine échéance repart d'aujourd'hui. Renvoie les points donnés (0 ou 5). */
export async function cocherTacheMenage(id: number): Promise<number> {
  const db = await getDatabase();
  const t = await db.getFirstAsync<TacheMenage>(`SELECT ${COLONNES_TACHE} FROM menage_taches WHERE id = ?`, id);
  const auj = getAujourdhui();
  if (!t || t.fait_le === auj) return 0;
  const c = cocher(t, auj);
  await db.runAsync(
    "UPDATE menage_taches SET prochaine_le = ?, fait_le = ?, avant_le = ?, points_donnes = 0 WHERE id = ?",
    c.prochaine_le,
    c.fait_le,
    c.avant_le,
    id,
  );
  await db.runAsync(
    "INSERT INTO menage_journal (tache_id, piece_id, jour, echeance, a_temps) VALUES (?, ?, ?, ?, ?)",
    id,
    t.piece_id,
    auj,
    t.prochaine_le,
    aTemps(t.prochaine_le, auj) ? 1 : 0,
  );
  if (!c.points) return 0;
  // Une seule fois par tâche et par échéance : la clé primaire refuse le deuxième.
  const r = await db.runAsync("INSERT OR IGNORE INTO menage_faits (tache_id, echeance, jour) VALUES (?, ?, ?)", id, t.prochaine_le, auj);
  if (r.changes === 0) return 0;
  await db.runAsync("UPDATE menage_taches SET points_donnes = 1 WHERE id = ?", id);
  await addPoints(POINTS_MENAGE);
  return POINTS_MENAGE;
}

/** Décoche une tâche cochée aujourd'hui : l'échéance revient, les points sont repris. */
export async function decocherTacheMenage(id: number): Promise<void> {
  const db = await getDatabase();
  const t = await db.getFirstAsync<TacheMenage>(`SELECT ${COLONNES_TACHE} FROM menage_taches WHERE id = ?`, id);
  if (!t || t.fait_le !== getAujourdhui() || !t.avant_le) return;
  await db.runAsync(
    "DELETE FROM menage_journal WHERE id = (SELECT MAX(id) FROM menage_journal WHERE tache_id = ? AND echeance = ? AND jour = ?)",
    id,
    t.avant_le,
    t.fait_le,
  );
  if (t.points_donnes) {
    await db.runAsync("DELETE FROM menage_faits WHERE tache_id = ? AND echeance = ?", id, t.avant_le);
    await addPoints(-POINTS_MENAGE);
  }
  await db.runAsync(
    "UPDATE menage_taches SET prochaine_le = ?, fait_le = NULL, avant_le = NULL, points_donnes = 0 WHERE id = ?",
    t.avant_le,
    id,
  );
}
