/**
 * SQL des migrations 18 à 20 et des lignes de départ, sans accès à la base :
 * testable seul contre une vraie base SQLite (tests/schema.test.mjs).
 */

/**
 * Migration 18 : les tables longtemps créées à la demande, ici une fois.
 * Mêmes définitions qu'avant : une base existante ne change pas.
 */
export const SQL_TABLES_HORS_MIGRATIONS = `
  CREATE TABLE IF NOT EXISTS ancres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    moment TEXT NOT NULL DEFAULT 'matin',
    active INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    points_total INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    rappel_actif INTEGER NOT NULL DEFAULT 0,
    rappel_heure INTEGER NOT NULL DEFAULT 20,
    rappel_minute INTEGER NOT NULL DEFAULT 0
  );
  -- Plus lue ni écrite : gardée pour que les sauvegardes se restaurent.
  CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    profil TEXT,
    onboarding_fait INTEGER NOT NULL DEFAULT 0,
    gamification TEXT NOT NULL DEFAULT 'complete',
    ton TEXT NOT NULL DEFAULT 'neutre',
    rigidite TEXT NOT NULL DEFAULT 'moyenne'
  );
  CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT '',
    routine_id INTEGER,
    timestamp TEXT NOT NULL DEFAULT '',
    contexte TEXT
  );
  CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);
`;

/** Colonnes ajoutées à stats après coup : ajoutées si une vieille table ne les a pas. */
export const COLONNES_STATS: { nom: string; sql: string }[] = [
  { nom: "rappel_actif", sql: "ALTER TABLE stats ADD COLUMN rappel_actif INTEGER NOT NULL DEFAULT 0" },
  { nom: "rappel_heure", sql: "ALTER TABLE stats ADD COLUMN rappel_heure INTEGER NOT NULL DEFAULT 20" },
  { nom: "rappel_minute", sql: "ALTER TABLE stats ADD COLUMN rappel_minute INTEGER NOT NULL DEFAULT 0" },
];

/**
 * Lignes de départ, rejouables : la ligne unique de stats, et les moments
 * repères proposés si la table est vide. Au démarrage et après une restauration.
 */
export const SQL_LIGNES_DE_BASE = `
  INSERT OR IGNORE INTO stats (id) VALUES (1);
  INSERT INTO ancres (nom, moment, active)
  SELECT nom, moment, 0 FROM (
    SELECT 'Le réveil' AS nom, 'matin' AS moment, 1 AS o
    UNION ALL SELECT 'Le café du matin', 'matin', 2
    UNION ALL SELECT 'Le brossage de dents', 'matin', 3
    UNION ALL SELECT 'Le départ de chez moi', 'matin', 4
    UNION ALL SELECT 'Le déjeuner', 'midi', 5
    UNION ALL SELECT 'Le retour chez moi', 'apres_midi', 6
    UNION ALL SELECT 'Le dîner', 'soir', 7
    UNION ALL SELECT 'Le coucher', 'soir', 8
  )
  WHERE NOT EXISTS (SELECT 1 FROM ancres)
  ORDER BY o;
`;

/** Migration 19 : une seule orthographe (apres_midi) ; « indifférent » = pas de moment. Rejouable. */
export const SQL_MOMENTS = `
  UPDATE items SET moment = 'apres_midi' WHERE moment = 'apres-midi';
  UPDATE items SET moment = NULL WHERE moment = 'indifferent';
`;

/**
 * Migration 20 : les versions courte et longue écrites à la main deviennent
 * des étapes, pour les routines qui n'en ont pas encore.
 *   courte seule  → courte (essentielle), nom (bonus)
 *   longue seule  → nom (essentielle), longue (bonus)
 *   les deux      → courte (essentielle), nom (bonus), longue (bonus)
 * Les colonnes version_* restent en base. Rejouable : une routine qui a
 * déjà des étapes n'est plus concernée.
 */
export const SQL_VERSIONS_EN_ETAPES = `
  DROP TABLE IF EXISTS temp.versions_a_convertir;
  CREATE TEMP TABLE versions_a_convertir AS
    SELECT id, nom,
           TRIM(COALESCE(version_courte, '')) AS courte,
           TRIM(COALESCE(version_longue, '')) AS longue
    FROM items
    WHERE type = 'routine'
      AND (TRIM(COALESCE(version_courte, '')) <> '' OR TRIM(COALESCE(version_longue, '')) <> '')
      AND NOT EXISTS (SELECT 1 FROM etapes e WHERE e.item_id = items.id);

  INSERT INTO etapes (item_id, nom, ordre, faite, essentielle)
    SELECT id, courte, 0, 0, 1 FROM versions_a_convertir WHERE courte <> '';
  INSERT INTO etapes (item_id, nom, ordre, faite, essentielle)
    SELECT id, nom, 1, 0, CASE WHEN courte <> '' THEN 0 ELSE 1 END FROM versions_a_convertir;
  INSERT INTO etapes (item_id, nom, ordre, faite, essentielle)
    SELECT id, longue, 2, 0, 0 FROM versions_a_convertir WHERE longue <> '';

  DROP TABLE temp.versions_a_convertir;
`;

/**
 * Transformations de données à rejouer après la restauration d'une sauvegarde
 * plus ancienne : ses lignes arrivent telles qu'elles étaient.
 */
export function transformationsApres(schemaSauvegarde: number): string[] {
  return [
    ...(schemaSauvegarde < 19 ? [SQL_MOMENTS] : []),
    ...(schemaSauvegarde < 20 ? [SQL_VERSIONS_EN_ETAPES] : []),
  ];
}
