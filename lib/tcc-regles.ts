/**
 * TCC en autonomie (anxiété sociale, confiance en soi), sans accès à la base : testable seul
 * (tests/tcc.test.mjs). Aucun diagnostic : l'appli range, compte et rend ce que la personne a noté.
 */
import { decalerJours } from "./dates";
import { debutPeriode } from "./regles-taches";
import { comparer, type Comparaison } from "./suivi-regles";

// ─── Échelle d'exposition ───────────────────────────────────────────────

export type Situation = { id: number; nom: string; /** anxiété imaginée, 0 à 100 */ anxiete: number };
export type ExpositionFaite = { id: number; situation_id: number; jour: string; anx_prevue: number | null; anx_reelle: number | null };

/** « Nettement plus basse » : au moins 20 points sous ce que j'avais prévu. */
export const ECART_REUSSITE = 20;
/** Une anxiété réelle de 30 ou moins compte aussi (sinon une marche presque facile ne serait jamais franchie). */
export const SEUIL_FACILE = 30;
/** Une marche est franchie après deux expositions réussies. */
export const REUSSITES_POUR_FRANCHIR = 2;

export function expositionReussie(e: Pick<ExpositionFaite, "anx_prevue" | "anx_reelle">): boolean {
  if (e.anx_prevue === null || e.anx_reelle === null) return false;
  return e.anx_reelle <= e.anx_prevue - ECART_REUSSITE || e.anx_reelle <= SEUIL_FACILE;
}

export const reussites = (expositions: ExpositionFaite[]): number => expositions.filter(expositionReussie).length;
export const marcheFranchie = (expositions: ExpositionFaite[]): boolean => reussites(expositions) >= REUSSITES_POUR_FRANCHIR;

/** De la plus facile à la plus dure (à anxiété égale, la plus ancienne d'abord). */
export const ranger = <T extends Situation>(situations: T[]): T[] =>
  [...situations].sort((a, b) => a.anxiete - b.anxiete || a.id - b.id);

export type Marche<T extends Situation> = {
  situation: T;
  franchie: boolean;
  reussites: number;
  /** Expositions terminées sur cette marche. */
  faites: number;
  /** La prochaine à tenter : la première, en montant, qui n'est pas franchie. */
  prochaine: boolean;
};

export function marches<T extends Situation>(situations: T[], expositions: ExpositionFaite[]): Marche<T>[] {
  const liste = ranger(situations).map((s) => {
    const siennes = expositions.filter((e) => e.situation_id === s.id && e.anx_reelle !== null);
    return { situation: s, franchie: marcheFranchie(siennes), reussites: reussites(siennes), faites: siennes.length, prochaine: false };
  });
  const prochaine = liste.find((m) => !m.franchie);
  if (prochaine) prochaine.prochaine = true;
  return liste;
}

/** Jour où chaque marche a été franchie : celui de la deuxième exposition réussie. */
export function joursDeFranchissement(expositions: ExpositionFaite[]): Map<number, string> {
  const res = new Map<number, string>();
  const parMarche = new Map<number, ExpositionFaite[]>();
  for (const e of [...expositions].sort((a, b) => a.jour.localeCompare(b.jour) || a.id - b.id)) {
    if (!expositionReussie(e)) continue;
    const l = parMarche.get(e.situation_id) ?? [];
    l.push(e);
    parMarche.set(e.situation_id, l);
  }
  for (const [id, l] of parMarche) if (l.length >= REUSSITES_POUR_FRANCHIR) res.set(id, l[REUSSITES_POUR_FRANCHIR - 1].jour);
  return res;
}

/** Des situations pour démarrer, avec une anxiété imaginée de départ (modifiable). */
export const IDEES_ECHELLE: { nom: string; anxiete: number }[] = [
  { nom: "Dire bonjour à un commerçant", anxiete: 20 },
  { nom: "Poser une question dans un magasin", anxiete: 30 },
  { nom: "Faire un compliment", anxiete: 40 },
  { nom: "Demander un service", anxiete: 45 },
  { nom: "Aller seule dans un café", anxiete: 50 },
  { nom: "Appeler pour un rendez-vous", anxiete: 55 },
  { nom: "Parler à quelqu'un que je ne connais pas", anxiete: 60 },
  { nom: "Donner mon avis dans un groupe", anxiete: 65 },
  { nom: "Dire non", anxiete: 70 },
];

/** Comportements de sécurité courants, en pastilles. */
export const COMPORTEMENTS_SECURITE = [
  "Éviter le regard",
  "Préparer mes phrases",
  "Le téléphone",
  "Rester près de la sortie",
  "M'excuser d'avance",
  "Parler très peu",
  "Occuper mes mains",
  "Être accompagnée",
];

// ─── Semaines ───────────────────────────────────────────────────────────

/** Lundi de la semaine qui contient `iso`. */
export const lundiDe = (iso: string): string => debutPeriode(iso, "semaine");

/** Les lundis des `n` dernières semaines, la plus ancienne d'abord, jusqu'à la semaine en cours. */
export const semainesDepuis = (aujourdhui: string, n = 8): string[] =>
  Array.from({ length: n }, (_, i) => decalerJours(lundiDe(aujourdhui), -7 * (n - 1 - i)));

const moy = (v: number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);

// ─── Objectifs de la semaine ────────────────────────────────────────────

export type GenreObjectif = "expositions" | "confiance" | "experiences" | "seance";

export const GENRES_OBJECTIF: { cle: GenreObjectif; unite: [string, string]; max: number }[] = [
  { cle: "expositions", unite: ["exposition", "expositions"], max: 7 },
  { cle: "confiance", unite: ["entrée dans le journal de confiance", "entrées dans le journal de confiance"], max: 7 },
  { cle: "experiences", unite: ["expérience prédiction / réalité", "expériences prédiction / réalité"], max: 7 },
  { cle: "seance", unite: ["séance avec moi-même", "séance avec moi-même"], max: 1 },
];
export const MAX_OBJECTIFS = 3;

export const libelleObjectif = (genre: GenreObjectif, cible: number): string => {
  const g = GENRES_OBJECTIF.find((x) => x.cle === genre)!;
  return `${cible} ${cible > 1 ? g.unite[1] : g.unite[0]}`;
};

export type Objectif = { genre: GenreObjectif; cible: number };

/** Valeurs lues en base : genres connus seulement, cibles bornées, 3 au plus. */
export function objectifsValides(brut: { genre: string; cible: number }[]): Objectif[] {
  const vus = new Set<string>();
  const res: Objectif[] = [];
  for (const o of brut) {
    const g = GENRES_OBJECTIF.find((x) => x.cle === o.genre);
    if (!g || vus.has(o.genre)) continue;
    vus.add(o.genre);
    res.push({ genre: g.cle, cible: Math.min(g.max, Math.max(1, Math.round(o.cible) || 1)) });
  }
  return res.slice(0, MAX_OBJECTIFS);
}

/**
 * Objectifs d'une semaine : les siens s'il y en a, sinon ceux de la dernière semaine qui en avait
 * (ils se reconduisent si je ne change rien).
 */
export function objectifsDeSemaine(lignes: { semaine: string; genre: string; cible: number }[], lundi: string): Objectif[] {
  const propres = lignes.filter((l) => l.semaine === lundi);
  if (propres.length > 0) return objectifsValides(propres);
  const avant = lignes.filter((l) => l.semaine < lundi).map((l) => l.semaine).sort().at(-1);
  return avant ? objectifsValides(lignes.filter((l) => l.semaine === avant)) : [];
}

export type Compteurs = Record<GenreObjectif, number>;

/** Ce qui a été fait cette semaine (lundi → dimanche), pour remplir les pastilles. */
export function compteursSemaine(
  semaine: string[],
  d: {
    /** Expositions terminées ; `experience` : la marche vient d'une pensée à tester. */
    expositions: { jour: string; experience: boolean }[];
    confiance: { jour: string }[];
    seances: { jour: string }[];
  },
): Compteurs {
  const dans = (j: string) => semaine.includes(j);
  return {
    expositions: d.expositions.filter((e) => dans(e.jour)).length,
    experiences: d.expositions.filter((e) => dans(e.jour) && e.experience).length,
    confiance: d.confiance.filter((e) => dans(e.jour)).length,
    seance: d.seances.filter((e) => dans(e.jour)).length,
  };
}

export const progressionObjectifs = (objectifs: Objectif[], c: Compteurs) =>
  objectifs.map((o) => ({ ...o, fait: Math.min(c[o.genre], o.cible), atteint: c[o.genre] >= o.cible }));

// ─── Courbes de la semaine ──────────────────────────────────────────────

/** Anxiété prévue et réelle moyennes de chaque semaine (null quand rien n'a été fait). */
export function anxieteParSemaine(expositions: ExpositionFaite[], aujourdhui: string, n = 8) {
  return semainesDepuis(aujourdhui, n).map((debut) => {
    const fin = decalerJours(debut, 6);
    const l = expositions.filter((e) => e.jour >= debut && e.jour <= fin && e.anx_prevue !== null && e.anx_reelle !== null);
    return { debut, prevue: moy(l.map((e) => e.anx_prevue!)), reelle: moy(l.map((e) => e.anx_reelle!)) };
  });
}

/** Marches franchies, comptées dans la semaine où elles l'ont été. */
export function marchesParSemaine(expositions: ExpositionFaite[], aujourdhui: string, n = 8) {
  const jours = [...joursDeFranchissement(expositions).values()];
  return semainesDepuis(aujourdhui, n).map((debut) => ({ debut, n: jours.filter((j) => j >= debut && j <= decalerJours(debut, 6)).length }));
}

export const nombreParSemaine = (jours: string[], aujourdhui: string, n = 8) =>
  semainesDepuis(aujourdhui, n).map((debut) => ({ debut, n: jours.filter((j) => j >= debut && j <= decalerJours(debut, 6)).length }));

// ─── Séance avec moi-même ───────────────────────────────────────────────

export type RecapSemaine = {
  humeur: number | null;
  anxietePrevue: number | null;
  anxieteReelle: number | null;
  expositions: number;
  confiance: number;
  objectifs: ReturnType<typeof progressionObjectifs>;
};

/** Le récap de l'étape 2, rempli tout seul : mêmes bornes de semaine que les objectifs (lundi → dimanche). */
export function recapSemaine(
  lundi: string,
  d: {
    humeurs: { jour: string; niveau: number }[];
    expositions: (ExpositionFaite & { experience: boolean })[];
    confiance: { jour: string }[];
    seances: { jour: string }[];
    objectifs: Objectif[];
  },
): RecapSemaine {
  const jours = Array.from({ length: 7 }, (_, i) => decalerJours(lundi, i));
  const faites = d.expositions.filter((e) => jours.includes(e.jour) && e.anx_reelle !== null);
  const c = compteursSemaine(jours, { expositions: faites, confiance: d.confiance, seances: d.seances });
  return {
    humeur: moy(d.humeurs.filter((h) => jours.includes(h.jour)).map((h) => h.niveau)),
    anxietePrevue: moy(faites.flatMap((e) => (e.anx_prevue === null ? [] : [e.anx_prevue]))),
    anxieteReelle: moy(faites.map((e) => e.anx_reelle!)),
    expositions: faites.length,
    confiance: c.confiance,
    objectifs: progressionObjectifs(d.objectifs, c),
  };
}

// ─── Journal de confiance ───────────────────────────────────────────────

/** Une à trois lignes par jour. */
export const MAX_CONFIANCE_PAR_JOUR = 3;

/** Une entrée au hasard, différente de celle qu'on vient de voir quand il y en a plusieurs. */
export function tirer<T>(liste: T[], exclure: T | null = null, hasard: () => number = Math.random): T | null {
  const possibles = liste.length > 1 ? liste.filter((x) => x !== exclure) : liste;
  return possibles.length ? possibles[Math.min(possibles.length - 1, Math.floor(hasard() * possibles.length))] : null;
}

// ─── Liens prudents avec le sommeil et le sport ─────────────────────────

export type LienAnxiete = { cle: string; libelle: string; resultat: Comparaison };

/**
 * Anxiété réelle moyenne des jours avec exposition, selon la nuit d'avant et le sport du jour.
 * Chaque comparaison attend 7 jours dans chaque groupe (voir comparer) : des tendances, jamais des causes.
 */
export function liensAnxiete(p: {
  anxieteParJour: Record<string, number>;
  sommeilMinParJour: Record<string, number>;
  joursSport: Set<string>;
}): LienAnxiete[] {
  const jours = Object.keys(p.anxieteParJour);
  const val = (js: string[]) => js.map((j) => p.anxieteParJour[j]);
  return [
    {
      cle: "sommeil",
      libelle: "Nuit de 7 h ou plus · moins de 7 h",
      resultat: comparer(
        val(jours.filter((j) => (p.sommeilMinParJour[j] ?? -1) >= 420)),
        val(jours.filter((j) => p.sommeilMinParJour[j] !== undefined && p.sommeilMinParJour[j] < 420)),
      ),
    },
    {
      cle: "sport",
      libelle: "Jour avec sport · sans sport",
      resultat: comparer(val(jours.filter((j) => p.joursSport.has(j))), val(jours.filter((j) => !p.joursSport.has(j)))),
    },
  ];
}
