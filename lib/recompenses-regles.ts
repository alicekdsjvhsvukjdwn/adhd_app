/**
 * Récompenses rangées par catégorie, sans accès à la base : testable seul
 * (tests/recompenses.test.mjs).
 */

export const CATEGORIES_RECOMPENSES = [
  { cle: "mer", nom: "Mer & dehors", couleur: "#22D3EE" },
  { cle: "bouffe", nom: "Bouffe & sorties", couleur: "#FB923C" },
  { cle: "temps", nom: "Temps pour moi", couleur: "#A78BFA" },
  { cle: "decouvertes", nom: "Activités & découvertes", couleur: "#FACC15" },
  { cle: "gros", nom: "Gros objectifs", couleur: "#60A5FA" },
] as const;

export type CategorieRecompense = (typeof CATEGORIES_RECOMPENSES)[number]["cle"];

/** Une clé inconnue (ancienne version, sauvegarde) tombe dans « Temps pour moi ». */
export const categorieRecompense = (cle: string) =>
  CATEGORIES_RECOMPENSES.find((c) => c.cle === cle) ?? CATEGORIES_RECOMPENSES[2];

/** La liste unique de l'écran Récompenses : de la moins chère à la plus chère, puis par nom. */
export const parPrix = <R extends { prix: number; nom: string }>(liste: R[]): R[] =>
  [...liste].sort((a, b) => a.prix - b.prix || a.nom.localeCompare(b.nom, "fr"));

/** Carte allumée : le solde suffit. Sinon, part de la barre (0 à 1). */
export function etatRecompense(prix: number, solde: number): { accessible: boolean; part: number } {
  return { accessible: prix <= solde, part: Math.min(1, Math.max(0, solde / Math.max(1, prix))) };
}

/** Icônes au trait (clés stockées dans recompenses.icone ; un emoji ancien reste tel quel). */
export const ICONES_RECOMPENSES = [
  "cafe",
  "ecran",
  "gateau",
  "ticket",
  "musique",
  "montagne",
  "casque",
  "vinyle",
  "clavier",
  "lit",
  "livre",
  "cadeau",
  "etoile",
  "avion",
  "manette",
  "vague",
  "soleil",
  "glace",
  "couverts",
  "lune",
  "musee",
  "carte",
  "bateau",
  "film",
  "bain",
  "sandwich",
  "palette",
  "ville",
] as const;

export type IconeRecompense = (typeof ICONES_RECOMPENSES)[number];

// ─── Page Récompenses repensée ──────────────────────────────────────────

type R = { id: number; nom: string; prix: number; categorie: string };

/** L'icône au trait de chaque étagère. */
export const ICONE_CATEGORIE: Record<CategorieRecompense, IconeRecompense> = {
  mer: "vague",
  bouffe: "couverts",
  temps: "lune",
  decouvertes: "carte",
  gros: "etoile",
};

/** Les étagères : une par catégorie qui a des récompenses, dans l'ordre fixe, chacune de la moins chère à la plus chère. */
export function etageres<T extends R>(liste: T[]) {
  return CATEGORIES_RECOMPENSES.map((c) => ({ ...c, recompenses: parPrix(liste.filter((r) => categorieRecompense(r.categorie).cle === c.cle)) })).filter(
    (e) => e.recompenses.length > 0,
  );
}

/**
 * Carte « Mon objectif » : la part atteinte, ce qui manque et une estimation en jours
 * d'après la moyenne de points par jour (null = pas assez de données : rien n'est affiché).
 */
export function progressionObjectif(prix: number, solde: number, moyenneParJour: number | null) {
  const reste = Math.max(0, prix - solde);
  const part = Math.min(1, Math.max(0, solde / Math.max(1, prix)));
  return {
    part,
    pourcent: Math.floor(part * 100),
    reste,
    atteint: reste === 0,
    jours: reste > 0 && moyenneParJour && moyenneParJour > 0 ? Math.ceil(reste / moyenneParJour) : null,
  };
}

/**
 * L'objectif le plus proche (carte 6 du récap) : celui que j'ai choisi, sinon la récompense pas encore
 * accessible la moins chère, sinon (tout est accessible) la plus chère. null sans récompense.
 */
export function objectifProche<T extends R>(liste: T[], solde: number, objectifId: number | null): { recompense: T; manque: number } | null {
  const choisi = liste.find((r) => r.id === objectifId);
  const pasEncore = parPrix(liste.filter((r) => r.prix > solde));
  const r = choisi ?? pasEncore[0] ?? parPrix(liste)[liste.length - 1];
  return r ? { recompense: r, manque: Math.max(0, r.prix - solde) } : null;
}

/** « Piocher une petite récompense » : seuil par défaut, et 3 pioches par jour (la première + 2 repioches). */
export const SEUIL_PIOCHE_DEFAUT = 60;
export const PIOCHES_PAR_JOUR = 3;

/** Une récompense disponible (prix ≤ solde) et petite (prix ≤ seuil), au hasard ; si possible pas `sauf`. */
export function piocher<T extends R>(liste: T[], solde: number, seuil: number, sauf: number | null = null, hasard = Math.random): T | null {
  const possibles = liste.filter((r) => r.prix <= seuil && r.prix <= solde);
  const autres = possibles.filter((r) => r.id !== sauf);
  const parmi = autres.length ? autres : possibles;
  return parmi.length ? parmi[Math.min(parmi.length - 1, Math.floor(hasard() * parmi.length))] : null;
}

/** Une zone « très remplie » cette semaine : au moins ce nombre d'entrées. */
export const SEUIL_ZONE_REMPLIE = 10;
const COTE: Record<string, string> = { tete: "travail", coeur: "relations", bras: "sport", mains: "maison", jambes: "sorties", pieds: "projets" };

/**
 * Une seule suggestion : si une zone (hors soin de soi) a été très remplie cette semaine, une récompense
 * « Temps pour moi » en tête de vitrine (la moins chère accessible, sinon la moins chère).
 */
export function suggestionRepos<T extends R>(comptes: Record<string, number>, liste: T[], solde: number): { recompense: T; message: string } | null {
  const [zone, n] = Object.entries(comptes)
    .filter(([z]) => COTE[z])
    .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (!zone || n < SEUIL_ZONE_REMPLIE) return null;
  const repos = parPrix(liste.filter((r) => categorieRecompense(r.categorie).cle === "temps"));
  const r = repos.find((x) => x.prix <= solde) ?? repos[0];
  return r ? { recompense: r, message: `Tu as beaucoup donné côté ${COTE[zone]} cette semaine` } : null;
}

/** Prix proposés à l'ajout d'une récompense. */
export const PRIX_SUGGERES = [40, 60, 100, 150, 300];
