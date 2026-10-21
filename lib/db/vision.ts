import { DOMAINES_DEFAUT, MAX_PHOTOS, placesPhotos, SECONDES_LECTURE_VALIDEE, sequenceVision, type EcranVision } from "../vision-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { ecrireMeta, lireMeta } from "./meta";
import { cocherRoutine } from "./routine-liee";

/** Ma vision : domaines de vie, photos (compressées, dans la base) et phrases au présent. */

export type DomaineVision = { id: number; nom: string; ordre: number };
export type PhotoVision = { id: number; domaine_id: number; data: string };
export type PhraseVision = { id: number; domaine_id: number; texte: string; ordre: number };

/** Les domaines de départ sont créés à la première ouverture seulement. */
export async function initialiserVision(): Promise<void> {
  if ((await lireMeta("vision_init")) !== null) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const [i, nom] of DOMAINES_DEFAUT.entries()) {
      await db.runAsync("INSERT INTO vision_domaines (nom, ordre) VALUES (?, ?)", nom, i);
    }
    await ecrireMeta("vision_init", "1");
  });
}

export async function getVision(): Promise<{ domaines: DomaineVision[]; photos: PhotoVision[]; phrases: PhraseVision[] }> {
  await initialiserVision();
  const db = await getDatabase();
  return {
    domaines: await db.getAllAsync<DomaineVision>("SELECT id, nom, ordre FROM vision_domaines ORDER BY ordre, id"),
    photos: await db.getAllAsync<PhotoVision>("SELECT id, domaine_id, data FROM vision_photos ORDER BY id"),
    phrases: await db.getAllAsync<PhraseVision>("SELECT id, domaine_id, texte, ordre FROM vision_phrases ORDER BY ordre, id"),
  };
}

export async function ajouterDomaineVision(nom: string): Promise<void> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ m: number | null }>("SELECT MAX(ordre) AS m FROM vision_domaines");
  await db.runAsync("INSERT INTO vision_domaines (nom, ordre) VALUES (?, ?)", nom.trim(), (r?.m ?? -1) + 1);
}

export async function renommerDomaineVision(id: number, nom: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE vision_domaines SET nom = ? WHERE id = ?", nom.trim(), id);
}

export async function supprimerDomaineVision(id: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM vision_photos WHERE domaine_id = ?", id);
    await db.runAsync("DELETE FROM vision_phrases WHERE domaine_id = ?", id);
    await db.runAsync("DELETE FROM vision_domaines WHERE id = ?", id);
  });
}

export async function nombrePhotos(): Promise<number> {
  const db = await getDatabase();
  return (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM vision_photos"))?.n ?? 0;
}

/** Ajoute des photos (data URI) dans la limite des places restantes. Renvoie combien ont été gardées. */
export async function ajouterPhotosVision(domaineId: number, donnees: string[]): Promise<number> {
  const db = await getDatabase();
  const gardees = donnees.slice(0, placesPhotos(await nombrePhotos()));
  await db.withTransactionAsync(async () => {
    for (const d of gardees) {
      await db.runAsync("INSERT INTO vision_photos (domaine_id, data, cree_le) VALUES (?, ?, ?)", domaineId, d, new Date().toISOString());
    }
  });
  return gardees.length;
}

export async function supprimerPhotoVision(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM vision_photos WHERE id = ?", id);
}

export async function ajouterPhraseVision(domaineId: number, texte: string): Promise<void> {
  const t = texte.trim();
  if (!t) return;
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ m: number | null }>("SELECT MAX(ordre) AS m FROM vision_phrases WHERE domaine_id = ?", domaineId);
  await db.runAsync("INSERT INTO vision_phrases (domaine_id, texte, ordre) VALUES (?, ?, ?)", domaineId, t, (r?.m ?? -1) + 1);
}

export async function modifierPhraseVision(id: number, texte: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE vision_phrases SET texte = ? WHERE id = ?", texte.trim(), id);
}

export async function supprimerPhraseVision(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM vision_phrases WHERE id = ?", id);
}

/** Ce que la lecture plein écran fait défiler. */
export async function ecransDeLecture(): Promise<EcranVision[]> {
  const v = await getVision();
  return sequenceVision(v.domaines, v.photos, v.phrases);
}

// ─── Routine liée ───────────────────────────────────────────────────────

export async function getRoutineVision(): Promise<number | null> {
  const n = Number(await lireMeta("vision_routine"));
  return n > 0 ? n : null;
}

/** null : plus de routine liée. */
export async function definirRoutineVision(id: number | null): Promise<void> {
  await ecrireMeta("vision_routine", id === null ? null : String(id));
}

/** Après une lecture : la routine liée est cochée si la lecture a duré assez longtemps. */
export async function lectureTerminee(secondes: number): Promise<boolean> {
  if (secondes < SECONDES_LECTURE_VALIDEE) return false;
  const id = await getRoutineVision();
  return id === null ? false : cocherRoutine(id, getAujourdhui());
}

export { MAX_PHOTOS };
