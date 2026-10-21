/**
 * Sport : arbre de skills de callisthénie. Catalogue et règles, sans accès
 * à la base : testable seul (tests/skills.test.mjs). Aucune autre partie
 * de l'appli (moteur, routines) ne lit le sport.
 *
 * Chaque étape est un exercice de la bibliothèque (lib/exercices.ts) avec un critère : les séries
 * notées dans n'importe quelle séance comptent pour l'étape, plus besoin de séance spéciale.
 */
import { exercice, faisable } from "./exercices";
import { MATERIEL_DEFAUT, manquants, type Materiel, type MaterielCle } from "./materiel";


export type Niveau = "fondation" | "intermediaire" | "avance";
export type Unite = "reps" | "s";

export type Etape = {
  nom: string;
  /** Id de l'exercice de la bibliothèque que l'étape fait travailler. */
  exercice: string;
  unite: Unite;
  series: number;
  /** Par série (répétitions ou secondes). */
  objectif: number;
  /** « par jambe » / « par bras ». */
  cote?: "jambe" | "bras";
  consignes: string[];
  /** Exercices qui aident à passer l'étape. */
  appuis: string[];
};

export type Skill = {
  id: string;
  nom: string;
  niveau: Niveau;
  /** Skills à maîtriser avant de commencer. */
  prerequis: string[];
  /** Matériel qu'il faut avoir pour travailler ce skill (barre de traction, parallettes…). */
  materiel?: MaterielCle[];
  etapes: Etape[];
};

export const NIVEAUX: { cle: Niveau; nom: string }[] = [
  { cle: "fondation", nom: "Fondations" },
  { cle: "intermediaire", nom: "Intermédiaire" },
  { cle: "avance", nom: "Avancé" },
];

const e = (
  nom: string,
  series: number,
  objectif: number,
  unite: Unite,
  exercice: string,
  consignes: string[],
  appuis: string[],
  cote?: "jambe" | "bras",
): Etape => ({ nom, exercice, series, objectif, unite, consignes, appuis, ...(cote ? { cote } : {}) });

export const SKILLS: Skill[] = [
  // ── Fondations ──
  {
    id: "pompe",
    nom: "Pompe",
    niveau: "fondation",
    prerequis: [],
    etapes: [
      e("Pompes au mur", 3, 12, "reps", "pompes_mur", ["Corps droit de la tête aux talons", "Coudes à 45°"], ["Planche 20 s"]),
      e("Pompes inclinées", 3, 12, "reps", "pompes_inclinees", ["Mains sur une table ou un banc", "Poitrine jusqu'au bord"], ["Pompes au mur lentes"]),
      e("Pompes sur les genoux", 3, 12, "reps", "pompes_genoux", ["Hanches alignées, pas de dos creux", "Descendre en 2 s"], ["Pompes inclinées", "Planche 30 s"]),
      e("Pompes", 3, 5, "reps", "pompes", ["Gainé, fesses serrées", "Poitrine à un poing du sol"], ["Pompes négatives 3 s", "Pompes sur les genoux"]),
      e("Pompes", 3, 10, "reps", "pompes", ["Amplitude complète", "Rythme régulier"], ["Pompes inclinées en fin de série"]),
    ],
  },
  {
    id: "traction",
    nom: "Traction",
    niveau: "fondation",
    prerequis: [],
    materiel: ["barre"],
    etapes: [
      e("Suspension passive", 3, 30, "s", "suspension_passive", ["Bras tendus, épaules relâchées", "Respirer calmement"], ["Serrer une serviette (grip)"]),
      e("Tractions scapulaires", 3, 10, "reps", "tractions_scapulaires", ["Bras tendus", "Abaisser les épaules, sans plier les coudes"], ["Suspension passive"]),
      e("Rowing australien", 3, 10, "reps", "rowing_table", ["Sous une barre basse ou une table", "Corps gainé, poitrine vers la barre"], ["Scapulaires"]),
      e("Tractions négatives 5 s", 3, 5, "reps", "tractions_negatives", ["Sauter en haut, menton au-dessus", "Descendre en 5 s"], ["Rowing australien"]),
      e("Tractions pieds au sol", 3, 6, "reps", "tractions_assistees", ["Pieds qui aident juste ce qu'il faut", "Menton au-dessus de la barre"], ["Négatives"]),
      e("1 traction stricte", 1, 1, "reps", "tractions", ["Partir bras tendus", "Pas d'élan"], ["Négatives", "Pieds au sol"]),
      e("Tractions", 3, 5, "reps", "tractions", ["Bras tendus en bas", "Menton au-dessus en haut"], ["Négatives en fin de séance"]),
    ],
  },
  {
    id: "dips",
    nom: "Dips",
    niveau: "fondation",
    prerequis: [],
    etapes: [
      e("Appui tenu", 3, 30, "s", "appui_tenu", ["Bras tendus entre deux chaises stables", "Épaules basses"], ["Pompes"]),
      e("Dips sur banc", 3, 12, "reps", "dips_banc", ["Mains derrière toi sur un banc", "Coudes vers l'arrière"], ["Appui tenu"]),
      e("Dips négatifs", 3, 5, "reps", "dips_negatifs", ["Descendre en 3 s", "Remonter avec les pieds"], ["Dips sur banc"]),
      e("Dips", 3, 5, "reps", "dips_parallettes", ["Aux parallettes, buste légèrement penché", "Épaules au niveau des coudes en bas"], ["Négatifs"]),
      e("Dips", 3, 10, "reps", "dips_parallettes", ["Amplitude complète", "Pas d'élan"], ["Dips sur banc en fin de série"]),
    ],
  },
  {
    id: "pistol",
    nom: "Pistol",
    niveau: "fondation",
    prerequis: [],
    etapes: [
      e("Squat", 3, 20, "reps", "squat", ["Talons au sol", "Genoux dans l'axe des pieds"], ["Squat tenu en bas 20 s"]),
      e("Fente", 3, 10, "reps", "fente", ["Grand pas", "Genou arrière près du sol"], ["Squat"], "jambe"),
      e("Squat bulgare", 3, 8, "reps", "squat_bulgare", ["Pied arrière sur une chaise", "Buste droit"], ["Fente"], "jambe"),
      e("Pistol sur boîte", 3, 5, "reps", "pistol_boite", ["S'asseoir sur une chaise sur une jambe", "Se relever sans élan"], ["Squat bulgare"], "jambe"),
      e("Pistol assisté", 3, 5, "reps", "pistol_assiste", ["Tenir un montant de porte", "Descendre en contrôle"], ["Pistol sur boîte"], "jambe"),
      e("Pistol", 3, 3, "reps", "pistol_squat", ["Jambe libre devant", "Bras devant pour l'équilibre"], ["Pistol assisté"], "jambe"),
    ],
  },
  {
    id: "gainage",
    nom: "Gainage",
    niveau: "fondation",
    prerequis: [],
    etapes: [
      e("Planche", 3, 60, "s", "planche", ["Coudes sous les épaules", "Fesses serrées, bassin neutre"], ["Planche sur les genoux"]),
      e("Hollow body hold", 3, 30, "s", "hollow", ["Bas du dos collé au sol", "Bras et jambes tendus, bas"], ["Hollow genoux pliés"]),
    ],
  },

  // ── Intermédiaire ──
  {
    id: "lsit",
    nom: "L-sit",
    niveau: "intermediaire",
    prerequis: ["gainage"],
    materiel: ["parallettes"],
    etapes: [
      e("Appui bras tendus", 3, 30, "s", "appui_parallettes", ["Sur tes parallettes", "Épaules basses"], ["Hollow hold"]),
      e("Tuck L-sit", 3, 15, "s", "tuck_lsit_parallettes", ["Genoux à la poitrine", "Pousser fort dans les mains"], ["Appui tenu"]),
      e("L-sit une jambe", 3, 10, "s", "lsit_une_jambe", ["Une jambe tendue, l'autre pliée", "Pointe de pied tirée"], ["Tuck L-sit"], "jambe"),
      e("L-sit", 3, 10, "s", "lsit_parallettes", ["Jambes tendues à l'horizontale", "Bras verrouillés"], ["L-sit une jambe"]),
    ],
  },
  {
    id: "poirier",
    nom: "Poirier",
    niveau: "intermediaire",
    prerequis: ["pompe"],
    etapes: [
      e("Pike push-ups", 3, 8, "reps", "pike_pushups", ["Hanches hautes", "Tête entre les mains en bas"], ["Pompes"]),
      e("Pieds au mur en L", 3, 30, "s", "poirier_pieds_mur_l", ["Mains à une jambe du mur", "Bras verrouillés"], ["Pike push-ups"]),
      e("Ventre au mur", 3, 30, "s", "poirier_mur", ["Mains à 10 cm du mur", "Corps aligné"], ["Pieds au mur en L"]),
      e("Montées contrôlées", 3, 5, "reps", "poirier_montees", ["Monter une jambe après l'autre", "Redescendre doucement"], ["Ventre au mur"]),
      e("Poirier libre", 1, 10, "s", "poirier_libre", ["Doigts qui corrigent l'équilibre", "Regard entre les mains"], ["Ventre au mur"]),
    ],
  },
  {
    id: "archer",
    nom: "Archer",
    niveau: "intermediaire",
    prerequis: ["pompe"],
    etapes: [
      e("Pompes larges", 3, 10, "reps", "pompes_larges", ["Mains bien plus larges que les épaules"], ["Pompes"]),
      e("Archer assistées", 3, 5, "reps", "archer_assistee", ["Bras tendu sur un ballon ou un livre", "Le bras plié travaille"], ["Pompes larges"], "bras"),
      e("Pompes archer", 3, 5, "reps", "pompes_archer", ["Un bras tendu sur le côté", "Descendre vers la main qui pousse"], ["Archer assistées"], "bras"),
    ],
  },
  {
    id: "pseudo",
    nom: "Pompes pseudo-planche",
    niveau: "intermediaire",
    prerequis: ["pompe"],
    etapes: [
      e("Pompes pieds surélevés", 3, 8, "reps", "pompes_pieds_sureleves", ["Pieds sur une chaise, corps en ligne", "Poitrine vers le sol sans cambrer"], ["Pompes"]),
      e("Planche lean", 3, 20, "s", "planche_lean", ["Épaules en avant des mains, bras tendus", "Dos rond, pousser dans le sol"], ["Pompes"]),
      e("Pompes pseudo-planche", 3, 5, "reps", "pompes_pseudo_planche", ["Mains près des hanches, doigts vers les pieds", "Épaules bien en avant des mains"], ["Planche lean"]),
      e("Pompes pseudo-planche", 3, 10, "reps", "pompes_pseudo_planche", ["Même position, amplitude complète", "Rythme régulier"], ["Planche lean en fin de série"]),
    ],
  },
  {
    id: "muscleup",
    nom: "Muscle-up",
    niveau: "intermediaire",
    prerequis: ["traction", "dips"],
    materiel: ["barre"],
    etapes: [
      e("Poitrine à la barre", 3, 5, "reps", "tractions_poitrine", ["Tirer jusqu'au sternum", "Coudes vers l'arrière"], ["Tractions"]),
      e("Tractions explosives", 3, 3, "reps", "tractions_explosives", ["Tirer vite et haut", "Descente contrôlée"], ["Poitrine à la barre"]),
      e("Transition barre basse", 3, 5, "reps", "transition_barre_basse", ["Pieds au sol, barre à la poitrine", "Passer les poignets au-dessus"], ["Dips"]),
      e("Muscle-up négatifs", 3, 3, "reps", "muscleup_negatif", ["Partir au-dessus de la barre", "Descendre lentement"], ["Dips", "Explosives"]),
      e("1 muscle-up", 1, 1, "reps", "muscleup", ["Tirer vers les hanches", "Basculer les poignets vite"], ["Négatifs"]),
    ],
  },

  // ── Avancé ──
  {
    id: "frontlever",
    nom: "Front lever",
    niveau: "avance",
    prerequis: ["traction", "gainage"],
    materiel: ["barre"],
    etapes: [
      e("Tuck front lever", 3, 10, "s", "tuck_frontlever", ["Genoux à la poitrine", "Bras tendus, dos parallèle au sol"], ["Hollow hold", "Tractions"]),
      e("Advanced tuck", 3, 10, "s", "adv_tuck_frontlever", ["Dos plat", "Genoux à 90°"], ["Tuck"]),
      e("Front lever une jambe", 3, 8, "s", "frontlever_une_jambe", ["Une jambe tendue", "Hanches hautes"], ["Advanced tuck"], "jambe"),
      e("Straddle", 3, 5, "s", "frontlever_straddle", ["Jambes écartées tendues", "Corps à l'horizontale"], ["Une jambe"]),
      e("Front lever", 1, 5, "s", "frontlever", ["Jambes serrées", "Tout le corps à l'horizontale"], ["Straddle"]),
    ],
  },
  {
    id: "planche",
    nom: "Planche",
    niveau: "avance",
    prerequis: ["pompe", "lsit"],
    materiel: ["parallettes"],
    etapes: [
      e("Planche lean", 3, 20, "s", "planche_lean", ["Épaules en avant des mains", "Bras tendus, dos rond"], ["Pompes"]),
      e("Tuck planche", 3, 10, "s", "tuck_planche_parallettes", ["Genoux contre les coudes", "Pieds décollés"], ["Planche lean"]),
      e("Advanced tuck", 3, 8, "s", "adv_tuck_planche", ["Dos plat", "Hanches au niveau des épaules"], ["Tuck planche"]),
      e("Straddle planche", 3, 5, "s", "planche_straddle", ["Jambes écartées tendues", "Corps à l'horizontale"], ["Advanced tuck"]),
    ],
  },
];

export const skill = (id: string) => SKILLS.find((s) => s.id === id);

/** Points (voir REGLES_POINTS), jamais deux fois pour la même étape ou le même skill. */
export const POINTS_ETAPE_SKILL = 20;
export const POINTS_MAITRISE = 50;
/** Skills travaillés en même temps. */
export const MAX_ACTIFS = 4;
/** Séries d'entretien des skills maîtrisés par séance (une chacun). */
export const MAX_ENTRETIEN = 2;
/** Séances réussies d'affilée avant de proposer de valider. */
export const SEANCES_POUR_VALIDER = 2;

/**
 * État d'un skill. `etape` : étape en cours, 1 = la première ;
 * nbEtapes + 1 = toutes validées (maîtrisé).
 */
export type EtatSkill = { etape: number; actif: boolean };

export const maitrise = (s: Skill, etat: EtatSkill | undefined) =>
  (etat?.etape ?? 1) > s.etapes.length;

/** Mon matériel, ou seulement « j'ai une barre de traction » (ancien réglage). */
const enMateriel = (m: Materiel | boolean): Materiel =>
  typeof m === "boolean" ? { ...MATERIEL_DEFAUT, dispo: { ...MATERIEL_DEFAUT.dispo, barre: m } } : m;

/**
 * Ce qui manque pour commencer : skills à maîtriser, matériel du skill. Vide = débloqué.
 * `barre` : la barre de traction manque (gardé pour l'écran du skill).
 */
export function manques(
  s: Skill,
  etats: Record<string, EtatSkill>,
  materiel: Materiel | boolean,
): { prerequis: string[]; barre: boolean; materiel: MaterielCle[] } {
  const absent = manquants(s.materiel ?? [], enMateriel(materiel));
  return {
    prerequis: s.prerequis.filter((p) => !maitrise(skill(p)!, etats[p])),
    barre: absent.includes("barre"),
    materiel: absent,
  };
}

/** L'exercice de l'étape, avec mon matériel : faisable ou non (l'alternative est proposée à l'écran). */
export const etapeFaisable = (et: Etape, materiel: Materiel | boolean): boolean => {
  const ex = exercice(et.exercice);
  return !!ex && faisable(ex, enMateriel(materiel));
};

export type Statut = "maitrise" | "en_cours" | "verrouille";

export function statut(s: Skill, etats: Record<string, EtatSkill>, materiel: Materiel | boolean): Statut {
  if (maitrise(s, etats[s.id])) return "maitrise";
  const m = manques(s, etats, materiel);
  return m.prerequis.length > 0 || m.materiel.length > 0 ? "verrouille" : "en_cours";
}

/** Toutes les séries demandées atteignent l'objectif. */
export function seanceReussie(realise: number[], et: Pick<Etape, "series" | "objectif">): boolean {
  return realise.length >= et.series && realise.slice(0, et.series).every((r) => r >= et.objectif);
}

/**
 * Proposer de valider l'étape ? `seances` : celles faites À CETTE ÉTAPE,
 * la plus récente d'abord (fin ISO, séries réalisées). Il faut 2 séances
 * réussies d'affilée, toutes deux après le dernier refus.
 */
export function proposerValidation(p: {
  seances: { fin: string; realise: number[] }[];
  etape: Pick<Etape, "series" | "objectif">;
  dernierRefus: string | null;
}): boolean {
  const recentes = p.seances.slice(0, SEANCES_POUR_VALIDER);
  if (recentes.length < SEANCES_POUR_VALIDER) return false;
  if (!recentes.every((s) => seanceReussie(s.realise, p.etape))) return false;
  return !(p.dernierRefus && recentes.some((s) => s.fin <= p.dernierRefus!));
}

/**
 * Points d'une validation de l'étape `n` (1 = la première) : +20 si cette
 * étape n'a jamais rapporté, +50 de plus si c'est la dernière et que le
 * skill n'a jamais été maîtrisé.
 */
export function pointsValidation(p: {
  n: number;
  nbEtapes: number;
  dejaValidees: number[];
  dejaMaitrise: boolean;
}): { etape: number; maitrise: number } {
  return {
    etape: p.dejaValidees.includes(p.n) ? 0 : POINTS_ETAPE_SKILL,
    maitrise: p.n === p.nbEtapes && !p.dejaMaitrise ? POINTS_MAITRISE : 0,
  };
}

/** Segments de la carte de l'étape : un par série, rempli si l'objectif a été atteint la dernière fois. */
export const seriesAtteintes = (derniere: number[], et: Pick<Etape, "series" | "objectif">) =>
  Array.from({ length: et.series }, (_, i) => (derniere[i] ?? 0) >= et.objectif);

/** « Encore 2 répétitions par série », « Encore 5 secondes »… d'après la dernière séance. */
export function phraseMotivante(derniere: number[] | null, et: Etape): string {
  if (!derniere || derniere.length === 0) return "Première séance à cette étape : vas-y doucement.";
  const unite = (n: number) =>
    et.unite === "s" ? `seconde${n > 1 ? "s" : ""}` : `répétition${n > 1 ? "s" : ""}`;
  const faites = derniere.slice(0, et.series);
  const manque = Math.max(0, ...faites.map((r) => et.objectif - r));
  const seriesManquantes = et.series - faites.length;
  if (manque === 0 && seriesManquantes === 0) return "Objectif atteint : encore une séance comme ça.";
  if (manque === 0)
    return `Encore ${seriesManquantes} série${seriesManquantes > 1 ? "s" : ""} au même niveau.`;
  return et.series > 1
    ? `Encore ${manque} ${unite(manque)} par série`
    : `Encore ${manque} ${unite(manque)}`;
}

/** « 3 × 12 », « 3 × 30 s », « 3 × 8 / jambe », « 10 s ». */
export function critere(et: Etape): string {
  const v = `${et.objectif}${et.unite === "s" ? " s" : ""}`;
  const cote = et.cote ? ` / ${et.cote}` : "";
  return et.series > 1 ? `${et.series} × ${v}${cote}` : `${v}${cote}`;
}

/**
 * Séries d'entretien : parmi les skills maîtrisés, les MAX_ENTRETIEN
 * travaillés le moins récemment (jamais = en premier), à tour de rôle.
 */
export function choisirEntretien(maitrises: { id: string; dernier: string | null }[]): string[] {
  return [...maitrises]
    .sort((a, b) => (a.dernier ?? "").localeCompare(b.dernier ?? "") || a.id.localeCompare(b.id))
    .slice(0, MAX_ENTRETIEN)
    .map((m) => m.id);
}

/** Premier lancement : « je ne sais pas » = étape 1, sinon l'étape choisie (bornée). */
export const etapeDepart = (s: Skill, choix: number | "inconnu") =>
  choix === "inconnu" ? 1 : Math.max(1, Math.min(s.etapes.length + 1, choix));
