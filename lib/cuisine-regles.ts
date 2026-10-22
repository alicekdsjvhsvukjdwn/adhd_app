/**
 * Cuisine (vegan) sans accès à la base : testable seul (tests/cuisine.test.mjs).
 * Inventaire sans chiffres (3 niveaux), recettes avec portions, comparaison recette ↔ inventaire.
 */
import { CATALOGUE, type AlimentCatalogue } from "./cuisine-catalogue";

// ─── Inventaire ─────────────────────────────────────────────────────────

export type Niveau = "plein" | "peu" | "presque_fini";
export const NIVEAUX: { cle: Niveau; nom: string; jauge: number }[] = [
  { cle: "plein", nom: "Plein", jauge: 1 },
  { cle: "peu", nom: "Un peu", jauge: 0.5 },
  { cle: "presque_fini", nom: "Presque fini", jauge: 0.15 },
];
export const niveauValide = (n: string): Niveau => (NIVEAUX.some((x) => x.cle === n) ? (n as Niveau) : "plein");
export const jaugeDe = (n: string) => NIVEAUX.find((x) => x.cle === n)?.jauge ?? 1;

/** Passe d'un niveau au suivant (plein → un peu → presque fini) ; « presque fini » reste. */
export const baisser = (n: Niveau): Niveau => (n === "plein" ? "peu" : "presque_fini");

/** Minuscules sans accents ni ponctuation superflue : sert à comparer des noms. */
export const normaliser = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/['’]/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Le catalogue, filtré par ce que je tape (début de mot d'abord) ; 8 résultats au plus. */
export function rechercherCatalogue(q: string, deja: string[] = [], catalogue: AlimentCatalogue[] = CATALOGUE): AlimentCatalogue[] {
  const n = normaliser(q);
  if (!n) return [];
  const pris = new Set(deja.map(normaliser));
  const score = (a: AlimentCatalogue) => {
    const nom = normaliser(a.nom);
    if (nom.startsWith(n)) return 0;
    if (nom.split(" ").some((m) => m.startsWith(n))) return 1;
    return nom.includes(n) ? 2 : 9;
  };
  return catalogue
    .filter((a) => !pris.has(normaliser(a.nom)) && score(a) < 9)
    .sort((a, b) => score(a) - score(b) || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, 8);
}

export const nomDeCatalogue = (nom: string): AlimentCatalogue | undefined => CATALOGUE.find((a) => normaliser(a.nom) === normaliser(nom));

/** Jours avant une date AAAA-MM-JJ (négatif si passée), null si pas de date. */
export function joursAvant(date: string, aujourdhui: string): number | null {
  if (!date) return null;
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(aujourdhui + "T00:00:00Z")) / 86_400_000);
}

/** Alerte douce : « à utiliser vite » à 2 jours de la date ou moins, « passée » après, sans rien d'alarmant. */
export function alerteDate(date: string, aujourdhui: string): "vite" | "passee" | null {
  const j = joursAvant(date, aujourdhui);
  if (j === null) return null;
  if (j < 0) return "passee";
  return j <= 2 ? "vite" : null;
}

type AlimentInv = { nom: string; toujours_la: number };

/**
 * Même aliment ? Noms égaux une fois normalisés, ou tous les mots du plus court (au moins deux)
 * dans le plus long (« lentilles corail » dans « lentilles corail sèches »).
 */
export function memeAliment(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (!x || !y) return false;
  const singulier = (m: string) => m.replace(/s$/, "");
  if (x.split(" ").map(singulier).join(" ") === y.split(" ").map(singulier).join(" ")) return true;
  const [court, long] = x.length <= y.length ? [x, y] : [y, x];
  const motsLong = new Set(long.split(" ").map(singulier));
  const cm = court.split(" ");
  // Un seul mot, c'est trop vague (« pois » ≠ « pois chiches ») : il faut au moins deux mots en commun.
  return cm.length >= 2 && cm.every((m) => motsLong.has(singulier(m)));
}

// ─── Recettes ───────────────────────────────────────────────────────────

export type IngredientRecette = { id?: number; nom: string; quantite: number | null; unite: string; aliment: string };
export const TAGS_RECETTE = ["rapide", "batch", "petit-déj", "déjeuner", "dîner", "snack", "se congèle"] as const;
export const UNITES = ["", "g", "kg", "ml", "cl", "L", "c. à s.", "c. à c.", "pincée", "pièce", "boîte", "gousse", "tranche", "verre"] as const;

export const tagsDe = (s: string): string[] => s.split(",").map((t) => t.trim()).filter(Boolean);

/** Quantité recalculée pour un autre nombre de portions (null reste null : « une pincée », « à volonté »). */
export function quantitePourPortions(q: number | null, portionsRecette: number, portionsVoulues: number): number | null {
  if (q === null || portionsRecette <= 0) return q;
  return Math.round(((q * portionsVoulues) / portionsRecette) * 100) / 100;
}

const FRACTIONS: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"]];
/** « 1,5 », « ½ », « 2 ½ » : lisible en cuisine. */
export function libelleQuantite(q: number | null): string {
  if (q === null) return "";
  const entier = Math.floor(q + 1e-9);
  const reste = q - entier;
  const f = FRACTIONS.find(([v]) => Math.abs(reste - v) < 0.01);
  if (f) return entier > 0 ? `${entier} ${f[1]}` : f[1];
  return String(Math.round(q * 100) / 100).replace(".", ",");
}

export type Presence = { ingredient: IngredientRecette; present: boolean };

/** Chaque ingrédient est-il dans l'inventaire ? Un aliment « toujours là » (sel, huile…) est toujours présent s'il est dans la liste. */
export function presenceIngredients(ingredients: IngredientRecette[], inventaire: AlimentInv[]): Presence[] {
  return ingredients.map((ingredient) => ({
    ingredient,
    present: inventaire.some((a) => memeAliment(a.nom, ingredient.aliment || ingredient.nom) || (!!ingredient.aliment && memeAliment(a.nom, ingredient.nom))),
  }));
}

export type Faisabilite = { manque: IngredientRecette[]; total: number; niveau: "pret" | "presque" | "non" };

/** Prête (tout est là), presque (1 ou 2 ingrédients manquent), sinon non. */
export function faisabilite(ingredients: IngredientRecette[], inventaire: AlimentInv[]): Faisabilite {
  const manque = presenceIngredients(ingredients, inventaire).filter((p) => !p.present).map((p) => p.ingredient);
  return { manque, total: ingredients.length, niveau: manque.length === 0 ? "pret" : manque.length <= 2 ? "presque" : "non" };
}

// ─── Coller une recette ─────────────────────────────────────────────────

const FRAC_UNICODE: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const UNITES_RECONNUES: [RegExp, string][] = [
  [/^(kg|kilos?)\b/i, "kg"],
  [/^(g|gr|grammes?)\b/i, "g"],
  [/^(ml|millilitres?)\b/i, "ml"],
  [/^(cl|centilitres?)\b/i, "cl"],
  [/^(l|litres?)\b/i, "L"],
  [/^(c\.? ?à ?s\.?|cuill?[èe]res? à soupe|cas)(?=\s|\.|$)/i, "c. à s."],
  [/^(c\.? ?à ?c\.?|cuill?[èe]res? à caf[ée]|cac)(?=\s|\.|$)/i, "c. à c."],
  [/^pinc[ée]es?\b/i, "pincée"],
  [/^bo[iî]tes?\b/i, "boîte"],
  [/^gousses?\b/i, "gousse"],
  [/^tranches?\b/i, "tranche"],
  [/^verres?\b/i, "verre"],
];

/** « 200 g de lentilles corail », « 2 gousses d'ail », « 1/2 chou », « sel » → un ingrédient. */
export function decouperIngredient(ligne: string): IngredientRecette {
  let l = ligne.replace(/^[\s\-•*·–]+/, "").trim();
  let quantite: number | null = null;
  const m = l.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?|^([¼½¾⅓⅔])/);
  if (m) {
    if (m[3]) quantite = FRAC_UNICODE[m[3]];
    else if (m[2]) quantite = Number(m[1]) / Number(m[2]);
    else quantite = Number(m[1].replace(",", "."));
    l = l.slice(m[0].length).trim();
    const frac = l.match(/^([¼½¾])/);
    if (frac) {
      quantite += FRAC_UNICODE[frac[1]];
      l = l.slice(1).trim();
    }
  }
  let unite = "";
  for (const [re, u] of UNITES_RECONNUES) {
    const r = l.match(re);
    if (r) {
      unite = u;
      l = l.slice(r[0].length).replace(/^\.?\s*/, "");
      break;
    }
  }
  l = l.replace(/^(de |d'|d’|du |des )/i, "").trim();
  const nom = l.charAt(0).toUpperCase() + l.slice(1);
  const liee = CATALOGUE.find((a) => memeAliment(a.nom, nom));
  return { nom, quantite, unite, aliment: liee?.nom ?? "" };
}

export type RecetteDecoupee = { titre: string; ingredients: IngredientRecette[]; etapes: string[] };

/**
 * Découpe un texte collé : une ligne « Ingrédients » / « Préparation » change de partie ; sans titre de partie,
 * les lignes qui commencent par une quantité sont des ingrédients et les autres des étapes. La première ligne courte
 * sans point final est le titre. Au mieux : l'écran de vérification permet de tout corriger.
 */
export function decouperRecette(texte: string): RecetteDecoupee {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ingredients: IngredientRecette[] = [];
  const etapes: string[] = [];
  let titre = "";
  let partie: "?" | "ing" | "etapes" = "?";
  const debutQuantite = /^[\s\-•*·–]*(\d|[¼½¾⅓⅔])/;
  const numerotee = /^\s*\d+[.)]\s/;
  lignes.forEach((l, i) => {
    const sansDeuxPoints = l.replace(/\s*[:：]\s*$/, "");
    if (/^(ingr[ée]dients?)$/i.test(sansDeuxPoints)) {
      partie = "ing";
      return;
    }
    if (/^(pr[ée]paration|[ée]tapes?|instructions?|recette|m[ée]thode)$/i.test(sansDeuxPoints)) {
      partie = "etapes";
      return;
    }
    if (i === 0 && !debutQuantite.test(l) && l.length <= 80 && !/[.!]$/.test(l)) {
      titre = l.replace(/^#+\s*/, "");
      return;
    }
    const etape = l.replace(/^\s*(\d+[.)]|étape \d+\s*[:.-]?)\s*/i, "").trim();
    if (partie === "ing" || (partie === "?" && debutQuantite.test(l) && !numerotee.test(l))) ingredients.push(decouperIngredient(l));
    else etapes.push(etape);
  });
  return { titre, ingredients: ingredients.filter((i) => i.nom), etapes: etapes.filter(Boolean) };
}

/** Une durée devinée dans une étape (« cuire 10 minutes », « 1 h ») ; 0 si rien. */
export function minuteurDeLEtape(texte: string): number {
  const m = texte.match(/(\d+)(?:\s*à\s*(\d+))?\s*(min(?:ute)?s?|h(?:eures?)?)(?![a-zé])/i);
  if (!m) return 0;
  const n = Number(m[2] ?? m[1]); // « 8 à 10 minutes » : la durée haute
  return /^h/i.test(m[3]) ? n * 60 : n;
}

export const tempsTotalRecette = (prep: number, cuisson: number) => Math.max(0, prep) + Math.max(0, cuisson);
