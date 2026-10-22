/**
 * Projets créatifs (Arduino, peinture, artisanat…), sans accès à la base : testable seul (tests/projets.test.mjs).
 * Un projet a des étapes (une seule profondeur de sous-étapes), un journal de bord, du matériel, des notes et des liens.
 */

// ─── États et types ─────────────────────────────────────────────────────

export type EtatProjet = "idee" | "en_cours" | "en_pause" | "fini";

export const ETATS_PROJET: { cle: EtatProjet; nom: string }[] = [
  { cle: "en_cours", nom: "En cours" },
  { cle: "idee", nom: "Idée" },
  { cle: "en_pause", nom: "En pause" },
  { cle: "fini", nom: "Fini" },
];

export const etatValide = (e: string): EtatProjet => (ETATS_PROJET.some((x) => x.cle === e) ? (e as EtatProjet) : "idee");
export const nomEtat = (e: string) => ETATS_PROJET.find((x) => x.cle === e)?.nom ?? "Idée";

/** Types de départ : icône au trait (clé de ICONES_TYPES) et couleur. */
export const TYPES_DEFAUT: { nom: string; icone: string; couleur: string }[] = [
  { nom: "Électronique / Arduino", icone: "cpu", couleur: "#22D3EE" },
  { nom: "Peinture & dessin", icone: "palette", couleur: "#F472B6" },
  { nom: "Artisanat", icone: "scissors", couleur: "#FB923C" },
  { nom: "Musique", icone: "music", couleur: "#A78BFA" },
  { nom: "Autre", icone: "sparkles", couleur: "#4ADE80" },
];

/** Icônes proposées pour un type personnel. */
export const CLES_ICONES_TYPES = ["cpu", "palette", "scissors", "music", "sparkles", "hammer", "brush", "camera", "pen", "gem", "lightbulb", "leaf"] as const;
export type CleIconeType = (typeof CLES_ICONES_TYPES)[number];

/** Couleurs proposées pour un type personnel. */
export const COULEURS_TYPES = ["#22D3EE", "#F472B6", "#FB923C", "#A78BFA", "#4ADE80", "#FACC15", "#60A5FA", "#F87171"] as const;

export const iconeValide = (i: string): CleIconeType => ((CLES_ICONES_TYPES as readonly string[]).includes(i) ? (i as CleIconeType) : "sparkles");
export const couleurValide = (c: string): string => ((COULEURS_TYPES as readonly string[]).includes(c) ? c : COULEURS_TYPES[4]);

// ─── Étapes ─────────────────────────────────────────────────────────────

export type EtapeProjet = { id: number; parent_id: number | null; nom: string; ordre: number; faite: number };

/**
 * Les étapes qui comptent : une étape découpée en sous-étapes ne compte pas elle-même, ses sous-étapes oui
 * (elle se coche quand elles le sont toutes).
 */
export function etapesFeuilles(etapes: EtapeProjet[]): EtapeProjet[] {
  const parents = new Set(etapes.filter((e) => e.parent_id !== null).map((e) => e.parent_id));
  return etapes.filter((e) => !parents.has(e.id));
}

/** Étapes faites sur le total, et la jauge (0 à 1). Un projet sans étape a une jauge à 0. */
export function avancement(etapes: EtapeProjet[]): { faites: number; total: number; jauge: number } {
  const f = etapesFeuilles(etapes);
  const faites = f.filter((e) => e.faite === 1).length;
  return { faites, total: f.length, jauge: f.length === 0 ? 0 : faites / f.length };
}

/** Une étape est faite quand elle l'est, ou quand toutes ses sous-étapes le sont. */
export function estFaite(etapes: EtapeProjet[], id: number): boolean {
  const enfants = etapes.filter((e) => e.parent_id === id);
  if (enfants.length > 0) return enfants.every((e) => e.faite === 1);
  return etapes.find((e) => e.id === id)?.faite === 1;
}

const parOrdre = (a: EtapeProjet, b: EtapeProjet) => a.ordre - b.ordre || a.id - b.id;

/** Les étapes dans l'ordre d'affichage : chaque étape suivie de ses sous-étapes. */
export function etapesOrdonnees(etapes: EtapeProjet[]): (EtapeProjet & { niveau: 0 | 1 })[] {
  return etapes
    .filter((e) => e.parent_id === null)
    .sort(parOrdre)
    .flatMap((e) => [{ ...e, niveau: 0 as const }, ...etapes.filter((x) => x.parent_id === e.id).sort(parOrdre).map((x) => ({ ...x, niveau: 1 as const }))]);
}

/** La prochaine étape à faire : la première, dans l'ordre, qui n'est pas faite (au niveau des sous-étapes s'il y en a). */
export function prochaineEtape(etapes: EtapeProjet[]): EtapeProjet | null {
  const feuilles = new Set(etapesFeuilles(etapes).map((e) => e.id));
  return etapesOrdonnees(etapes).find((e) => feuilles.has(e.id) && e.faite === 0) ?? null;
}

/** « Terminer » est proposé quand toutes les étapes sont faites (et qu'il y en a). */
export const toutEstFait = (etapes: EtapeProjet[]): boolean => {
  const a = avancement(etapes);
  return a.total > 0 && a.faites === a.total;
};

/** Première ligne non vide d'un texte : les étapes d'un nouveau projet se saisissent une par ligne. */
export const lignesDe = (texte: string): string[] => texte.split(/\r?\n/).map((l) => l.replace(/^[\s\-•*·]+/, "").trim()).filter((l) => l !== "");

// ─── Galerie ────────────────────────────────────────────────────────────

export type ResumeProjet = { id: number; nom: string; etat: EtatProjet; type_id: number; maj_le: string };

const RANG_ETAT: Record<EtatProjet, number> = { en_cours: 0, idee: 1, en_pause: 2, fini: 3 };

/** « En cours » d'abord, puis les idées, les pauses, les finis ; le plus récemment touché en premier. */
export function trierProjets<T extends ResumeProjet>(projets: T[]): T[] {
  return [...projets].sort((a, b) => RANG_ETAT[a.etat] - RANG_ETAT[b.etat] || b.maj_le.localeCompare(a.maj_le) || b.id - a.id);
}

/** Filtres en pastilles : un état et/ou un type. Les finis vivent dans « Mes réalisations » sauf si on filtre sur « Fini ». */
export function filtrerProjets<T extends ResumeProjet>(projets: T[], f: { etat?: EtatProjet | null; type?: number | null }): T[] {
  return trierProjets(projets).filter((p) => (f.etat ? p.etat === f.etat : p.etat !== "fini") && (!f.type || p.type_id === f.type));
}

// ─── Temps ──────────────────────────────────────────────────────────────

export const tempsTotal = (journal: { minutes: number }[]): number => journal.reduce((s, j) => s + Math.max(0, j.minutes), 0);

/** « 45 min », « 2 h », « 2 h 30 » */
export function libelleDuree(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h} h` : `${h} h ${String(m % 60).padStart(2, "0")}`;
}

// ─── Photos du journal ──────────────────────────────────────────────────

/** « Avant → maintenant » : la première et la dernière photo du journal, dans l'ordre des entrées. */
export function avantMaintenant<T>(photos: T[]): { avant: T; maintenant: T } | null {
  return photos.length >= 2 ? { avant: photos[0], maintenant: photos[photos.length - 1] } : null;
}

/** Les liens saisis sans https:// sont complétés ; une adresse vide ou sans point est refusée (null). */
export function urlValide(brut: string): string | null {
  const u = brut.trim();
  if (!u || /\s/.test(u)) return null;
  const complete = /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : `https://${u}`;
  return /^https?:\/\/[^./]+\.[^/]+/i.test(complete) ? complete : null;
}
