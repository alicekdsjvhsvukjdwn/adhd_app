import { CATALOGUE, type Categorie, type Emplacement } from "../cuisine-catalogue";
import { memeAliment, minuteurDeLEtape, niveauValide, type IngredientRecette, type Niveau } from "../cuisine-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Cuisine : l'inventaire (frigo, congélateur, placard, épices) et mes recettes.
 * Les photos de recettes sont gardées dans la base (data URI compressée par lib/photos.ts).
 */

export type Aliment = {
  id: number;
  nom: string;
  emplacement: Emplacement;
  categorie: Categorie;
  niveau: Niveau;
  peremption: string;
  ouvert_le: string;
  toujours_la: number;
  cree_le: string;
};

const maintenant = () => new Date().toISOString();

// ─── Inventaire ─────────────────────────────────────────────────────────

export async function listerAliments(): Promise<Aliment[]> {
  const db = await getDatabase();
  return db.getAllAsync<Aliment>("SELECT * FROM aliments ORDER BY nom COLLATE NOCASE");
}

/**
 * Ajoute un aliment (le catalogue donne sa catégorie et son emplacement s'ils ne sont pas précisés).
 * Déjà dans l'inventaire : il redevient « plein » au lieu d'être doublé. Renvoie son identifiant.
 */
export async function ajouterAliment(d: { nom: string; emplacement?: Emplacement; categorie?: Categorie; niveau?: Niveau; peremption?: string; toujours_la?: boolean }): Promise<number | null> {
  const nom = d.nom.trim();
  if (!nom) return null;
  const db = await getDatabase();
  const existant = (await listerAliments()).find((a) => memeAliment(a.nom, nom) && a.nom.toLowerCase() === nom.toLowerCase());
  if (existant) {
    await db.runAsync("UPDATE aliments SET niveau = ? WHERE id = ?", d.niveau ?? "plein", existant.id);
    return existant.id;
  }
  const cat = CATALOGUE.find((a) => a.nom.toLowerCase() === nom.toLowerCase());
  const r = await db.runAsync(
    "INSERT INTO aliments (nom, emplacement, categorie, niveau, peremption, toujours_la, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
    cat?.nom ?? nom,
    d.emplacement ?? cat?.emplacement ?? "placard",
    d.categorie ?? cat?.categorie ?? "conserves",
    niveauValide(d.niveau ?? "plein"),
    d.peremption ?? "",
    d.toujours_la ? 1 : 0,
    maintenant(),
  );
  return r.lastInsertRowId;
}

export async function modifierAliment(id: number, d: { nom: string; emplacement: Emplacement; categorie: Categorie; peremption: string }): Promise<void> {
  const nom = d.nom.trim();
  if (!nom) return;
  const db = await getDatabase();
  await db.runAsync("UPDATE aliments SET nom = ?, emplacement = ?, categorie = ?, peremption = ? WHERE id = ?", nom, d.emplacement, d.categorie, d.peremption, id);
}

export async function changerNiveau(id: number, niveau: Niveau): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE aliments SET niveau = ? WHERE id = ?", niveauValide(niveau), id);
}

export async function basculerToujoursLa(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE aliments SET toujours_la = 1 - toujours_la WHERE id = ?", id);
}

/** « jeté » et « fini » sont comptés dans le suivi ; « supprime » (je me suis trompée) ne laisse aucune trace. */
export async function retirerAliment(id: number, raison: "jete" | "fini" | "supprime"): Promise<void> {
  const db = await getDatabase();
  const a = await db.getFirstAsync<{ nom: string }>("SELECT nom FROM aliments WHERE id = ?", id);
  if (!a) return;
  if (raison !== "supprime") await db.runAsync("INSERT INTO aliments_jetes (nom, jour, raison) VALUES (?, ?, ?)", a.nom, await getAujourdhui(), raison);
  await db.runAsync("DELETE FROM aliments WHERE id = ?", id);
}

// ─── Recettes ───────────────────────────────────────────────────────────

export type Recette = {
  id: number;
  titre: string;
  photo: string;
  portions: number;
  prep_min: number;
  cuisson_min: number;
  tags: string;
  notes: string;
  favori: number;
  depart: number;
  cree_le: string;
  maj_le: string;
};
export type EtapeRecette = { id?: number; texte: string; minuteur_min: number };
export type RecetteComplete = { recette: Recette; ingredients: IngredientRecette[]; etapes: EtapeRecette[] };

export async function listerRecettes(): Promise<Recette[]> {
  const db = await getDatabase();
  return db.getAllAsync<Recette>("SELECT * FROM recettes ORDER BY favori DESC, titre COLLATE NOCASE");
}

/** Toutes les recettes avec leurs ingrédients (pour « Avec ce que j'ai » et le meal prep). */
export async function recettesAvecIngredients(): Promise<{ recette: Recette; ingredients: IngredientRecette[] }[]> {
  const db = await getDatabase();
  const recettes = await listerRecettes();
  const ings = await db.getAllAsync<IngredientRecette & { recette_id: number }>("SELECT id, recette_id, nom, quantite, unite, aliment FROM recette_ingredients ORDER BY recette_id, ordre, id");
  return recettes.map((recette) => ({ recette, ingredients: ings.filter((i) => i.recette_id === recette.id) }));
}

export async function lireRecette(id: number): Promise<RecetteComplete | null> {
  const db = await getDatabase();
  const recette = await db.getFirstAsync<Recette>("SELECT * FROM recettes WHERE id = ?", id);
  if (!recette) return null;
  return {
    recette,
    ingredients: await db.getAllAsync<IngredientRecette>("SELECT id, nom, quantite, unite, aliment FROM recette_ingredients WHERE recette_id = ? ORDER BY ordre, id", id),
    etapes: await db.getAllAsync<EtapeRecette>("SELECT id, texte, minuteur_min FROM recette_etapes WHERE recette_id = ? ORDER BY ordre, id", id),
  };
}

export type SaisieRecette = {
  id?: number;
  titre: string;
  photo: string;
  portions: number;
  prep_min: number;
  cuisson_min: number;
  tags: string;
  notes: string;
  ingredients: IngredientRecette[];
  etapes: { texte: string; minuteur_min?: number }[];
};

/** Crée ou remplace une recette complète (ingrédients et étapes vides ignorés, minuteur deviné s'il n'est pas donné). Renvoie son identifiant. */
export async function enregistrerRecette(d: SaisieRecette): Promise<number | null> {
  const titre = d.titre.trim();
  if (!titre) return null;
  const db = await getDatabase();
  const t = maintenant();
  const portions = Math.max(1, Math.round(d.portions) || 1);
  let id = d.id ?? null;
  if (id === null) {
    id = (await db.runAsync("INSERT INTO recettes (titre, photo, portions, prep_min, cuisson_min, tags, notes, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", titre, d.photo, portions, Math.max(0, d.prep_min), Math.max(0, d.cuisson_min), d.tags, d.notes, t, t)).lastInsertRowId;
  } else {
    await db.runAsync("UPDATE recettes SET titre = ?, photo = ?, portions = ?, prep_min = ?, cuisson_min = ?, tags = ?, notes = ?, maj_le = ? WHERE id = ?", titre, d.photo, portions, Math.max(0, d.prep_min), Math.max(0, d.cuisson_min), d.tags, d.notes, t, id);
    await db.runAsync("DELETE FROM recette_ingredients WHERE recette_id = ?", id);
    await db.runAsync("DELETE FROM recette_etapes WHERE recette_id = ?", id);
  }
  let ordre = 0;
  for (const i of d.ingredients.filter((x) => x.nom.trim())) {
    await db.runAsync("INSERT INTO recette_ingredients (recette_id, ordre, nom, quantite, unite, aliment) VALUES (?, ?, ?, ?, ?, ?)", id, ordre++, i.nom.trim(), i.quantite, i.unite, i.aliment);
  }
  ordre = 0;
  for (const e of d.etapes.filter((x) => x.texte.trim())) {
    await db.runAsync("INSERT INTO recette_etapes (recette_id, ordre, texte, minuteur_min) VALUES (?, ?, ?, ?)", id, ordre++, e.texte.trim(), e.minuteur_min ?? minuteurDeLEtape(e.texte));
  }
  return id;
}

export async function dupliquerRecette(id: number): Promise<number | null> {
  const r = await lireRecette(id);
  if (!r) return null;
  return enregistrerRecette({ ...r.recette, id: undefined, titre: `${r.recette.titre} (copie)`, ingredients: r.ingredients, etapes: r.etapes });
}

export async function basculerFavori(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE recettes SET favori = 1 - favori WHERE id = ?", id);
}

export async function supprimerRecette(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM recette_ingredients WHERE recette_id = ?", id);
  await db.runAsync("DELETE FROM recette_etapes WHERE recette_id = ?", id);
  await db.runAsync("DELETE FROM meal_prep WHERE recette_id = ?", id);
  await db.runAsync("DELETE FROM recettes WHERE id = ?", id);
}
