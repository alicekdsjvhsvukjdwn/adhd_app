import { decalerJours } from "../dates";
import {
  anxieteParSemaine,
  compteursSemaine,
  expositionReussie,
  liensAnxiete,
  lundiDe,
  marches,
  marchesParSemaine,
  MAX_CONFIANCE_PAR_JOUR,
  MAX_OBJECTIFS,
  nombreParSemaine,
  objectifsDeSemaine,
  objectifsValides,
  progressionObjectifs,
  recapSemaine,
  type ExpositionFaite,
  type LienAnxiete,
  type Marche,
  type Objectif,
  type RecapSemaine,
} from "../tcc-regles";
import { POINTS_TCC } from "../tcc-points";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { humeursEntre, listerPensees, type Pensee } from "./esprit";
import { ecrireMeta, lireMeta } from "./meta";
import { nuitsEntre } from "./sommeil";
import { addPoints } from "./stats";

/**
 * TCC en autonomie : échelle d'exposition, expositions, journal de confiance, objectifs de la semaine,
 * séances avec moi-même. +5 points par jour où je fais une exposition ou ma séance (une fois par jour) ;
 * rien pour l'humeur ni les journaux. Tout reste sur l'appareil.
 */

const semaineDe7 = (lundi: string) => Array.from({ length: 7 }, (_, i) => decalerJours(lundi, i));

// ─── Points : une fois par jour ─────────────────────────────────────────

/**
 * Remet les points d'un jour d'accord avec ce qui a été fait : +5 s'il y a une exposition terminée
 * ou une séance ce jour-là, repris s'il n'y a plus rien. Jamais deux fois le même jour.
 */
async function recalculerPointsJour(jour: string): Promise<number> {
  const db = await getDatabase();
  const fait = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM tcc_expositions WHERE jour = ? AND anx_reelle IS NOT NULL)
          + (SELECT COUNT(*) FROM tcc_seances_moi WHERE jour = ?) AS n`,
    jour,
    jour,
  );
  const paye = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM tcc_points_jours WHERE jour = ?", jour);
  if ((fait?.n ?? 0) > 0 && !paye?.n) {
    await db.runAsync("INSERT INTO tcc_points_jours (jour) VALUES (?)", jour);
    await addPoints(POINTS_TCC);
    return POINTS_TCC;
  }
  if ((fait?.n ?? 0) === 0 && paye?.n) {
    await db.runAsync("DELETE FROM tcc_points_jours WHERE jour = ?", jour);
    await addPoints(-POINTS_TCC);
    return -POINTS_TCC;
  }
  return 0;
}

// ─── Échelle d'exposition ───────────────────────────────────────────────

export type SituationDb = { id: number; nom: string; anxiete: number; pensee_id: number | null };

const borne = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export async function listerSituations(): Promise<SituationDb[]> {
  const db = await getDatabase();
  return db.getAllAsync<SituationDb>("SELECT id, nom, anxiete, pensee_id FROM tcc_echelle WHERE archivee = 0 ORDER BY anxiete, id");
}

export async function ajouterSituation(nom: string, anxiete: number, penseeId: number | null = null): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    "INSERT INTO tcc_echelle (nom, anxiete, pensee_id, cree_le) VALUES (?, ?, ?, ?)",
    nom.trim(),
    borne(anxiete),
    penseeId,
    new Date().toISOString(),
  );
  return r.lastInsertRowId;
}

export async function modifierSituation(id: number, nom: string, anxiete: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tcc_echelle SET nom = ?, anxiete = ? WHERE id = ?", nom.trim(), borne(anxiete), id);
}

/** Retire la marche de l'échelle ; ses expositions restent dans l'historique et les statistiques. */
export async function archiverSituation(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tcc_echelle SET archivee = 1 WHERE id = ?", id);
}

export type ExpositionDb = ExpositionFaite & { crainte: string; vecu: string; retenu: string; securite: string };

const COLONNES_EXPO = "id, situation_id, jour, anx_prevue, crainte, anx_reelle, vecu, retenu, securite";

/** Expositions terminées. */
export async function expositionsTerminees(): Promise<ExpositionDb[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExpositionDb>(`SELECT ${COLONNES_EXPO} FROM tcc_expositions WHERE anx_reelle IS NOT NULL ORDER BY jour, id`);
}

export async function expositionsDeSituation(situationId: number): Promise<ExpositionDb[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExpositionDb>(`SELECT ${COLONNES_EXPO} FROM tcc_expositions WHERE situation_id = ? ORDER BY jour DESC, id DESC`, situationId);
}

/** L'échelle, de la plus facile à la plus dure, avec la marche franchie ou non et la prochaine à tenter. */
export async function echelle(): Promise<Marche<SituationDb>[]> {
  return marches(await listerSituations(), await expositionsTerminees());
}

/** « Je le fais », avant : l'anxiété prévue et ce que je crains. L'exposition reste en cours jusqu'à terminerExposition. */
export async function commencerExposition(situationId: number, anxPrevue: number, crainte: string, jour: string = getAujourdhui()): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    "INSERT INTO tcc_expositions (situation_id, jour, anx_prevue, crainte) VALUES (?, ?, ?, ?)",
    situationId,
    jour,
    borne(anxPrevue),
    crainte.trim(),
  );
  return r.lastInsertRowId;
}

/** Une exposition commencée et pas terminée (reprise après une fermeture de l'appli). */
export async function expositionEnCours(situationId: number): Promise<ExpositionDb | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ExpositionDb>(
    `SELECT ${COLONNES_EXPO} FROM tcc_expositions WHERE situation_id = ? AND anx_reelle IS NULL ORDER BY id DESC LIMIT 1`,
    situationId,
  );
}

/**
 * « Je le fais », après. Renvoie les points gagnés, si cette exposition compte comme réussie
 * et si elle vient de faire franchir la marche.
 */
export async function terminerExposition(
  id: number,
  p: { anxReelle: number; vecu: string; retenu: string; securite: string[] },
): Promise<{ points: number; reussie: boolean; marcheFranchie: boolean }> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<ExpositionDb>(`SELECT ${COLONNES_EXPO} FROM tcc_expositions WHERE id = ?`, id);
  if (!e) return { points: 0, reussie: false, marcheFranchie: false };
  const avant = (await marches(await listerSituations(), await expositionsTerminees())).find((m) => m.situation.id === e.situation_id)?.franchie ?? false;
  await db.runAsync(
    "UPDATE tcc_expositions SET anx_reelle = ?, vecu = ?, retenu = ?, securite = ? WHERE id = ?",
    borne(p.anxReelle),
    p.vecu.trim(),
    p.retenu.trim(),
    p.securite.map((s) => s.replace(/\|/g, " ")).join("|"),
    id,
  );
  const apres = (await marches(await listerSituations(), await expositionsTerminees())).find((m) => m.situation.id === e.situation_id)?.franchie ?? false;
  return {
    points: await recalculerPointsJour(e.jour),
    reussie: expositionReussie({ anx_prevue: e.anx_prevue, anx_reelle: borne(p.anxReelle) }),
    marcheFranchie: apres && !avant,
  };
}

export async function supprimerExposition(id: number): Promise<void> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ jour: string }>("SELECT jour FROM tcc_expositions WHERE id = ?", id);
  await db.runAsync("DELETE FROM tcc_expositions WHERE id = ?", id);
  if (e) await recalculerPointsJour(e.jour);
}

// ─── Journal de confiance ───────────────────────────────────────────────

export type EntreeConfiance = { id: number; jour: string; texte: string };

export async function listerConfiance(): Promise<EntreeConfiance[]> {
  const db = await getDatabase();
  return db.getAllAsync<EntreeConfiance>("SELECT id, jour, texte FROM tcc_confiance ORDER BY jour DESC, id DESC");
}

/** Ajoute une ligne (3 au plus par jour). Renvoie false si le jour est plein ou la ligne vide. */
export async function ajouterConfiance(texte: string, jour: string = getAujourdhui()): Promise<boolean> {
  const t = texte.trim();
  if (!t) return false;
  const db = await getDatabase();
  const n = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM tcc_confiance WHERE jour = ?", jour);
  if ((n?.n ?? 0) >= MAX_CONFIANCE_PAR_JOUR) return false;
  await db.runAsync("INSERT INTO tcc_confiance (jour, texte, cree_le) VALUES (?, ?, ?)", jour, t, new Date().toISOString());
  return true;
}

export async function supprimerConfiance(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_confiance WHERE id = ?", id);
}

// ─── Objectifs de la semaine ────────────────────────────────────────────

/** Les objectifs de la semaine du lundi donné ; sans choix, ceux de la dernière semaine qui en avait. */
export async function objectifsDe(lundi: string): Promise<Objectif[]> {
  const db = await getDatabase();
  const lignes = await db.getAllAsync<{ semaine: string; genre: string; cible: number }>("SELECT semaine, genre, cible FROM tcc_objectifs WHERE semaine <= ?", lundi);
  return objectifsDeSemaine(lignes, lundi);
}

/** Remplace les objectifs d'une semaine (3 au plus, un par genre). */
export async function definirObjectifs(lundi: string, objectifs: Objectif[]): Promise<void> {
  const db = await getDatabase();
  const valides = objectifsValides(objectifs).slice(0, MAX_OBJECTIFS);
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM tcc_objectifs WHERE semaine = ?", lundi);
    for (const o of valides) await db.runAsync("INSERT INTO tcc_objectifs (semaine, genre, cible) VALUES (?, ?, ?)", lundi, o.genre, o.cible);
  });
}

type Brut = {
  expositions: (ExpositionFaite & { experience: boolean })[];
  confiance: { jour: string }[];
  seances: { jour: string }[];
};

async function donneesBrutes(): Promise<Brut> {
  const db = await getDatabase();
  const expositions = await db.getAllAsync<ExpositionFaite & { experience: number }>(
    `SELECT x.id, x.situation_id, x.jour, x.anx_prevue, x.anx_reelle,
            CASE WHEN e.pensee_id IS NOT NULL THEN 1 ELSE 0 END AS experience
     FROM tcc_expositions x LEFT JOIN tcc_echelle e ON e.id = x.situation_id
     WHERE x.anx_reelle IS NOT NULL ORDER BY x.jour, x.id`,
  );
  return {
    expositions: expositions.map((e) => ({ ...e, experience: !!e.experience })),
    confiance: await db.getAllAsync<{ jour: string }>("SELECT jour FROM tcc_confiance"),
    seances: await db.getAllAsync<{ jour: string }>("SELECT jour FROM tcc_seances_moi"),
  };
}

// ─── Où j'en suis ───────────────────────────────────────────────────────

export type SeanceMoi = {
  id: number;
  jour: string;
  semaine: string;
  humeur_moy: number | null;
  anx_prevue_moy: number | null;
  anx_reelle_moy: number | null;
  expositions: number;
  confiance: number;
  objectifs: string;
  retenu: string;
  prochain_pas: string;
  situation_id: number | null;
  objectifs_suivants: string;
  mot_gentil: string;
};

const COLONNES_SEANCE =
  "id, jour, semaine, humeur_moy, anx_prevue_moy, anx_reelle_moy, expositions, confiance, objectifs, retenu, prochain_pas, situation_id, objectifs_suivants, mot_gentil";

export async function seancesMoi(): Promise<SeanceMoi[]> {
  const db = await getDatabase();
  return db.getAllAsync<SeanceMoi>(`SELECT ${COLONNES_SEANCE} FROM tcc_seances_moi ORDER BY jour DESC, id DESC`);
}

export type OuJenSuis = {
  objectifs: ReturnType<typeof progressionObjectifs>;
  marches: { franchies: number; total: number };
  /** 8 semaines : anxiété prévue et réelle moyennes. */
  courbe: ReturnType<typeof anxieteParSemaine>;
  derniereSeance: (SeanceMoi & { prochaine: string | null }) | null;
};

/** L'en-tête du programme : objectifs de la semaine, marches franchies, évolution prévue / réelle, dernière séance. */
export async function ouJenSuis(aujourdhui: string = getAujourdhui()): Promise<OuJenSuis> {
  const lundi = lundiDe(aujourdhui);
  const brut = await donneesBrutes();
  const echelleDb = await echelle();
  const derniere = (await seancesMoi())[0] ?? null;
  const prochaine = derniere?.situation_id ? echelleDb.find((m) => m.situation.id === derniere.situation_id)?.situation.nom ?? null : null;
  return {
    objectifs: progressionObjectifs(await objectifsDe(lundi), compteursSemaine(semaineDe7(lundi), brut)),
    marches: { franchies: echelleDb.filter((m) => m.franchie).length, total: echelleDb.length },
    courbe: anxieteParSemaine(brut.expositions, aujourdhui, 8),
    derniereSeance: derniere ? { ...derniere, prochaine } : null,
  };
}

// ─── Séance avec moi-même ───────────────────────────────────────────────

export type ReglagesSeanceMoi = { actif: boolean; /** 0 = dimanche */ jour: number; heure: string };
const DEFAUT_SEANCE_MOI: ReglagesSeanceMoi = { actif: false, jour: 0, heure: "18:00" };

export async function lireReglagesSeanceMoi(): Promise<ReglagesSeanceMoi> {
  try {
    const r = { ...DEFAUT_SEANCE_MOI, ...JSON.parse((await lireMeta("tcc_seance_moi")) ?? "{}") };
    return { actif: !!r.actif, jour: Number.isInteger(r.jour) && r.jour >= 0 && r.jour <= 6 ? r.jour : 0, heure: /^\d{2}:\d{2}$/.test(r.heure) ? r.heure : "18:00" };
  } catch {
    return DEFAUT_SEANCE_MOI;
  }
}

export const ecrireReglagesSeanceMoi = (r: ReglagesSeanceMoi) => ecrireMeta("tcc_seance_moi", JSON.stringify(r));

/** Les étapes 1 et 2 de la séance, remplies toutes seules pour la semaine du lundi donné. */
export async function recapAutomatique(lundi: string): Promise<RecapSemaine> {
  const brut = await donneesBrutes();
  return recapSemaine(lundi, {
    humeurs: await humeursEntre(lundi, decalerJours(lundi, 6)),
    expositions: brut.expositions,
    confiance: brut.confiance,
    seances: brut.seances,
    objectifs: await objectifsDe(lundi),
  });
}

/**
 * Enregistre la séance : le récap automatique est gardé tel qu'il était ce jour-là, puis ce que j'en retiens,
 * le prochain pas (la marche) et les objectifs de la semaine suivante. +5 pts, une fois par jour.
 */
export async function enregistrerSeanceMoi(p: {
  retenu: string;
  situationId: number | null;
  objectifsSuivants: Objectif[];
  motGentil: string;
  jour?: string;
}): Promise<{ points: number }> {
  const jour = p.jour ?? getAujourdhui();
  const lundi = lundiDe(jour);
  const recap = await recapAutomatique(lundi);
  const suivants = objectifsValides(p.objectifsSuivants);
  const db = await getDatabase();
  const marche = p.situationId ? (await listerSituations()).find((s) => s.id === p.situationId) : null;
  await db.runAsync(
    `INSERT INTO tcc_seances_moi
       (jour, semaine, humeur_moy, anx_prevue_moy, anx_reelle_moy, expositions, confiance, objectifs, retenu, prochain_pas, situation_id, objectifs_suivants, mot_gentil)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jour,
    lundi,
    recap.humeur,
    recap.anxietePrevue,
    recap.anxieteReelle,
    recap.expositions,
    recap.confiance,
    JSON.stringify(recap.objectifs),
    p.retenu.trim(),
    marche?.nom ?? "",
    marche?.id ?? null,
    JSON.stringify(suivants),
    p.motGentil.trim(),
  );
  // Les objectifs de la semaine suivante : ce que j'ai choisi, ou la reconduction de ceux d'aujourd'hui.
  await definirObjectifs(decalerJours(lundi, 7), suivants.length > 0 ? suivants : await objectifsDe(lundi));
  return { points: await recalculerPointsJour(jour) };
}

// ─── Suivi › Progrès : « Confiance & anxiété » ──────────────────────────

export type ProgresConfiance = {
  marches: { debut: string; n: number }[];
  anxiete: ReturnType<typeof anxieteParSemaine>;
  confiance: { debut: string; n: number }[];
  liens: LienAnxiete[];
  /** Pas encore d'exposition ni d'entrée : la section reste discrète. */
  vide: boolean;
};

export async function progresConfiance(aujourdhui: string = getAujourdhui()): Promise<ProgresConfiance> {
  const brut = await donneesBrutes();
  const debutLiens = decalerJours(aujourdhui, -89);
  const parJour = new Map<string, number[]>();
  for (const e of brut.expositions) {
    if (e.jour < debutLiens || e.anx_reelle === null) continue;
    parJour.set(e.jour, [...(parJour.get(e.jour) ?? []), e.anx_reelle]);
  }
  const anxieteParJour: Record<string, number> = {};
  for (const [j, l] of parJour) anxieteParJour[j] = l.reduce((s, x) => s + x, 0) / l.length;

  const sommeilMinParJour: Record<string, number> = {};
  for (const n of await nuitsEntre(debutLiens, aujourdhui)) if (n.duree_min > 0) sommeilMinParJour[n.date] = n.duree_min;
  const db = await getDatabase();
  const joursSport = new Set(
    (
      await db.getAllAsync<{ date: string }>(
        `SELECT date FROM seances WHERE date >= ? UNION SELECT date FROM seances_guidees WHERE date >= ?`,
        debutLiens,
        debutLiens,
      )
    ).map((r) => r.date),
  );
  return {
    marches: marchesParSemaine(brut.expositions, aujourdhui, 8),
    anxiete: anxieteParSemaine(brut.expositions, aujourdhui, 8),
    confiance: nombreParSemaine(brut.confiance.map((c) => c.jour), aujourdhui, 8),
    liens: liensAnxiete({ anxieteParJour, sommeilMinParJour, joursSport }),
    vide: brut.expositions.length === 0 && brut.confiance.length === 0,
  };
}

// ─── Du journal de pensées à l'échelle ──────────────────────────────────

/**
 * « Tester cette pensée » : la pensée devient une marche de l'échelle (son anxiété de départ est la force
 * de l'émotion notée). Une pensée n'a qu'une marche : on retrouve la même si elle existe déjà.
 */
export async function situationDepuisPensee(
  p: number | Pensee,
  repli?: { pensee: string; situation: string; avant: number | null },
): Promise<number> {
  const id = typeof p === "number" ? p : p.id;
  const db = await getDatabase();
  const deja = await db.getFirstAsync<{ id: number }>("SELECT id FROM tcc_echelle WHERE pensee_id = ? AND archivee = 0 ORDER BY id DESC", id);
  if (deja) return deja.id;
  const pensee = typeof p === "number" ? (await listerPensees()).find((x) => x.id === id) : p;
  const texte = (pensee?.pensee || repli?.pensee || "").trim();
  const nom = `Tester : « ${texte.length > 60 ? `${texte.slice(0, 57)}…` : texte || "ma pensée"} »`;
  return ajouterSituation(nom, pensee?.intensite_avant ?? repli?.avant ?? 50, id);
}

/** Le texte de la pensée liée à une marche (sert de prédiction de départ), ou "". */
export async function penseeDeSituation(situationId: number): Promise<string> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ pensee: string }>(
    "SELECT p.pensee AS pensee FROM tcc_echelle e JOIN pensees p ON p.id = e.pensee_id WHERE e.id = ?",
    situationId,
  );
  return r?.pensee ?? "";
}
