/**
 * Format du fichier de sauvegarde, sans accès à la base ni au téléphone :
 * testable seul (tests/etape8.test.mjs).
 *
 * Une sauvegarde est le contenu brut de chaque table, avec la version du
 * schéma (PRAGMA user_version) au moment de l'export. À la restauration,
 * seules les colonnes qui existent encore sont reprises : une sauvegarde
 * plus ancienne que l'appli se restaure, une plus récente est refusée.
 */

export const APP = "tdah-routines";
export const FORMAT = 1;

export type Valeur = string | number | null;
export type Ligne = Record<string, Valeur>;

export type Sauvegarde = {
  app: string;
  format: number;
  /** PRAGMA user_version de la base exportée. */
  schema: number;
  /** Horodatage ISO de l'export. */
  creee_le: string;
  tables: Record<string, Ligne[]>;
};

export type Validation =
  | { ok: true; sauvegarde: Sauvegarde }
  | { ok: false; erreur: string };

/** Noms de tables et de colonnes interpolés dans le SQL : lettres, chiffres, _. */
const NOM_SQL = /^[A-Za-z_][A-Za-z0-9_]*$/;

const PAS_UNE_SAUVEGARDE = "Ce fichier n'est pas une sauvegarde de l'appli.";

export function construireSauvegarde(
  schema: number,
  tables: Record<string, Ligne[]>,
  maintenant = new Date(),
): Sauvegarde {
  return {
    app: APP,
    format: FORMAT,
    schema,
    creee_le: maintenant.toISOString(),
    tables,
  };
}

/** Nom du fichier partagé, daté du jour (date locale AAAA-MM-JJ). */
export function nomFichier(dateLocale: string): string {
  return `${APP}-sauvegarde-${dateLocale}.json`;
}

const estObjet = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const estValeur = (x: unknown): x is Valeur =>
  x === null || typeof x === "string" || typeof x === "number";

/**
 * Vérifie tout avant de toucher à la base : un fichier refusé ne change rien.
 * `texte` est le contenu brut du fichier choisi.
 */
export function validerSauvegarde(
  texte: string,
  schemaActuel: number,
): Validation {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: PAS_UNE_SAUVEGARDE };
  }
  if (!estObjet(brut) || brut.app !== APP || !estObjet(brut.tables)) {
    return { ok: false, erreur: PAS_UNE_SAUVEGARDE };
  }
  if (brut.format !== FORMAT) {
    return {
      ok: false,
      erreur: "Ce format de sauvegarde n'est pas reconnu par cette version de l'appli.",
    };
  }
  const schema = brut.schema;
  if (typeof schema !== "number" || !Number.isInteger(schema) || schema < 1) {
    return { ok: false, erreur: PAS_UNE_SAUVEGARDE };
  }
  if (schema > schemaActuel) {
    return {
      ok: false,
      erreur:
        "Cette sauvegarde vient d'une version plus récente de l'appli. Mets l'appli à jour, puis réessaie.",
    };
  }
  if (!Array.isArray(brut.tables.items)) {
    return { ok: false, erreur: PAS_UNE_SAUVEGARDE };
  }

  for (const [table, lignes] of Object.entries(brut.tables)) {
    if (!NOM_SQL.test(table) || !Array.isArray(lignes)) {
      return { ok: false, erreur: "Ce fichier de sauvegarde est abîmé." };
    }
    for (const ligne of lignes) {
      if (!estObjet(ligne)) {
        return { ok: false, erreur: "Ce fichier de sauvegarde est abîmé." };
      }
      for (const [colonne, valeur] of Object.entries(ligne)) {
        if (!NOM_SQL.test(colonne) || !estValeur(valeur)) {
          return { ok: false, erreur: "Ce fichier de sauvegarde est abîmé." };
        }
      }
    }
  }

  return {
    ok: true,
    sauvegarde: {
      app: APP,
      format: FORMAT,
      schema,
      creee_le: typeof brut.creee_le === "string" ? brut.creee_le : "",
      tables: brut.tables as Record<string, Ligne[]>,
    },
  };
}

/**
 * Colonnes d'une ligne sauvegardée qui existent dans la table actuelle.
 * Une colonne disparue est ignorée ; une colonne ajoutée depuis prend
 * sa valeur par défaut.
 */
export function colonnesCommunes(ligne: Ligne, colonnesTable: string[]): string[] {
  return Object.keys(ligne).filter((c) => colonnesTable.includes(c));
}

/** Résumé lisible pour la confirmation : « 12 routines et tâches ». */
export function nombreItems(s: Sauvegarde): number {
  return s.tables.items?.length ?? 0;
}
