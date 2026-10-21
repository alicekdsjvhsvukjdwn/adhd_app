/**
 * Esprit (humeur, journal de pensées, TCC) sans accès à la base : testable seul
 * (tests/esprit.test.mjs). Aucun diagnostic ici : seulement ce que la personne note.
 */
import { decalerJours } from "./dates";
import { comparer, type Comparaison } from "./suivi-regles";

// ─── Humeur ─────────────────────────────────────────────────────────────

export const HUMEURS = [
  { niveau: 1, libelle: "Très bas", couleur: "#F87171" },
  { niveau: 2, libelle: "Bas", couleur: "#FB923C" },
  { niveau: 3, libelle: "Moyen", couleur: "#FACC15" },
  { niveau: 4, libelle: "Bien", couleur: "#4ADE80" },
  { niveau: 5, libelle: "Très bien", couleur: "#22D3EE" },
] as const;

export const couleurHumeur = (niveau: number) => HUMEURS[Math.min(5, Math.max(1, Math.round(niveau))) - 1].couleur;

export const EMOTIONS = [
  "calme",
  "joie",
  "fierté",
  "soulagement",
  "espoir",
  "fatigue",
  "ennui",
  "frustration",
  "anxiété",
  "tristesse",
  "colère",
  "honte",
  "culpabilité",
  "solitude",
  "submergée",
] as const;

export const MAX_EMOTIONS_HUMEUR = 3;

/** Les pièges de pensée proposés dans le journal (facultatifs). */
export const PIEGES = [
  "Tout ou rien",
  "Lecture de pensée",
  "Catastrophisme",
  "Généralisation",
  "« Je dois »",
  "Personnalisation",
  "Raisonnement émotionnel",
  "Filtre négatif",
  "Étiquetage",
] as const;

export type HumeurNotee = { id: number; jour: string; heure: string; niveau: number; emotions: string; note: string };

/** Liste d'émotions stockée « a,b,c » (virgule interdite dans une émotion). */
export const emotionsDe = (s: string | null | undefined): string[] => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
export const emotionsEnTexte = (l: string[]) => l.map((x) => x.replace(/,/g, " ").trim()).filter(Boolean).join(",");

/** Moyenne arrondie au dixième ; null s'il n'y a rien. */
export function moyenne(valeurs: number[]): number | null {
  return valeurs.length ? Math.round((valeurs.reduce((s, x) => s + x, 0) / valeurs.length) * 10) / 10 : null;
}

/** Une moyenne par jour de `jours` (null sans humeur ce jour-là) : les mini-barres de la semaine. */
export function moyennesParJour(humeurs: { jour: string; niveau: number }[], jours: string[]): { jour: string; moy: number | null }[] {
  return jours.map((jour) => ({ jour, moy: moyenne(humeurs.filter((h) => h.jour === jour).map((h) => h.niveau)) }));
}

/** Les n derniers jours jusqu'à `fin` (inclus), du plus ancien au plus récent. */
export const derniersJours = (fin: string, n: number) => Array.from({ length: n }, (_, i) => decalerJours(fin, i - (n - 1)));

/** Émotions les plus citées, par ordre décroissant puis alphabétique. */
export function emotionsFrequentes(listes: string[], n = 5): [string, number][] {
  const c = new Map<string, number>();
  for (const l of listes) for (const e of emotionsDe(l)) c.set(e, (c.get(e) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).slice(0, n);
}

/** Heure du jour pour la carte : le soir (à partir de 18 h), « Comment était ta journée ? ». */
export const estLeSoir = (heure: number) => heure >= 18;

// ─── Liens prudents avec le sommeil, le sport, les jours difficiles ─────

export type LienHumeur = { cle: string; libelle: string; resultat: Comparaison };

/**
 * Humeur moyenne du jour selon le sommeil de la nuit d'avant, le sport du jour et les jours
 * difficiles. Chaque comparaison attend 7 jours dans chaque groupe (voir comparer).
 */
export function liensHumeur(p: {
  humeurParJour: Record<string, number>;
  sommeilMinParJour: Record<string, number>;
  joursSport: Set<string>;
  joursDifficiles: Set<string>;
}): LienHumeur[] {
  const jours = Object.keys(p.humeurParJour);
  const val = (js: string[]) => js.map((j) => p.humeurParJour[j]);
  const nuitLongue = jours.filter((j) => (p.sommeilMinParJour[j] ?? -1) >= 420);
  const nuitCourte = jours.filter((j) => p.sommeilMinParJour[j] !== undefined && p.sommeilMinParJour[j] < 420);
  return [
    { cle: "sommeil", libelle: "Nuit de 7 h ou plus · moins de 7 h", resultat: comparer(val(nuitLongue), val(nuitCourte)) },
    {
      cle: "sport",
      libelle: "Jour avec sport · sans sport",
      resultat: comparer(val(jours.filter((j) => p.joursSport.has(j))), val(jours.filter((j) => !p.joursSport.has(j)))),
    },
    {
      cle: "difficile",
      libelle: "Jour normal · jour difficile",
      resultat: comparer(val(jours.filter((j) => !p.joursDifficiles.has(j))), val(jours.filter((j) => p.joursDifficiles.has(j)))),
    },
  ];
}

// ─── Séances de TCC et rappel ───────────────────────────────────────────

export type SeanceTcc = { id: number; date: string; heure: string };

/** La prochaine séance : la première dont le jour n'est pas passé. */
export function prochaineSeance<T extends { date: string }>(seances: T[], aujourdhui: string): T | null {
  return [...seances].filter((s) => s.date >= aujourdhui).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/** La dernière séance passée (jour strictement avant `avant`). */
export function derniereSeance<T extends { date: string }>(seances: T[], avant: string): T | null {
  return [...seances].filter((s) => s.date < avant).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

/** Heure du rappel de la veille. */
export const HEURE_RAPPEL_SEANCE = 18;

/**
 * Moment de la notification de la veille (heure locale de l'appareil), ou null si c'est déjà passé.
 * `maintenant` en paramètre pour les tests.
 */
export function rappelDeSeance(seance: { date: string }, maintenant: Date): Date | null {
  const [a, m, j] = decalerJours(seance.date, -1).split("-").map(Number);
  const d = new Date(a, m - 1, j, HEURE_RAPPEL_SEANCE, 0, 0);
  return d.getTime() > maintenant.getTime() ? d : null;
}

/** Texte à afficher dans l'appli la veille et le jour de la séance (le web n'a pas de notification locale). */
export function bandeauSeance(seance: SeanceTcc | null, aujourdhui: string): string | null {
  if (!seance) return null;
  if (seance.date === aujourdhui) return `Séance de TCC aujourd'hui à ${seance.heure}`;
  if (seance.date === decalerJours(aujourdhui, 1)) return `Séance de TCC demain à ${seance.heure}`;
  return null;
}

// ─── Exercices de la psy ────────────────────────────────────────────────

export type ExerciceTcc = {
  id: number;
  nom: string;
  consigne: string;
  /** 'jour' : chaque jour ; 'semaine' : freq_n fois par semaine. */
  freq_type: "jour" | "semaine";
  freq_n: number;
  /** '' | 'journal' | 'respiration' | 'meditation' */
  lien: string;
};

/** Pastilles de la semaine : combien visées, combien faites (jours de la semaine donnée). */
export function progressionExercice(ex: Pick<ExerciceTcc, "freq_type" | "freq_n">, faits: string[], semaine: string[]) {
  const cible = ex.freq_type === "jour" ? 7 : Math.min(7, Math.max(1, ex.freq_n));
  const faitsCetteSemaine = new Set(faits.filter((j) => semaine.includes(j))).size;
  return { cible, faits: Math.min(faitsCetteSemaine, 7) };
}
