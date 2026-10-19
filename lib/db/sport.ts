import { decalerJours } from "../dates";
import {
  choisirEntretien,
  etapeDepart,
  maitrise,
  MAX_ACTIFS,
  pointsValidation,
  proposerValidation,
  skill,
  SKILLS,
  statut,
  type Etape,
  type EtatSkill,
  type Skill,
} from "../skills";
import { POINTS_SEANCE } from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
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

async function journaliser(id: string, de: number | null, vers: number, origine: Origine, points = 0) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO skills_historique (date, horodatage, skill, de, vers, origine, points)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    getAujourdhui(),
    new Date().toISOString(),
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
  barre: boolean,
  choix: Record<string, number | "inconnu">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sport_reglages (id, barre_traction, configure_le) VALUES (1, ?, ?)`,
    barre ? 1 : 0,
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

/** Séances faites à une étape, la plus récente d'abord, séries dans l'ordre. */
async function seancesA(id: string, etape: number): Promise<SeanceSkill[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ seance_id: number; quand: string; realise: number }>(
    `SELECT s.seance_id, COALESCE(se.fin, se.debut) AS quand, s.realise
     FROM series s JOIN seances se ON se.id = s.seance_id
     WHERE s.famille = ? AND s.palier = ?
     ORDER BY quand DESC, s.seance_id DESC, s.numero`,
    id,
    etape,
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
  for (const h of hist) if (h.origine === "valide" && h.de !== null) validees[h.de] = h.date;
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
 * Valide l'étape en cours (proposée et acceptée). +20 la première fois
 * pour cette étape, +50 la première fois que le skill est maîtrisé.
 */
export async function validerEtape(id: string): Promise<{ points: number; maitrise: boolean }> {
  const s = skill(id)!;
  const etat = (await getEtats())[id] ?? { etape: 1, actif: false };
  if (maitrise(s, etat)) return { points: 0, maitrise: true };
  const db = await getDatabase();
  const deja = await db.getAllAsync<{ de: number | null; origine: Origine }>(
    "SELECT de, origine FROM skills_historique WHERE skill = ? AND origine IN ('valide', 'maitrise')",
    id,
  );
  const p = pointsValidation({
    n: etat.etape,
    nbEtapes: s.etapes.length,
    dejaValidees: deja.filter((d) => d.origine === "valide").map((d) => d.de ?? 0),
    dejaMaitrise: deja.some((d) => d.origine === "maitrise"),
  });
  const vers = etat.etape + 1;
  const fini = vers > s.etapes.length;
  // Maîtrisé : il quitte les actifs (place libre), l'entretien prend le relais.
  await ecrireEtat(id, { etape: vers, actif: fini ? false : etat.actif });
  await journaliser(id, etat.etape, vers, "valide", p.etape);
  if (fini) await journaliser(id, etat.etape, vers, "maitrise", p.maitrise);
  if (p.etape + p.maitrise > 0) await addPoints(p.etape + p.maitrise);
  return { points: p.etape + p.maitrise, maitrise: fini };
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

// ─── Séance ─────────────────────────────────────────────────────────────

export type ExerciceDuJour = {
  skill: Skill;
  numero: number;
  etape: Etape;
  /** Série d'entretien d'un skill maîtrisé : une seule, au niveau de la dernière étape. */
  entretien: boolean;
};

/** L'étape en cours de chaque skill actif, puis 1 série d'entretien pour au plus 2 skills maîtrisés. */
export async function seanceProposee(): Promise<ExerciceDuJour[]> {
  const { barre } = await getReglages();
  const etats = await getEtats();
  const res: ExerciceDuJour[] = [];
  for (const s of SKILLS) {
    const e = etats[s.id];
    if (!e?.actif || statut(s, etats, barre) !== "en_cours") continue;
    res.push({ skill: s, numero: e.etape, etape: s.etapes[e.etape - 1], entretien: false });
  }
  const db = await getDatabase();
  const maitrises = [];
  for (const s of SKILLS.filter((x) => maitrise(x, etats[x.id]) && (!x.barre || barre))) {
    const r = await db.getFirstAsync<{ d: string | null }>(
      "SELECT MAX(se.date) AS d FROM series s JOIN seances se ON se.id = s.seance_id WHERE s.famille = ?",
      s.id,
    );
    maitrises.push({ id: s.id, dernier: r?.d ?? null });
  }
  for (const id of choisirEntretien(maitrises)) {
    const s = skill(id)!;
    const n = s.etapes.length;
    res.push({ skill: s, numero: n, etape: { ...s.etapes[n - 1], series: 1 }, entretien: true });
  }
  return res;
}

export async function commencerSeance(): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    "INSERT INTO seances (date, debut) VALUES (?, ?)",
    getAujourdhui(),
    new Date().toISOString(),
  );
  return r.lastInsertRowId;
}

/** Une séance (skills ou guidée) a déjà rapporté ce jour-là : les points du sport sont une fois par jour. */
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

/**
 * Enregistre une série dès qu'elle change : rien ne se perd si l'appli
 * se ferme en cours de séance. La première série faite donne les points,
 * si aucune séance n'a rapporté aujourd'hui.
 */
export async function enregistrerSerie(
  seanceId: number,
  ex: ExerciceDuJour,
  numero: number,
  realise: number,
): Promise<void> {
  const db = await getDatabase();
  const existante = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM series WHERE seance_id = ? AND famille = ? AND numero = ?",
    seanceId,
    ex.skill.id,
    numero,
  );
  if (existante) {
    await db.runAsync("UPDATE series SET realise = ? WHERE id = ?", realise, existante.id);
  } else {
    await db.runAsync(
      `INSERT INTO series (seance_id, famille, palier, exercice, numero, unite, objectif_bas, objectif_haut, realise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      seanceId,
      ex.skill.id,
      ex.numero,
      ex.etape.nom,
      numero,
      ex.etape.unite,
      ex.etape.objectif,
      ex.etape.objectif,
      realise,
    );
  }

  if (realise > 0) {
    const s = await db.getFirstAsync<{ points_donnes: number; date: string }>(
      "SELECT points_donnes, date FROM seances WHERE id = ?",
      seanceId,
    );
    if (s && s.points_donnes === 0 && !(await sportPayeLe(s.date))) {
      await db.runAsync("UPDATE seances SET points_donnes = ? WHERE id = ?", POINTS_SEANCE, seanceId);
      await addPoints(POINTS_SEANCE);
    }
  }
}

export async function terminerSeance(seanceId: number): Promise<void> {
  const db = await getDatabase();
  // Les séries laissées à 0 n'ont pas été faites : on ne les garde pas.
  await db.runAsync("DELETE FROM series WHERE seance_id = ? AND realise = 0", seanceId);
  const reste = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM series WHERE seance_id = ?",
    seanceId,
  );
  if ((reste?.n ?? 0) === 0) {
    // Tout remis à 0 avant de terminer : pas de séance, pas de points.
    const s = await db.getFirstAsync<{ points_donnes: number }>(
      "SELECT points_donnes FROM seances WHERE id = ?",
      seanceId,
    );
    if (s?.points_donnes) await addPoints(-s.points_donnes);
    await db.runAsync("DELETE FROM seances WHERE id = ?", seanceId);
    return;
  }
  await db.runAsync(
    "UPDATE seances SET fin = ? WHERE id = ?",
    new Date().toISOString(),
    seanceId,
  );
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
