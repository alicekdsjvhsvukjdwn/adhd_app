import { getDatabase } from "./client";
import { annulerCompletion, completer, getAujourdhui } from "./completions";

/**
 * Étapes d'une grosse tâche. Chaque étape cochée rapporte des points ;
 * cocher la dernière termine la tâche et ajoute un bonus.
 */

export const POINTS_ETAPE = 5;
export const BONUS_FIN = 10;

export type Etape = {
  id: number;
  item_id: number;
  nom: string;
  ordre: number;
  faite: number;
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
  liste: { id?: number; nom: string }[],
): Promise<void> {
  const db = await getDatabase();
  const existantes = await getEtapes(itemId);
  const gardees = new Set(
    liste.map((e) => e.id).filter((x): x is number => !!x),
  );

  for (const e of existantes) {
    if (!gardees.has(e.id)) {
      await db.runAsync("DELETE FROM etapes WHERE id = ?", e.id);
    }
  }
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    const nom = e.nom.trim();
    if (!nom) continue;
    if (e.id) {
      await db.runAsync(
        "UPDATE etapes SET nom = ?, ordre = ? WHERE id = ?",
        nom,
        i,
        e.id,
      );
    } else {
      await db.runAsync(
        "INSERT INTO etapes (item_id, nom, ordre) VALUES (?, ?, ?)",
        itemId,
        nom,
        i,
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
  const { addPoints } = await import("./stats");
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
  const { addPoints } = await import("./stats");
  await addPoints(-POINTS_ETAPE);

  if (item?.statut === "termine") {
    await annulerCompletion(etape.item_id);
    await addPoints(-BONUS_FIN);
  }
}
