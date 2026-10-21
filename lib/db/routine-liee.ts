import { palierEtapes, pointsPalier } from "../regles-taches";
import { getDatabase } from "./client";
import { completer, getAujourdhui } from "./completions";
import { estJourDifficile } from "./jour-difficile";

/**
 * Routine cochée quand je fais du sport (réglage de l'écran Sport, aucune par
 * défaut). Une séance notée, une séance guidée ou une séance de skills la
 * coche pour le jour de la séance. Une routine à étapes a toutes ses étapes
 * cochées (palier complet). Les points sont ceux de la routine, jamais deux fois.
 */

export async function getRoutineLiee(): Promise<number | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ routine_id: number }>("SELECT routine_id FROM sport_lien WHERE id = 1");
  return r && r.routine_id > 0 ? r.routine_id : null;
}

/** null : plus de routine liée. */
export async function definirRoutineLiee(id: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT OR REPLACE INTO sport_lien (id, routine_id) VALUES (1, ?)", id ?? 0);
}

/** Mes routines actives, pour choisir celle qui se coche avec le sport. */
export async function routinesDisponibles(): Promise<{ id: number; nom: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: number; nom: string }>(
    "SELECT id, nom FROM items WHERE type = 'routine' AND statut = 'actif' ORDER BY nom COLLATE NOCASE",
  );
}

/** Sans accents ni majuscules, pour reconnaître « Callisthenie » comme « Callisthénie ». */
export const nomSimple = (nom: string) =>
  nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/** La routine « Callisthenie », si elle existe : proposée, jamais choisie d'office. */
export async function routineProposee(): Promise<{ id: number; nom: string } | null> {
  return (await routinesDisponibles()).find((r) => nomSimple(r.nom) === "callisthenie") ?? null;
}

/**
 * Coche la routine liée pour ce jour. Renvoie false s'il n'y en a pas
 * (ou si elle a disparu).
 */
export async function cocherRoutineLiee(date: string): Promise<boolean> {
  const id = await getRoutineLiee();
  return id === null ? false : cocherRoutine(id, date);
}

/** Coche une routine donnée pour ce jour (la même mécanique : étapes, palier, points une seule fois). */
export async function cocherRoutine(id: number, date: string): Promise<boolean> {
  const db = await getDatabase();
  const item = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM items WHERE id = ? AND type = 'routine'",
    id,
  );
  if (!item) return false;

  const existante = await db.getFirstAsync<{ version: string | null }>(
    "SELECT version FROM completions WHERE item_id = ? AND date = ?",
    id,
    date,
  );
  const etapes = await db.getAllAsync<{ id: number; essentielle: number }>(
    "SELECT id, essentielle FROM etapes WHERE item_id = ?",
    id,
  );

  if (etapes.length === 0) {
    if (!existante) await completer(id, "complet", undefined, "normale", undefined, date);
    return true;
  }

  if (existante?.version === "toutes") return true;
  for (const e of etapes) {
    const deja = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM etapes_cochees WHERE etape_id = ? AND date = ?",
      e.id,
      date,
    );
    if (!deja) {
      await db.runAsync(
        "INSERT INTO etapes_cochees (etape_id, item_id, date, horodatage) VALUES (?, ?, ?, ?)",
        e.id,
        id,
        date,
        new Date().toISOString(),
      );
    }
  }
  const palier = palierEtapes(etapes.map((e) => ({ essentielle: e.essentielle === 1, cochee: true })));
  const jourDifficile = date === getAujourdhui() && (await estJourDifficile());
  await completer(id, "complet", undefined, "toutes", pointsPalier(palier, jourDifficile), date);
  return true;
}
