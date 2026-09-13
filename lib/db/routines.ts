/**
 * Façade de compatibilité.
 *
 * La table `routines` est devenue `items` (file unifiée tâches + routines).
 * Ce fichier garde l'ancienne API vivante le temps de migrer les écrans.
 * À terme : importer directement depuis `./items` et supprimer ce fichier.
 */

import {
  addItem,
  deleteItem,
  getItems,
  getItemsAvecAncre,
  updateItemAncre,
  type Item,
  type ItemAvecAncre,
} from "./items";

export type Routine = Item;
export type RoutineAvecAncre = ItemAvecAncre;

/** Les migrations remplacent les anciens init*(). Voir lib/db/migrations.ts. */
export async function initRoutines() {
  const { runMigrations } = await import("./migrations");
  await runMigrations();
}

export async function getRoutines(): Promise<Routine[]> {
  return getItems("actif");
}

export async function getRoutinesAvecAncre(): Promise<RoutineAvecAncre[]> {
  return getItemsAvecAncre("actif");
}

export async function addRoutine(
  nom: string,
  ancreId: number | null = null,
  position: "avant" | "apres" = "apres",
) {
  await addItem({
    nom,
    type: "routine",
    recurrence: "quotidien",
    ancre_id: ancreId,
    ancre_position: position,
  });
}

export async function updateRoutineAncre(
  id: number,
  ancreId: number | null,
  position: "avant" | "apres",
) {
  await updateItemAncre(id, ancreId, position);
}

/**
 * Attention : supprime définitivement.
 * Préférer `pauserItem` — rien ne doit se perdre.
 */
export async function deleteRoutine(id: number) {
  await deleteItem(id);
}
