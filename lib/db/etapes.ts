import {
  BONUS_FIN,
  debutEtapesEnCours,
  deltaPoints,
  lireFrequence,
  palierEtapes,
  pointsEtapesARetirer,
  pointsPalier,
  POINTS_ETAPE,
  SQL_AJOUT_ETAPE,
  type Frequence,
} from "../regles-taches";
import { getDatabase } from "./client";
import { annulerCompletion, completer, getAujourdhui } from "./completions";
import { estJourDifficile } from "./jour-difficile";
import { addPoints } from "./stats";

/**
 * Étapes d'une tâche. Chaque étape cochée rapporte des points ; cocher la
 * dernière termine la tâche et ajoute un bonus (lib/regles-taches.ts).
 * - tâche unique : etapes.faite, cochée une fois pour toutes ;
 * - tâche « x fois par semaine / par mois » : etapes_cochees, remises à
 *   zéro après chaque fois faite (debutEtapesEnCours).
 *
 * Étapes d'une routine : essentielles ou bonus, recochées chaque jour
 * (etapes_cochees). Points par palier.
 */

export { BONUS_FIN, POINTS_ETAPE };

export type Etape = {
  id: number;
  item_id: number;
  nom: string;
  ordre: number;
  faite: number;
  /** 1 = essentielle, 0 = bonus (routines). */
  essentielle: number;
};

type Db = Awaited<ReturnType<typeof getDatabase>>;

export async function getEtapes(itemId: number): Promise<Etape[]> {
  const db = await getDatabase();
  return db.getAllAsync<Etape>(
    "SELECT * FROM etapes WHERE item_id = ? ORDER BY ordre, id",
    itemId,
  );
}

/** Fréquence de la tâche, ou null (tâche unique, routine). */
async function frequenceDe(db: Db, itemId: number): Promise<Frequence | null> {
  const item = await db.getFirstAsync<{ type: string; recurrence: string | null }>(
    "SELECT type, recurrence FROM items WHERE id = ?",
    itemId,
  );
  return item?.type === "tache" ? lireFrequence(item.recurrence) : null;
}

/** Premier jour où une étape cochée compte encore, pour une tâche récurrente, au jour `jour`. */
async function debutEnCours(db: Db, itemId: number, f: Frequence, jour: string): Promise<string> {
  const avant = await db.getFirstAsync<{ d: string | null }>(
    "SELECT MAX(date) AS d FROM completions WHERE item_id = ? AND date < ?",
    itemId,
    jour,
  );
  return debutEtapesEnCours(jour, f.periode, avant?.d ?? null);
}

/** Ids des étapes cochées en cours d'une tâche récurrente, avec la date de chaque coche. */
async function cocheesEnCours(
  db: Db,
  itemId: number,
  f: Frequence,
  jour: string,
): Promise<{ id: number; etape_id: number }[]> {
  return db.getAllAsync<{ id: number; etape_id: number }>(
    "SELECT id, etape_id FROM etapes_cochees WHERE item_id = ? AND date >= ? AND date <= ?",
    itemId,
    await debutEnCours(db, itemId, f, jour),
    jour,
  );
}

/**
 * Étapes de plusieurs tâches d'un coup, rangées par tâche. Pour une tâche
 * récurrente, `faite` dit si l'étape est cochée pour la fois en cours.
 */
export async function getEtapesPour(
  itemIds: number[],
): Promise<Record<number, Etape[]>> {
  const resultat: Record<number, Etape[]> = {};
  if (itemIds.length === 0) return resultat;
  const db = await getDatabase();
  const rows = await db.getAllAsync<Etape>(
    `SELECT * FROM etapes WHERE item_id IN (${itemIds.map(() => "?").join(",")})
     ORDER BY ordre, id`,
    ...itemIds,
  );
  for (const e of rows) (resultat[e.item_id] ??= []).push(e);

  const aujourdhui = getAujourdhui();
  for (const id of Object.keys(resultat).map(Number)) {
    const f = await frequenceDe(db, id);
    if (!f) continue;
    const cochees = new Set((await cocheesEnCours(db, id, f, aujourdhui)).map((c) => c.etape_id));
    resultat[id] = resultat[id].map((e) => ({ ...e, faite: cochees.has(e.id) ? 1 : 0 }));
  }
  return resultat;
}

/**
 * Enregistre la liste d'étapes telle qu'elle est à l'écran :
 * supprime celles qui ont disparu, renomme et réordonne les autres,
 * ajoute les nouvelles. L'état « faite » des étapes gardées est conservé.
 */
export async function enregistrerEtapes(
  itemId: number,
  liste: { id?: number; nom: string; essentielle?: number }[],
): Promise<void> {
  const db = await getDatabase();
  const existantes = await getEtapes(itemId);
  const gardees = new Set(
    liste.map((e) => e.id).filter((x): x is number => !!x),
  );

  for (const e of existantes) {
    if (!gardees.has(e.id)) {
      await db.runAsync("DELETE FROM etapes WHERE id = ?", e.id);
      await db.runAsync("DELETE FROM etapes_cochees WHERE etape_id = ?", e.id);
    }
  }
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    const nom = e.nom.trim();
    if (!nom) continue;
    if (e.id) {
      await db.runAsync(
        "UPDATE etapes SET nom = ?, ordre = ?, essentielle = ? WHERE id = ?",
        nom,
        i,
        e.essentielle ?? 1,
        e.id,
      );
    } else {
      await db.runAsync(
        "INSERT INTO etapes (item_id, nom, ordre, essentielle) VALUES (?, ?, ?, ?)",
        itemId,
        nom,
        i,
        e.essentielle ?? 1,
      );
    }
  }
}

/** Ajoute une étape en dernier, sans toucher aux autres. */
export async function ajouterEtape(itemId: number, nom: string): Promise<void> {
  const n = nom.trim();
  if (!n) return;
  const db = await getDatabase();
  await db.runAsync(SQL_AJOUT_ETAPE, itemId, n, itemId);
}

/** Coche une étape de tâche. Renvoie true si c'était la dernière (tâche faite). */
export async function cocherEtape(etapeId: number): Promise<boolean> {
  const db = await getDatabase();
  const etape = await db.getFirstAsync<Etape>("SELECT * FROM etapes WHERE id = ?", etapeId);
  if (!etape) return false;
  const aujourdhui = getAujourdhui();
  const f = await frequenceDe(db, etape.item_id);

  let restantes: number;
  if (f) {
    const deja = await cocheesEnCours(db, etape.item_id, f, aujourdhui);
    if (deja.some((c) => c.etape_id === etapeId)) return false;
    await db.runAsync(
      "INSERT INTO etapes_cochees (etape_id, item_id, date, horodatage) VALUES (?, ?, ?, ?)",
      etapeId,
      etape.item_id,
      aujourdhui,
      new Date().toISOString(),
    );
    const total = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM etapes WHERE item_id = ?",
      etape.item_id,
    );
    restantes = (total?.n ?? 0) - deja.length - 1;
  } else {
    if (etape.faite === 1) return false;
    await db.runAsync(
      "UPDATE etapes SET faite = 1, faite_le = ? WHERE id = ?",
      aujourdhui,
      etapeId,
    );
    const r = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM etapes WHERE item_id = ? AND faite = 0",
      etape.item_id,
    );
    restantes = r?.n ?? 0;
  }
  await addPoints(POINTS_ETAPE);

  if (restantes <= 0) {
    await completer(etape.item_id, "complet");
    await addPoints(BONUS_FIN);
    return true;
  }
  return false;
}

/** Décoche une étape de tâche ; si la tâche était faite par elle, elle redevient à faire. */
export async function decocherEtape(etapeId: number): Promise<void> {
  const db = await getDatabase();
  const etape = await db.getFirstAsync<Etape>("SELECT * FROM etapes WHERE id = ?", etapeId);
  if (!etape) return;
  const aujourdhui = getAujourdhui();
  const f = await frequenceDe(db, etape.item_id);

  if (f) {
    const coche = (await cocheesEnCours(db, etape.item_id, f, aujourdhui)).find(
      (c) => c.etape_id === etapeId,
    );
    if (!coche) return;
    await db.runAsync("DELETE FROM etapes_cochees WHERE id = ?", coche.id);
    await addPoints(-POINTS_ETAPE);
    // Faite aujourd'hui par la dernière étape : on l'annule avec son bonus.
    const faite = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM completions WHERE item_id = ? AND date = ?",
      etape.item_id,
      aujourdhui,
    );
    if (faite) {
      await annulerCompletion(etape.item_id, aujourdhui);
      await addPoints(-BONUS_FIN);
    }
    return;
  }

  if (etape.faite === 0) return;
  await db.runAsync("UPDATE etapes SET faite = 0, faite_le = NULL WHERE id = ?", etapeId);
  await addPoints(-POINTS_ETAPE);
  // Tâche terminée : on annule sa complétion (quel que soit son jour) et le bonus.
  const faite = await db.getFirstAsync<{ date: string }>(
    "SELECT date FROM completions WHERE item_id = ? ORDER BY date DESC LIMIT 1",
    etape.item_id,
  );
  if (faite) {
    await annulerCompletion(etape.item_id, faite.date);
    await addPoints(-BONUS_FIN);
  }
}

/**
 * « Remettre à faire » une tâche faite un jour donné (Progression) :
 * retire la complétion et ses points, et aussi les étapes cochées pour
 * cette fois-là, leurs points et le bonus. Refaire la tâche redonne tout,
 * une seule fois.
 */
export async function remettreAFaire(itemId: number, date: string): Promise<void> {
  const db = await getDatabase();
  const etapes = await getEtapes(itemId);
  const f = await frequenceDe(db, itemId);

  let cochees = 0;
  if (f) {
    const lignes = await cocheesEnCours(db, itemId, f, date);
    cochees = lignes.length;
    for (const l of lignes) await db.runAsync("DELETE FROM etapes_cochees WHERE id = ?", l.id);
  } else {
    cochees = etapes.filter((e) => e.faite === 1).length;
    await db.runAsync("UPDATE etapes SET faite = 0, faite_le = NULL WHERE item_id = ?", itemId);
  }

  await annulerCompletion(itemId, date);
  const aRetirer = etapes.length > 0 ? pointsEtapesARetirer(cochees, etapes.length) : 0;
  if (aRetirer > 0) await addPoints(-aRetirer);
}

// ─── Routines à étapes ──────────────────────────────────────────────────

export type EtapeRoutine = Etape & { cochee: boolean };

/** Étapes de plusieurs routines, avec leur état du jour. */
export async function getEtapesRoutines(
  itemIds: number[],
  jour: string = getAujourdhui(),
): Promise<Record<number, EtapeRoutine[]>> {
  const resultat: Record<number, EtapeRoutine[]> = {};
  if (itemIds.length === 0) return resultat;
  const db = await getDatabase();
  const rows = await db.getAllAsync<Etape & { cochee: number }>(
    `SELECT e.*, (ec.id IS NOT NULL) AS cochee
     FROM etapes e
     LEFT JOIN etapes_cochees ec ON ec.etape_id = e.id AND ec.date = ?
     WHERE e.item_id IN (${itemIds.map(() => "?").join(",")})
     ORDER BY e.ordre, e.id`,
    jour,
    ...itemIds,
  );
  for (const e of rows) (resultat[e.item_id] ??= []).push({ ...e, cochee: e.cochee === 1 });
  return resultat;
}

/** Valeur de completions.version pour une routine à étapes : le palier atteint. */
const VERSION_PALIER = { 1: "essentielles", 2: "toutes" } as const;

/**
 * Coche ou décoche une étape de routine pour aujourd'hui, puis ajuste la
 * complétion du jour au palier atteint. Les points donnés sont gardés
 * dans completions.points : on ne verse que la différence.
 */
export async function basculerEtapeRoutine(
  etapeId: number,
  date: string = getAujourdhui(),
): Promise<void> {
  const db = await getDatabase();
  const etape = await db.getFirstAsync<Etape>("SELECT * FROM etapes WHERE id = ?", etapeId);
  if (!etape) return;

  const cochee = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM etapes_cochees WHERE etape_id = ? AND date = ?",
    etapeId,
    date,
  );
  if (cochee) {
    await db.runAsync("DELETE FROM etapes_cochees WHERE id = ?", cochee.id);
  } else {
    await db.runAsync(
      "INSERT INTO etapes_cochees (etape_id, item_id, date, horodatage) VALUES (?, ?, ?, ?)",
      etapeId,
      etape.item_id,
      date,
      new Date().toISOString(),
    );
  }

  const etapes = (await getEtapesRoutines([etape.item_id], date))[etape.item_id] ?? [];
  const palier = palierEtapes(
    etapes.map((e) => ({ essentielle: e.essentielle === 1, cochee: e.cochee })),
  );
  const points = pointsPalier(palier, await estJourDifficile(date));
  if (palier === 0) await annulerCompletion(etape.item_id, date);
  else await completer(etape.item_id, "complet", undefined, VERSION_PALIER[palier], points, date);
}

/**
 * Après un changement d'énergie du jour (Jour difficile ↔ Normal / En forme) :
 * remet les points des routines à étapes déjà cochées aujourd'hui au
 * barème du nouvel état. Seule la différence est versée ou retirée, et
 * l'heure de la complétion ne bouge pas.
 */
export async function recalculerPointsEtapesDuJour(): Promise<void> {
  const db = await getDatabase();
  const date = getAujourdhui();
  const jourDifficile = await estJourDifficile();
  // Routines seulement : les tâches récurrentes ont aussi des lignes ici.
  const ids = (
    await db.getAllAsync<{ item_id: number }>(
      `SELECT DISTINCT ec.item_id FROM etapes_cochees ec
       JOIN items i ON i.id = ec.item_id AND i.type = 'routine'
       WHERE ec.date = ?`,
      date,
    )
  ).map((r) => r.item_id);
  const parRoutine = await getEtapesRoutines(ids);

  for (const id of ids) {
    const c = await db.getFirstAsync<{ id: number; statut: string; points: number | null }>(
      "SELECT id, statut, points FROM completions WHERE item_id = ? AND date = ?",
      id,
      date,
    );
    if (!c) continue;
    const palier = palierEtapes(
      (parRoutine[id] ?? []).map((e) => ({ essentielle: e.essentielle === 1, cochee: e.cochee })),
    );
    if (palier === 0) continue;
    const deja = c.points ?? (c.statut === "partiel" ? 5 : 10);
    const delta = deltaPoints(deja, palier, jourDifficile);
    if (delta === 0) continue;
    await db.runAsync("UPDATE completions SET points = ? WHERE id = ?", deja + delta, c.id);
    await addPoints(delta);
  }
}
