import { Platform } from "react-native";
import JSZip from "jszip";
import { lisezmoi, versCsv } from "../csv";
import { enregistrerFichier, lireFichierChoisi, noterSauvegardeFaite } from "../fichiers";
import {
  APP,
  colonnesCommunes,
  construireSauvegarde,
  nomFichier,
  validerSauvegarde,
  type Ligne,
  type Sauvegarde,
  type Validation,
} from "../sauvegarde-format";
import { transformationsApres } from "../schema";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { initialiserBase } from "./demarrage";

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


export async function lireSauvegarde(): Promise<Sauvegarde> {
  await initialiserBase();
  const db = await getDatabase();
  const tables: Record<string, Ligne[]> = {};
  for (const t of await nomsTables(db)) {
    tables[t] = await db.getAllAsync<Ligne>(`SELECT * FROM "${t}"`);
  }
  return construireSauvegarde(await versionSchema(db), tables);
}

/** Écrit la sauvegarde dans un fichier et ouvre la feuille de partage. */
export async function exporterSauvegarde(): Promise<void> {
  const sauvegarde = await lireSauvegarde();
  await enregistrerFichier(
    nomFichier(getAujourdhui()),
    JSON.stringify(sauvegarde),
    "application/json",
    "public.json",
    "Enregistrer la sauvegarde",
  );
  noterSauvegardeFaite();
}

/**
 * Export pour l'analyse : un CSV par table (toutes) et un LISEZMOI.txt
 * qui décrit chaque colonne, dans un zip partagé.
 */
export async function exporterCsv(): Promise<void> {
  const { tables } = await lireSauvegarde();
  const db = await getDatabase();
  const zip = new JSZip();
  const resume: { nom: string; colonnes: string[]; lignes: number }[] = [];

  for (const [nom, lignes] of Object.entries(tables)) {
    // Colonnes lues dans le schéma : une table vide a quand même ses en-têtes.
    const colonnes = (
      await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${nom}")`)
    ).map((c) => c.name);
    zip.file(`${nom}.csv`, versCsv(colonnes, lignes));
    resume.push({ nom, colonnes, lignes: lignes.length });
  }
  zip.file("LISEZMOI.txt", lisezmoi(resume, new Date().toISOString()));

  await enregistrerFichier(
    `${APP}-donnees-${getAujourdhui()}.zip`,
    await zip.generateAsync({ type: "uint8array" }),
    "application/zip",
    "public.zip-archive",
    "Exporter mes données (CSV)",
  );
}

/**
 * Fait choisir un fichier et le valide, sans rien modifier.
 * null si la personne a annulé.
 */
export async function choisirSauvegarde(): Promise<Validation | null> {
  // C'est la validation du contenu qui décide, pas le type annoncé du fichier.
  const texte = await lireFichierChoisi();
  if (texte === null) return null;
  const db = await getDatabase();
  return validerSauvegarde(texte, await versionSchema(db));
}

/**
 * Remplace toutes les données par celles de la sauvegarde.
 * Tout ou rien : en cas d'erreur, la base reste telle qu'elle était.
 */
export async function restaurerSauvegarde(s: Sauvegarde): Promise<void> {
  await initialiserBase();
  const db = await getDatabase();
  const actuelles = await nomsTables(db);

  // Exclusive : aucune autre requête de l'appli ne s'intercale pendant le remplacement.
  // Le web ne connaît pas la transaction exclusive : une transaction simple, sur la même connexion.
  const transaction = (travail: (txn: Db) => Promise<void>) =>
    Platform.OS === "web"
      ? db.withTransactionAsync(() => travail(db))
      : db.withExclusiveTransactionAsync(travail as never);
  await transaction(async (txn) => {
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

    // Une sauvegarde plus ancienne arrive telle quelle : on rejoue les
    // transformations de données des migrations qu'elle n'a pas connues.
    for (const sql of transformationsApres(s.schema)) await txn.execAsync(sql);
  });

  // Recrée les lignes uniques (stats, préférences) si la sauvegarde n'en avait pas.
  await initialiserBase();
}
