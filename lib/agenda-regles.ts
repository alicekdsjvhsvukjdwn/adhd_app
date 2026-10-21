import type { Evenement } from "../push-worker/src/ics";

export type { Evenement };

/** Rendez-vous d'un jour : la journée entière d'abord, puis par heure. */
export function rdvDuJour(evenements: Evenement[], jour: string): Evenement[] {
  return evenements
    .filter((e) => e.jour === jour)
    .sort((a, b) => (a.debut ?? "").localeCompare(b.debut ?? ""));
}

/** Minutes de rendez-vous à heure fixe ce jour-là (une journée entière ne compte pas). */
export function chargeDuJour(evenements: Evenement[], jour: string): number {
  return evenements.filter((e) => e.jour === jour && !e.journee).reduce((s, e) => s + e.duree_min, 0);
}

/** Jours qui ont au moins un rendez-vous (pour le point de la bande des jours). */
export function joursAvecRdv(evenements: Evenement[]): Set<string> {
  return new Set(evenements.map((e) => e.jour));
}
