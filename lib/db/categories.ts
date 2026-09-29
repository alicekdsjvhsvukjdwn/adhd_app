import { getFamille, type Categorie } from "../catalogue";
import { getDatabase } from "./client";

import { dateLocale, ilYA } from "../dates";

/** Date du jour, prise dans dates.ts pour ne pas importer completions.ts (cycle). */
const aujourdhui = () => dateLocale();

/**
 * Équilibre entre catégories.
 *
 * L'objectif n'est pas de tout faire, mais de toucher un peu à chaque
 * catégorie régulièrement. Une catégorie peu servie sur la fenêtre récente
 * fait remonter ses items ; une catégorie déjà bien couverte les fait
 * redescendre. Le calcul sert au moteur (composante) et à l'écran Progression.
 */

export const CATEGORIES: Categorie[] = [
  "sommeil",
  "mouvement",
  "organisation",
  "focus",
  "competences",
  "emotions",
];

/** Catégorie réelle d'un item : sa colonne, ou à défaut celle du catalogue. */
export function categorieEffective(
  categorie: string | null,
  templateId: string | null,
): Categorie | null {
  if (categorie && (CATEGORIES as string[]).includes(categorie)) {
    return categorie as Categorie;
  }
  if (templateId) {
    const famille = getFamille(templateId);
    if (famille) return famille.categorie;
  }
  return null;
}

/** Nombre de complétions par catégorie sur les `jours` derniers jours. */
export async function completionsParCategorie(
  jours = 7,
): Promise<Record<Categorie, number>> {
  const db = await getDatabase();
  const debut = ilYA(jours);

  const rows = await db.getAllAsync<{
    categorie: string | null;
    template_id: string | null;
    n: number;
  }>(
    `SELECT i.categorie, i.template_id, COUNT(*) AS n
     FROM completions c
     JOIN items i ON i.id = c.item_id
     WHERE c.date >= ? AND c.statut IN ('complet', 'partiel')
     GROUP BY i.categorie, i.template_id`,
    debut,
  );

  return agreger(rows);
}

/** Complétions par catégorie pour AUJOURD'HUI seulement (indicateur visuel). */
export async function completionsParCategorieJour(): Promise<
  Record<Categorie, number>
> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    categorie: string | null;
    template_id: string | null;
    n: number;
  }>(
    `SELECT i.categorie, i.template_id, COUNT(*) AS n
     FROM completions c
     JOIN items i ON i.id = c.item_id
     WHERE c.date = ? AND c.statut IN ('complet', 'partiel')
     GROUP BY i.categorie, i.template_id`,
    aujourdhui(),
  );

  return agreger(rows);
}

function agreger(
  rows: { categorie: string | null; template_id: string | null; n: number }[],
): Record<Categorie, number> {
  const acc: Record<Categorie, number> = {
    sommeil: 0,
    mouvement: 0,
    organisation: 0,
    focus: 0,
    competences: 0,
    emotions: 0,
  };
  for (const r of rows) {
    const cat = categorieEffective(r.categorie, r.template_id);
    if (cat) acc[cat] += r.n;
  }
  return acc;
}

/**
 * Score d'équilibre par catégorie, dans [0, 1].
 * 1 = catégorie délaissée (à remonter), 0 = catégorie sur-servie.
 * Neutre (0.5) pour une catégorie absente des items actifs ou une semaine vide.
 */
export async function equilibreParCategorie(
  jours = 7,
): Promise<Record<Categorie, number>> {
  const counts = await completionsParCategorie(jours);
  const db = await getDatabase();

  const actifs = await db.getAllAsync<{
    categorie: string | null;
    template_id: string | null;
  }>(
    `SELECT DISTINCT categorie, template_id FROM items
     WHERE statut = 'actif' AND type IN ('routine', 'tache')`,
  );
  const presentes = new Set<Categorie>();
  for (const a of actifs) {
    const c = categorieEffective(a.categorie, a.template_id);
    if (c) presentes.add(c);
  }

  const total = (Object.values(counts) as number[]).reduce((s, x) => s + x, 0);
  const partEquitable = presentes.size > 0 ? total / presentes.size : 0;

  const eq: Record<Categorie, number> = {
    sommeil: 0.5,
    mouvement: 0.5,
    organisation: 0.5,
    focus: 0.5,
    competences: 0.5,
    emotions: 0.5,
  };
  for (const c of CATEGORIES) {
    if (!presentes.has(c) || partEquitable <= 0) {
      eq[c] = 0.5;
      continue;
    }
    eq[c] = Math.max(0, Math.min(1, 1 - counts[c] / (2 * partEquitable)));
  }
  return eq;
}
