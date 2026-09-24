import type { Categorie } from "../catalogue";
import { CATEGORIES, categorieEffective } from "./categories";
import { getDatabase } from "./client";
import { getAujourdhui, routineAttendueLe } from "./completions";
import { trancheDeHeure, type Tranche } from "./etat";

/**
 * Données de l'écran Progression.
 *
 * Toutes les dates suivent la convention de getAujourdhui() (ISO, UTC),
 * pour rester cohérentes avec les complétions enregistrées.
 */

export type Periode = "jour" | "semaine" | "mois";

export function decalerJours(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
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
    depuis: r.cree_le.slice(0, 10),
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

export type EtatTranche = {
  tranche: Tranche;
  energie: number;
  focus: number;
  humeur: number;
  n: number;
};

export type EtatSelonMoment = {
  /** Seulement les moments de la journée qui ont au moins un check-in. */
  tranches: EtatTranche[];
  nbCheckins: number;
  /** Nombre de jours entre le plus ancien check-in retenu et aujourd'hui, inclus. */
  joursCouverts: number;
};

const ORDRE_TRANCHES: Tranche[] = ["matin", "apres_midi", "soir"];

/**
 * Moyennes du check-in par moment de la journée, sur les données réelles :
 * rien n'est affiché pour un moment où la personne n'a jamais répondu.
 */
export async function etatSelonMoment(jours = 30): Promise<EtatSelonMoment> {
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();
  const debut = decalerJours(aujourdhui, -(jours - 1));
  const rows = await db.getAllAsync<{
    date: string;
    heure: number;
    energie: number;
    focus: number;
    humeur: number;
  }>(
    "SELECT date, heure, energie, focus, humeur FROM etat WHERE date >= ?",
    debut,
  );
  if (rows.length === 0) {
    return { tranches: [], nbCheckins: 0, joursCouverts: 0 };
  }

  const acc = new Map<
    Tranche,
    { energie: number; focus: number; humeur: number; n: number }
  >();
  let plusAncien = aujourdhui;
  for (const r of rows) {
    const t = trancheDeHeure(r.heure);
    const v = acc.get(t) ?? { energie: 0, focus: 0, humeur: 0, n: 0 };
    v.energie += r.energie;
    v.focus += r.focus;
    v.humeur += r.humeur;
    v.n += 1;
    acc.set(t, v);
    if (r.date < plusAncien) plusAncien = r.date;
  }

  const tranches = ORDRE_TRANCHES.filter((t) => acc.has(t)).map((t) => {
    const v = acc.get(t)!;
    return {
      tranche: t,
      energie: v.energie / v.n,
      focus: v.focus / v.n,
      humeur: v.humeur / v.n,
      n: v.n,
    };
  });

  const joursCouverts =
    Math.round(
      (Date.parse(aujourdhui + "T00:00:00Z") -
        Date.parse(plusAncien + "T00:00:00Z")) /
        86400000,
    ) + 1;

  return { tranches, nbCheckins: rows.length, joursCouverts };
}

export type CheckinJour = {
  heure: number;
  energie: number;
  focus: number;
  humeur: number;
};

export type RecapJour = {
  date: string;
  global: number | null;
  parCategorie: AvanceeCategorie[];
  /** Ce qui a été fait ce jour-là. Volontairement pas la liste de ce qui manque. */
  faits: {
    id: number;
    nom: string;
    type: string;
    categorie: Categorie | null;
    partiel: boolean;
  }[];
  checkins: CheckinJour[];
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

  const checkins = await db.getAllAsync<CheckinJour>(
    `SELECT heure, energie, focus, humeur
     FROM etat WHERE date = ? ORDER BY heure`,
    date,
  );

  return {
    date,
    global: avancee.global,
    parCategorie: avancee.parCategorie,
    faits: rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      type: r.type,
      categorie: categorieEffective(r.categorie, r.template_id),
      partiel: r.statut === "partiel",
    })),
    checkins,
  };
}
