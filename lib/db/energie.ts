import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { recalculerPointsEtapesDuJour } from "./etapes";
import { logEvent } from "./events";
import { cleEnergie, estJourDifficile } from "./jour-difficile";

/**
 * Énergie du jour, choisie à la main sur l'onglet Routines
 * (🪫 Jour difficile / 🔋 Normal / ⚡ En forme). Rien tant qu'on n'a pas choisi.
 * 🪫 fait le « Jour difficile » (voir jour-difficile.ts) ; ⚡ n'est pour
 * l'instant qu'enregistré, pour l'analyse.
 */

export async function energieDuJour(): Promise<{
  niveau: 1 | 2 | 3 | null;
  source: "choix" | null;
}> {
  const db = await getDatabase();
  const choix = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cleEnergie(),
  );
  if (choix)
    return { niveau: Number(choix.valeur) as 1 | 2 | 3, source: "choix" };
  return { niveau: null, source: null };
}

export async function choisirEnergie(niveau: 1 | 2 | 3): Promise<void> {
  const etaitDifficile = await estJourDifficile();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)",
    cleEnergie(),
    String(niveau),
  );
  // Historique des jours difficiles, comme avant.
  if (etaitDifficile !== (niveau === 1)) {
    await logEvent(
      niveau === 1 ? "jour_difficile_active" : "jour_difficile_desactive",
      null,
      { date: getAujourdhui() },
    );
  }
  // Les routines à étapes déjà cochées suivent le barème du nouvel état.
  await recalculerPointsEtapesDuJour();
}

// ─── Vue de l'onglet Routines ───────────────────────────────────────────

/** Domaine, « Autres » ou « Tout » choisi aujourd'hui (meta vue_routines:AAAA-MM-JJ). */
const cleVue = () => `vue_routines:${getAujourdhui()}`;

/** Vue choisie aujourd'hui, ou null : le lendemain, rien n'est retenu. */
export async function vueDuJour(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cleVue(),
  );
  return row?.valeur ?? null;
}

export async function choisirVue(vue: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)", cleVue(), vue);
}
