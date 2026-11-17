/**
 * « Ma journée » : le journal de ce que j'ai fait, rangé par zone du bonhomme.
 * Règles pures, sans accès à la base : testables seules (tests/journee.test.mjs).
 */
import { decalerJours } from "./dates";
import { melanger } from "./theme";

export type CleZone = "tete" | "coeur" | "bras" | "ventre" | "mains" | "jambes" | "pieds";

/** Une ligne de la table zones : la forme ne change pas, seulement le sens (libellé) et la couleur. */
export type Zone = { cle: CleZone; libelle: string; couleur: string; ordre: number; active: number };

export const ZONES_DEFAUT: Zone[] = [
  { cle: "tete", libelle: "Travail, recherche d'emploi, apprendre", couleur: "#60A5FA", ordre: 0, active: 1 },
  { cle: "coeur", libelle: "Relations", couleur: "#F87171", ordre: 1, active: 1 },
  { cle: "bras", libelle: "Sport", couleur: "#FB923C", ordre: 2, active: 1 },
  { cle: "ventre", libelle: "Prendre soin de moi : repas, repos, TCC", couleur: "#FACC15", ordre: 3, active: 1 },
  { cle: "mains", libelle: "Maison, cuisine, ménage, démarches", couleur: "#4ADE80", ordre: 4, active: 1 },
  { cle: "jambes", libelle: "Sorties, dehors, la mer", couleur: "#2DD4BF", ordre: 5, active: 1 },
  { cle: "pieds", libelle: "Avancer sur mes projets : Arduino, musique, appli…", couleur: "#A78BFA", ordre: 6, active: 1 },
];

/** Nom de la partie du corps, pour l'accessibilité et Profil. */
export const PARTIES: Record<CleZone, string> = {
  tete: "Tête",
  coeur: "Cœur",
  bras: "Bras",
  ventre: "Ventre",
  mains: "Mains",
  jambes: "Jambes",
  pieds: "Pieds",
};

/** Couleurs proposées dans Profil pour une zone. */
export const PALETTE_ZONES = ["#60A5FA", "#F87171", "#FB923C", "#FACC15", "#4ADE80", "#2DD4BF", "#A78BFA", "#F472B6", "#94A3B8"];

/** Zone sans entrée (ou désactivée) : gris foncé. */
export const GRIS_ZONE = "#26302F";

/** 0, 1, 2 ou 3 (= 3 entrées et plus). */
export const intensite = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

/** De plus en plus vive selon le nombre d'entrées du jour. */
export function couleurZone(couleur: string, n: number): string {
  const i = intensite(n);
  if (i === 0) return GRIS_ZONE;
  return melanger(GRIS_ZONE, couleur, [0, 0.45, 0.72, 1][i]);
}

// ─── Moments ────────────────────────────────────────────────────────────

/** Les moments de l'appli (lib/moments.ts) proposés en pastilles. */
export type MomentJournee = "matin" | "midi" | "apres_midi" | "soir";
export const MOMENTS_JOURNEE: MomentJournee[] = ["matin", "midi", "apres_midi", "soir"];

/** Moment par défaut d'après l'heure : la nuit compte pour le soir. */
export function momentDeHeureJournee(h: number): MomentJournee {
  if (h >= 6 && h < 12) return "matin";
  if (h >= 12 && h < 14) return "midi";
  if (h >= 14 && h < 18) return "apres_midi";
  return "soir";
}

/** 'recopie' si l'entrée est saisie après le jour ou le moment indiqué. */
export function origineSaisie(jour: string, moment: MomentJournee, aujourdhui: string, heure: number): "saisie" | "recopie" {
  if (jour < aujourdhui) return "recopie";
  const maintenant = momentDeHeureJournee(heure);
  // Après minuit (avant le début de journée), « soir » est encore le moment en cours.
  return MOMENTS_JOURNEE.indexOf(moment) < MOMENTS_JOURNEE.indexOf(maintenant) ? "recopie" : "saisie";
}

// ─── Saisie et modification ─────────────────────────────────────────────

/** Message clair si quelque chose manque, null si l'entrée peut être enregistrée. */
export function validerSaisie(zone: string | null, texte: string): string | null {
  if (!zone) return "Touche d'abord une zone du bonhomme.";
  if (!texte.trim()) return "Écris ce que tu as fait.";
  return null;
}

/** Les jours passés restent modifiables 7 jours, puis lecture seule ; les jours à venir aussi en lecture seule. */
export const JOURS_MODIFIABLES = 7;
export function modifiable(jour: string, aujourdhui: string): boolean {
  return jour <= aujourdhui && jour >= decalerJours(aujourdhui, -JOURS_MODIFIABLES);
}

/** Pastilles de durée (minutes) ; « autre » ouvre un champ. */
export const DUREES = [5, 15, 30, 60, 120];
export const libelleDuree = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m} min`);

/** Durée et ressenti sont facultatifs : null efface, une valeur hors bornes est refusée (null). */
export function nettoyerDetails(d: { duree_min?: number | null; ressenti?: number | null }) {
  const duree = d.duree_min == null || !(d.duree_min > 0) ? null : Math.min(24 * 60, Math.round(d.duree_min));
  const ressenti = d.ressenti == null || d.ressenti < 1 || d.ressenti > 5 ? null : Math.round(d.ressenti);
  return { duree_min: duree, ressenti };
}

// ─── Suggestions ────────────────────────────────────────────────────────

/** Minuscules, sans accents ni ponctuation. */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Entrées passées qui commencent comme la saisie (ou la contiennent) : même zone d'abord, puis les plus fréquentes.
 * `passees` : une ligne par (texte, zone) avec son nombre.
 */
export function suggestions(
  saisie: string,
  zone: string | null,
  passees: { texte: string; zone: string; n: number }[],
  max = 3,
): string[] {
  const s = normaliser(saisie);
  if (s.length < 2) return [];
  const rang = (p: { texte: string; zone: string; n: number }) => {
    const t = normaliser(p.texte);
    if (t === s) return -1;
    if (t.startsWith(s)) return 0;
    if (t.includes(s)) return 1;
    return -1;
  };
  const vus = new Set<string>();
  return passees
    .map((p) => ({ p, r: rang(p) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => Number(b.p.zone === zone) - Number(a.p.zone === zone) || a.r - b.r || b.p.n - a.p.n)
    .map((x) => x.p.texte)
    .filter((t) => {
      const k = normaliser(t);
      if (vus.has(k)) return false;
      vus.add(k);
      return true;
    })
    .slice(0, max);
}

/** Nombre d'entrées par zone. */
export function compterParZone(entrees: { zone: string }[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const e of entrees) c[e.zone] = (c[e.zone] ?? 0) + 1;
  return c;
}

// ─── Points (voir REGLES_POINTS) ────────────────────────────────────────

export const POINTS_ENTREE = 2;
/** Plafond des points d'entrées par jour : inutile de tout découper en mini-entrées. */
export const PLAFOND_ENTREES_JOUR = 20;
export const POINTS_BONUS_ZONES = 10;
export const ZONES_POUR_BONUS = 4;

/** Points d'une nouvelle entrée, d'après ceux déjà gagnés par les entrées du jour. Liée à une tâche : 0 (la tâche a les siens). */
export function pointsEntree(dejaGagnes: number, lieeATache = false): number {
  if (lieeATache) return 0;
  return Math.max(0, Math.min(POINTS_ENTREE, PLAFOND_ENTREES_JOUR - dejaGagnes));
}

/** Le bonus des 4 zones : une fois par jour, dès que la 4ᵉ zone se colore (entrées liées à une tâche comprises). */
export const gagneBonus = (zonesColorees: number, dejaDonne: boolean) => !dejaDonne && zonesColorees >= ZONES_POUR_BONUS;

// ─── Tâches : correspondance et zone de leur liste ──────────────────────

/** Mots trop courants pour dire qu'une entrée ressemble à une tâche. */
const MOTS_VIDES = new Set(["faire", "fait", "avec", "pour", "dans", "chez", "tout", "toute", "tous", "plus", "apres", "avant", "encore"]);

/** Mots clés : plus de 3 lettres, sans accents ni pluriel en -s. */
function motsCles(s: string): string[] {
  return normaliser(s)
    .split(" ")
    .filter((m) => m.length > 3 && !MOTS_VIDES.has(m))
    .map((m) => m.replace(/s$/, ""));
}

/**
 * La tâche non faite qui ressemble le plus à l'entrée (accents, majuscules et pluriels ignorés) :
 * au moins la moitié de ses mots clés dans l'entrée, ou son nom en entier. null sinon.
 */
export function tacheCorrespondante<T extends { id: number; nom: string }>(texte: string, taches: T[]): T | null {
  const entree = normaliser(texte);
  const mots = new Set(motsCles(texte));
  let meilleure: { t: T; score: number; communs: number } | null = null;
  for (const t of taches) {
    const nom = normaliser(t.nom);
    if (!nom) continue;
    const cles = motsCles(t.nom);
    const communs = cles.filter((m) => mots.has(m)).length;
    const score = entree.includes(nom) || nom === entree ? 1 : cles.length ? communs / cles.length : 0;
    if (score < 0.5 || (score < 1 && communs === 0)) continue;
    if (!meilleure || score > meilleure.score || (score === meilleure.score && communs > meilleure.communs)) meilleure = { t, score, communs };
  }
  return meilleure?.t ?? null;
}

/** Correspondance liste → zone par défaut, d'après des mots du nom de la liste (modifiable dans Mes listes). */
const MOTS_ZONES: [CleZone, string[]][] = [
  ["mains", ["quotidien", "maison", "menage", "cuisin", "course", "administ", "admin", "demarche", "papier"]],
  ["tete", ["travail", "emploi", "competence", "apprend", "formation", "boulot", "etude"]],
  ["bras", ["sport"]],
  ["pieds", ["projet", "arduino", "musique", "appli"]],
  ["ventre", ["perso", "sante", "soin", "tcc", "repos", "repas"]],
  ["coeur", ["relation", "ami", "famille"]],
  ["jambes", ["sortie", "dehors", "mer", "balade"]],
];

/** Zone devinée d'après le nom de la liste ; null = aucun mot reconnu (on demandera). */
export function zoneDeListe(nom: string): CleZone | null {
  const mots = normaliser(nom).split(" ");
  // Mots courts (mer, ami, tcc) : en entier seulement (pas « mercredi »).
  const reconnu = (m: string, k: string) => (k.length < 5 ? m === k || m === k + "s" : m.startsWith(k));
  for (const [zone, cles] of MOTS_ZONES) if (mots.some((m) => cles.some((k) => reconnu(m, k)))) return zone;
  return null;
}

/** Zone d'une tâche : celle réglée sur sa liste, sinon devinée du nom de la liste, sinon null (on demande). */
export const zoneDeTache = (t: { liste_zone: string | null; liste_nom: string | null }): CleZone | null =>
  (t.liste_zone as CleZone | null) ?? (t.liste_nom ? zoneDeListe(t.liste_nom) : null);

// ─── Progrès ────────────────────────────────────────────────────────────

/** Carte de chaleur : chaque zone de 0 à 3 selon sa part du maximum de la période. */
export function chaleur(comptes: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.values(comptes));
  return Object.fromEntries(Object.entries(comptes).map(([k, n]) => [k, n > 0 ? Math.max(1, Math.ceil((3 * n) / max)) : 0]));
}

/** Par zone : entrées, ressenti moyen (null si jamais noté), minutes notées ; et zones colorées par jour. */
export function statsJournee(
  entrees: { jour: string; zone: string; ressenti: number | null; duree_min: number | null }[],
  jours: string[],
) {
  const parZone: Record<string, { n: number; ressentiMoyen: number | null; minutes: number }> = {};
  const ressentis: Record<string, number[]> = {};
  for (const e of entrees) {
    const z = (parZone[e.zone] ??= { n: 0, ressentiMoyen: null, minutes: 0 });
    z.n++;
    z.minutes += e.duree_min ?? 0;
    if (e.ressenti) (ressentis[e.zone] ??= []).push(e.ressenti);
  }
  for (const [k, r] of Object.entries(ressentis)) parZone[k].ressentiMoyen = Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10;
  const zonesParJour = jours.map((j) => new Set(entrees.filter((e) => e.jour === j).map((e) => e.zone)).size);
  return { parZone, zonesParJour };
}

/** meta : '1' = « Afficher mes 3 priorités » (Profil). Absent = désactivé : les 3 et les bonus restent cachés. */
export const CLE_AFFICHER_TROIS = "afficher_trois";
