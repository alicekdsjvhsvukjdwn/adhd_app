import { materielValide, MATERIEL_DEFAUT, type Materiel } from "../materiel";
import { getDatabase } from "./client";
import { lireMeta, ecrireMeta } from "./meta";

/**
 * Mon matériel de sport (meta « sport_materiel », JSON). La barre de traction reste aussi dans
 * sport_reglages.barre_traction, que lit l'arbre de skills : les deux sont tenus d'accord.
 */

const CLE = "sport_materiel";

/** Le matériel a déjà été réglé (au premier lancement ou depuis ⚙️). */
export async function materielConfigure(): Promise<boolean> {
  return (await lireMeta(CLE)) !== null;
}

export async function getMateriel(): Promise<Materiel> {
  const brut = await lireMeta(CLE);
  if (brut !== null) {
    try {
      return materielValide(JSON.parse(brut));
    } catch {
      return MATERIEL_DEFAUT;
    }
  }
  // Jamais réglé : on reprend ce que le sport savait déjà (la barre de traction).
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ barre_traction: number }>("SELECT barre_traction FROM sport_reglages WHERE id = 1");
  return materielValide({ dispo: { ...MATERIEL_DEFAUT.dispo, barre: r?.barre_traction === 1 }, poids: [] });
}

export async function ecrireMateriel(m: Materiel): Promise<Materiel> {
  const v = materielValide(m);
  await ecrireMeta(CLE, JSON.stringify(v));
  const db = await getDatabase();
  await db.runAsync("UPDATE sport_reglages SET barre_traction = ? WHERE id = 1", v.dispo.barre ? 1 : 0);
  return v;
}
