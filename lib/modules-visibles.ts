/**
 * Modules affichés dans l'appli. `false` = accès retirés (onglets, tuiles, boutons, entrées de Profil) ;
 * le code, les écrans et les tables restent : remettre `true` suffit pour tout retrouver.
 */
export const MODULES = {
  /** Suivi › Esprit : humeur, bilan du dimanche, pensées, journal, TCC, séance avec moi, méditer, vision. */
  esprit: false,
  /** Suivi › Progrès (et la route cachée progression). */
  progres: false,
  /** Moments repères (ancres). */
  ancres: false,
  /** « Je commence » (minuteur). */
  jeCommence: false,
  /** Carnet / historique d'une tâche. */
  carnet: false,
  /** Projets créatifs (vue « Projets » de Tâches). */
  projets: false,
  /** Cuisine › Frigo et placards (l'inventaire). */
  frigo: false,
  /** Énergie du jour « En forme » (troisième niveau, sans effet). `false` = 2 niveaux : Jour difficile / Normal. */
  energieEnForme: false,

  // ── Sport : tout passe par « Mes séances » (lien vidéo, exercices) et les Skills ──
  /** Sport › Skills : l'arbre, les étapes, les essais. */
  sportSkills: true,
  /** Sport › Plan (6 semaines, tests de niveau, bilans) et la « séance du plan » dans Workout. */
  sportPlan: false,
  /** Sport › Workout : les séances proposées par zone et par durée. */
  sportSeancesProposees: false,
  /** Sport › Workout : Réveil du corps (la routine du matin au minuteur). */
  sportReveil: false,
  /** Séance faite ailleurs (zones, durée, source) et « Récentes ». `false` : « J'ai fait une séance » ne propose que Mes séances. */
  sportSeanceAilleurs: false,
} as const;
