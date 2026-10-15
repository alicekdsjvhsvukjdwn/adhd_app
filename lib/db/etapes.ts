import { deltaPoints, palierEtapes, pointsPalier } from "../regles-taches";
import { getDatabase } from "./client";
import { annulerCompletion, completer, getAujourdhui } from "./completions";
import { estJourDifficile } from "./jour-difficile";
import { addPoints } from "./stats";

/**
 * Étapes d'une grosse tâche. Chaque étape cochée rapporte des points ;
 * cocher la dernière termine la tâche et ajoute un bonus.
 *
 * Étapes d'une routine : essentielles ou bonus, recochées chaque jour
 * (table etapes_cochees). Points par palier (lib/regles-taches.ts).
 */

export const POINTS_ETAPE = 5;
export const BONUS_FIN = 10;

export type Etape = {
  id: number;
  item_id: number;
  nom: string;
  ordre: number;
  faite: number;
  /** 1 = essentielle, 0 = bonus (routines). */
  essentielle: number;
};

export async function getEtapes(itemId: number): Promise<Etape[]> {
  const db = await getDatabase();
  return db.getAllAsync<Etape>(
    "SELECT * FROM etapes WHERE item_id = ? ORDER BY ordre, id",
    itemId,
  );
}

/** Étapes de plusieurs tâches d'un coup, rangées par tâche. */
export async function getEtapesPour(
  itemIds: number[],
): Promise<Record<number, Etape[]>> {
  const resultat: Record<number, Etape[]> = {};
  if (itemIds.length === 0) return resultat;
  const db = await getDatabase();
  const rows = await db.getAllAsync<Etape>(
    `SELECT * FROM etapes WHERE item_id IN (${itemIds.map(() => "?").join(",")})
     ORDER BY ordre, id`,
    ...itemIds,
  );
  for (const e of rows) (resultat[e.item_id] ??= []).push(e);
  return resultat;
}

/**
 * Enregistre la liste d'étapes telle qu'elle est à l'écran :
 * supprime celles qui ont disparu, renomme et réordonne les autres,
 * ajoute les nouvelles. L'état « faite » des étapes gardées est conservé.
 */
export async function enregistrerEtapes(
  itemId: number,
  liste: { id?: number; nom: string; essentielle?: number }[],
): Promise<void> {
  const db = await getDatabase();
  const existantes = await getEtapes(itemId);
  const gardees = new Set(
    liste.map((e) => e.id).filter((x): x is number => !!x),
  );

  for (const e of existantes) {
    if (!gardees.has(e.id)) {
      await db.runAsync("DELETE FROM etapes WHERE id = ?", e.id);
      await db.runAsync("DELETE FROM etapes_cochees WHERE etape_id = ?", e.id);
    }
  }
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    const nom = e.nom.trim();
    if (!nom) continue;
    if (e.id) {
      await db.runAsync(
        "UPDATE etapes SET nom = ?, ordre = ?, essentielle = ? WHERE id = ?",
        nom,
        i,
        e.essentielle ?? 1,
        e.id,
      );
    } else {
      await db.runAsync(
        "INSERT INTO etapes (item_id, nom, ordre, essentielle) VALUES (?, ?, ?, ?)",
        itemId,
        nom,
        i,
        e.essentielle ?? 1,
      );
    }
  }
}

/** Coche une étape. Renvoie true si c'était la dernière (tâche terminée). */
export async function cocherEtape(etapeId: number): Promise<boolean> {
  const db = await getDatabase();
  const etape = await db.getFirstAsync<Etape>(
    "SELECT * FROM etapes WHERE id = ?",
    etapeId,
  );
  if (!etape || etape.faite === 1) return false;

  await db.runAsync(
    "UPDATE etapes SET faite = 1, faite_le = ? WHERE id = ?",
    getAujourdhui(),
    etapeId,
  );
  await addPoints(POINTS_ETAPE);

  const restantes = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM etapes WHERE item_id = ? AND faite = 0",
    etape.item_id,
  );
  if ((restantes?.n ?? 0) === 0) {
    await completer(etape.item_id, "complet");
    await addPoints(BONUS_FIN);
    return true;
  }
  return false;
}

/** Décoche une étape ; si la tâche était terminée, elle redevient à faire. */
export async function decocherEtape(etapeId: number): Promise<void> {
  const db = await getDatabase();
  const etape = await db.getFirstAsync<Etape>(
    "SELECT * FROM etapes WHERE id = ?",
    etapeId,
  );
  if (!etape || etape.faite === 0) return;

  const item = await db.getFirstAsync<{ statut: string }>(
    "SELECT statut FROM items WHERE id = ?",
    etape.item_id,
  );

  await db.runAsync(
    "UPDATE etapes SET faite = 0, faite_le = NULL WHERE id = ?",
    etapeId,
  );
  await addPoints(-POINTS_ETAPE);

  if (item?.statut === "termine") {
    await annulerCompletion(etape.item_id);
    await addPoints(-BONUS_FIN);
  }
}

// ─── Routines à étapes ──────────────────────────────────────────────────

export type EtapeRoutine = Etape & { cochee: boolean };

/** Étapes de plusieurs routines, avec leur état du jour. */
export async function getEtapesRoutines(
  itemIds: number[],
): Promise<Record<number, EtapeRoutine[]>> {
  const resultat: Record<number, EtapeRoutine[]> = {};
  if (itemIds.length === 0) return resultat;
  const db = await getDatabase();
  const rows = await db.getAllAsync<Etape & { cochee: number }>(
    `SELECT e.*, (ec.id IS NOT NULL) AS cochee
     FROM etapes e
     LEFT JOIN etapes_cochees ec ON ec.etape_id = e.id AND ec.date = ?
     WHERE e.item_id IN (${itemIds.map(() => "?").join(",")})
     ORDER BY e.ordre, e.id`,
    getAujourdhui(),
    ...itemIds,
  );
  for (const e of rows) (resultat[e.item_id] ??= []).push({ ...e, cochee: e.cochee === 1 });
  return resultat;
}

/**
 * Coche ou décoche une étape de routine pour aujourd'hui, puis ajuste la
 * complétion du jour au palier atteint. Les points donnés sont gardés
 * dans completions.points : on ne verse que la différence.
 */
export async function basculerEtapeRoutine(
  etapeId: number,
  version: string,
): Promise<void> {
  const db = await getDatabase();
  const date = getAujourdhui();
  const etape = await db.getFirstAsync<Etape>("SELECT * FROM etapes WHERE id = ?", etapeId);
  if (!etape) return;

  const cochee = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM etapes_cochees WHERE etape_id = ? AND date = ?",
    etapeId,
    date,
  );
  if (cochee) {
    await db.runAsync("DELETE FROM etapes_cochees WHERE id = ?", cochee.id);
  } else {
    await db.runAsync(
      "INSERT INTO etapes_cochees (etape_id, item_id, date, horodatage) VALUES (?, ?, ?, ?)",
      etapeId,
      etape.item_id,
      date,
      new Date().toISOString(),
    );
  }

  const etapes = (await getEtapesRoutines([etape.item_id]))[etape.item_id] ?? [];
  const palier = palierEtapes(
    etapes.map((e) => ({ essentielle: e.essentielle === 1, cochee: e.cochee })),
  );
  const points = pointsPalier(palier, await estJourDifficile());
  if (points === 0) await annulerCompletion(etape.item_id);
  else await completer(etape.item_id, "complet", undefined, version, points);
}

/**
 * Après un changement d'énergie du jour (Jour difficile ↔ Normal / En forme) :
 * remet les points des routines à étapes déjà cochées aujourd'hui au
 * barème du nouvel état. Seule la différence est versée ou retirée, et
 * l'heure de la complétion ne bouge pas.
 */
export async function recalculerPointsEtapesDuJour(): Promise<void> {
  const db = await getDatabase();
  const date = getAujourdhui();
  const jourDifficile = await estJourDifficile();
  const ids = (
    await db.getAllAsync<{ item_id: number }>(
      "SELECT DISTINCT item_id FROM etapes_cochees WHERE date = ?",
      date,
    )
  ).map((r) => r.item_id);
  const parRoutine = await getEtapesRoutines(ids);

  for (const id of ids) {
    const c = await db.getFirstAsync<{ id: number; statut: string; points: number | null }>(
      "SELECT id, statut, points FROM completions WHERE item_id = ? AND date = ?",
      id,
      date,
    );
    if (!c) continue;
    const palier = palierEtapes(
      (parRoutine[id] ?? []).map((e) => ({ essentielle: e.essentielle === 1, cochee: e.cochee })),
    );
    if (palier === 0) continue;
    const deja = c.points ?? (c.statut === "partiel" ? 5 : 10);
    const delta = deltaPoints(deja, palier, jourDifficile);
    if (delta === 0) continue;
    await db.runAsync("UPDATE completions SET points = ? WHERE id = ?", deja + delta, c.id);
    await addPoints(delta);
  }
}
