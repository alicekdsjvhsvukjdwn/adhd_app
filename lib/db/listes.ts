import { getDatabase } from "./client";

/**
 * Listes de tâches (Quotidien, Travail, Administratif…), modifiables.
 * Distinctes des domaines bien-être, qui servent à l'équilibre.
 */

export type Liste = { id: number; nom: string; icone: string | null; ordre: number };

export async function getListes(): Promise<Liste[]> {
  const db = await getDatabase();
  return db.getAllAsync<Liste>(
    "SELECT id, nom, icone, ordre FROM listes ORDER BY ordre, id",
  );
}

export async function ajouterListe(nom: string, icone: string | null): Promise<number> {
  const db = await getDatabase();
  const max = await db.getFirstAsync<{ m: number | null }>(
    "SELECT MAX(ordre) AS m FROM listes",
  );
  const r = await db.runAsync(
    "INSERT INTO listes (nom, icone, ordre, cree_le) VALUES (?, ?, ?, ?)",
    nom.trim(),
    icone,
    (max?.m ?? -1) + 1,
    new Date().toISOString(),
  );
  return r.lastInsertRowId;
}

export async function modifierListe(id: number, nom: string, icone: string | null) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE listes SET nom = ?, icone = ? WHERE id = ?",
    nom.trim(),
    icone,
    id,
  );
}

/** Nombre de tâches actives d'une liste. */
export async function compterTaches(id: number): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM items WHERE liste_id = ? AND type = 'tache' AND statut = 'actif'",
    id,
  );
  return r?.n ?? 0;
}

/** La liste qui recevra les tâches d'une liste supprimée (la première des autres). */
export async function listeDeRepli(id: number): Promise<Liste | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Liste>(
    "SELECT id, nom, icone, ordre FROM listes WHERE id != ? ORDER BY ordre, id LIMIT 1",
    id,
  );
}

/** Supprime une liste ; ses tâches passent dans la liste de repli (ou sans liste). */
export async function supprimerListe(id: number): Promise<void> {
  const db = await getDatabase();
  const repli = await listeDeRepli(id);
  await db.runAsync(
    "UPDATE items SET liste_id = ? WHERE liste_id = ?",
    repli?.id ?? null,
    id,
  );
  await db.runAsync("DELETE FROM listes WHERE id = ?", id);
}
