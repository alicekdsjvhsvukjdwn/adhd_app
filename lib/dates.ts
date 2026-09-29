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

/** La date locale d'il y a n jours. */
export function ilYA(n: number): string {
  return decalerJours(dateLocale(), -n);
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
