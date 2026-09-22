import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Filet anti-famine.
 *
 * Un item proposé un jour donné mais non complété ce jour-là voit son
 * compteur nb_propositions_sans_action monter d'une unité. Après plusieurs
 * jours ignoré, sa composante « négligence » grimpe et le moteur finit par
 * le remonter — c'est ce qui empêche un item de disparaître pour toujours
 * juste parce qu'il n'a jamais été fait. completer() remet ce compteur à 0.
 *
 * On ne traite que les jours RÉVOLUS (strictement avant aujourd'hui) :
 * un item proposé aujourd'hui et pas encore fait n'est pas « négligé »,
 * la journée n'est pas finie. On rattrape aussi les jours où l'appli
 * n'a pas été ouverte, via un marqueur de dernier jour comptabilisé.
 */

const CLE_DERNIER_JOUR = "negligence_dernier_jour_traite";

function isoHier(): string {
  return new Date(Date.now() - 86400000).toISOString().split("T")[0];
}

async function assurerMeta() {
  const db = await getDatabase();
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);`,
  );
}

async function lireMeta(cle: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cle,
  );
  return row?.valeur ?? null;
}

async function ecrireMeta(cle: string, valeur: string) {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)",
    cle,
    valeur,
  );
}

export async function traiterNegligence(): Promise<void> {
  await assurerMeta();
  const db = await getDatabase();
  const hier = isoHier();

  const dernier = await lireMeta(CLE_DERNIER_JOUR);

  // Premier lancement : on démarre proprement, sans punir le passé.
  if (dernier === null) {
    await ecrireMeta(CLE_DERNIER_JOUR, hier);
    return;
  }

  // Déjà à jour (comparaison de dates ISO = comparaison chronologique).
  if (dernier >= hier) return;

  // Pour chaque jour de (dernier, hier], +1 aux items proposés ce jour-là
  // qui n'ont pas de complétion à cette date.
  await db.runAsync(
    `UPDATE items
     SET nb_propositions_sans_action = nb_propositions_sans_action + (
       SELECT COUNT(*)
       FROM decision_log d
       WHERE d.item_id = items.id
         AND d.propose = 1
         AND d.date > ? AND d.date <= ?
         AND NOT EXISTS (
           SELECT 1 FROM completions c
           WHERE c.item_id = d.item_id AND c.date = d.date
         )
     )
     WHERE id IN (
       SELECT DISTINCT item_id FROM decision_log
       WHERE propose = 1 AND date > ? AND date <= ?
     )`,
    dernier,
    hier,
    dernier,
    hier,
  );

  await ecrireMeta(CLE_DERNIER_JOUR, hier);
}

/** Exposé au cas où tu veuilles l'appeler ailleurs (ex : au démarrage). */
export function jourAujourdhui(): string {
  return getAujourdhui();
}
