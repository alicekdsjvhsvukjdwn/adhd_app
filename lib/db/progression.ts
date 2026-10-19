import type { Categorie } from "../catalogue";
import { decalerJours as decaler, jourDeCreation } from "../dates";
import { CATEGORIES, categorieEffective } from "./categories";
import { getDatabase } from "./client";
import { getAujourdhui, routineAttendueLe } from "./completions";
import { comparer, type Comparaison } from "../suivi-regles";

/**
 * Données de l'écran Progression.
 *
 * Toutes les dates suivent la convention de getAujourdhui() (date locale),
 * pour rester cohérentes avec les complétions enregistrées.
 */

export type Periode = "jour" | "semaine" | "mois";

/** Réexporté pour l'écran Progression. */
export function decalerJours(iso: string, n: number): string {
  return decaler(iso, n);
}

/** 0 = dimanche, 1 = lundi... (convention JavaScript). */
export function jourSemaine(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}

/** Fenêtres glissantes : aujourd'hui, 7 derniers jours, 30 derniers jours. */
export function bornesPeriode(p: Periode): { debut: string; fin: string } {
  const fin = getAujourdhui();
  const recul = p === "jour" ? 0 : p === "semaine" ? 6 : 29;
  return { debut: decalerJours(fin, -recul), fin };
}

function joursEntre(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let d = debut; d <= fin; d = decalerJours(d, 1)) jours.push(d);
  return jours;
}

type RoutineSuivie = {
  id: number;
  cat: Categorie | null;
  recurrence: string;
  depuis: string;
};

async function routinesSuivies(): Promise<RoutineSuivie[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    categorie: string | null;
    template_id: string | null;
    recurrence: string | null;
    cree_le: string;
  }>(
    `SELECT id, categorie, template_id, recurrence, cree_le
     FROM items WHERE type = 'routine' AND statut = 'actif'`,
  );
  return rows.map((r) => ({
    id: r.id,
    cat: categorieEffective(r.categorie, r.template_id),
    recurrence: r.recurrence ?? "quotidien",
    depuis: jourDeCreation(r.cree_le),
  }));
}

/**
 * Une routine est-elle attendue ce jour-là ?
 * Jamais avant sa création : c'est ce qui évite de gonfler le dénominateur.
 */
function attenduCeJour(r: RoutineSuivie, iso: string): boolean {
  return routineAttendueLe(r.recurrence, r.depuis, iso);
}

type CompletionRow = {
  item_id: number;
  date: string;
  statut: string;
  type: string;
  categorie: string | null;
  template_id: string | null;
};

async function completionsEntre(
  debut: string,
  fin: string,
): Promise<CompletionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CompletionRow>(
    `SELECT c.item_id, c.date, c.statut, i.type, i.categorie, i.template_id
     FROM completions c
     JOIN items i ON i.id = c.item_id
     WHERE c.date >= ? AND c.date <= ?
       AND c.statut IN ('complet', 'partiel')`,
    debut,
    fin,
  );
}

const poids = (statut: string) => (statut === "partiel" ? 0.5 : 1);

export type AvanceeCategorie = {
  categorie: Categorie;
  attendu: number;
  fait: number;
  /** null si aucune routine attendue dans ce domaine sur la période. */
  taux: number | null;
  taches: number;
};

export async function avanceePeriode(p: Periode) {
  const { debut, fin } = bornesPeriode(p);
  return avanceeEntre(debut, fin);
}

/** Avancée des routines (et tâches faites) par domaine entre deux dates incluses. */
export async function avanceeEntre(
  debut: string,
  fin: string,
): Promise<{
  global: number | null;
  parCategorie: AvanceeCategorie[];
}> {
  const jours = joursEntre(debut, fin);
  const routines = await routinesSuivies();
  const idsRoutines = new Set(routines.map((r) => r.id));
  const completions = await completionsEntre(debut, fin);

  const acc = new Map<
    Categorie,
    { attendu: number; fait: number; taches: number }
  >();
  const ligne = (c: Categorie) => {
    if (!acc.has(c)) acc.set(c, { attendu: 0, fait: 0, taches: 0 });
    return acc.get(c)!;
  };

  let attenduTotal = 0;
  let faitTotal = 0;

  for (const r of routines) {
    const n = jours.filter((j) => attenduCeJour(r, j)).length;
    attenduTotal += n;
    if (r.cat) ligne(r.cat).attendu += n;
  }

  for (const c of completions) {
    const cat = categorieEffective(c.categorie, c.template_id);
    if (c.type === "routine" && idsRoutines.has(c.item_id)) {
      faitTotal += poids(c.statut);
      if (cat) ligne(cat).fait += poids(c.statut);
    } else if (c.type === "tache" && cat) {
      ligne(cat).taches += 1;
    }
  }

  const parCategorie = CATEGORIES.filter((c) => acc.has(c)).map((c) => {
    const v = acc.get(c)!;
    return {
      categorie: c,
      ...v,
      taux: v.attendu > 0 ? Math.min(1, v.fait / v.attendu) : null,
    };
  });

  return {
    global: attenduTotal > 0 ? Math.min(1, faitTotal / attenduTotal) : null,
    parCategorie,
  };
}

export type TacheFaite = {
  id: number;
  nom: string;
  date: string;
  categorie: Categorie | null;
};

export async function tachesFaites(p: Periode): Promise<TacheFaite[]> {
  const { debut, fin } = bornesPeriode(p);
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    nom: string;
    date: string;
    categorie: string | null;
    template_id: string | null;
  }>(
    `SELECT i.id, i.nom, c.date, i.categorie, i.template_id
     FROM completions c
     JOIN items i ON i.id = c.item_id
     WHERE i.type = 'tache'
       AND c.date >= ? AND c.date <= ?
       AND c.statut IN ('complet', 'partiel')
     ORDER BY c.date DESC, c.id DESC`,
    debut,
    fin,
  );
  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    date: r.date,
    categorie: categorieEffective(r.categorie, r.template_id),
  }));
}

/**
 * Intensité de chaque jour, de 0 à 4, pour le calendrier et la vue année.
 * null = jour futur ou antérieur au premier usage (case vide, pas « raté »).
 * Score = part des routines attendues faites, + 0,25 par tâche, plafonné à 1.
 */
export async function intensiteJours(
  debut: string,
  fin: string,
): Promise<Record<string, number | null>> {
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();
  const routines = await routinesSuivies();
  const idsRoutines = new Set(routines.map((r) => r.id));
  const completions = await completionsEntre(debut, fin);

  const premier = await db.getFirstAsync<{ d: string | null }>(
    "SELECT MIN(substr(cree_le, 1, 10)) AS d FROM items",
  );
  const premierJour = premier?.d ?? aujourdhui;

  const faitesParJour = new Map<string, { routines: number; taches: number }>();
  for (const c of completions) {
    const v = faitesParJour.get(c.date) ?? { routines: 0, taches: 0 };
    if (c.type === "routine" && idsRoutines.has(c.item_id)) {
      v.routines += poids(c.statut);
    } else if (c.type === "tache") {
      v.taches += 1;
    }
    faitesParJour.set(c.date, v);
  }

  const resultat: Record<string, number | null> = {};
  for (const j of joursEntre(debut, fin)) {
    if (j > aujourdhui || j < premierJour) {
      resultat[j] = null;
      continue;
    }
    const attendu = routines.filter((r) => attenduCeJour(r, j)).length;
    const faites = faitesParJour.get(j) ?? { routines: 0, taches: 0 };
    const partRoutines =
      attendu > 0 ? Math.min(1, faites.routines / attendu) : 0;
    const score = Math.min(1, partRoutines + 0.25 * faites.taches);
    resultat[j] = score === 0 ? 0 : Math.max(1, Math.ceil(score * 4));
  }
  return resultat;
}

export type RecapJour = {
  date: string;
  global: number | null;
  /** Ce qui a été fait ce jour-là. Volontairement pas la liste de ce qui manque. */
  faits: {
    id: number;
    nom: string;
    type: string;
    categorie: Categorie | null;
    partiel: boolean;
  }[];
};

export async function recapJour(date: string): Promise<RecapJour> {
  const db = await getDatabase();
  const avancee = await avanceeEntre(date, date);

  const rows = await db.getAllAsync<{
    id: number;
    nom: string;
    type: string;
    categorie: string | null;
    template_id: string | null;
    statut: string;
  }>(
    `SELECT i.id, i.nom, i.type, i.categorie, i.template_id, c.statut
     FROM completions c
     JOIN items i ON i.id = c.item_id
     WHERE c.date = ? AND c.statut IN ('complet', 'partiel')
     ORDER BY i.type, c.heure, c.id`,
    date,
  );

  return {
    date,
    global: avancee.global,
    faits: rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      type: r.type,
      categorie: categorieEffective(r.categorie, r.template_id),
      partiel: r.statut === "partiel",
    })),
  };
}

export type MesureAdaptation = {
  /** Tâches proposées par le moteur (première ouverture de chaque jour). */
  propositions: number;
  /** Parmi elles, celles faites le jour même. */
  faites: number;
  suggestionsDecidees: number;
  suggestionsAcceptees: number;
};

/**
 * Ce que l'appli peut dire de sa propre utilité : ses propositions sont-elles
 * suivies, ses suggestions acceptées ? Ne prouve pas à elle seule que le tri
 * aide (il faudrait une comparaison), mais permet de le suivre dans le temps.
 */
export async function mesureAdaptation(jours = 14): Promise<MesureAdaptation> {
  const db = await getDatabase();
  const debut = decalerJours(getAujourdhui(), -(jours - 1));

  const p = await db.getFirstAsync<{ proposes: number; faits: number }>(
    `SELECT
       COUNT(DISTINCT d.date || '-' || d.item_id) AS proposes,
       COUNT(DISTINCT CASE WHEN c.id IS NOT NULL
             THEN d.date || '-' || d.item_id END) AS faits
     FROM decision_log d
     LEFT JOIN completions c ON c.item_id = d.item_id AND c.date = d.date
     WHERE d.propose = 1 AND d.date >= ?`,
    debut,
  );

  const s = await db.getFirstAsync<{ n: number; acceptees: number | null }>(
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN statut = 'acceptee' THEN 1 ELSE 0 END) AS acceptees
     FROM suggestions`,
  );

  return {
    propositions: p?.proposes ?? 0,
    faites: p?.faits ?? 0,
    suggestionsDecidees: s?.n ?? 0,
    suggestionsAcceptees: s?.acceptees ?? 0,
  };
}

export type LiensSommeilSport = {
  /** Part des routines attendues faites : après une bonne nuit (A) / une mauvaise (B). */
  routinesSelonNuit: Comparaison;
  /** Qualité ressentie (1–3) : nuits avec écrans (A) / sans (B). */
  qualiteSelonEcrans: Comparaison;
  /** Énergie choisie sur Routines (1–3) : jours avec séance (A) / sans (B). */
  energieSelonSeance: Comparaison;
};

/**
 * Liens entre sommeil, sport et le reste, pour l'analyse seulement :
 * rien ici ne modifie le tri, les routines ou Jour difficile.
 */
export async function liensSommeilSport(): Promise<LiensSommeilSport> {
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();
  const nuits = await db.getAllAsync<{ date: string; qualite: number; ecrans: number }>(
    // Nuits sans réponses du matin (reponses = 0) : qualité et écrans par défaut, ignorés.
    "SELECT date, qualite, ecrans FROM sommeil WHERE date <= ? AND reponses = 1 ORDER BY date",
    aujourdhui,
  );

  // Taux de routines faites, jour par jour, pour les jours qui suivent une nuit notée.
  const routines = await routinesSuivies();
  const ids = new Set(routines.map((r) => r.id));
  const fait = new Map<string, number>();
  if (nuits.length > 0) {
    for (const c of await completionsEntre(nuits[0].date, aujourdhui)) {
      if (c.type === "routine" && ids.has(c.item_id)) {
        fait.set(c.date, (fait.get(c.date) ?? 0) + poids(c.statut));
      }
    }
  }
  const taux = (jour: string): number | null => {
    const attendu = routines.filter((r) => attenduCeJour(r, jour)).length;
    return attendu > 0 ? Math.min(1, (fait.get(jour) ?? 0) / attendu) : null;
  };
  const tauxDe = (q: number) =>
    nuits
      .filter((n) => n.qualite === q)
      .map((n) => taux(n.date))
      .filter((x): x is number => x !== null);

  // Énergie choisie à la main sur Routines (meta energie_routines:AAAA-MM-JJ).
  const energies = await db.getAllAsync<{ cle: string; valeur: string }>(
    "SELECT cle, valeur FROM meta WHERE cle LIKE 'energie_routines:%'",
  );
  const joursSeance = new Set(
    (
      await db.getAllAsync<{ date: string }>(
        "SELECT DISTINCT date FROM seances WHERE points_donnes > 0",
      )
    ).map((r) => r.date),
  );
  const avec: number[] = [];
  const sans: number[] = [];
  for (const e of energies) {
    const jour = e.cle.slice("energie_routines:".length);
    (joursSeance.has(jour) ? avec : sans).push(Number(e.valeur));
  }

  return {
    routinesSelonNuit: comparer(tauxDe(3), tauxDe(1)),
    qualiteSelonEcrans: comparer(
      nuits.filter((n) => n.ecrans === 1).map((n) => n.qualite),
      nuits.filter((n) => n.ecrans === 0).map((n) => n.qualite),
    ),
    energieSelonSeance: comparer(avec, sans),
  };
}
