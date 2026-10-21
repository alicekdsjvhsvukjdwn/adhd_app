import { decalerJours } from "../dates";
import type { ExerciceTcc, SeanceTcc } from "../esprit-regles";
import { prochaineSeance } from "../esprit-regles";
import { POINTS_TCC } from "../tcc-points";
import { construireResume, periodeResume, type Resume } from "../tcc-resume";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { humeursEntre, penseesMarquees } from "./esprit";
import { nuitsEntre } from "./sommeil";
import { addPoints } from "./stats";

/** Ma TCC : séances, exercices de la psy, notes « à dire en séance », résumé avant séance. */

// ─── Séances ────────────────────────────────────────────────────────────

export async function seancesTcc(): Promise<SeanceTcc[]> {
  const db = await getDatabase();
  return db.getAllAsync<SeanceTcc>("SELECT id, date, heure FROM tcc_seances ORDER BY date, heure, id");
}

export async function ajouterSeanceTcc(date: string, heure: string): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync("INSERT INTO tcc_seances (date, heure) VALUES (?, ?)", date, heure);
  return r.lastInsertRowId;
}

export async function supprimerSeanceTcc(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_seances WHERE id = ?", id);
}

export async function prochaineSeanceTcc(): Promise<SeanceTcc | null> {
  return prochaineSeance(await seancesTcc(), getAujourdhui());
}

// ─── Exercices ──────────────────────────────────────────────────────────

const COLONNES_EX = "id, nom, consigne, freq_type, freq_n, lien";

export async function exercicesTcc(): Promise<ExerciceTcc[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExerciceTcc>(`SELECT ${COLONNES_EX} FROM tcc_exercices WHERE actif = 1 ORDER BY id`);
}

export type NouvelExercice = Omit<ExerciceTcc, "id">;

export async function ajouterExerciceTcc(e: NouvelExercice): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO tcc_exercices (nom, consigne, freq_type, freq_n, lien, cree_le) VALUES (?, ?, ?, ?, ?, ?)",
    e.nom.trim(),
    e.consigne.trim(),
    e.freq_type,
    Math.min(7, Math.max(1, Math.round(e.freq_n))),
    e.lien,
    new Date().toISOString(),
  );
}

export async function modifierExerciceTcc(id: number, e: NouvelExercice): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE tcc_exercices SET nom = ?, consigne = ?, freq_type = ?, freq_n = ?, lien = ? WHERE id = ?",
    e.nom.trim(),
    e.consigne.trim(),
    e.freq_type,
    Math.min(7, Math.max(1, Math.round(e.freq_n))),
    e.lien,
    id,
  );
}

/** L'exercice disparaît de la liste ; ses jours faits restent pour les résumés. */
export async function retirerExerciceTcc(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tcc_exercices SET actif = 0 WHERE id = ?", id);
}

export async function exercicesFaitsEntre(debut: string, fin: string): Promise<{ exercice_id: number; jour: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync("SELECT exercice_id, jour FROM tcc_exercices_faits WHERE jour >= ? AND jour <= ?", debut, fin);
}

async function faitsDuJour(jour: string): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM tcc_exercices_faits WHERE jour = ?", jour);
  return r?.n ?? 0;
}

/**
 * Coche ou décoche un exercice pour un jour. +5 pts au premier exercice du jour, repris si on
 * décoche le dernier : jamais deux fois le même jour, quel que soit le nombre d'exercices.
 * Renvoie les points gagnés (négatifs si repris).
 */
export async function basculerExerciceTcc(id: number, jour: string = getAujourdhui()): Promise<number> {
  const db = await getDatabase();
  const deja = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tcc_exercices_faits WHERE exercice_id = ? AND jour = ?",
    id,
    jour,
  );
  if (deja && deja.n > 0) {
    await db.runAsync("DELETE FROM tcc_exercices_faits WHERE exercice_id = ? AND jour = ?", id, jour);
    if ((await faitsDuJour(jour)) === 0) {
      await addPoints(-POINTS_TCC);
      return -POINTS_TCC;
    }
    return 0;
  }
  await db.runAsync("INSERT INTO tcc_exercices_faits (exercice_id, jour) VALUES (?, ?)", id, jour);
  if ((await faitsDuJour(jour)) === 1) {
    await addPoints(POINTS_TCC);
    return POINTS_TCC;
  }
  return 0;
}

// ─── À dire en séance ──────────────────────────────────────────────────

export type ADire = { id: number; texte: string; source: string; fait: number };

export async function listerADire(): Promise<ADire[]> {
  const db = await getDatabase();
  return db.getAllAsync<ADire>("SELECT id, texte, source, fait FROM a_dire ORDER BY fait, id DESC");
}

export async function ajouterADire(texte: string, source: "note" | "humeur" | "journal" = "note"): Promise<void> {
  const t = texte.trim();
  if (!t) return;
  const db = await getDatabase();
  await db.runAsync("INSERT INTO a_dire (texte, source, cree_le) VALUES (?, ?, ?)", t, source, new Date().toISOString());
}

export async function cocherADire(id: number, fait: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE a_dire SET fait = ? WHERE id = ?", fait ? 1 : 0, id);
}

export async function supprimerADire(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM a_dire WHERE id = ?", id);
}

// ─── Résumé avant séance ───────────────────────────────────────────────

/** Jours où il y a eu du sport (séances de skills, guidées ou notées). */
async function joursDeSport(debut: string, fin: string): Promise<string[]> {
  const db = await getDatabase();
  const l = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM seances WHERE date >= ? AND date <= ?
     UNION SELECT date FROM seances_guidees WHERE date >= ? AND date <= ?`,
    debut,
    fin,
    debut,
    fin,
  );
  return l.map((x) => x.date);
}

/**
 * Le résumé de la période depuis la séance d'avant, pour la prochaine séance (sinon pour aujourd'hui).
 * Rien n'est interprété : les chiffres et les mots de la personne.
 */
export async function resumeAvantSeance(): Promise<{ seance: SeanceTcc | null; resume: Resume }> {
  const aujourdhui = getAujourdhui();
  const seances = await seancesTcc();
  const seance = prochaineSeance(seances, aujourdhui);
  // Une séance d'aujourd'hui est celle qu'on prépare : la précédente est strictement avant.
  const { debut, fin } = periodeResume(
    seances.map((s) => s.date),
    seance ? seance.date : decalerJours(aujourdhui, 1),
    aujourdhui,
  );

  const db = await getDatabase();
  const exercices = await db.getAllAsync<{ nom: string; faits: number }>(
    `SELECT e.nom AS nom, COUNT(f.jour) AS faits
     FROM tcc_exercices e JOIN tcc_exercices_faits f ON f.exercice_id = e.id AND f.jour >= ? AND f.jour <= ?
     GROUP BY e.id ORDER BY e.id`,
    debut,
    fin,
  );
  const nuits = (await nuitsEntre(debut, fin)).filter((n) => n.duree_min > 0);
  const resume = construireResume({
    debut,
    fin,
    humeurs: await humeursEntre(debut, fin),
    pensees: await penseesMarquees(debut, fin),
    exercices,
    sommeil: {
      nuits: nuits.length,
      moyenneMin: nuits.length ? Math.round(nuits.reduce((s, n) => s + n.duree_min, 0) / nuits.length) : null,
    },
    sport: { jours: new Set(await joursDeSport(debut, fin)).size },
    aDire: (await listerADire()).filter((a) => !a.fait).map((a) => a.texte),
  });
  return { seance, resume };
}
