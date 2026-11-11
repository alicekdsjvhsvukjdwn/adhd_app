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
} as const;
