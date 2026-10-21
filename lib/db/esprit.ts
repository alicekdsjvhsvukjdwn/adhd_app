import { emotionsEnTexte, MAX_EMOTIONS_HUMEUR, type HumeurNotee } from "../esprit-regles";
import { hhmmMaintenant } from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Humeur et journal de pensées. Aucun point, pour ne pas les remplir pour des points.
 * Tout reste sur l'appareil (et dans la sauvegarde) : rien n'est envoyé au serveur de rappels.
 */

// ─── Humeur ─────────────────────────────────────────────────────────────

/** Une humeur en un tap ; émotions et note viennent après (majHumeur). Renvoie son identifiant. */
export async function enregistrerHumeur(niveau: number): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    "INSERT INTO humeurs (jour, heure, niveau) VALUES (?, ?, ?)",
    getAujourdhui(),
    hhmmMaintenant(),
    Math.min(5, Math.max(1, Math.round(niveau))),
  );
  return r.lastInsertRowId;
}

/** 0 à 3 émotions et une ligne de note, après le tap. */
export async function majHumeur(id: number, p: { emotions?: string[]; note?: string; niveau?: number }): Promise<void> {
  const db = await getDatabase();
  if (p.emotions) {
    await db.runAsync("UPDATE humeurs SET emotions = ? WHERE id = ?", emotionsEnTexte(p.emotions.slice(0, MAX_EMOTIONS_HUMEUR)), id);
  }
  if (p.note !== undefined) await db.runAsync("UPDATE humeurs SET note = ? WHERE id = ?", p.note.trim(), id);
  if (p.niveau !== undefined) await db.runAsync("UPDATE humeurs SET niveau = ? WHERE id = ?", Math.min(5, Math.max(1, Math.round(p.niveau))), id);
}

export async function supprimerHumeur(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM humeurs WHERE id = ?", id);
}

export async function humeursEntre(debut: string, fin: string): Promise<HumeurNotee[]> {
  const db = await getDatabase();
  return db.getAllAsync<HumeurNotee>(
    "SELECT id, jour, heure, niveau, emotions, note FROM humeurs WHERE jour >= ? AND jour <= ? ORDER BY jour, heure, id",
    debut,
    fin,
  );
}

// ─── Journal de pensées ────────────────────────────────────────────────

export type Pensee = {
  id: number;
  jour: string;
  heure: string;
  situation: string;
  pensee: string;
  emotions: string;
  intensite_avant: number | null;
  pieges: string;
  autre_vision: string;
  intensite_apres: number | null;
  /** 0 rien, 1 à en parler en séance, 2 abordée. */
  a_dire: number;
};

export type NouvellePensee = Partial<Omit<Pensee, "id" | "jour" | "heure">>;

const COLONNES = "id, jour, heure, situation, pensee, emotions, intensite_avant, pieges, autre_vision, intensite_apres, a_dire";
const borne = (n: number | null | undefined) => (n == null ? null : Math.min(100, Math.max(0, Math.round(n))));

export async function ajouterPensee(p: NouvellePensee): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    `INSERT INTO pensees (jour, heure, situation, pensee, emotions, intensite_avant, pieges, autre_vision, intensite_apres, a_dire)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    getAujourdhui(),
    hhmmMaintenant(),
    (p.situation ?? "").trim(),
    (p.pensee ?? "").trim(),
    p.emotions ?? "",
    borne(p.intensite_avant),
    p.pieges ?? "",
    (p.autre_vision ?? "").trim(),
    borne(p.intensite_apres),
    p.a_dire ?? 0,
  );
  return r.lastInsertRowId;
}

export async function majPensee(id: number, p: NouvellePensee): Promise<void> {
  const db = await getDatabase();
  const avant = await db.getFirstAsync<Pensee>(`SELECT ${COLONNES} FROM pensees WHERE id = ?`, id);
  if (!avant) return;
  const m = { ...avant, ...p };
  await db.runAsync(
    `UPDATE pensees SET situation = ?, pensee = ?, emotions = ?, intensite_avant = ?, pieges = ?,
       autre_vision = ?, intensite_apres = ?, a_dire = ? WHERE id = ?`,
    m.situation.trim(),
    m.pensee.trim(),
    m.emotions,
    borne(m.intensite_avant),
    m.pieges,
    m.autre_vision.trim(),
    borne(m.intensite_apres),
    m.a_dire,
    id,
  );
}

export async function supprimerPensee(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM pensees WHERE id = ?", id);
}

/** Les entrées, les plus récentes d'abord ; `emotion` : seulement celles qui la citent. */
export async function listerPensees(emotion?: string): Promise<Pensee[]> {
  const db = await getDatabase();
  const toutes = await db.getAllAsync<Pensee>(`SELECT ${COLONNES} FROM pensees ORDER BY jour DESC, heure DESC, id DESC`);
  return emotion ? toutes.filter((p) => p.emotions.split(",").includes(emotion)) : toutes;
}

// ─── Ma semaine (dimanche) ──────────────────────────────────────────────

export type Bilan = { semaine: string; aide: string; garder: string };

export async function lireBilan(semaine: string): Promise<Bilan | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Bilan>("SELECT semaine, aide, garder FROM bilan_semaine WHERE semaine = ?", semaine);
}

export async function ecrireBilan(b: Bilan): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO bilan_semaine (semaine, aide, garder, cree_le) VALUES (?, ?, ?, ?)",
    b.semaine,
    b.aide.trim(),
    b.garder.trim(),
    new Date().toISOString(),
  );
}
