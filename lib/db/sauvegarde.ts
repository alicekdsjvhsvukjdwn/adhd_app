import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  colonnesCommunes,
  construireSauvegarde,
  nomFichier,
  validerSauvegarde,
  type Ligne,
  type Sauvegarde,
  type Validation,
} from "../sauvegarde-format";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { initialiserBase } from "./demarrage";
import { initEvents } from "./events";

/**
 * Sauvegarde et restauration de toutes les données, en un fichier JSON.
 * Le fichier ne quitte le téléphone que par la feuille de partage,
 * à la demande de la personne.
 */

type Db = Awaited<ReturnType<typeof getDatabase>>;

async function versionSchema(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version ?? 0;
}

/** Toutes les tables de l'appli, y compris celles créées hors migrations. */
async function nomsTables(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

/** S'assure que toutes les tables existent, même celles créées à la demande. */
async function assurerTables(): Promise<void> {
  await initialiserBase();
  await initEvents();
  const db = await getDatabase();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);",
  );
}

export async function lireSauvegarde(): Promise<Sauvegarde> {
  await assurerTables();
  const db = await getDatabase();
  const tables: Record<string, Ligne[]> = {};
  for (const t of await nomsTables(db)) {
    tables[t] = await db.getAllAsync<Ligne>(`SELECT * FROM "${t}"`);
  }
  return construireSauvegarde(await versionSchema(db), tables);
}

/** Écrit la sauvegarde dans un fichier et ouvre la feuille de partage. */
export async function exporterSauvegarde(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  }
  const sauvegarde = await lireSauvegarde();
  const fichier = new File(Paths.cache, nomFichier(getAujourdhui()));
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(JSON.stringify(sauvegarde));
  await Sharing.shareAsync(fichier.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "Enregistrer la sauvegarde",
  });
}

/**
 * Fait choisir un fichier et le valide, sans rien modifier.
 * null si la personne a annulé.
 */
export async function choisirSauvegarde(): Promise<Validation | null> {
  // Tous types : selon d'où vient le fichier (Drive, mail…), son type annoncé varie.
  // C'est la validation du contenu qui décide.
  const choix = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (choix.canceled) return null;
  const texte = await new File(choix.assets[0].uri).text();
  const db = await getDatabase();
  return validerSauvegarde(texte, await versionSchema(db));
}

/**
 * Remplace toutes les données par celles de la sauvegarde.
 * Tout ou rien : en cas d'erreur, la base reste telle qu'elle était.
 */
export async function restaurerSauvegarde(s: Sauvegarde): Promise<void> {
  await assurerTables();
  const db = await getDatabase();
  const actuelles = await nomsTables(db);

  // Exclusive : aucune autre requête de l'appli ne s'intercale pendant le remplacement.
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const t of actuelles) await txn.runAsync(`DELETE FROM "${t}"`);

    for (const [t, lignes] of Object.entries(s.tables)) {
      // Une table qui n'existe plus dans cette version est ignorée.
      if (!actuelles.includes(t)) continue;
      const colonnes = (
        await txn.getAllAsync<{ name: string }>(`PRAGMA table_info("${t}")`)
      ).map((c) => c.name);

      // ponytail: une requête par ligne, quelques secondes pour des milliers d'événements ; requête préparée par table si ça devient lent
      for (const ligne of lignes) {
        const cols = colonnesCommunes(ligne, colonnes);
        if (cols.length === 0) continue;
        await txn.runAsync(
          `INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(", ")})
           VALUES (${cols.map(() => "?").join(", ")})`,
          ...cols.map((c) => ligne[c]),
        );
      }
    }
  });

  // Recrée les lignes uniques (stats, préférences) si la sauvegarde n'en avait pas.
  await initialiserBase();
}
