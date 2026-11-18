import { activer, etatRappels, lireReglages, synchroniser } from "./push-web";

/** Version web : l'heure du récap part au serveur de rappels (rien d'autre), qui l'envoie le dimanche. */
export async function programmerRappelRecap(r: { actif: boolean; heure: string }): Promise<boolean> {
  const reglages = { ...lireReglages(), recap: r };
  if ((await etatRappels()) === "actif") {
    await synchroniser(reglages);
    return true;
  }
  return r.actif ? activer(reglages) : true;
}
