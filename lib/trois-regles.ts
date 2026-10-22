/**
 * « Mes 3 » sans accès à la base : testable seul (tests/trois.test.mjs).
 * Trois emplacements par jour (et, en plus, des tâches « bonus »). Un emplacement est choisi par moi, ou proposé
 * le jour même seulement (tâche prévue ce jour-là, tâche de la veille pas faite, puis le moteur) : un jour futur
 * n'a que ce que j'y ai mis, un jour passé est en lecture seule.
 */

export const NB_TROIS = 3;

/** 'choisi' = mon choix ; 'report' / 'moteur' = proposé ; 'vide' = emplacement que j'ai vidé. */
export type SourceTrois = "choisi" | "report" | "moteur" | "vide";

/** D'où vient la tâche placée (pour comparer plus tard planifier à l'avance et réaliser) : moi, report, moteur, ou prévue ce jour-là. */
export type OrigineTrois = "moi" | "report" | "moteur" | "prevue" | "";

export type Stocke = { rang: number; itemId: number; source: SourceTrois; origine?: OrigineTrois };

export type Emplacement = {
  rang: number;
  /** null = emplacement libre (jamais rempli ou vidé). Une tâche faite garde son emplacement. */
  itemId: number | null;
  source: SourceTrois;
  origine: OrigineTrois;
  /** Déjà enregistré en base (sinon : proposition du moment, à enregistrer pour la figer). */
  stocke: boolean;
  /** La tâche est faite : elle reste affichée, cochée. */
  faite: boolean;
  /** Jour où elle a été faite (peut être avant le jour de l'emplacement : « déjà faite le ven. »). */
  faiteLe: string | null;
};

export const estPropose = (e: Emplacement) => e.itemId !== null && e.source !== "choisi";

/** Une ligne « vide » prend un item_id négatif (clé primaire : jour + item_id). */
export const idVide = (rang: number) => -(rang + 1);

export type Candidat = { itemId: number; source: SourceTrois; origine: OrigineTrois };

/**
 * Candidats à proposer, dans l'ordre : tâches prévues ce jour-là (dus), puis les non faites de la veille,
 * puis le moteur. Seules les tâches encore à faire (`ordre`) comptent ; sans doublon.
 */
export function candidatsOrdonnes(p: { dus: number[]; veille: number[]; ordre: number[] }): Candidat[] {
  const afaire = new Set(p.ordre);
  const vus = new Set<number>();
  const sortie: Candidat[] = [];
  const ajouter = (ids: number[], source: SourceTrois, origine: OrigineTrois) => {
    for (const id of ids) {
      if (!afaire.has(id) || vus.has(id)) continue;
      vus.add(id);
      sortie.push({ itemId: id, source, origine });
    }
  };
  ajouter(p.dus, "moteur", "prevue");
  ajouter(p.veille, "report", "report");
  ajouter(p.ordre, "moteur", "moteur");
  return sortie;
}

const vide = (rang: number, stocke: boolean): Emplacement => ({ rang, itemId: null, source: "vide", origine: "", stocke, faite: false, faiteLe: null });

/**
 * Les 3 emplacements d'un jour. Ce qui est enregistré prime (une tâche faite garde son emplacement, cochée) ;
 * les emplacements jamais remplis reçoivent les meilleurs candidats, mais seulement si `proposer` (le jour même).
 * `faits` : pour chaque tâche faite, le jour où elle l'a été.
 */
export function composerTrois(p: { stockes: Stocke[]; dus: number[]; veille: number[]; ordre: number[]; actifs?: number[]; faits?: Record<number, string>; proposer?: boolean }): Emplacement[] {
  // Une tâche que j'ai placée reste (même si le classement ne la propose pas aujourd'hui, ex. récurrente du jour d'après) tant qu'elle existe.
  const afaire = new Set(p.actifs ?? p.ordre);
  const faits = p.faits ?? {};
  const pris = new Set(p.stockes.filter((s) => s.itemId > 0).map((s) => s.itemId));
  const reste = p.proposer === false ? [] : candidatsOrdonnes(p).filter((c) => !pris.has(c.itemId) && faits[c.itemId] === undefined);
  return Array.from({ length: NB_TROIS }, (_, rang): Emplacement => {
    const s = p.stockes.find((x) => x.rang === rang);
    if (s) {
      if (s.source !== "vide" && s.itemId > 0 && faits[s.itemId] !== undefined) {
        return { rang, itemId: s.itemId, source: s.source, origine: s.origine ?? "", stocke: true, faite: true, faiteLe: faits[s.itemId] };
      }
      const actif = s.source !== "vide" && s.itemId > 0 && afaire.has(s.itemId);
      return actif ? { rang, itemId: s.itemId, source: s.source, origine: s.origine ?? "", stocke: true, faite: false, faiteLe: null } : vide(rang, true);
    }
    const c = reste.shift();
    return c ? { rang, itemId: c.itemId, source: c.source, origine: c.origine, stocke: false, faite: false, faiteLe: null } : vide(rang, false);
  });
}

export type Bonus = { itemId: number; rang: number; faite: boolean; faiteLe: string | null };

/** Les bonus d'un jour dans l'ordre où je les ai placés ; une tâche supprimée disparaît, une tâche faite reste. */
export function composerBonus(p: { stockes: { itemId: number; rang: number }[]; ordre: number[]; actifs?: number[]; faits?: Record<number, string> }): Bonus[] {
  const afaire = new Set(p.actifs ?? p.ordre);
  const faits = p.faits ?? {};
  return [...p.stockes]
    .sort((a, b) => a.rang - b.rang)
    .flatMap((s): Bonus[] => {
      const faiteLe = faits[s.itemId];
      if (faiteLe !== undefined) return [{ itemId: s.itemId, rang: s.rang, faite: true, faiteLe }];
      return afaire.has(s.itemId) ? [{ itemId: s.itemId, rang: s.rang, faite: false, faiteLe: null }] : [];
    });
}

/** Premier emplacement libre, ou null quand les 3 sont pris (une tâche faite occupe son emplacement). */
export const premierLibre = (e: Emplacement[]): number | null => e.find((x) => x.itemId === null)?.rang ?? null;

export const rangDe = (e: Emplacement[], itemId: number): number | null => e.find((x) => x.itemId === itemId)?.rang ?? null;

/** Les 3 sont-ils tous remplis et faits ? (un emplacement vide compte comme « pas fait ») */
export const troisFaits = (e: Emplacement[]): boolean => e.length === NB_TROIS && e.every((x) => x.itemId !== null && x.faite);

/**
 * La section « Bonus » d'un jour : aujourd'hui, en retrait (« après tes 3 ») tant que les 3 ne sont pas faits, en avant quand ils le sont ;
 * un autre jour (ou un jour passé), normale : rien n'y est fait, rien n'y bloque.
 */
export function etatBonus(prio: Emplacement[], estAujourdhui: boolean): "retrait" | "avant" | "normal" {
  if (!estAujourdhui) return "normal";
  return troisFaits(prio) ? "avant" : "retrait";
}

/** « déjà faite le ven. » : la tâche a été faite un autre jour que celui de l'emplacement. */
export const faiteAvant = (e: { faite: boolean; faiteLe: string | null }, jour: string): boolean => e.faite && e.faiteLe !== null && e.faiteLe !== jour;
