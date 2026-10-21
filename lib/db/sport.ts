import { decalerJours } from "../dates";
import { exercice, faisable } from "../exercices";
import type { Materiel } from "../materiel";
import type { LigneSeance, SeanceSport } from "../seances-sport";
import {
  choisirEntretien,
  etapeDepart,
  etapeFaisable,
  maitrise,
  MAX_ACTIFS,
  pointsValidation,
  proposerValidation,
  skill,
  SKILLS,
  statut,
  type EtatSkill,
  type Skill,
} from "../skills";
import { POINTS_SEANCE } from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { cocherRoutineLiee } from "./routine-liee";
import { addPoints } from "./stats";

/**
 * Sport : arbre de skills (lib/skills.ts). Séances et séries restent dans
 * seances / series (famille = id du skill, palier = numéro d'étape).
 * Aucune autre partie de l'appli ne lit ces tables.
 */

export type Reglages = { configure: boolean; barre: boolean };

export async function getReglages(): Promise<Reglages> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ barre_traction: number }>(
    "SELECT barre_traction FROM sport_reglages WHERE id = 1",
  );
  return { configure: !!r, barre: r?.barre_traction === 1 };
}

export async function getEtats(): Promise<Record<string, EtatSkill>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ skill: string; etape: number; actif: number }>(
    "SELECT skill, etape, actif FROM skills_etat",
  );
  return Object.fromEntries(rows.map((r) => [r.skill, { etape: r.etape, actif: r.actif === 1 }]));
}

type Origine = "depart" | "valide" | "refuse" | "manuel" | "maitrise";

/** Horodatage d'un jour passé : midi, pour se ranger avant les séances d'aujourd'hui. */
const horodatageDe = (date: string) =>
  date === getAujourdhui() ? new Date().toISOString() : `${date}T12:00:00.000Z`;

async function journaliser(
  id: string,
  de: number | null,
  vers: number,
  origine: Origine,
  points = 0,
  date: string = getAujourdhui(),
) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO skills_historique (date, horodatage, skill, de, vers, origine, points)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    date,
    horodatageDe(date),
    id,
    de,
    vers,
    origine,
    points,
  );
}

async function ecrireEtat(id: string, e: EtatSkill) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO skills_etat (skill, etape, actif, maj_le) VALUES (?, ?, ?, ?)
     ON CONFLICT(skill) DO UPDATE SET etape = excluded.etape, actif = excluded.actif, maj_le = excluded.maj_le`,
    id,
    e.etape,
    e.actif ? 1 : 0,
    new Date().toISOString(),
  );
}

/** Premier lancement : barre, et où on en est sur chaque fondation (actives d'emblée). */
export async function configurerSport(
  barre: Materiel | boolean,
  choix: Record<string, number | "inconnu">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sport_reglages (id, barre_traction, configure_le) VALUES (1, ?, ?)`,
    (typeof barre === "boolean" ? barre : barre.dispo.barre) ? 1 : 0,
    new Date().toISOString(),
  );
  const etats: Record<string, EtatSkill> = {};
  for (const s of SKILLS.filter((x) => x.niveau === "fondation")) {
    const etape = etapeDepart(s, choix[s.id] ?? "inconnu");
    etats[s.id] = { etape, actif: false };
  }
  // Actifs : les fondations accessibles et pas encore maîtrisées, au plus 4.
  SKILLS.filter((s) => statut(s, etats, barre) === "en_cours" && etats[s.id])
    .slice(0, MAX_ACTIFS)
    .forEach((s) => (etats[s.id].actif = true));
  for (const [id, e] of Object.entries(etats)) {
    await ecrireEtat(id, e);
    await journaliser(id, null, e.etape, "depart");
  }
}

/** Travailler ce skill, ou plus. Refusé (false) au-delà de 4 actifs. */
export async function basculerActif(id: string): Promise<boolean> {
  const etats = await getEtats();
  const e = etats[id] ?? { etape: 1, actif: false };
  const actifs = Object.values(etats).filter((x) => x.actif).length;
  if (!e.actif && actifs >= MAX_ACTIFS) return false;
  await ecrireEtat(id, { ...e, actif: !e.actif });
  return true;
}

export type SeanceSkill = { fin: string; realise: number[] };

/**
 * Séances faites à une étape, la plus récente d'abord, séries dans l'ordre. Elles comptent toutes, quelle que
 * soit la séance où l'exercice a été fait (Workout, séance de skills, essai noté), à partir du moment où l'étape
 * est devenue l'étape en cours. Les séries notées avant la bibliothèque (famille = skill, palier = étape) comptent aussi.
 */
async function seancesA(id: string, etape: number): Promise<SeanceSkill[]> {
  const db = await getDatabase();
  const exerciceId = skill(id)?.etapes[etape - 1]?.exercice ?? "";
  const arrivee = await db.getFirstAsync<{ h: string | null }>(
    "SELECT MAX(horodatage) AS h FROM skills_historique WHERE skill = ? AND vers = ? AND origine IN ('depart', 'valide', 'manuel')",
    id,
    etape,
  );
  const rows = await db.getAllAsync<{ seance_id: number; quand: string; realise: number }>(
    `SELECT s.seance_id, COALESCE(se.fin, se.debut) AS quand, s.realise
     FROM series s JOIN seances se ON se.id = s.seance_id
     WHERE s.realise > 0 AND ((s.famille = ? AND s.palier = ?) OR (s.exercice_id = ? AND se.debut > ?))
     ORDER BY quand DESC, s.seance_id DESC, s.numero`,
    id,
    etape,
    exerciceId,
    arrivee?.h ?? "",
  );
  const par = new Map<number, SeanceSkill>();
  for (const r of rows) {
    if (!par.has(r.seance_id)) par.set(r.seance_id, { fin: r.quand, realise: [] });
    par.get(r.seance_id)!.realise.push(r.realise);
  }
  return [...par.values()];
}

export type FicheSkill = {
  skill: Skill;
  etat: EtatSkill;
  /** Dates de validation, par numéro d'étape validée (vide = avant l'appli). */
  validees: Record<number, string>;
  /** Séances à l'étape en cours. */
  seances: SeanceSkill[];
  meilleur: number | null;
  /** Valider l'étape en cours est proposé. */
  proposition: boolean;
};

export async function ficheSkill(id: string): Promise<FicheSkill> {
  const s = skill(id)!;
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  const db = await getDatabase();
  const hist = await db.getAllAsync<{ de: number | null; vers: number; origine: Origine; date: string; horodatage: string }>(
    "SELECT de, vers, origine, date, horodatage FROM skills_historique WHERE skill = ? ORDER BY horodatage",
    id,
  );
  const validees: Record<number, string> = {};
  for (const h of hist) if (estValidation(h) && h.de !== null) validees[h.de] = h.date;
  const seances = maitrise(s, etat) ? [] : await seancesA(id, etat.etape);
  const refus = hist.filter((h) => h.origine === "refuse" && h.de === etat.etape).pop();
  return {
    skill: s,
    etat,
    validees,
    seances,
    meilleur: seances.length ? Math.max(...seances.flatMap((x) => x.realise)) : null,
    proposition:
      !maitrise(s, etat) &&
      proposerValidation({
        seances,
        etape: s.etapes[etat.etape - 1],
        dernierRefus: refus?.horodatage ?? null,
      }),
  };
}

/**
 * Une ligne de l'historique qui valide une étape : proposée et acceptée
 * ('valide'), ou validée à la main ('manuel' qui monte ; un 'manuel' qui
 * descend est un retour en arrière).
 */
export const estValidation = (h: { origine: string; de: number | null; vers: number }) =>
  h.origine === "valide" || (h.origine === "manuel" && h.de !== null && h.vers > h.de);

/**
 * Valide l'étape en cours. +20 la première fois pour cette étape, +50 la
 * première fois que le skill est maîtrisé, jamais deux fois (même après un
 * retour en arrière). `origine` : 'valide' (proposée par l'appli) ou
 * 'manuel' (« C'est acquis ») ; `date` : le jour de la validation.
 */
export async function validerEtape(
  id: string,
  origine: "valide" | "manuel" = "valide",
  date: string = getAujourdhui(),
): Promise<{ points: number; maitrise: boolean }> {
  const s = skill(id)!;
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  if (maitrise(s, etat)) return { points: 0, maitrise: true };
  const db = await getDatabase();
  const deja = await db.getAllAsync<{ de: number | null; vers: number; origine: Origine }>(
    "SELECT de, vers, origine FROM skills_historique WHERE skill = ? AND origine IN ('valide', 'manuel', 'maitrise')",
    id,
  );
  const p = pointsValidation({
    n: etat.etape,
    nbEtapes: s.etapes.length,
    dejaValidees: deja.filter(estValidation).map((d) => d.de ?? 0),
    dejaMaitrise: deja.some((d) => d.origine === "maitrise"),
  });
  const vers = etat.etape + 1;
  const fini = vers > s.etapes.length;
  // Maîtrisé : il quitte les actifs (place libre), l'entretien prend le relais.
  await ecrireEtat(id, { etape: vers, actif: fini ? false : etat.actif });
  await journaliser(id, etat.etape, vers, origine, p.etape, date);
  if (fini) await journaliser(id, etat.etape, vers, "maitrise", p.maitrise, date);
  if (p.etape + p.maitrise > 0) await addPoints(p.etape + p.maitrise);
  return { points: p.etape + p.maitrise, maitrise: fini };
}

/** « C'est acquis » : valide l'étape en cours à la main, à la date donnée. */
export const validerManuellement = (id: string, date: string = getAujourdhui()) =>
  validerEtape(id, "manuel", date);

/**
 * Note un essai fait hors de l'appli à l'étape en cours : `series` séries de
 * `valeur` (répétitions ou secondes). C'est une séance comme les autres : elle
 * compte pour « 2 séances réussies », donne +10 si rien n'a rapporté ce
 * jour-là, et coche la routine liée au sport. Renvoie les points et si la
 * validation est maintenant proposée.
 */
export async function noterEssai(
  id: string,
  series: number,
  valeur: number,
  date: string = getAujourdhui(),
): Promise<{ points: number; proposition: boolean }> {
  const s = skill(id)!;
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  if (maitrise(s, etat) || series < 1 || valeur < 1) return { points: 0, proposition: false };
  const etape = s.etapes[etat.etape - 1];
  const db = await getDatabase();
  const quand = horodatageDe(date);
  const points = (await sportPayeLe(date)) ? 0 : POINTS_SEANCE;
  const r = await db.runAsync(
    "INSERT INTO seances (date, debut, fin, points_donnes) VALUES (?, ?, ?, ?)",
    date,
    quand,
    quand,
    points,
  );
  for (let n = 1; n <= series; n++) {
    await db.runAsync(
      `INSERT INTO series (seance_id, famille, palier, exercice, numero, unite, objectif_bas, objectif_haut, realise, exercice_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.lastInsertRowId,
      id,
      etat.etape,
      etape.nom,
      n,
      etape.unite,
      etape.objectif,
      etape.objectif,
      valeur,
      etape.exercice,
    );
  }
  if (points > 0) await addPoints(points);
  await cocherRoutineLiee(date);
  return { points, proposition: (await ficheSkill(id)).proposition };
}

/**
 * « Mettre à jour mon niveau » : règle l'étape de plusieurs skills d'un coup
 * (1 = la première, nombre d'étapes + 1 = maîtrisé). Aucun point ; les skills
 * travaillés restent les mêmes, sauf un skill maîtrisé qui quitte les actifs.
 */
export async function mettreAJourNiveau(choix: Record<string, number>): Promise<void> {
  const etats = await getEtats();
  for (const [id, voulu] of Object.entries(choix)) {
    const s = skill(id);
    if (!s) continue;
    const etape = etapeDepart(s, voulu);
    const avant = etats[id] ?? { etape: 1, actif: false };
    if (etape === avant.etape) continue;
    await ecrireEtat(id, { etape, actif: etape > s.etapes.length ? false : avant.actif });
    await journaliser(id, avant.etape, etape, "depart");
  }
}

/** « Pas encore » : l'étape reste, la proposition revient après 2 nouvelles réussites. */
export async function refuserValidation(id: string): Promise<void> {
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  await journaliser(id, etat.etape, etat.etape + 1, "refuse");
}

/** Redescendre d'une étape (ou revenir sur un skill maîtrisé). Les points restent acquis. */
export async function redescendre(id: string): Promise<void> {
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  if (etat.etape <= 1) return;
  await ecrireEtat(id, { ...etat, etape: etat.etape - 1 });
  await journaliser(id, etat.etape, etat.etape - 1, "manuel");
}

// ─── Séance de skills ───────────────────────────────────────────────────

/**
 * La séance de skills : l'étape en cours de chaque skill actif (son exercice, les séries et la cible de l'étape),
 * puis 1 série d'entretien pour au plus 2 skills maîtrisés. Elle se fait dans le lecteur du Workout : ce qui est
 * noté compte pour les étapes, comme n'importe quelle autre séance. Un skill dont il manque le matériel n'y est pas.
 */
export async function seanceSkills(m: Materiel): Promise<SeanceSport> {
  const etats = await getEtats();
  const lignes: LigneSeance[] = [];
  for (const s of SKILLS) {
    const e = etats[s.id];
    if (!e?.actif || statut(s, etats, m) !== "en_cours") continue;
    const et = s.etapes[e.etape - 1];
    const ex = exercice(et.exercice);
    if (ex && faisable(ex, m)) lignes.push({ exercice: ex.id, series: et.series, cible: et.objectif, poids: null, repos_s: et.unite === "s" ? 45 : 60 });
  }
  const db = await getDatabase();
  const maitrises = [];
  for (const s of SKILLS.filter((x) => maitrise(x, etats[x.id]) && statut(x, etats, m) === "maitrise" && etapeFaisable(x.etapes[x.etapes.length - 1], m))) {
    const dernier = s.etapes[s.etapes.length - 1];
    const r = await db.getFirstAsync<{ d: string | null }>(
      "SELECT MAX(se.date) AS d FROM series s JOIN seances se ON se.id = s.seance_id WHERE s.famille = ? OR s.exercice_id = ?",
      s.id,
      dernier.exercice,
    );
    maitrises.push({ id: s.id, dernier: r?.d ?? null });
  }
  for (const id of choisirEntretien(maitrises)) {
    const et = skill(id)!.etapes.at(-1)!;
    lignes.push({ exercice: et.exercice, series: 1, cible: et.objectif, poids: null, repos_s: 45 });
  }
  return { nom: "Séance de skills", lignes };
}

/** Une séance (de sport ou guidée) a déjà rapporté ce jour-là : les points du sport sont une fois par jour. */
export async function sportPayeLe(date: string): Promise<boolean> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM seances WHERE date = ? AND points_donnes > 0)
          + (SELECT COUNT(*) FROM seances_guidees WHERE date = ? AND points_donnes > 0) AS n`,
    date,
    date,
  );
  return (r?.n ?? 0) > 0;
}

/** Séances faites sur les 7 derniers jours, skills et guidées. */
export async function seancesCetteSemaine(): Promise<number> {
  const db = await getDatabase();
  const depuis = decalerJours(getAujourdhui(), -6);
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM seances se WHERE date >= ?
               AND EXISTS (SELECT 1 FROM series s WHERE s.seance_id = se.id AND s.realise > 0))
          + (SELECT COUNT(*) FROM seances_guidees WHERE date >= ?) AS n`,
    depuis,
    depuis,
  );
  return r?.n ?? 0;
}
