import { decalerJours } from "../dates";
import { composerTrois, idVide, NB_TROIS, rangDe, type Emplacement, type SourceTrois, type Stocke } from "../trois-regles";
import { prevueLe } from "../regles-taches";
import { getDatabase } from "./client";
import type { Proposition } from "./moteur";

/**
 * « Mes 3 » : trois emplacements par jour (table trois, un rang de 0 à 2 chacun).
 * Ce que je choisis (source 'choisi') est enregistré tout de suite. Ce que l'appli propose
 * n'est enregistré qu'à l'ouverture d'aujourd'hui (`figer`), pour que les 3 ne bougent pas
 * dans la journée ; pour un autre jour, la proposition se recalcule à chaque affichage.
 */

type Ligne = { item_id: number; rang: number; source: SourceTrois };

async function lignes(jour: string): Promise<Ligne[]> {
  const db = await getDatabase();
  return db.getAllAsync<Ligne>("SELECT item_id, rang, source FROM trois WHERE jour = ? ORDER BY rang", jour);
}

const enStocke = (l: Ligne): Stocke => ({ rang: l.rang, itemId: l.item_id, source: l.source });

/** Les 3 emplacements d'un jour. `classement` : les tâches encore à faire (moteur). */
export async function emplacementsDuJour(jour: string, classement: Proposition[], figer: boolean): Promise<Emplacement[]> {
  const parRang = [...classement].sort((a, b) => a.rang - b.rang);
  const veille = (await lignes(decalerJours(jour, -1)))
    .filter((l) => l.item_id > 0 && l.rang < NB_TROIS)
    .map((l) => l.item_id);
  const emplacements = composerTrois({
    stockes: (await lignes(jour)).filter((l) => l.rang < NB_TROIS).map(enStocke),
    dus: parRang.filter((p) => prevueLe(p.jours, jour)).map((p) => p.itemId),
    veille,
    ordre: parRang.map((p) => p.itemId),
  });
  const aFiger = figer ? emplacements.filter((e) => !e.stocke && e.itemId !== null) : [];
  if (aFiger.length > 0) {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const e of aFiger) {
        await db.runAsync("INSERT OR REPLACE INTO trois (jour, item_id, rang, source) VALUES (?, ?, ?, ?)", jour, e.itemId, e.rang, e.source);
      }
    });
    return emplacements.map((e) => (aFiger.includes(e) ? { ...e, stocke: true } : e));
  }
  return emplacements;
}

/** Marque l'emplacement comme vidé : il ne se remplit plus tout seul. */
async function vider(jour: string, rang: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM trois WHERE jour = ? AND rang = ?", jour, rang);
  await db.runAsync("INSERT OR REPLACE INTO trois (jour, item_id, rang, source) VALUES (?, ?, ?, 'vide')", jour, idVide(rang), rang);
}

/** Mon choix : la tâche prend cet emplacement (remplace son occupant ; si elle était dans un autre, celui-ci se libère). */
export async function placerDansTrois(jour: string, rang: number, itemId: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const ailleurs = await db.getFirstAsync<{ rang: number }>("SELECT rang FROM trois WHERE jour = ? AND item_id = ? AND rang <> ?", jour, itemId, rang);
    await db.runAsync("DELETE FROM trois WHERE jour = ? AND (rang = ? OR item_id = ?)", jour, rang, itemId);
    await db.runAsync("INSERT INTO trois (jour, item_id, rang, source) VALUES (?, ?, ?, 'choisi')", jour, itemId, rang);
    if (ailleurs) await vider(jour, ailleurs.rang);
  });
}

export async function retirerDesTrois(jour: string, rang: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(() => vider(jour, rang));
}

/** L'étoile ☆ / ★ : retire la tâche si elle y est, sinon la met dans le premier emplacement libre. Renvoie false si les 3 sont pris. */
export async function basculerEtoile(jour: string, emplacements: Emplacement[], itemId: number): Promise<boolean> {
  const rang = rangDe(emplacements, itemId);
  if (rang !== null) {
    await retirerDesTrois(jour, rang);
    return true;
  }
  const libre = emplacements.find((e) => e.itemId === null);
  if (!libre) return false;
  await placerDansTrois(jour, libre.rang, itemId);
  return true;
}
