/**
 * Séances de sport construites sur la bibliothèque d'exercices (lib/exercices.ts) : « Mes séances »,
 * séances proposées par zone et durée, records, résumé de fin de séance. Chaque ligne = un exercice,
 * des séries, une cible (répétitions ou secondes), un poids éventuel et un repos.
 * Sans accès à la base : testable seul (tests/seances-sport.test.mjs).
 */
import { EXERCICES, exercice, faisable, type Exercice } from "./exercices";
import type { Materiel } from "./materiel";

export type LigneSeance = {
  exercice: string;
  series: number;
  /** Par série : répétitions ou secondes selon l'exercice. */
  cible: number;
  /** Poids prévu (kg), pour les exercices avec poids ; null sinon. */
  poids: number | null;
  repos_s: number;
};

export type SeanceSport = { nom: string; lignes: LigneSeance[] };

// ─── Valeurs de départ d'une ligne ──────────────────────────────────────

const CIBLE_REPS = [15, 12, 10, 8, 6] as const;
const CIBLE_SECONDES = [30, 30, 25, 20, 15] as const;

/** Cible de départ d'un exercice selon son niveau (modifiable ensuite). */
export function cibleParDefaut(e: Exercice): number {
  if (e.mode === "reps_poids") return 10;
  if (e.mode === "s") return e.zones.includes("mobilite") ? 40 : CIBLE_SECONDES[e.niveau - 1];
  return CIBLE_REPS[e.niveau - 1];
}

export function reposParDefaut(e: Exercice): number {
  if (e.zones.includes("mobilite")) return e.mode === "s" ? 10 : 20; // mobilité : on enchaîne
  return e.mode === "s" ? 30 : 45;
}

/** Une ligne prête à l'emploi pour un exercice de la bibliothèque. */
export function ligneParDefaut(id: string, m?: Materiel): LigneSeance {
  const e = exercice(id)!;
  const poids = e.mode === "reps_poids" && m && m.poids.length > 0 ? m.poids[Math.floor((m.poids.length - 1) / 2)] : null;
  return { exercice: id, series: e.zones.includes("mobilite") && e.mode === "s" ? 2 : 3, cible: cibleParDefaut(e), poids, repos_s: reposParDefaut(e) };
}

/** Secondes d'effort d'une série (3 s par répétition, 5 s de mise en place). */
const effort = (e: Exercice, cible: number) => (e.mode === "s" ? cible : cible * 3 + 5);

/** Durée estimée d'une séance, repos compris, en secondes. */
export function dureeEstimee(lignes: LigneSeance[]): number {
  return lignes.reduce((s, l) => {
    const e = exercice(l.exercice);
    return s + (e ? l.series * (effort(e, l.cible) + l.repos_s) : 0);
  }, 0);
}

export const minutesDe = (s: number) => Math.max(1, Math.round(s / 60));

// ─── Séances proposées ──────────────────────────────────────────────────

export type ZoneProposee = "haut" | "bas" | "abdos" | "mobilite" | "complet";

export const ZONES_PROPOSEES: { cle: ZoneProposee; nom: string; couleur: string }[] = [
  { cle: "haut", nom: "Haut du corps", couleur: "#60A5FA" },
  { cle: "bas", nom: "Bas du corps", couleur: "#FB923C" },
  { cle: "abdos", nom: "Abdos & gainage", couleur: "#FACC15" },
  { cle: "mobilite", nom: "Mobilité", couleur: "#4ADE80" },
  { cle: "complet", nom: "Corps complet", couleur: "#A78BFA" },
];

export const DUREES_PROPOSEES = [10, 20, 30, 45] as const;
export type DureeProposee = (typeof DUREES_PROPOSEES)[number];

const SERIES: Record<DureeProposee, number> = { 10: 2, 20: 3, 30: 3, 45: 4 };

/** Les proches du niveau 2 d'abord, puis par id : un point de départ accessible, toujours le même. */
const parProximite = (a: Exercice, b: Exercice) => Math.abs(a.niveau - 2) - Math.abs(b.niveau - 2) || a.id.localeCompare(b.id);

const tourner = <T,>(l: T[], n: number): T[] => (l.length === 0 ? l : [...l.slice(n % l.length), ...l.slice(0, n % l.length)]);

/**
 * Une séance pour une zone et une durée, avec ce que mon matériel permet (rien de grisé).
 * `graine` change les exercices proposés (« Une autre ») sans rien de hasardeux : mêmes entrées, même séance.
 * Corps complet : haut, bas et abdos à tour de rôle.
 */
export function proposerSeance(zone: ZoneProposee, minutes: DureeProposee, m: Materiel, graine = 0): SeanceSport {
  const dispo = (z: Exercice["zones"][number]) => EXERCICES.filter((e) => e.zones.includes(z) && faisable(e, m) && e.niveau <= 4).sort(parProximite);
  const files =
    zone === "complet"
      ? [dispo("haut"), dispo("bas"), dispo("abdos")].map((l) => tourner(l, graine * 2))
      : [tourner(dispo(zone), graine * 3)];
  const ordre: Exercice[] = [];
  for (let i = 0; files.some((f) => i < f.length); i++) for (const f of files) if (i < f.length && !ordre.includes(f[i])) ordre.push(f[i]);

  const cibleDuree = minutes * 60;
  const lignes: LigneSeance[] = [];
  let total = 0;
  for (const e of ordre) {
    const l = { ...ligneParDefaut(e.id, m), series: e.zones.includes("mobilite") && e.mode === "s" ? Math.min(2, SERIES[minutes]) : SERIES[minutes] };
    const duree = dureeEstimee([l]);
    if (lignes.length >= 3 && total + duree > cibleDuree * 1.1) continue;
    lignes.push(l);
    total += duree;
    if (total >= cibleDuree * 0.95) break;
  }
  // Pas assez d'exercices pour remplir la durée : une série de plus partout, jusqu'à 5.
  while (total < cibleDuree * 0.85 && lignes.some((l) => l.series < 5)) {
    for (const l of lignes) {
      if (total >= cibleDuree * 0.95 || l.series >= 5) continue;
      l.series += 1;
      total = dureeEstimee(lignes);
    }
  }
  const nom = ZONES_PROPOSEES.find((z) => z.cle === zone)!.nom;
  return { nom: `${nom} · ${minutes} min`, lignes };
}

// ─── Records et résumé ──────────────────────────────────────────────────

export type Perf = { realise: number; poids: number | null };

/** `a` fait mieux que `b` : plus lourd, ou à poids égal plus de répétitions ou de secondes. */
export const faitMieux = (a: Perf, b: Perf): boolean => {
  const pa = a.poids ?? 0;
  const pb = b.poids ?? 0;
  return pa > pb || (pa === pb && a.realise > b.realise);
};

export function meilleurePerf(perfs: Perf[]): Perf | null {
  return perfs.reduce<Perf | null>((m, p) => (m === null || faitMieux(p, m) ? p : m), null);
}

/** Un record : mieux que tout ce qui avait été noté avant. La première fois n'en est pas un. */
export const nouveauRecord = (anciennes: Perf[], p: Perf): boolean => {
  const m = meilleurePerf(anciennes);
  return m !== null && faitMieux(p, m);
};

export type SerieFaite = { exercice: string; numero: number; realise: number; poids: number | null };

export type ResumeExercice = {
  exercice: string;
  /** Séries prévues et faites. */
  prevues: number;
  faites: number;
  /** Total prévu et fait (répétitions ou secondes). */
  totalPrevu: number;
  totalFait: number;
  record: boolean;
};

/** Fait contre prévu, exercice par exercice, dans l'ordre de la séance. `records` : les exercices où un record est tombé. */
export function resumeSeance(prevu: LigneSeance[], faites: SerieFaite[], records: string[] = []): { exercices: ResumeExercice[]; completion: number } {
  const exercices = prevu.map((l) => {
    const siennes = faites.filter((s) => s.exercice === l.exercice);
    return {
      exercice: l.exercice,
      prevues: l.series,
      faites: siennes.length,
      totalPrevu: l.series * l.cible,
      totalFait: siennes.reduce((s, x) => s + x.realise, 0),
      record: records.includes(l.exercice),
    };
  });
  const prevues = exercices.reduce((s, e) => s + e.prevues, 0);
  const faitesN = exercices.reduce((s, e) => s + Math.min(e.faites, e.prevues), 0);
  return { exercices, completion: prevues === 0 ? 0 : faitesN / prevues };
}

// ─── Valeurs de saisie ──────────────────────────────────────────────────

/** Pastilles rapides pour la valeur d'une série : autour de la cible, sans dépasser. */
export function pastillesRapides(cible: number): number[] {
  const pas = cible >= 40 ? 10 : cible >= 20 ? 5 : cible >= 10 ? 2 : 1;
  return [...new Set([cible - 2 * pas, cible - pas, cible, cible + pas].filter((v) => v > 0))];
}

/** Pas du − / + : 5 s pour les temps longs, 1 sinon. */
export const pasDeSaisie = (mode: Exercice["mode"], cible: number): number => (mode === "s" && cible >= 20 ? 5 : 1);
