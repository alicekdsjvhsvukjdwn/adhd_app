import { getFamille } from "./catalogue";

/**
 * Versions d'une routine. La courte s'affiche les jours difficiles, la normale
 * sinon ; elles rapportent les mêmes points : faire la version courte un jour
 * difficile, c'est réussir sa journée. La longue n'est plus affichée, mais
 * reste en base et se calcule encore (complétions passées en version longue).
 */

export type Version = "courte" | "normale" | "longue";

export type UneVersion = { nom: string; duree: number | null };
export type Versions = Record<Version, UneVersion> & {
  /** true si la version existe vraiment (sinon, c'est la normale qui est reprise). */
  distincte: Record<Version, boolean>;
};

type RoutineVersionnable = {
  nom: string;
  duree_min: number | null;
  template_id: string | null;
  variante_rang: number | null;
  version_courte: string | null;
  version_longue: string | null;
};

export const LIBELLES_VERSION: Record<Version, string> = {
  courte: "courte",
  normale: "normale",
  longue: "longue",
};

/**
 * - normale : la routine telle qu'elle est ;
 * - courte : écrite par la personne, sinon le niveau le plus simple du catalogue ;
 * - longue : écrite par la personne, sinon le niveau au-dessus dans le catalogue.
 * Faute de mieux, une version reprend la normale.
 */
export function versionsDe(r: RoutineVersionnable): Versions {
  const normale: UneVersion = { nom: r.nom, duree: r.duree_min };
  let courte: UneVersion | null = null;
  let longue: UneVersion | null = null;

  const famille = r.template_id ? getFamille(r.template_id) : undefined;
  if (famille && r.variante_rang !== null) {
    const rangs = famille.variantes.map((v) => v.rang);
    const plusSimple = Math.min(...rangs);
    if (r.variante_rang > plusSimple) {
      const v = famille.variantes.find((x) => x.rang === plusSimple)!;
      courte = { nom: v.libelle, duree: v.duree_min };
    }
    const suivante = famille.variantes.find(
      (x) => x.rang === r.variante_rang! + 1,
    );
    if (suivante) longue = { nom: suivante.libelle, duree: suivante.duree_min };
  }

  if (r.version_courte?.trim())
    courte = { nom: r.version_courte.trim(), duree: null };
  if (r.version_longue?.trim())
    longue = { nom: r.version_longue.trim(), duree: null };

  return {
    courte: courte ?? normale,
    normale,
    longue: longue ?? normale,
    distincte: { courte: !!courte, normale: true, longue: !!longue },
  };
}

/** Un jour difficile, toutes les routines en version courte ; sinon la normale. */
export function versionDuJour(jourDifficile: boolean): Version {
  return jourDifficile ? "courte" : "normale";
}
