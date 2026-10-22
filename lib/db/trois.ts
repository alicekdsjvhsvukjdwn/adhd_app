import { decalerJours } from "../dates";
import { composerBonus, composerTrois, idVide, NB_TROIS, rangDe, type Bonus, type Emplacement, type OrigineTrois, type SourceTrois, type Stocke } from "../trois-regles";
import { prevueLe } from "../regles-taches";
import { getDatabase } from "./client";
import type { Proposition } from "./moteur";

/**
 * « Mes 3 » : trois emplacements par jour (table trois, un rang de 0 à 2 chacun), plus des tâches « bonus » (bonus = 1,
 * rang = l'ordre). Ce que je choisis (source 'choisi', origine 'moi') est enregistré tout de suite. Ce que l'appli propose
 * n'est enregistré qu'à l'ouverture d'aujourd'hui (`figer`), et seulement aujourd'hui : un jour futur n'a que ce que j'y ai
 * mis, un jour passé se lit tel qu'il était. place_le garde le moment où la tâche a été placée, origine d'où elle vient.
 */

type Ligne = { item_id: number; rang: number; source: SourceTrois; origine: OrigineTrois };

const maintenant = () => new Date().toISOString();

async function lignes(jour: string): Promise<Ligne[]> {
  const db = await getDatabase();
  return db.getAllAsync<Ligne>("SELECT item_id, rang, source, origine FROM trois WHERE jour = ? AND bonus = 0 ORDER BY rang", jour);
}

const enStocke = (l: Ligne): Stocke => ({ rang: l.rang, itemId: l.item_id, source: l.source, origine: l.origine });

/**
 * Pour chaque tâche faite, le jour où elle l'a été. Une tâche ponctuelle : sa dernière complétion, quel que soit le jour
 * (faite vendredi pour samedi : « déjà faite le ven. »). Une tâche récurrente : seulement la complétion du jour concerné.
 */
export async function faitesPour(jour: string, ids: number[]): Promise<Record<number, string>> {
  const sortie: Record<number, string> = {};
  const uniques = [...new Set(ids.filter((i) => i > 0))];
  if (uniques.length === 0) return sortie;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ item_id: number; date: string; recurrence: string | null; statut: string }>(
    `SELECT c.item_id, c.date, i.recurrence, i.statut
     FROM completions c JOIN items i ON i.id = c.item_id
     WHERE c.statut = 'complet' AND c.item_id IN (${uniques.map(() => "?").join(",")}) ORDER BY c.date`,
    ...uniques,
  );
  for (const r of rows) {
    if (r.recurrence === null || r.recurrence === "") {
      if (r.statut === "termine") sortie[r.item_id] = r.date; // la dernière complétion l'emporte (ORDER BY date)
    } else if (r.date === jour) sortie[r.item_id] = r.date;
  }
  return sortie;
}

/** Parmi ces tâches, celles qui existent encore et ne sont pas terminées. */
async function encoreActives(ids: number[]): Promise<number[]> {
  const uniques = [...new Set(ids.filter((i) => i > 0))];
  if (uniques.length === 0) return [];
  const db = await getDatabase();
  return (await db.getAllAsync<{ id: number }>(`SELECT id FROM items WHERE statut = 'actif' AND id IN (${uniques.map(() => "?").join(",")})`, ...uniques)).map((r) => r.id);
}

/**
 * Les 3 emplacements d'un jour. `classement` : les tâches encore à faire (moteur).
 * `aujourdhui` : le jour de l'appli. Les propositions ne se font que ce jour-là ; un autre jour montre seulement ce qui y est enregistré.
 */
export async function emplacementsDuJour(jour: string, classement: Proposition[], figer: boolean, aujourdhui: string = jour): Promise<Emplacement[]> {
  const parRang = [...classement].sort((a, b) => a.rang - b.rang);
  const proposer = jour === aujourdhui;
  const stockes = (await lignes(jour)).filter((l) => l.rang < NB_TROIS);
  const veille = proposer
    ? (await lignes(decalerJours(jour, -1))).filter((l) => l.item_id > 0 && l.rang < NB_TROIS).map((l) => l.item_id)
    : [];
  const faits = await faitesPour(jour, [...stockes.map((l) => l.item_id), ...parRang.map((p) => p.itemId)]);
  const emplacements = composerTrois({
    stockes: stockes.map(enStocke),
    dus: proposer ? parRang.filter((p) => prevueLe(p.jours, jour)).map((p) => p.itemId) : [],
    veille,
    ordre: parRang.map((p) => p.itemId),
    actifs: await encoreActives(stockes.map((l) => l.item_id)),
    faits,
    proposer,
  });
  const aFiger = figer && proposer ? emplacements.filter((e) => !e.stocke && e.itemId !== null) : [];
  if (aFiger.length > 0) {
    const db = await getDatabase();
    const t = maintenant();
    await db.withTransactionAsync(async () => {
      for (const e of aFiger) {
        await db.runAsync("INSERT OR REPLACE INTO trois (jour, item_id, rang, source, bonus, place_le, origine) VALUES (?, ?, ?, ?, 0, ?, ?)", jour, e.itemId, e.rang, e.source, t, e.origine);
      }
    });
    return emplacements.map((e) => (aFiger.includes(e) ? { ...e, stocke: true } : e));
  }
  return emplacements;
}

/** Les tâches bonus d'un jour (dans l'ordre où je les ai placées), cochées ou non. */
export async function bonusDuJour(jour: string, classement: Proposition[]): Promise<Bonus[]> {
  const db = await getDatabase();
  const stockes = await db.getAllAsync<{ item_id: number; rang: number }>("SELECT item_id, rang FROM trois WHERE jour = ? AND bonus = 1 ORDER BY rang", jour);
  const faits = await faitesPour(jour, stockes.map((s) => s.item_id));
  return composerBonus({ stockes: stockes.map((s) => ({ itemId: s.item_id, rang: s.rang })), ordre: classement.map((p) => p.itemId), actifs: await encoreActives(stockes.map((s) => s.item_id)), faits });
}

/** Marque l'emplacement comme vidé : il ne se remplit plus tout seul. */
async function vider(jour: string, rang: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM trois WHERE jour = ? AND rang = ? AND bonus = 0", jour, rang);
  await db.runAsync("INSERT OR REPLACE INTO trois (jour, item_id, rang, source, bonus, place_le, origine) VALUES (?, ?, ?, 'vide', 0, ?, '')", jour, idVide(rang), rang, maintenant());
}

/** Mon choix : la tâche prend cet emplacement (remplace son occupant ; si elle était dans un autre, ou en bonus, celui-ci se libère). */
export async function placerDansTrois(jour: string, rang: number, itemId: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const ailleurs = await db.getFirstAsync<{ rang: number }>("SELECT rang FROM trois WHERE jour = ? AND item_id = ? AND bonus = 0 AND rang <> ?", jour, itemId, rang);
    await db.runAsync("DELETE FROM trois WHERE jour = ? AND ((bonus = 0 AND rang = ?) OR item_id = ?)", jour, rang, itemId);
    await db.runAsync("INSERT INTO trois (jour, item_id, rang, source, bonus, place_le, origine) VALUES (?, ?, ?, 'choisi', 0, ?, 'moi')", jour, itemId, rang, maintenant());
    if (ailleurs) await vider(jour, ailleurs.rang);
  });
}

export async function retirerDesTrois(jour: string, rang: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(() => vider(jour, rang));
}

/** La tâche devient un bonus de ce jour (si elle était dans les 3, son emplacement se libère). */
export async function placerEnBonus(jour: string, itemId: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const prio = await db.getFirstAsync<{ rang: number }>("SELECT rang FROM trois WHERE jour = ? AND item_id = ? AND bonus = 0", jour, itemId);
    await db.runAsync("DELETE FROM trois WHERE jour = ? AND item_id = ?", jour, itemId);
    if (prio) await vider(jour, prio.rang);
    const m = await db.getFirstAsync<{ m: number | null }>("SELECT MAX(rang) AS m FROM trois WHERE jour = ? AND bonus = 1", jour);
    await db.runAsync("INSERT INTO trois (jour, item_id, rang, source, bonus, place_le, origine) VALUES (?, ?, ?, 'choisi', 1, ?, 'moi')", jour, itemId, (m?.m ?? -1) + 1, maintenant());
  });
}

export async function retirerDuBonus(jour: string, itemId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM trois WHERE jour = ? AND item_id = ? AND bonus = 1", jour, itemId);
}

/** Où cette tâche est-elle placée, aujourd'hui et plus tard ? (pour l'étoile ★) */
export async function planifications(depuis: string): Promise<Record<number, { jour: string; bonus: boolean }[]>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ jour: string; item_id: number; bonus: number }>("SELECT jour, item_id, bonus FROM trois WHERE jour >= ? AND item_id > 0 AND source <> 'vide' ORDER BY jour", depuis);
  const sortie: Record<number, { jour: string; bonus: boolean }[]> = {};
  for (const r of rows) (sortie[r.item_id] ??= []).push({ jour: r.jour, bonus: r.bonus === 1 });
  return sortie;
}

/**
 * L'étoile ☆ pour un jour : retire la tâche si je l'y avais mise (priorité ou bonus) ; sinon la place (en bonus si demandé, ou dans le
 * premier emplacement libre ; une simple proposition de l'appli devient mon choix). 'plein' quand les 3 sont pris : l'appelant propose
 * « En bonus » ou « Remplacer… », jamais d'écrasement silencieux.
 */
export async function etoiler(jour: string, itemId: number, comme: "priorite" | "bonus", classement: Proposition[], aujourdhui: string): Promise<"ajoute" | "retire" | "plein"> {
  const db = await getDatabase();
  const stocke = await db.getFirstAsync<{ rang: number; bonus: number; source: string }>("SELECT rang, bonus, source FROM trois WHERE jour = ? AND item_id = ?", jour, itemId);
  if (stocke && stocke.source === "choisi") {
    if (stocke.bonus === 1) await retirerDuBonus(jour, itemId);
    else await retirerDesTrois(jour, stocke.rang);
    return "retire";
  }
  if (comme === "bonus") {
    await placerEnBonus(jour, itemId);
    return "ajoute";
  }
  const empl = await emplacementsDuJour(jour, classement, false, aujourdhui);
  const rang = rangDe(empl, itemId);
  if (rang !== null) {
    await placerDansTrois(jour, rang, itemId); // une proposition que je confirme
    return "ajoute";
  }
  const libre = empl.find((e) => e.itemId === null);
  if (!libre) return "plein";
  await placerDansTrois(jour, libre.rang, itemId);
  return "ajoute";
}

/** Ancienne API (bascule sur des emplacements déjà lus) : gardée pour les écrans qui n'ont pas besoin du choix du jour. */
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
