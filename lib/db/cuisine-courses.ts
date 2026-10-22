import {
  additionnerIngredients,
  baissesProposees,
  ingredientsManquants,
  libelleCourse,
  normaliser,
  POINTS_CUISINE,
  rayonDe,
  recettesLesPlusFaites,
  repasParSemaine,
  type Baisse,
  type IngredientCalcule,
} from "../cuisine-regles";
import { getDatabase } from "./client";
import { completer, getAujourdhui } from "./completions";
import { ajouterAliment, changerNiveau, lireRecette, listerAliments, recettesAvecIngredients } from "./cuisine";
import { LISTE_COURSES, listeSysteme } from "./listes-systeme";
import { rattraperProjets } from "./projets";
import { addPoints } from "./stats";

/**
 * Cuisine : la liste de courses (par rayon), le meal prep de la semaine et « J'ai cuisiné ».
 * Les achats des projets restent des tâches de la liste « Courses / achats » (la même que Cuisine) :
 * ils sont affichés ici dans une section « Projets » et se cochent des deux côtés.
 */

export type Course = { id: number; nom: string; rayon: string; cochee: number; source: string; aliment_id: number | null; cree_le: string; quantite: string };

// ─── Courses ────────────────────────────────────────────────────────────

export async function listerCourses(): Promise<Course[]> {
  const db = await getDatabase();
  return db.getAllAsync<Course>("SELECT * FROM courses ORDER BY cochee, nom COLLATE NOCASE");
}

/** Ajoute un article ; déjà sur la liste (même nom, pas encore coché) : rien n'est doublé. Renvoie l'identifiant. */
export async function ajouterCourse(d: { nom: string; source?: string; alimentId?: number | null; quantite?: string; rayon?: string }): Promise<number | null> {
  const nom = d.nom.trim();
  if (!nom) return null;
  const db = await getDatabase();
  const deja = (await listerCourses()).find((c) => !c.cochee && normaliser(c.nom) === normaliser(nom));
  if (deja) return deja.id;
  const r = await db.runAsync(
    "INSERT INTO courses (nom, rayon, source, aliment_id, quantite, cree_le) VALUES (?, ?, ?, ?, ?, ?)",
    nom,
    d.rayon ?? rayonDe(nom),
    d.source ?? "manuel",
    d.alimentId ?? null,
    d.quantite ?? "",
    new Date().toISOString(),
  );
  return r.lastInsertRowId;
}

export async function cocherCourse(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE courses SET cochee = 1 - cochee WHERE id = ?", id);
}

export async function retirerCourse(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM courses WHERE id = ?", id);
}

/** « Courses faites » : vide les articles cochés. Renvoie combien. */
export async function coursesFaites(): Promise<number> {
  const db = await getDatabase();
  const n = (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM courses WHERE cochee = 1"))?.n ?? 0;
  await db.runAsync("DELETE FROM courses WHERE cochee = 1");
  return n;
}

/** Un article acheté revient dans l'inventaire, « plein ». */
export async function remettreEnInventaire(courseId: number): Promise<void> {
  const db = await getDatabase();
  const c = await db.getFirstAsync<Course>("SELECT * FROM courses WHERE id = ?", courseId);
  if (!c) return;
  if (c.aliment_id && (await db.getFirstAsync("SELECT 1 FROM aliments WHERE id = ?", c.aliment_id))) await changerNiveau(c.aliment_id, "plein");
  else await ajouterAliment({ nom: c.nom, niveau: "plein" });
}

/** Un aliment « presque fini » (ou autre) part sur la liste de courses. */
export async function ajouterAlimentAuxCourses(alimentId: number): Promise<number | null> {
  const db = await getDatabase();
  const a = await db.getFirstAsync<{ nom: string }>("SELECT nom FROM aliments WHERE id = ?", alimentId);
  return a ? ajouterCourse({ nom: a.nom, source: "frigo", alimentId }) : null;
}

/** Les ingrédients qui manquent (d'une recette ou du meal prep) partent sur la liste. Renvoie combien d'articles ajoutés. */
export async function ajouterManquantsAuxCourses(manquants: IngredientCalcule[], source: "recette" | "meal_prep"): Promise<number> {
  let n = 0;
  const avant = (await listerCourses()).filter((c) => !c.cochee).length;
  for (const m of manquants) await ajouterCourse({ nom: m.aliment || m.nom, source, quantite: libelleCourse(m.quantite, m.unite) });
  n = (await listerCourses()).filter((c) => !c.cochee).length - avant;
  return n;
}

// ─── Achats des projets (liste « Courses / achats ») ────────────────────

export type AchatProjet = { id: number; nom: string };

export async function achatsDesProjets(): Promise<AchatProjet[]> {
  const db = await getDatabase();
  return db.getAllAsync<AchatProjet>("SELECT id, nom FROM items WHERE liste_id = ? AND statut = 'actif' AND type = 'tache' ORDER BY nom COLLATE NOCASE", await listeSysteme(LISTE_COURSES));
}

/** Acheté : la tâche est faite, et le matériel du projet passe à « j'ai ». */
export async function acheterPourProjet(itemId: number): Promise<void> {
  await completer(itemId, "complet");
  await rattraperProjets();
}

// ─── Meal prep de la semaine ────────────────────────────────────────────

export type LigneMealPrep = { id: number; recette_id: number; titre: string; portions: number };
export type MealPrep = { semaine: string; lignes: LigneMealPrep[]; jour_batch: string; routine_id: number | null };

export async function lireMealPrep(semaine: string): Promise<MealPrep> {
  const db = await getDatabase();
  const lignes = await db.getAllAsync<LigneMealPrep>("SELECT m.id, m.recette_id, r.titre, m.portions FROM meal_prep m JOIN recettes r ON r.id = m.recette_id WHERE m.semaine = ? ORDER BY m.id", semaine);
  const s = await db.getFirstAsync<{ jour_batch: string; routine_id: number | null }>("SELECT jour_batch, routine_id FROM meal_prep_semaines WHERE semaine = ?", semaine);
  return { semaine, lignes, jour_batch: s?.jour_batch ?? "", routine_id: s?.routine_id ?? null };
}

/** Choisit une recette pour la semaine (déjà choisie : ses portions sont mises à jour). */
export async function choisirPourMealPrep(semaine: string, recetteId: number, portions: number): Promise<void> {
  const db = await getDatabase();
  const p = Math.max(1, Math.round(portions));
  const deja = await db.getFirstAsync<{ id: number }>("SELECT id FROM meal_prep WHERE semaine = ? AND recette_id = ?", semaine, recetteId);
  if (deja) await db.runAsync("UPDATE meal_prep SET portions = ? WHERE id = ?", p, deja.id);
  else await db.runAsync("INSERT INTO meal_prep (semaine, recette_id, portions) VALUES (?, ?, ?)", semaine, recetteId, p);
}

export async function retirerDuMealPrep(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM meal_prep WHERE id = ?", id);
}

export async function changerPortionsMealPrep(id: number, portions: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE meal_prep SET portions = ? WHERE id = ?", Math.max(1, Math.round(portions)), id);
}

/** Le jour de batch cooking de la semaine (vide = aucun) et la routine qui lui est liée (facultative). */
export async function definirBatch(semaine: string, jour: string, routineId: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT OR REPLACE INTO meal_prep_semaines (semaine, jour_batch, routine_id) VALUES (?, ?, ?)", semaine, jour, routineId);
}

/** Les ingrédients de la semaine additionnés, et ce qui manque une fois retiré ce qui est dans l'inventaire. */
export async function calculerMealPrep(semaine: string): Promise<{ total: IngredientCalcule[]; manquants: IngredientCalcule[] }> {
  const prep = await lireMealPrep(semaine);
  const toutes = await recettesAvecIngredients();
  const total = additionnerIngredients(
    prep.lignes.flatMap((l) => {
      const r = toutes.find((x) => x.recette.id === l.recette_id);
      return r ? [{ ingredients: r.ingredients, portionsRecette: r.recette.portions, portionsVoulues: l.portions }] : [];
    }),
  );
  return { total, manquants: ingredientsManquants(total, await listerAliments()) };
}

/** Le reste à acheter part dans les courses. Renvoie combien d'articles ont été ajoutés. */
export async function mealPrepVersCourses(semaine: string): Promise<number> {
  return ajouterManquantsAuxCourses((await calculerMealPrep(semaine)).manquants, "meal_prep");
}

// ─── J'ai cuisiné ───────────────────────────────────────────────────────

/** Les baisses d'inventaire proposées pour cette recette (à confirmer une par une). */
export async function baissesDeLaRecette(recetteId: number): Promise<Baisse[]> {
  const r = await lireRecette(recetteId);
  return r ? baissesProposees(r.ingredients, await listerAliments()) : [];
}

/**
 * « J'ai cuisiné » : garde le repas (recette, jour, portions), applique les baisses confirmées à l'inventaire,
 * +5 points la première fois du jour. Renvoie les points donnés.
 */
export async function jAiCuisine(recetteId: number, portions: number, baisses: Baisse[]): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ titre: string }>("SELECT titre FROM recettes WHERE id = ?", recetteId);
  if (!r) return 0;
  const jour = await getAujourdhui();
  await db.runAsync("INSERT INTO cuisines (recette_id, titre, jour, portions, cree_le) VALUES (?, ?, ?, ?, ?)", recetteId, r.titre, jour, Math.max(1, portions), new Date().toISOString());
  for (const b of baisses) await changerNiveau(b.alimentId, b.vers);
  if (await db.getFirstAsync("SELECT 1 FROM cuisine_points_jours WHERE jour = ?", jour)) return 0;
  await db.runAsync("INSERT INTO cuisine_points_jours (jour) VALUES (?)", jour);
  await addPoints(POINTS_CUISINE);
  return POINTS_CUISINE;
}

// ─── Suivi › Progrès ────────────────────────────────────────────────────

export type SuiviCuisine = { semaines: { lundi: string; n: number }[]; total: number; top: { titre: string; n: number }[]; jetes: { nom: string; n: number }[]; finis: number };

export async function suiviCuisine(aujourdhui: string): Promise<SuiviCuisine> {
  const db = await getDatabase();
  const repas = await db.getAllAsync<{ jour: string; titre: string }>("SELECT jour, titre FROM cuisines");
  const semaines = repasParSemaine(repas.map((x) => x.jour), aujourdhui, 8);
  const retires = await db.getAllAsync<{ nom: string; raison: string }>("SELECT nom, raison FROM aliments_jetes");
  const jetes = new Map<string, number>();
  for (const a of retires.filter((x) => x.raison === "jete")) jetes.set(a.nom, (jetes.get(a.nom) ?? 0) + 1);
  return {
    semaines,
    total: semaines.reduce((s, x) => s + x.n, 0),
    top: recettesLesPlusFaites(repas.map((x) => x.titre)),
    jetes: [...jetes.entries()].map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom, "fr")).slice(0, 5),
    finis: retires.filter((x) => x.raison === "fini").length,
  };
}
