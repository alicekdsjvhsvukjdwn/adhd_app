import { decalerJours } from "../dates";
import { ID_REVEIL, REVEIL_DEFAUT, type Seance } from "../seances";
import { POINTS_SEANCE } from "../suivi-regles";
import { getDatabase } from "./client";
import { completer, getAujourdhui, getRoutinesAvecStatutDuJour } from "./completions";
import { getEtapes } from "./etapes";
import { sportPayeLe } from "./sport";
import { addPoints } from "./stats";

/** Ma routine du matin : la version modifiée, sinon celle d'origine. */
export async function getSeancePerso(): Promise<Seance> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ exercices: string; effort_s: number; repos_s: number; lien: string }>(
    "SELECT exercices, effort_s, repos_s, lien FROM seance_perso WHERE id = 1",
  );
  if (!r) return REVEIL_DEFAUT;
  return {
    ...REVEIL_DEFAUT,
    exercices: r.exercices ? r.exercices.split(",") : [],
    effort_s: r.effort_s,
    repos_s: r.repos_s,
    lien: r.lien,
  };
}

export async function enregistrerSeancePerso(s: Seance): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO seance_perso (id, exercices, effort_s, repos_s, lien) VALUES (1, ?, ?, ?, ?)",
    s.exercices.join(","),
    s.effort_s,
    s.repos_s,
    s.lien?.trim() ?? "",
  );
}

/** « Faite hier / aujourd'hui » : date de la dernière fois. */
export async function derniereFois(seance: string): Promise<string | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ d: string | null }>(
    "SELECT MAX(date) AS d FROM seances_guidees WHERE seance = ?",
    seance,
  );
  return r?.d ?? null;
}

export const hier = () => decalerJours(getAujourdhui(), -1);

/**
 * Enregistre une séance guidée (au moins un exercice fait). +10 pts si
 * aucune séance, skills ou guidée, n'a rapporté aujourd'hui. Ma routine du
 * matin coche aussi la routine « Réveil du corps » si elle existe.
 */
export async function enregistrerSeanceGuidee(
  seance: string,
  duree_s: number,
  exercices: string[],
  terminee: boolean,
): Promise<number> {
  const db = await getDatabase();
  const date = getAujourdhui();
  const points = (await sportPayeLe(date)) ? 0 : POINTS_SEANCE;
  await db.runAsync(
    `INSERT INTO seances_guidees (date, seance, duree_s, exercices, terminee, points_donnes, horodatage)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    date,
    seance,
    duree_s,
    exercices.join(","),
    terminee ? 1 : 0,
    points,
    new Date().toISOString(),
  );
  if (points > 0) await addPoints(points);

  if (seance === ID_REVEIL && terminee) {
    const r = (await getRoutinesAvecStatutDuJour()).find(
      (x) => x.nom.trim().toLowerCase() === REVEIL_DEFAUT.nom.toLowerCase(),
    );
    // Une routine à étapes se coche par ses étapes : on n'y touche pas.
    if (r && !r.faitAujourdhui && (await getEtapes(r.id)).length === 0) {
      await completer(r.id, "complet", Math.round(duree_s / 60), "normale");
    }
  }
  return points;
}
