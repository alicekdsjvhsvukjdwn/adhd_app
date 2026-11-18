/**
 * « Ma journée » se remplit toute seule : ce que je fais ailleurs dans l'appli devient une entrée 'auto'.
 * Règles pures, sans accès à la base : testables seules (tests/journal-auto.test.mjs).
 * Les entrées auto se déduisent des données (lib/db/journal-auto.ts) : annuler l'action d'origine les retire.
 */
import { momentDeHeureJournee, motsCles, type CleZone, type MomentJournee } from "./journee-regles";

export type SourceAuto = "routine" | "sport" | "menage" | "cuisine" | "tcc" | "meditation" | "humeur" | "projet" | "recompense" | "tache";

export const SOURCES: { cle: SourceAuto; libelle: string }[] = [
  { cle: "routine", libelle: "Routines" },
  { cle: "sport", libelle: "Sport" },
  { cle: "menage", libelle: "Ménage" },
  { cle: "cuisine", libelle: "Cuisine" },
  { cle: "tcc", libelle: "TCC" },
  { cle: "meditation", libelle: "Méditation" },
  { cle: "humeur", libelle: "Humeur" },
  { cle: "projet", libelle: "Projets" },
  { cle: "recompense", libelle: "Récompenses" },
  { cle: "tache", libelle: "Tâches" },
];
export const libelleSource = (s: string | null) => SOURCES.find((x) => x.cle === s)?.libelle ?? "";

/** Un lien source (ou domaine) → zone. null = pas d'entrée. Les tâches suivent la zone de leur liste (Mes listes). */
export type Lien = { cle: string; source: SourceAuto; libelle: string; zone: CleZone | null };

export const LIENS_DEFAUT: Lien[] = [
  { cle: "routine:mouvement", source: "routine", libelle: "Routines · Mouvement", zone: "bras" },
  { cle: "routine:organisation", source: "routine", libelle: "Routines · Organisation", zone: "mains" },
  { cle: "routine:emotions", source: "routine", libelle: "Routines · Émotions", zone: "ventre" },
  { cle: "routine:sommeil", source: "routine", libelle: "Routines · Sommeil", zone: "ventre" },
  { cle: "routine:focus", source: "routine", libelle: "Routines · Focus", zone: "tete" },
  { cle: "routine:competences", source: "routine", libelle: "Routines · Compétences", zone: "tete" },
  { cle: "routine:autres", source: "routine", libelle: "Routines sans domaine", zone: null },
  { cle: "sport:seance", source: "sport", libelle: "Séance de sport", zone: "bras" },
  { cle: "sport:skill", source: "sport", libelle: "Essai de skill", zone: "bras" },
  { cle: "menage", source: "menage", libelle: "Ménage d'une pièce", zone: "mains" },
  { cle: "cuisine:recette", source: "cuisine", libelle: "Recette cuisinée", zone: "mains" },
  { cle: "cuisine:mealprep", source: "cuisine", libelle: "Meal prep", zone: "mains" },
  { cle: "cuisine:courses", source: "cuisine", libelle: "Courses faites", zone: "mains" },
  { cle: "tcc", source: "tcc", libelle: "Exercice TCC", zone: "ventre" },
  { cle: "meditation", source: "meditation", libelle: "Méditation", zone: "ventre" },
  { cle: "humeur", source: "humeur", libelle: "Journal d'humeur", zone: "ventre" },
  { cle: "projet", source: "projet", libelle: "Étape d'un projet", zone: "pieds" },
  { cle: "recompense:mer", source: "recompense", libelle: "Récompense · Mer & dehors", zone: "jambes" },
  { cle: "recompense:bouffe", source: "recompense", libelle: "Récompense · Bouffe & sorties", zone: "jambes" },
  { cle: "recompense:temps", source: "recompense", libelle: "Récompense · Temps pour moi", zone: "ventre" },
  { cle: "recompense:decouvertes", source: "recompense", libelle: "Récompense · Découvertes", zone: "pieds" },
  { cle: "recompense:gros", source: "recompense", libelle: "Récompense · Gros objectifs", zone: "ventre" },
];

/** meta 'liens_auto' : les zones changées et les sources coupées. */
export const CLE_LIENS = "liens_auto";
export type Liens = { zones: Record<string, CleZone | null>; off: SourceAuto[] };

export function lireLiens(json: string | null): Liens {
  const defaut = Object.fromEntries(LIENS_DEFAUT.map((l) => [l.cle, l.zone]));
  try {
    const l = JSON.parse(json ?? "{}");
    return { zones: { ...defaut, ...(l.zones ?? {}) }, off: Array.isArray(l.off) ? l.off : [] };
  } catch {
    return { zones: defaut, off: [] };
  }
}

/** Ce qu'une source dit d'un jour : une entrée voulue. `lien` absent = tâche, `zone` donnée directement. */
export type Voulue = {
  source: SourceAuto;
  source_id: string;
  lien?: string;
  zone?: CleZone | null;
  texte: string;
  duree_min?: number | null;
  ressenti?: number | null;
  /** Heure locale de l'action, si elle est connue (pour le moment). */
  heure?: number | null;
};

/** La zone d'une entrée voulue d'après les liens ; null = rien à créer (source coupée, lien sans zone). */
export function zoneDe(v: Voulue, liens: Liens): CleZone | null {
  if (liens.off.includes(v.source)) return null;
  if (v.lien === undefined) return v.zone ?? null;
  return liens.zones[v.lien] ?? null;
}

export type Existante = {
  id: number;
  source: string | null;
  source_id: string | null;
  texte: string;
  duree_min: number | null;
  ressenti: number | null;
  texte_perso: number;
};

/**
 * Ce qu'il faut changer pour que les entrées auto d'un jour suivent les données :
 * ajouter les nouvelles, mettre à jour le texte (sauf s'il a été réécrit) et les détails connus,
 * supprimer celles dont l'action d'origine a disparu. Une entrée masquée reste masquée (elle est dans `existantes`).
 */
export function difference(voulues: (Voulue & { zone: CleZone })[], existantes: Existante[]) {
  const cle = (s: string | null, id: string | null) => `${s}|${id}`;
  const parCle = new Map(existantes.map((e) => [cle(e.source, e.source_id), e]));
  const vues = new Set<string>();
  const ajouter: (Voulue & { zone: CleZone })[] = [];
  const maj: { id: number; texte: string; duree_min: number | null; ressenti: number | null }[] = [];
  for (const v of voulues) {
    const k = cle(v.source, v.source_id);
    if (vues.has(k)) continue;
    vues.add(k);
    const e = parCle.get(k);
    if (!e) {
      ajouter.push(v);
      continue;
    }
    // Un détail inconnu de la source ne remplace pas celui que j'ai noté.
    const texte = e.texte_perso ? e.texte : v.texte;
    const duree = v.duree_min ?? e.duree_min;
    const ressenti = v.ressenti ?? e.ressenti;
    if (texte !== e.texte || duree !== e.duree_min || ressenti !== e.ressenti) maj.push({ id: e.id, texte, duree_min: duree, ressenti });
  }
  const supprimer = existantes.filter((e) => !vues.has(cle(e.source, e.source_id))).map((e) => e.id);
  return { ajouter, maj, supprimer };
}

// ─── Routines : une entrée par moment (et par zone) ─────────────────────

const NOM_MOMENT_ROUTINES: Record<MomentJournee, string> = { matin: "du matin", midi: "de midi", apres_midi: "de l'après-midi", soir: "du soir" };

/** Moment d'une routine : réveil compte pour le matin, coucher pour le soir ; sans moment, l'heure de la coche. */
export function momentDeRoutine(moment: string | null, heure: number | null): MomentJournee | null {
  if (moment === "reveil" || moment === "matin") return "matin";
  if (moment === "midi" || moment === "apres_midi" || moment === "soir") return moment;
  if (moment === "coucher") return "soir";
  return heure == null ? null : momentDeHeureJournee(heure);
}

const DOMAINES = ["mouvement", "organisation", "emotions", "sommeil", "focus", "competences"];

/**
 * Les routines prévues du jour → une entrée par moment et par zone, seulement si au moins une est faite :
 * « Routines du matin · 4/5 ». Deux domaines liés à des zones différentes donnent deux entrées.
 */
export function regrouperRoutines(
  routines: { categorie: string | null; moment: string | null; heure: number | null; fait: boolean }[],
  liens: Liens,
): (Voulue & { moment: MomentJournee })[] {
  if (liens.off.includes("routine")) return [];
  const groupes = new Map<string, { moment: MomentJournee; zone: CleZone; faites: number; total: number; heure: number | null }>();
  for (const r of routines) {
    const lien = `routine:${DOMAINES.includes(r.categorie ?? "") ? r.categorie : "autres"}`;
    const zone = liens.zones[lien] ?? null;
    const moment = momentDeRoutine(r.moment, r.fait ? r.heure : null);
    if (!zone || !moment) continue;
    const k = `${moment}:${zone}`;
    const g = groupes.get(k) ?? { moment, zone, faites: 0, total: 0, heure: null };
    g.total++;
    if (r.fait) {
      g.faites++;
      g.heure = r.heure;
    }
    groupes.set(k, g);
  }
  return [...groupes.entries()]
    .filter(([, g]) => g.faites > 0)
    .map(([k, g]) => ({
      source: "routine" as const,
      source_id: k,
      zone: g.zone,
      texte: `Routines ${NOM_MOMENT_ROUTINES[g.moment]} · ${g.faites}/${g.total}`,
      moment: g.moment,
      heure: g.heure,
    }));
}

/** Moment d'une nouvelle entrée auto : celui de l'action, sinon l'heure actuelle aujourd'hui, sinon le soir. */
export function momentAuto(heure: number | null | undefined, jour: string, aujourdhui: string, maintenant: number): MomentJournee {
  if (heure != null) return momentDeHeureJournee(heure);
  return jour === aujourdhui ? momentDeHeureJournee(maintenant) : "soir";
}

/** Heure locale d'un horodatage ISO ; null s'il est vide ou illisible. */
export function heureDe(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.getHours();
}

// ─── Pas de doublon : fusionner une note avec une entrée auto ───────────

/**
 * L'entrée auto du jour qui ressemble à ce que je viens d'écrire : même zone, et un mot clé commun
 * avec son texte ou le nom de sa source (« sport », « ménage », « méditation »…). null sinon.
 */
export function autoRessemblante<T extends { id: number; zone: string; texte: string; source: string | null }>(
  texte: string,
  zone: string,
  autos: T[],
): T | null {
  const mots = new Set(motsCles(texte));
  if (!mots.size) return null;
  let meilleure: { e: T; n: number } | null = null;
  for (const e of autos) {
    if (e.zone !== zone) continue;
    const n = motsCles(`${libelleSource(e.source)} ${e.texte}`).filter((m) => mots.has(m)).length;
    if (n > 0 && (!meilleure || n > meilleure.n)) meilleure = { e, n };
  }
  return meilleure?.e ?? null;
}
