import { exercice } from "../exercices";
import { meilleurePerf, nouveauRecord, type LigneSeance, type Perf, type SerieFaite } from "../seances-sport";
import { POINTS_SEANCE } from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { cocherRoutineLiee } from "./routine-liee";
import { sportPayeLe } from "./sport";
import { addPoints } from "./stats";

/**
 * Séances de sport construites sur la bibliothèque : « Mes séances » (sport_seances) et les séances faites,
 * enregistrées série par série (seances + series, avec l'exercice et le poids). +10 pts par jour de sport,
 * sans cumul ; la routine liée au sport se coche.
 */

// ─── Mes séances ────────────────────────────────────────────────────────

export type MaSeance = { id: number; nom: string; lignes: LigneSeance[] };

type LigneDb = { exercice_id: string; series: number; cible: number; poids: number | null; repos_s: number };
const enLigne = (l: LigneDb): LigneSeance => ({ exercice: l.exercice_id, series: l.series, cible: l.cible, poids: l.poids, repos_s: l.repos_s });

async function lignesDe(seanceId: number): Promise<LigneSeance[]> {
  const db = await getDatabase();
  const l = await db.getAllAsync<LigneDb>(
    "SELECT exercice_id, series, cible, poids, repos_s FROM sport_seances_ex WHERE seance_id = ? ORDER BY rang, id",
    seanceId,
  );
  // Un exercice qui n'existe plus dans la bibliothèque n'est plus proposé.
  return l.filter((x) => exercice(x.exercice_id)).map(enLigne);
}

export async function listerMesSeances(): Promise<MaSeance[]> {
  const db = await getDatabase();
  const s = await db.getAllAsync<{ id: number; nom: string }>("SELECT id, nom FROM sport_seances ORDER BY id DESC");
  return Promise.all(s.map(async (x) => ({ id: x.id, nom: x.nom, lignes: await lignesDe(x.id) })));
}

export async function lireMaSeance(id: number): Promise<MaSeance | null> {
  const db = await getDatabase();
  const s = await db.getFirstAsync<{ id: number; nom: string }>("SELECT id, nom FROM sport_seances WHERE id = ?", id);
  return s ? { id: s.id, nom: s.nom, lignes: await lignesDe(s.id) } : null;
}

const borne = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** Crée (sans id) ou remplace une de mes séances. Renvoie son id. */
export async function enregistrerMaSeance(s: { id?: number; nom: string; lignes: LigneSeance[] }): Promise<number> {
  const db = await getDatabase();
  const nom = s.nom.trim() || "Ma séance";
  let id = s.id ?? 0;
  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync("UPDATE sport_seances SET nom = ? WHERE id = ?", nom, id);
      await db.runAsync("DELETE FROM sport_seances_ex WHERE seance_id = ?", id);
    } else {
      id = (await db.runAsync("INSERT INTO sport_seances (nom, cree_le) VALUES (?, ?)", nom, new Date().toISOString())).lastInsertRowId;
    }
    for (const [rang, l] of s.lignes.filter((x) => exercice(x.exercice)).entries()) {
      await db.runAsync(
        "INSERT INTO sport_seances_ex (seance_id, rang, exercice_id, series, cible, poids, repos_s) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        rang,
        l.exercice,
        borne(l.series, 1, 10),
        borne(l.cible, 1, 600),
        l.poids !== null && l.poids > 0 ? Math.round(l.poids * 2) / 2 : null,
        borne(l.repos_s, 0, 600),
      );
    }
  });
  return id;
}

export async function dupliquerMaSeance(id: number): Promise<number | null> {
  const s = await lireMaSeance(id);
  return s ? enregistrerMaSeance({ nom: `${s.nom} (copie)`, lignes: s.lignes }) : null;
}

export async function supprimerMaSeance(id: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM sport_seances_ex WHERE seance_id = ?", id);
    await db.runAsync("DELETE FROM sport_seances WHERE id = ?", id);
  });
}

// ─── Une séance qu'on fait ──────────────────────────────────────────────

export type OrigineSeance = "perso" | "proposee" | "exercice" | "notee";

export async function commencerSeanceSport(nom: string, origine: OrigineSeance, date: string = getAujourdhui()): Promise<number> {
  const db = await getDatabase();
  const quand = new Date().toISOString();
  const r = await db.runAsync("INSERT INTO seances (date, debut, nom, origine) VALUES (?, ?, ?, ?)", date, quand, nom, origine);
  return r.lastInsertRowId;
}

/** Ce qui a été noté pour cet exercice dans les autres séances (et dans les séries de skills du même nom). */
async function anciennesPerfs(exerciceId: string, sauf: number): Promise<Perf[]> {
  const e = exercice(exerciceId);
  const db = await getDatabase();
  return db.getAllAsync<Perf>(
    `SELECT realise, poids FROM series
     WHERE seance_id <> ? AND realise > 0 AND (exercice_id = ? OR (exercice_id = '' AND exercice = ?))`,
    sauf,
    exerciceId,
    e?.nom ?? "",
  );
}

/**
 * Note une série (ou la corrige : même exercice, même numéro). La première série d'une séance donne les points
 * du jour, une seule fois. `record` : mieux que tout ce qui avait été noté avant dans une autre séance.
 */
export async function noterSerieSport(
  seanceId: number,
  s: { exercice: string; numero: number; realise: number; poids: number | null; prevu: number },
): Promise<{ record: boolean; points: number }> {
  const e = exercice(s.exercice);
  if (!e) return { record: false, points: 0 };
  const db = await getDatabase();
  const realise = borne(s.realise, 0, 10_000);
  const poids = s.poids !== null && s.poids > 0 ? Math.round(s.poids * 2) / 2 : null;
  const existante = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM series WHERE seance_id = ? AND exercice_id = ? AND numero = ?",
    seanceId,
    s.exercice,
    s.numero,
  );
  if (existante) {
    await db.runAsync("UPDATE series SET realise = ?, poids = ? WHERE id = ?", realise, poids, existante.id);
  } else {
    await db.runAsync(
      `INSERT INTO series (seance_id, famille, palier, exercice, numero, unite, objectif_bas, objectif_haut, realise, exercice_id, poids)
       VALUES (?, '', 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      seanceId,
      e.nom,
      s.numero,
      e.mode === "s" ? "s" : "reps",
      s.prevu,
      s.prevu,
      realise,
      s.exercice,
      poids,
    );
  }
  let points = 0;
  if (realise > 0) {
    const seance = await db.getFirstAsync<{ points_donnes: number; date: string }>("SELECT points_donnes, date FROM seances WHERE id = ?", seanceId);
    if (seance) {
      await cocherRoutineLiee(seance.date);
      if (seance.points_donnes === 0 && !(await sportPayeLe(seance.date))) {
        await db.runAsync("UPDATE seances SET points_donnes = ? WHERE id = ?", POINTS_SEANCE, seanceId);
        await addPoints(POINTS_SEANCE);
        points = POINTS_SEANCE;
      }
    }
  }
  return { record: realise > 0 && nouveauRecord(await anciennesPerfs(s.exercice, seanceId), { realise, poids }), points };
}

export async function seriesDeSeance(seanceId: number): Promise<SerieFaite[]> {
  const db = await getDatabase();
  const l = await db.getAllAsync<{ exercice_id: string; numero: number; realise: number; poids: number | null }>(
    "SELECT exercice_id, numero, realise, poids FROM series WHERE seance_id = ? AND exercice_id <> '' AND realise > 0 ORDER BY id",
    seanceId,
  );
  return l.map((x) => ({ exercice: x.exercice_id, numero: x.numero, realise: x.realise, poids: x.poids }));
}

/** Les exercices où cette séance a battu un record (mieux que toutes les autres séances). */
export async function recordsDeSeance(seanceId: number): Promise<string[]> {
  const faites = await seriesDeSeance(seanceId);
  const res: string[] = [];
  for (const id of new Set(faites.map((s) => s.exercice))) {
    const meilleure = meilleurePerf(faites.filter((s) => s.exercice === id));
    if (meilleure && nouveauRecord(await anciennesPerfs(id, seanceId), meilleure)) res.push(id);
  }
  return res;
}

/**
 * Termine la séance : heure de fin et ressenti. Une séance sans aucune série faite n'a pas eu lieu : elle disparaît.
 * Renvoie les records tombés, ou null s'il n'y avait rien.
 */
export async function terminerSeanceSport(seanceId: number, ressenti: string): Promise<{ records: string[] } | null> {
  const db = await getDatabase();
  const n = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM series WHERE seance_id = ? AND realise > 0", seanceId);
  if (!n?.n) {
    await db.runAsync("DELETE FROM series WHERE seance_id = ?", seanceId);
    await db.runAsync("DELETE FROM seances WHERE id = ?", seanceId);
    return null;
  }
  await db.runAsync("UPDATE seances SET fin = ?, ressenti = ? WHERE id = ?", new Date().toISOString(), ressenti, seanceId);
  return { records: await recordsDeSeance(seanceId) };
}

/** Une séance notée en 1 tap, « comme prévu » : toutes les séries à leur cible. */
export async function noterSeanceCommePrevu(
  nom: string,
  origine: OrigineSeance,
  lignes: LigneSeance[],
  date: string = getAujourdhui(),
): Promise<{ seanceId: number; points: number }> {
  const seanceId = await commencerSeanceSport(nom, origine, date);
  let points = 0;
  for (const l of lignes) {
    for (let numero = 1; numero <= l.series; numero++) {
      points += (await noterSerieSport(seanceId, { exercice: l.exercice, numero, realise: l.cible, poids: l.poids, prevu: l.cible })).points;
    }
  }
  await terminerSeanceSport(seanceId, "");
  return { seanceId, points };
}
