import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Plus grand côté d'une photo gardée : assez pour un plein écran de téléphone, léger pour la sauvegarde. */
const COTE_MAX = 1024;
const QUALITE = 0.6;

/**
 * Fait choisir jusqu'à `max` photos dans la galerie et les renvoie compressées, en data URI JPEG.
 * Vide si la personne annule ou s'il n'y a plus de place.
 */
export async function choisirPhotos(max: number): Promise<string[]> {
  if (max <= 0) return [];
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 1,
  });
  if (r.canceled) return [];
  const sortie: string[] = [];
  for (const a of r.assets.slice(0, max)) {
    const contexte = ImageManipulator.manipulate(a.uri);
    // Réduit seulement ce qui dépasse (taille inconnue = 0 : on réduit par la largeur).
    if (Math.max(a.width, a.height) > COTE_MAX || a.width === 0) {
      contexte.resize(a.height > a.width ? { height: COTE_MAX } : { width: COTE_MAX });
    }
    const image = await contexte.renderAsync();
    const fichier = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITE, base64: true });
    if (fichier.base64) sortie.push(`data:image/jpeg;base64,${fichier.base64}`);
  }
  return sortie;
}
