/**
 * Récap du dimanche : la semaine lundi → dimanche (jours logiques), en 6 cartes.
 * Règles pures, sans accès à la base : testables seules (tests/recap.test.mjs).
 * Les chiffres sont recalculés à chaque ouverture ; seuls la phrase de fierté et la piste sont enregistrées.
 */
import { decalerJours } from "./dates";
import { couleurChaleur, type CleZone, type Zone } from "./journee-regles";
import { semaineDe } from "./regles-taches";

export const HEURE_RECAP_DEFAUT = "18:00";
/** Moins d'entrées que ça : récap court (cartes 1, 2 et 6). */
export const MIN_ENTREES_RECAP = 5;

/** 0 = dimanche (convention JS), sur une date AAAA-MM-JJ. */
const jourSemaine = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
export const lundiDe = (iso: string) => semaineDe(iso)[0];

/**
 * Le lundi de la semaine du dernier récap disponible.
 * Le dimanche (jour logique), celui de la semaine en cours à partir de l'heure réglée
 * (et après minuit, tant que la journée de l'appli n'a pas basculé) ; sinon celui de la semaine d'avant.
 */
export function semaineDuRecap(jour: string, heure: string, heureRecap: string, debutJour: number): string {
  const lundi = lundiDe(jour);
  const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const dimanche = jourSemaine(jour) === 0;
  const pret = dimanche && (min(heure) >= min(heureRecap) || min(heure) < debutJour * 60);
  return pret ? lundi : decalerJours(lundi, -7);
}


export type EntreeRecap = {
  id: number;
  jour: string;
  zone: string;
  texte: string;
  ressenti: number | null;
  duree_min: number | null;
  origine: string;
};

/** Carte 1 : la couleur de chaque zone, normalisée sur la zone la plus remplie ; zone vide à 18 %. */
export function carteChaleur(zones: Zone[], comptes: Record<string, number>): Partial<Record<CleZone, string>> {
  const max = Math.max(0, ...zones.filter((z) => z.active).map((z) => comptes[z.cle] ?? 0));
  return Object.fromEntries(zones.filter((z) => z.active).map((z) => [z.cle, couleurChaleur(z.couleur, comptes[z.cle] ?? 0, max)]));
}

/** Meilleur ressenti d'abord ; à égalité, les plus longues ; puis mes notes avant les entrées auto. */
const parValeur = (a: EntreeRecap, b: EntreeRecap) =>
  (b.ressenti ?? 0) - (a.ressenti ?? 0) || (b.duree_min ?? 0) - (a.duree_min ?? 0) || Number(a.origine === "auto") - Number(b.origine === "auto") || a.id - b.id;

/** Carte 2 : la journée la plus remplie (la plus récente à égalité) et ses 5 entrées principales. */
export function journeeEnAvant(entrees: EntreeRecap[], jours: string[]): { jour: string; entrees: EntreeRecap[] } | null {
  let meilleur: string | null = null;
  let n = 0;
  for (const j of jours) {
    const c = entrees.filter((e) => e.jour === j).length;
    if (c > 0 && c >= n) {
      meilleur = j;
      n = c;
    }
  }
  return meilleur ? { jour: meilleur, entrees: entrees.filter((e) => e.jour === meilleur).sort(parValeur).slice(0, 5) } : null;
}

/** Carte 4 : les 3 entrées au meilleur ressenti (à égalité : les plus longues). */
export const momentsForts = (entrees: EntreeRecap[]) => [...entrees].sort(parValeur).slice(0, 3);

/**
 * « Première fois » : une zone déjà remplie qui se colore de nouveau après au moins 14 jours sans entrée.
 * `dernieres` : pour chaque zone, la dernière entrée avant le lundi (null = jamais).
 */
export function zonesRetrouvees(entrees: EntreeRecap[], dernieres: Record<string, string | null>, lundi: string): string[] {
  const limite = decalerJours(lundi, -14);
  const zones = [...new Set(entrees.map((e) => e.zone))];
  // Une zone jamais remplie avant ne « revient » pas : avec un journal récent, ce serait toutes les zones.
  return zones.filter((z) => {
    const d = dernieres[z];
    return !!d && d < limite;
  });
}

// ─── Carte 3 : en chiffres ──────────────────────────────────────────────

export type Mesure = { cle: string; titre: string; valeur: number | null; unite?: "min" | "%" };
export type Tuile = { cle: string; titre: string; valeur: string; ecart: string | null };

/** L'ordre des tuiles : les 4 premières, puis celles qui les remplacent si une donnée manque. */
export const ORDRE_TUILES = ["sport", "cuisine", "routines", "sommeil", "tcc", "menage", "projets", "meditation"];

export const dureeCourte = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h} h${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} min`;
};

/** « +1 », « −20 min », « = » ; null si la semaine d'avant n'a pas de donnée. Jamais de ton de reproche (pas de couleur). */
export function ecart(m: Mesure, avant: number | null): string | null {
  if (m.valeur === null || avant === null) return null;
  const d = Math.round(m.valeur - avant);
  if (d === 0) return "=";
  const signe = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  return `${signe}${m.unite === "min" ? dureeCourte(abs) : m.unite === "%" ? `${abs} pts` : abs}`;
}

/** 4 tuiles : les données manquantes (null ou 0) sont remplacées par la suivante disponible. */
export function tuiles(cette: Mesure[], avant: Mesure[], n = 4): Tuile[] {
  const par = new Map(cette.map((m) => [m.cle, m]));
  const avantPar = new Map(avant.map((m) => [m.cle, m.valeur]));
  return ORDRE_TUILES.map((c) => par.get(c))
    .filter((m): m is Mesure => !!m && m.valeur !== null && m.valeur > 0)
    .slice(0, n)
    .map((m) => ({
      cle: m.cle,
      titre: m.titre,
      valeur: m.unite === "min" ? dureeCourte(m.valeur!) : m.unite === "%" ? `${Math.round(m.valeur!)} %` : String(m.valeur),
      ecart: ecart(m, avantPar.get(m.cle) ?? null),
    }));
}

// ─── Carte 5 : la piste pour la semaine ─────────────────────────────────

export const IDEES_PISTE: Record<CleZone, string[]> = {
  tete: ["Lire 10 pages", "Regarder une offre d'emploi", "Apprendre un mot ou une notion"],
  coeur: ["Envoyer un message à quelqu'un", "Appeler une amie", "Prendre un café avec quelqu'un"],
  bras: ["5 minutes de mouvement", "Une marche de 15 minutes", "Quelques étirements le matin"],
  ventre: ["Un vrai repas assis", "Une pause de 5 minutes", "Un bain ou une douche longue"],
  mains: ["Ranger une seule chose", "Préparer un repas simple", "Une démarche de 10 minutes"],
  jambes: ["Une balade près de la mer", "Sortir prendre l'air 10 minutes", "Un coucher de soleil dehors"],
  pieds: ["15 minutes sur un projet", "Noter une idée de projet", "Ouvrir le projet en cours, juste regarder"],
};

const ARTICLE: Record<CleZone, { nom: string; pluriel: boolean }> = {
  tete: { nom: "La tête", pluriel: false },
  coeur: { nom: "Le cœur", pluriel: false },
  bras: { nom: "Les bras", pluriel: true },
  ventre: { nom: "Le ventre", pluriel: false },
  mains: { nom: "Les mains", pluriel: true },
  jambes: { nom: "Les jambes", pluriel: true },
  pieds: { nom: "Les pieds", pluriel: true },
};

/** « Le cœur a été plus calme », « Les bras ont été plus calmes ». */
export const phrasePiste = (z: CleZone) => `${ARTICLE[z].nom} ${ARTICLE[z].pluriel ? "ont été plus calmes" : "a été plus calme"} cette semaine.`;

/** La zone la moins remplie (une seule ; à égalité, la première dans l'ordre des zones). */
export function zonePiste(zones: Zone[], comptes: Record<string, number>): CleZone | null {
  const actives = [...zones].filter((z) => z.active).sort((a, b) => a.ordre - b.ordre);
  if (!actives.length) return null;
  return actives.reduce((m, z) => ((comptes[z.cle] ?? 0) < (comptes[m.cle] ?? 0) ? z : m)).cle;
}

/** Une idée stable pour la semaine (même idée à chaque ouverture tant qu'elle n'est pas enregistrée). */
export function ideePour(zone: CleZone, lundi: string, idees: Partial<Record<CleZone, string[]>>): string {
  const liste = idees[zone]?.length ? idees[zone]! : IDEES_PISTE[zone];
  const graine = [...lundi].reduce((s, c) => s + c.charCodeAt(0), 0);
  return liste[graine % liste.length];
}

// ─── Réglages (meta 'recap') ────────────────────────────────────────────

export const CLE_RECAP = "recap";
export type ReglagesRecap = { heure: string; notif: boolean; piste: boolean; idees: Partial<Record<CleZone, string[]>> };
export const RECAP_DEFAUT: ReglagesRecap = { heure: HEURE_RECAP_DEFAUT, notif: false, piste: true, idees: {} };

export function lireReglagesRecap(json: string | null): ReglagesRecap {
  try {
    const r = JSON.parse(json ?? "{}");
    return { ...RECAP_DEFAUT, ...r, idees: { ...(r.idees ?? {}) } };
  } catch {
    return RECAP_DEFAUT;
  }
}

/** « Semaine du 10 au 16 nov. » */
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function titreSemaine(lundi: string): string {
  const d = (iso: string) => new Date(iso + "T00:00:00Z");
  const a = d(lundi);
  const b = d(decalerJours(lundi, 6));
  return a.getUTCMonth() === b.getUTCMonth()
    ? `Semaine du ${a.getUTCDate()} au ${b.getUTCDate()} ${MOIS[b.getUTCMonth()]}`
    : `Semaine du ${a.getUTCDate()} ${MOIS[a.getUTCMonth()]} au ${b.getUTCDate()} ${MOIS[b.getUTCMonth()]}`;
}
