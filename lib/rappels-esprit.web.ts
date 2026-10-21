import { activer, etatRappels, lireReglages, synchroniser } from "./push-web";

/**
 * Rappels de l'Esprit, version web. Le serveur de rappels ne reçoit que l'heure du rappel du soir :
 * aucune date ni aucune note ne part. Le jour de ma séance avec moi-même, l'appli l'affiche à
 * l'ouverture (bandeau dans Esprit) : le web ne sait pas programmer de notification locale.
 */

export type RappelEsprit = { actif: boolean; heure: string };

export async function lireRappelEsprit(): Promise<RappelEsprit> {
  return lireReglages().esprit;
}

/** Renvoie false si la permission des notifications est refusée. */
export async function ecrireRappelEsprit(c: RappelEsprit): Promise<boolean> {
  const reglages = { ...lireReglages(), esprit: c };
  if ((await etatRappels()) === "actif") {
    await synchroniser(reglages);
    return true;
  }
  return c.actif ? activer(reglages) : true;
}

/** Pas de notification locale sur le web : le bandeau du jour (Esprit) tient lieu de rappel. */
export async function programmerRappelSeanceMoi(_r: { actif: boolean; jour: number; heure: string }): Promise<boolean> {
  return true;
}
