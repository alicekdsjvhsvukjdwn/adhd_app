import { decalerJours } from "../dates";
import { derniersJours, liensHumeur, moyenne, moyennesParJour, type LienHumeur } from "../esprit-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { humeursEntre } from "./esprit";
import { nuitsEntre } from "./sommeil";

/** Progrès › Humeur : la courbe des 30 derniers jours et les liens prudents (90 jours d'historique). */
export async function humeurProgres(): Promise<{
  courbe: { jour: string; moy: number | null }[];
  notes: number;
  moyenne: number | null;
  liens: LienHumeur[];
}> {
  const fin = getAujourdhui();
  const debutLiens = decalerJours(fin, -89);
  const humeurs = await humeursEntre(debutLiens, fin);

  const courbe = moyennesParJour(humeurs, derniersJours(fin, 30));
  const recentes = humeurs.filter((h) => h.jour >= decalerJours(fin, -29));

  const humeurParJour: Record<string, number> = {};
  for (const j of moyennesParJour(humeurs, derniersJours(fin, 90))) if (j.moy !== null) humeurParJour[j.jour] = j.moy;

  const sommeilMinParJour: Record<string, number> = {};
  for (const n of await nuitsEntre(debutLiens, fin)) if (n.duree_min > 0) sommeilMinParJour[n.date] = n.duree_min;

  const db = await getDatabase();
  const joursSport = new Set(
    (
      await db.getAllAsync<{ date: string }>(
        `SELECT date FROM seances WHERE date >= ? UNION SELECT date FROM seances_guidees WHERE date >= ?`,
        debutLiens,
        debutLiens,
      )
    ).map((r) => r.date),
  );
  const joursDifficiles = new Set(
    (await db.getAllAsync<{ cle: string }>("SELECT cle FROM meta WHERE cle LIKE 'energie_routines:%' AND valeur = '1'")).map((r) =>
      r.cle.slice("energie_routines:".length),
    ),
  );

  return {
    courbe,
    notes: recentes.length,
    moyenne: moyenne(recentes.map((h) => h.niveau)),
    liens: liensHumeur({ humeurParJour, sommeilMinParJour, joursSport, joursDifficiles }),
  };
}
