/**
 * Dates « de calendrier » (YYYY-MM-DD), toujours en heure locale.
 *
 * toISOString() donne l'heure UTC : en France, la journée basculait donc
 * à 2 h du matin l'été (1 h l'hiver) au lieu de minuit. Toute date de jour
 * passe par ce fichier. Les instants précis (horodatages) restent en ISO UTC.
 */

/** Date du calendrier local pour un instant donné. */
export function dateLocale(d: Date = new Date()): string {
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Décale une date de calendrier de n jours.
 * Calcul fait en UTC sur la chaîne elle-même : aucun fuseau ni changement
 * d'heure ne peut décaler le résultat.
 */
export function decalerJours(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

/** Le jour de l'appli d'il y a n jours. */
export function ilYA(n: number): string {
  return decalerJours(jourLogique(), -n);
}

/**
 * Jour de création d'un item, en date locale.
 * cree_le est un horodatage ISO UTC (« …T…Z ») ; les items migrés depuis
 * l'ancienne base ont un format SQLite (« YYYY-MM-DD HH:MM:SS ») : on garde
 * alors simplement la date.
 */
export function jourDeCreation(creeLe: string): string {
  if (creeLe.includes("T")) {
    const d = new Date(creeLe);
    if (!isNaN(d.getTime())) return dateLocale(d);
  }
  return creeLe.slice(0, 10);
}

/** Heure à laquelle commence la journée de l'appli (réglable dans Profil, 4 à 8). */
export const DEBUT_JOUR_DEFAUT = 6;
let debutJour = DEBUT_JOUR_DEFAUT;

export const getDebutJour = () => debutJour;

/** Appelé au démarrage et quand le réglage change. Hors 4–8 : valeur par défaut. */
export function definirDebutJour(h: number): void {
  debutJour = Number.isInteger(h) && h >= 4 && h <= 8 ? h : DEBUT_JOUR_DEFAUT;
}

/**
 * Jour « logique » : avant l'heure de début, on compte encore pour la veille.
 * Comparaison sur l'heure du mur (getHours), pas en retranchant des heures :
 * le changement d'heure ne peut pas décaler le résultat.
 */
export function jourLogique(d: Date = new Date(), debut: number = debutJour): string {
  const jour = dateLocale(d);
  return d.getHours() < debut ? decalerJours(jour, -1) : jour;
}
