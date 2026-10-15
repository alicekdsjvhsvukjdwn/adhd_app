import { decalerJours } from "../dates";
import {
  FAMILLES,
  nbPaliers,
  palier,
  palierDepart,
  POINTS_SEANCE,
  proposerMontee,
  UNITE,
  type Famille,
  type Palier,
  type Unite,
} from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { addPoints } from "./stats";

/**
 * Sport : callisthénie guidée, 4 familles avec une échelle de paliers
 * (lib/suivi-regles.ts). Aucune autre partie de l'appli ne lit ces tables.
 */

export type Reglages = { configure: boolean; barre: boolean };

export async function getReglages(): Promise<Reglages> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ barre_traction: number }>(
    "SELECT barre_traction FROM sport_reglages WHERE id = 1",
  );
  return { configure: !!r, barre: r?.barre_traction === 1 };
}

async function journaliserPalier(
  famille: Famille,
  de: number | null,
  vers: number,
  origine: "depart" | "propose_accepte" | "propose_refuse" | "manuel",
) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO paliers_historique (date, horodatage, famille, de, vers, origine)
     VALUES (?, ?, ?, ?, ?, ?)`,
    getAujourdhui(),
    new Date().toISOString(),
    famille,
    de,
    vers,
    origine,
  );
}

/** Premier lancement : barre de traction et palier de départ par famille. */
export async function configurerSport(
  barre: boolean,
  choix: Record<Famille, number | "inconnu">,
): Promise<void> {
  const db = await getDatabase();
  const maintenant = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO sport_reglages (id, barre_traction, configure_le) VALUES (1, ?, ?)`,
    barre ? 1 : 0,
    maintenant,
  );
  for (const f of FAMILLES) {
    const n = palierDepart(f, choix[f], barre);
    await db.runAsync(
      "INSERT OR REPLACE INTO sport_paliers (famille, palier, maj_le) VALUES (?, ?, ?)",
      f,
      n,
      maintenant,
    );
    await journaliserPalier(f, null, n, "depart");
  }
}

export async function getPaliers(): Promise<Record<Famille, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ famille: Famille; palier: number }>(
    "SELECT famille, palier FROM sport_paliers",
  );
  const p = { pousser: 1, tirer: 1, jambes: 1, gainage: 1 };
  for (const r of rows) p[r.famille] = r.palier;
  return p;
}

export async function changerPalier(
  famille: Famille,
  vers: number,
  origine: "propose_accepte" | "manuel",
): Promise<void> {
  const db = await getDatabase();
  const de = (await getPaliers())[famille];
  if (vers === de) return;
  await db.runAsync(
    "UPDATE sport_paliers SET palier = ?, maj_le = ? WHERE famille = ?",
    vers,
    new Date().toISOString(),
    famille,
  );
  await journaliserPalier(famille, de, vers, origine);
}

/** Refus de la montée proposée : le palier reste, le refus est noté. */
export async function refuserMontee(famille: Famille): Promise<void> {
  const de = (await getPaliers())[famille];
  await journaliserPalier(famille, de, de + 1, "propose_refuse");
}

export type ExerciceDuJour = {
  famille: Famille;
  numero: number;
  palier: Palier;
  unite: Unite;
  /** Palier max accessible (barre ou non). */
  max: number;
  /** Le palier suivant est proposé (2 séances réussies d'affilée). */
  montee: boolean;
};

/** Séance proposée : un exercice par famille, au palier actuel. */
export async function seanceProposee(): Promise<ExerciceDuJour[]> {
  const { barre } = await getReglages();
  const paliers = await getPaliers();
  const db = await getDatabase();
  const res: ExerciceDuJour[] = [];

  for (const f of FAMILLES) {
    const n = paliers[f];
    const p = palier(f, n);
    const max = nbPaliers(f, barre);

    // Séances à ce palier, la plus récente d'abord, séries dans l'ordre.
    const series = await db.getAllAsync<{ seance_id: number; quand: string; realise: number }>(
      `SELECT s.seance_id, COALESCE(se.fin, se.debut) AS quand, s.realise
       FROM series s JOIN seances se ON se.id = s.seance_id
       WHERE s.famille = ? AND s.palier = ?
       ORDER BY quand DESC, s.seance_id DESC, s.numero`,
      f,
      n,
    );
    const parSeance = new Map<number, { fin: string; realise: number[] }>();
    for (const s of series) {
      if (!parSeance.has(s.seance_id)) parSeance.set(s.seance_id, { fin: s.quand, realise: [] });
      parSeance.get(s.seance_id)!.realise.push(s.realise);
    }
    const refus = await db.getFirstAsync<{ h: string | null }>(
      `SELECT MAX(horodatage) AS h FROM paliers_historique
       WHERE famille = ? AND de = ? AND origine = 'propose_refuse'`,
      f,
      n,
    );

    res.push({
      famille: f,
      numero: n,
      palier: p,
      unite: UNITE[f],
      max,
      montee: proposerMontee({
        seances: [...parSeance.values()],
        haut: p.haut,
        palierActuel: n,
        palierMax: max,
        dernierRefus: refus?.h ?? null,
      }),
    });
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

/**
 * Enregistre une série dès qu'elle change : rien ne se perd si l'appli
 * se ferme en cours de séance. La première série faite donne les points.
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
    ex.famille,
    numero,
  );
  if (existante) {
    await db.runAsync("UPDATE series SET realise = ? WHERE id = ?", realise, existante.id);
  } else {
    await db.runAsync(
      `INSERT INTO series (seance_id, famille, palier, exercice, numero, unite, objectif_bas, objectif_haut, realise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      seanceId,
      ex.famille,
      ex.numero,
      ex.palier.nom,
      numero,
      ex.unite,
      ex.palier.bas,
      ex.palier.haut,
      realise,
    );
  }

  if (realise > 0) {
    const s = await db.getFirstAsync<{ points_donnes: number }>(
      "SELECT points_donnes FROM seances WHERE id = ?",
      seanceId,
    );
    if (s && s.points_donnes === 0) {
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

/** Séances faites sur les 7 derniers jours (rythme indicatif : 3). */
export async function seancesCetteSemaine(): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM seances WHERE date >= ? AND points_donnes > 0",
    decalerJours(getAujourdhui(), -6),
  );
  return r?.n ?? 0;
}

export type SeanceHistorique = {
  date: string;
  palier: number;
  exercice: string;
  unite: Unite;
  meilleure: number;
  series: number[];
};

/** Les dernières séances d'une famille, la plus récente d'abord. */
export async function historiqueFamille(
  famille: Famille,
  limite = 12,
): Promise<SeanceHistorique[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    seance_id: number;
    date: string;
    palier: number;
    exercice: string;
    unite: Unite;
    realise: number;
  }>(
    `SELECT s.seance_id, se.date, s.palier, s.exercice, s.unite, s.realise
     FROM series s JOIN seances se ON se.id = s.seance_id
     WHERE s.famille = ? AND s.realise > 0
     ORDER BY se.debut DESC, s.numero`,
    famille,
  );
  const parSeance = new Map<number, SeanceHistorique>();
  for (const r of rows) {
    if (!parSeance.has(r.seance_id)) {
      if (parSeance.size >= limite) break;
      parSeance.set(r.seance_id, {
        date: r.date,
        palier: r.palier,
        exercice: r.exercice,
        unite: r.unite,
        meilleure: 0,
        series: [],
      });
    }
    const h = parSeance.get(r.seance_id)!;
    h.series.push(r.realise);
    h.meilleure = Math.max(h.meilleure, r.realise);
  }
  return [...parSeance.values()];
}
