/** Entrées/sorties de fichiers, version web : téléchargement et sélecteur de fichier. */

const CLE_SAUVEGARDE = "derniere-sauvegarde";

/** Télécharge le fichier (Safari le propose dans Fichiers / iCloud Drive). */
export async function enregistrerFichier(
  nom: string,
  contenu: string | Uint8Array,
  mimeType: string,
): Promise<void> {
  const blob = new Blob([contenu as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Ouvre le sélecteur de fichier ; null si la personne annule. */
export function lireFichierChoisi(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, reject);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function noterSauvegardeFaite(): void {
  try {
    localStorage.setItem(CLE_SAUVEGARDE, String(Date.now()));
  } catch {}
}

/** Jours depuis le dernier export ; null si jamais exporté. */
export function joursDepuisSauvegarde(): number | null {
  try {
    const v = Number(localStorage.getItem(CLE_SAUVEGARDE));
    return v ? Math.floor((Date.now() - v) / 86_400_000) : null;
  } catch {
    return null;
  }
}
