import { decalerJours } from "../dates";
import {
  composerTrois,
  ordreTrois,
  poidsTrois,
  prefsValides,
  type PrefsTrois,
  type SourceTrois,
} from "../trois-regles";
import { getDatabase } from "./client";
import { logDecisions } from "./decisions";
import { ecrireMeta, lireMeta } from "./meta";
import type { Proposition } from "./moteur";

/**
 * « Mes 3 » : les tâches retenues pour un jour (table trois) et les préférences (meta).
 * La composition d'un jour se fait une seule fois, à sa première ouverture :
 * une tâche faite disparaît ensuite sans être remplacée.
 */

const CLE_PREFS = "prefs_trois";
const cleCompose = (jour: string) => `trois_compose:${jour}`;
const jourSemaine = (jour: string) => new Date(jour + "T00:00:00Z").getUTCDay();

export async function lirePrefsTrois(): Promise<PrefsTrois> {
  try {
    return prefsValides(JSON.parse((await lireMeta(CLE_PREFS)) ?? "null"));
  } catch {
    return prefsValides(null);
  }
}

export const ecrirePrefsTrois = (p: PrefsTrois) => ecrireMeta(CLE_PREFS, JSON.stringify(prefsValides(p)));

type Ligne = { item_id: number; rang: number; source: SourceTrois };

async function lignes(jour: string): Promise<Ligne[]> {
  const db = await getDatabase();
  return db.getAllAsync<Ligne>("SELECT item_id, rang, source FROM trois WHERE jour = ? ORDER BY rang, item_id", jour);
}

/** Classement du moteur re-noté avec les poids des 3, listes exclues retirées, charge du jour comprise. */
export const ordrePourJour = (classement: Proposition[], prefs: PrefsTrois, jour: string, chargeMin: number) =>
  ordreTrois(classement, prefs, jourSemaine(jour), chargeMin);

/** Les 3 que je choisis pour un jour (remplace un choix précédent, garde le reste). */
export async function choisirPourJour(jour: string, ids: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM trois WHERE jour = ? AND source = 'choisi'", jour);
    let rang = 0;
    for (const id of ids) {
      await db.runAsync(
        "INSERT OR REPLACE INTO trois (jour, item_id, rang, source) VALUES (?, ?, ?, 'choisi')",
        jour,
        id,
        rang++,
      );
    }
  });
}

export async function choixDuJour(jour: string): Promise<number[]> {
  return (await lignes(jour)).filter((l) => l.source === "choisi").map((l) => l.item_id);
}

/**
 * Les 3 d'aujourd'hui, encore à faire. Au premier appel du jour : composition
 * (choix de la veille, report des non faites, moteur) et trace dans decision_log
 * avec les poids utilisés.
 */
export async function lesTroisDuJour(
  jour: string,
  classement: Proposition[],
  prefs: PrefsTrois,
  chargeMin: number,
): Promise<Proposition[]> {
  const ordre = ordrePourJour(classement, prefs, jour, chargeMin);
  const db = await getDatabase();

  if ((await lireMeta(cleCompose(jour))) === null) {
    const choisis = (await lignes(jour)).filter((l) => l.source === "choisi").map((l) => l.item_id);
    const veille = (await lignes(decalerJours(jour, -1))).map((l) => l.item_id);
    const composes = composerTrois({
      mode: prefs.mode,
      nombre: prefs.nombre,
      choisis,
      veille,
      ordre: ordre.map((o) => o.itemId),
    });
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM trois WHERE jour = ?", jour);
      for (const [rang, c] of composes.entries()) {
        await db.runAsync(
          "INSERT INTO trois (jour, item_id, rang, source) VALUES (?, ?, ?, ?)",
          jour,
          c.itemId,
          rang,
          c.source,
        );
      }
      await ecrireMeta(cleCompose(jour), "1");
    });
    const poids = poidsTrois(prefs.curseurs);
    await logDecisions(
      composes.flatMap((c, rang) => {
        const o = ordre.find((x) => x.itemId === c.itemId);
        return o
          ? [
              {
                itemId: c.itemId,
                score: o.scoreTrois,
                composantes: { ...o.composantes, poids_trois: poids },
                rang: rang + 1,
                propose: true,
                exploration: false,
                raison: `Mes 3 (${c.source})`,
              },
            ]
          : [];
      }),
    ).catch(() => {});
  }

  const parId = new Map(classement.map((p) => [p.itemId, p]));
  return (await lignes(jour)).flatMap((l) => {
    const p = parId.get(l.item_id);
    return p ? [p] : [];
  });
}

/** « Une autre ? » : la meilleure tâche suivante, ajoutée aux 3 du jour. Renvoie false s'il n'y en a plus. */
export async function ajouterUneAutre(
  jour: string,
  classement: Proposition[],
  prefs: PrefsTrois,
  chargeMin: number,
): Promise<boolean> {
  const deja = await lignes(jour);
  const prises = new Set(deja.map((l) => l.item_id));
  const suivante = ordrePourJour(classement, prefs, jour, chargeMin).find((o) => !prises.has(o.itemId));
  if (!suivante) return false;
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO trois (jour, item_id, rang, source) VALUES (?, ?, ?, 'moteur')",
    jour,
    suivante.itemId,
    Math.max(-1, ...deja.map((l) => l.rang)) + 1,
  );
  return true;
}
