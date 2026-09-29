import { FAMILLES_COMPETENCES } from "./familles/competences";
import { FAMILLES_CORPS } from "./familles/corps";
import { FAMILLES_DEMARRER } from "./familles/demarrer";
import { FAMILLES_EMOTIONS } from "./familles/emotions";
import { FAMILLES_FOCUS } from "./familles/focus";
import { FAMILLES_MOUVEMENT } from "./familles/mouvement";
import { FAMILLES_ORGANISATION } from "./familles/organisation";
import { FAMILLES_QUOTIDIEN } from "./familles/quotidien";
import { FAMILLES_SOMMEIL } from "./familles/sommeil";
import { FAMILLES_TEMPS } from "./familles/temps";
import type { Categorie, FamilleTemplate, VarianteTemplate } from "./types";

export * from "./types";

/**
 * Le catalogue vit en TypeScript, pas en base : versionné avec le code,
 * typé, et pas de migration quand une famille s'ajoute.
 * Seuls `template_id` et `variante_rang` sont stockés sur l'item.
 */
export const CATALOGUE: FamilleTemplate[] = [
  ...FAMILLES_SOMMEIL,
  ...FAMILLES_MOUVEMENT,
  ...FAMILLES_CORPS,
  ...FAMILLES_ORGANISATION,
  ...FAMILLES_TEMPS,
  ...FAMILLES_QUOTIDIEN,
  ...FAMILLES_FOCUS,
  ...FAMILLES_DEMARRER,
  ...FAMILLES_EMOTIONS,
  ...FAMILLES_COMPETENCES,
];

export function getFamille(id: string): FamilleTemplate | undefined {
  return CATALOGUE.find((f) => f.id === id);
}

export function getVariante(
  templateId: string,
  rang: number,
): VarianteTemplate | undefined {
  return getFamille(templateId)?.variantes.find((v) => v.rang === rang);
}

export function famillesParCategorie(categorie: Categorie): FamilleTemplate[] {
  return CATALOGUE.filter((f) => f.categorie === categorie);
}

/** Liste dédupliquée des formulations de problèmes, pour l'écran d'entrée. */
export function tousLesProblemes(): string[] {
  return [...new Set(CATALOGUE.flatMap((f) => f.problemes))];
}

export const LIBELLES_CATEGORIES: Record<Categorie, string> = {
  sommeil: "Sommeil et réveil",
  mouvement: "Corps et santé",
  organisation: "Organisation du quotidien",
  focus: "Concentration et démarrage",
  // Pas encore de familles au catalogue : sert aux tâches et routines libres.
  competences: "Compétences et pratiques",
  emotions: "Émotions et charge mentale",
};

/**
 * Regroupe les problèmes par catégorie. Un problème est rattaché à la
 * catégorie de la première famille qui le mentionne.
 */
export function problemesParCategorie(): {
  categorie: Categorie;
  problemes: string[];
}[] {
  const vus = new Set<string>();
  const groupes = new Map<Categorie, string[]>();

  for (const f of CATALOGUE) {
    for (const p of f.problemes) {
      if (vus.has(p)) continue;
      vus.add(p);
      const liste = groupes.get(f.categorie) ?? [];
      liste.push(p);
      groupes.set(f.categorie, liste);
    }
  }

  return (Object.keys(LIBELLES_CATEGORIES) as Categorie[])
    .filter((c) => groupes.has(c))
    .map((c) => ({ categorie: c, problemes: groupes.get(c)! }));
}

export function famillesPourProbleme(probleme: string): FamilleTemplate[] {
  return CATALOGUE.filter((f) => f.problemes.includes(probleme));
}

const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Recherche locale sur nom, mots-clés, problèmes et libellés de variantes.
 * Accessible dès le premier jour : le catalogue n'est jamais verrouillé,
 * seulement non proposé spontanément.
 */
export function rechercher(requete: string): FamilleTemplate[] {
  const q = normaliser(requete).trim();
  if (q.length < 2) return [];

  const termes = q.split(/\s+/);

  return CATALOGUE.map((f) => {
    const corpus = normaliser(
      [
        f.nom,
        ...f.mots_cles,
        ...f.problemes,
        ...f.variantes.map((v) => v.libelle),
      ].join(" "),
    );
    const score = termes.filter((t) => corpus.includes(t)).length;
    return { famille: f, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.famille);
}

/**
 * Classification d'une routine créée librement : correspondance locale
 * par mots-clés. Premier recours avant les trois questions, avant le LLM.
 * Une métadonnée manquante dégrade le score, elle ne le bloque jamais.
 */
export function deviner(nomLibre: string): FamilleTemplate | null {
  const resultats = rechercher(nomLibre);
  return resultats[0] ?? null;
}

/**
 * Familles proposables à l'onboarding : palier 0, prérequis satisfaits.
 * On en montre trois, jamais le catalogue complet.
 */
export function famillesOnboarding(
  categoriesPrioritaires: Categorie[],
): FamilleTemplate[] {
  return CATALOGUE.filter(
    (f) =>
      f.palier_devoilement === 0 &&
      f.prerequis.length === 0 &&
      categoriesPrioritaires.includes(f.categorie),
  );
}
