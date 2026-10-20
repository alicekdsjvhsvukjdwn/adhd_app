import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Entrées/sorties de fichiers, version téléphone (feuille de partage, sélecteur).
 * La version web est dans fichiers.web.ts.
 */

/** Écrit le fichier puis ouvre la feuille de partage. */
export async function enregistrerFichier(
  nom: string,
  contenu: string | Uint8Array,
  mimeType: string,
  uti: string,
  titre: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  }
  const fichier = new File(Paths.cache, nom);
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(contenu);
  await Sharing.shareAsync(fichier.uri, { mimeType, UTI: uti, dialogTitle: titre });
}

/** Fait choisir un fichier et renvoie son texte ; null si la personne annule. */
export async function lireFichierChoisi(): Promise<string | null> {
  // Tous types : selon d'où vient le fichier (Drive, mail…), son type annoncé varie.
  const choix = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (choix.canceled) return null;
  return new File(choix.assets[0].uri).text();
}

/** Rappel « sauvegarde ancienne » : seulement sur le web, où les données vivent dans le navigateur. */
export function noterSauvegardeFaite(): void {}
export function joursDepuisSauvegarde(): number | null {
  return null;
}
