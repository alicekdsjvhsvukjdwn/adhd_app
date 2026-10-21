/**
 * Ménage par pièce, sans accès à la base : testable seul (tests/menage.test.mjs).
 * Une tâche revient tous les `freq_jours` jours ; la jauge d'une pièce dit
 * « propre » ou « à faire » sans chiffres.
 */
import { decalerJours } from "./dates";

/** Points d'une tâche de ménage (voir REGLES_POINTS) : une fois par tâche et par échéance. */
export const POINTS_MENAGE = 5;

export type TacheMenage = {
  id: number;
  piece_id: number;
  nom: string;
  freq_jours: number;
  /** Prochaine échéance, AAAA-MM-JJ. */
  prochaine_le: string;
  /** Jour où elle a été cochée en dernier ; sert à l'afficher cochée ce jour-là. */
  fait_le: string | null;
  /** Échéance d'avant le dernier cochage, pour pouvoir décocher. */
  avant_le: string | null;
  /** 1 si ce cochage a rapporté des points (donc à reprendre en décochant). */
  points_donnes: number;
};

/** Jours entiers de a à b (positif si b est après a). Calcul sur les dates, pas sur des heures. */
export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

export function libelleFrequence(n: number): string {
  if (n <= 1) return "chaque jour";
  if (n === 7) return "chaque semaine";
  if (n === 30) return "chaque mois";
  if (n % 7 === 0 && n < 30) return `toutes les ${n / 7} semaines`;
  return `tous les ${n} jours`;
}

export const estDue = (t: TacheMenage, aujourdhui: string) => t.prochaine_le <= aujourdhui;

/** Jours de retard : 0 le jour même de l'échéance (ou avant). */
export const retardJours = (t: TacheMenage, aujourdhui: string) => Math.max(0, joursEntre(t.prochaine_le, aujourdhui));

/**
 * Part de la période écoulée depuis la dernière fois (0 = vient d'être faite,
 * 1 = à faire ou en retard). Sert à la jauge de la pièce.
 */
export function partRetard(t: TacheMenage, aujourdhui: string): number {
  const f = Math.max(1, t.freq_jours);
  const depuis = f - joursEntre(aujourdhui, t.prochaine_le); // jours depuis la dernière fois
  return Math.min(1, Math.max(0, depuis / f));
}

/** Jauge d'une pièce : 1 = propre (pleine), 0 = à faire (vide). Une pièce sans tâche est propre. */
export function jauge(taches: TacheMenage[], aujourdhui: string): number {
  if (taches.length === 0) return 1;
  return 1 - taches.reduce((s, t) => s + partRetard(t, aujourdhui), 0) / taches.length;
}

const mixer = (a: number, b: number, p: number) => Math.round(a + (b - a) * p);
/** Orange (à faire) → vert (propre). */
export function couleurJauge(part: number): string {
  const p = Math.min(1, Math.max(0, part));
  const [r, g, b] = [mixer(0xfb, 0x34, p), mixer(0x92, 0xd3, p), mixer(0x3c, 0x99, p)];
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * « À faire aujourd'hui » : les tâches dues ou en retard, toutes pièces, les plus en retard
 * d'abord, `max` visibles. Un jour difficile : seulement les tâches « chaque jour ».
 */
export function aFaireAujourdhui<T extends TacheMenage>(
  taches: T[],
  aujourdhui: string,
  opts: { jourDifficile?: boolean; max?: number } = {},
): { visibles: T[]; autres: number } {
  const { jourDifficile = false, max = 5 } = opts;
  const dues = taches
    .filter((t) => estDue(t, aujourdhui) && t.fait_le !== aujourdhui && (!jourDifficile || t.freq_jours <= 1))
    .sort(
      (a, b) =>
        retardJours(b, aujourdhui) - retardJours(a, aujourdhui) ||
        partRetard(b, aujourdhui) - partRetard(a, aujourdhui) ||
        a.id - b.id,
    );
  return { visibles: dues.slice(0, max), autres: Math.max(0, dues.length - max) };
}

/** Cochage : la prochaine échéance repart d'aujourd'hui. Des points seulement si la tâche était due. */
export function cocher(t: TacheMenage, aujourdhui: string) {
  return {
    prochaine_le: decalerJours(aujourdhui, Math.max(1, t.freq_jours)),
    fait_le: aujourdhui,
    avant_le: t.prochaine_le,
    points: estDue(t, aujourdhui),
  };
}

/** Pièces proposées au départ, avec leurs tâches (nom, fréquence en jours). */
export const PIECES_DEFAUT: { nom: string; icone: string; taches: [string, number][] }[] = [
  { nom: "Cuisine", icone: "cuisine", taches: [["Vaisselle", 1], ["Plan de travail", 2], ["Sol de la cuisine", 7], ["Frigo", 30]] },
  { nom: "Salle de bain", icone: "bain", taches: [["Lavabo", 7], ["Douche", 7], ["Toilettes", 7], ["Sol de la salle de bain", 14]] },
  { nom: "Chambre", icone: "chambre", taches: [["Faire le lit", 1], ["Ranger les vêtements", 3], ["Aspirer", 7], ["Dépoussiérer", 14]] },
  { nom: "Salon", icone: "salon", taches: [["Ranger", 2], ["Aspirer", 7], ["Dépoussiérer", 14], ["Vitres", 30]] },
  { nom: "Entrée", icone: "entree", taches: [["Ranger chaussures et courrier", 3], ["Balayer", 7]] },
  { nom: "Linge", icone: "linge", taches: [["Lessive", 3], ["Plier et ranger le linge", 3], ["Serviettes", 7], ["Changer les draps", 14]] },
  { nom: "Courses & poubelles", icone: "courses", taches: [["Sortir les poubelles", 3], ["Faire les courses", 7], ["Trier le recyclage", 7]] },
];
