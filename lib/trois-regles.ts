/**
 * « Mes 3 » sans accès à la base : testable seul (tests/trois.test.mjs).
 * Trois emplacements par jour. Un emplacement est choisi par moi, ou proposé
 * (tâche prévue ce jour-là, tâche de la veille pas faite, puis le moteur).
 */

export const NB_TROIS = 3;

/** 'choisi' = mon choix ; 'report' / 'moteur' = proposé ; 'vide' = emplacement que j'ai vidé. */
export type SourceTrois = "choisi" | "report" | "moteur" | "vide";

export type Stocke = { rang: number; itemId: number; source: SourceTrois };

export type Emplacement = {
  rang: number;
  /** null = emplacement libre (jamais rempli, vidé, ou tâche faite). */
  itemId: number | null;
  source: SourceTrois;
  /** Déjà enregistré en base (sinon : proposition du moment, à enregistrer pour la figer). */
  stocke: boolean;
};

export const estPropose = (e: Emplacement) => e.itemId !== null && e.source !== "choisi";

/** Une ligne « vide » prend un item_id négatif (clé primaire : jour + item_id). */
export const idVide = (rang: number) => -(rang + 1);

/**
 * Candidats à proposer, dans l'ordre : tâches prévues ce jour-là (dus), puis les non faites de la veille,
 * puis le moteur. Seules les tâches encore à faire (`ordre`) comptent ; sans doublon.
 */
export function candidatsOrdonnes(p: { dus: number[]; veille: number[]; ordre: number[] }): { itemId: number; source: SourceTrois }[] {
  const afaire = new Set(p.ordre);
  const vus = new Set<number>();
  const sortie: { itemId: number; source: SourceTrois }[] = [];
  const ajouter = (ids: number[], source: SourceTrois) => {
    for (const id of ids) {
      if (!afaire.has(id) || vus.has(id)) continue;
      vus.add(id);
      sortie.push({ itemId: id, source });
    }
  };
  ajouter(p.dus, "moteur");
  ajouter(p.veille, "report");
  ajouter(p.ordre, "moteur");
  return sortie;
}

/**
 * Les 3 emplacements d'un jour. Ce qui est enregistré prime (une tâche faite laisse son emplacement libre,
 * sans remplacement) ; les emplacements jamais remplis reçoivent les meilleurs candidats.
 */
export function composerTrois(p: { stockes: Stocke[]; dus: number[]; veille: number[]; ordre: number[] }): Emplacement[] {
  const afaire = new Set(p.ordre);
  const pris = new Set(p.stockes.filter((s) => s.itemId > 0).map((s) => s.itemId));
  const reste = candidatsOrdonnes(p).filter((c) => !pris.has(c.itemId));
  return Array.from({ length: NB_TROIS }, (_, rang): Emplacement => {
    const s = p.stockes.find((x) => x.rang === rang);
    if (s) {
      const actif = s.source !== "vide" && s.itemId > 0 && afaire.has(s.itemId);
      return { rang, itemId: actif ? s.itemId : null, source: actif ? s.source : "vide", stocke: true };
    }
    const c = reste.shift();
    return c ? { rang, itemId: c.itemId, source: c.source, stocke: false } : { rang, itemId: null, source: "vide", stocke: false };
  });
}

/** Premier emplacement libre, ou null quand les 3 sont pris. */
export const premierLibre = (e: Emplacement[]): number | null => e.find((x) => x.itemId === null)?.rang ?? null;

export const rangDe = (e: Emplacement[], itemId: number): number | null => e.find((x) => x.itemId === itemId)?.rang ?? null;
