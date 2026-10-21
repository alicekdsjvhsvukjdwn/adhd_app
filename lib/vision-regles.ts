/**
 * Ma vision (tableau de manifestation) sans accès à la base : testable seul (tests/esprit.test.mjs).
 */

export const DOMAINES_DEFAUT = ["Moi", "Travail", "Mer & nature", "Relations", "Créativité", "Corps", "Maison"];

/** Au plus ce nombre de photos : elles sont gardées dans la base et dans la sauvegarde. */
export const MAX_PHOTOS = 40;

/** Combien de photos on peut encore ajouter. */
export const placesPhotos = (dejaLa: number) => Math.max(0, MAX_PHOTOS - dejaLa);

/** Secondes d'affichage d'une photo ou d'une phrase dans la lecture. */
export const SECONDES_PAR_ECRAN = 7;

/** Au-delà de ce temps de lecture, la routine liée à la vision est cochée. */
export const SECONDES_LECTURE_VALIDEE = 20;

export type EcranVision =
  | { type: "photo"; domaine: string; data: string }
  | { type: "phrase"; domaine: string; texte: string };

/**
 * La suite de la lecture : domaine par domaine, une phrase puis une photo, en alternance.
 * Les domaines vides sont sautés.
 */
export function sequenceVision(
  domaines: { id: number; nom: string }[],
  photos: { domaine_id: number; data: string }[],
  phrases: { domaine_id: number; texte: string }[],
): EcranVision[] {
  const suite: EcranVision[] = [];
  for (const d of domaines) {
    const ph = photos.filter((p) => p.domaine_id === d.id);
    const fr = phrases.filter((p) => p.domaine_id === d.id);
    for (let i = 0; i < Math.max(ph.length, fr.length); i++) {
      if (fr[i]) suite.push({ type: "phrase", domaine: d.nom, texte: fr[i].texte });
      if (ph[i]) suite.push({ type: "photo", domaine: d.nom, data: ph[i].data });
    }
  }
  return suite;
}
