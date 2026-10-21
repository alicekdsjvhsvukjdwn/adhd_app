/**
 * SQL des migrations 18 à 23 et des lignes de départ, sans accès à la base :
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
 * Migration 21 : nouvelle palette des listes (bleus, verts, cyans, indigo).
 * Recopie volontaire de la correspondance (lib/theme-listes.ts, ANCIENNES_CLES) :
 * une migration ne doit pas changer si la palette change plus tard.
 * Une à une, donc deux listes restent distinctes. Rejouable.
 */
export const SQL_COULEURS_LISTES = `
  UPDATE listes SET couleur = CASE couleur
    WHEN 'orange' THEN 'cyan'
    WHEN 'violet' THEN 'indigo'
    WHEN 'rose' THEN 'lavande'
    WHEN 'ocre' THEN 'foret'
    WHEN 'ardoise' THEN 'glacier'
    ELSE couleur
  END
  WHERE couleur IN ('orange', 'violet', 'rose', 'ocre', 'ardoise');
`;

/**
 * Migration 22 (après l'ajout de recompenses.categorie) : catégorie devinée d'après le nom (minuscules ; lower() de
 * SQLite ne touche pas aux accents, d'où les deux orthographes). L'ordre
 * compte : « concert » est de la musique avant d'être une sortie. Rejouable :
 * ne touche que les récompenses restées en Petits plaisirs.
 */
export const SQL_CATEGORIES_RECOMPENSES = `
  UPDATE recompenses SET categorie = CASE
    WHEN lower(nom) LIKE '%album%' OR lower(nom) LIKE '%concert%' OR lower(nom) LIKE '%musique%'
      OR lower(nom) LIKE '%vinyle%' OR lower(nom) LIKE '%disque%' OR lower(nom) LIKE '%casque%'
      THEN 'musique'
    WHEN lower(nom) LIKE '%voyage%' OR lower(nom) LIKE '%week-end%' OR lower(nom) LIKE '%weekend%'
      OR lower(nom) LIKE '%vacances%'
      THEN 'gros'
    WHEN lower(nom) LIKE '%ciné%' OR lower(nom) LIKE '%cine%' OR lower(nom) LIKE '%resto%'
      OR lower(nom) LIKE '%sortie%' OR lower(nom) LIKE '%expo%' OR lower(nom) LIKE '%musée%'
      OR lower(nom) LIKE '%théâtre%' OR lower(nom) LIKE '%theatre%'
      THEN 'sorties'
    WHEN lower(nom) LIKE '%cocooning%' OR lower(nom) LIKE '%bain%' OR lower(nom) LIKE '%livre%'
      OR lower(nom) LIKE '%jeu%' OR lower(nom) LIKE '%sieste%' OR lower(nom) LIKE '%massage%'
      OR lower(nom) LIKE '%épisode%' OR lower(nom) LIKE '%episode%' OR lower(nom) LIKE '%série%'
      THEN 'temps'
    ELSE 'plaisirs'
  END
  WHERE categorie = 'plaisirs';
`;

/**
 * Migration 23 : méditation et arbre de skills. Tables nouvelles seulement :
 * sport_paliers et paliers_historique restent, en archive.
 */
export const SQL_TABLES_LOT4 = `
  CREATE TABLE IF NOT EXISTS meditations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT '',
    -- id du catalogue (lib/meditations.ts)
    seance TEXT NOT NULL DEFAULT '',
    duree_s INTEGER NOT NULL DEFAULT 0,
    terminee INTEGER NOT NULL DEFAULT 0,
    points_donnes INTEGER NOT NULL DEFAULT 0,
    horodatage TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_meditations_date ON meditations(date);

  -- Étape en cours de chaque skill (lib/skills.ts) ; sans ligne : étape 1, inactif.
  CREATE TABLE IF NOT EXISTS skills_etat (
    skill TEXT PRIMARY KEY,
    etape INTEGER NOT NULL DEFAULT 1,
    actif INTEGER NOT NULL DEFAULT 0,
    maj_le TEXT NOT NULL DEFAULT ''
  );

  -- 'depart' | 'valide' | 'refuse' | 'manuel' | 'maitrise'
  CREATE TABLE IF NOT EXISTS skills_historique (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT '',
    horodatage TEXT NOT NULL DEFAULT '',
    skill TEXT NOT NULL DEFAULT '',
    de INTEGER,
    vers INTEGER NOT NULL DEFAULT 0,
    origine TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL DEFAULT 0
  );
`;

/**
 * Migration 24 : séances guidées (lib/seances.ts) et la séance perso
 * « Ma routine du matin » (sans ligne : REVEIL_DEFAUT).
 */
export const SQL_TABLES_SEANCES_GUIDEES = `
  CREATE TABLE IF NOT EXISTS seances_guidees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT '',
    -- id de lib/seances.ts, ou 'reveil'
    seance TEXT NOT NULL DEFAULT '',
    duree_s INTEGER NOT NULL DEFAULT 0,
    -- ids des exercices faits jusqu'au bout, séparés par des virgules
    exercices TEXT NOT NULL DEFAULT '',
    terminee INTEGER NOT NULL DEFAULT 0,
    points_donnes INTEGER NOT NULL DEFAULT 0,
    horodatage TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_seances_guidees_date ON seances_guidees(date);

  CREATE TABLE IF NOT EXISTS seance_perso (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    exercices TEXT NOT NULL DEFAULT '',
    effort_s INTEGER NOT NULL DEFAULT 45,
    repos_s INTEGER NOT NULL DEFAULT 15,
    lien TEXT NOT NULL DEFAULT ''
  );
`;

/**
 * Migration 23 : les paliers des 4 familles deviennent des étapes de skills
 * (Pousser → Pompe, Tirer → Traction, Jambes → Pistol, Gainage → Gainage).
 * Recopie volontaire des échelles : la migration ne change pas si le
 * catalogue change. Traction reste inactive sans barre. Rejouable : un skill
 * déjà présent n'est pas touché.
 */
export const SQL_SKILLS_DEPUIS_PALIERS = `
  INSERT OR IGNORE INTO skills_etat (skill, etape, actif, maj_le)
  SELECT
    CASE famille WHEN 'pousser' THEN 'pompe' WHEN 'tirer' THEN 'traction'
      WHEN 'jambes' THEN 'pistol' ELSE 'gainage' END,
    CASE famille
      WHEN 'pousser' THEN MIN(palier, 5)
      WHEN 'tirer' THEN CASE palier WHEN 1 THEN 3 WHEN 2 THEN 3 WHEN 3 THEN 4 WHEN 4 THEN 5 ELSE 7 END
      WHEN 'jambes' THEN CASE WHEN palier >= 4 THEN 5 ELSE palier END
      ELSE CASE WHEN palier >= 3 THEN 2 ELSE 1 END
    END,
    CASE WHEN famille = 'tirer'
      AND COALESCE((SELECT barre_traction FROM sport_reglages WHERE id = 1), 0) = 0 THEN 0 ELSE 1 END,
    maj_le
  FROM sport_paliers
  WHERE famille IN ('pousser', 'tirer', 'jambes', 'gainage');

  INSERT INTO skills_historique (date, horodatage, skill, de, vers, origine)
  SELECT substr(maj_le, 1, 10), maj_le, skill, NULL, etape, 'depart' FROM skills_etat
  WHERE NOT EXISTS (SELECT 1 FROM skills_historique h WHERE h.skill = skills_etat.skill);
`;

/**
 * Migration 25 : séances de sport notées après coup (faites ailleurs, YouTube,
 * salle…) dans la même table que les séances guidées, et la routine cochée
 * quand je fais du sport (sans ligne : aucune).
 */
export const SQL_SEANCES_NOTEES = `
  -- 'guidee' (lecteur de l'appli) | 'notee' (faite ailleurs)
  ALTER TABLE seances_guidees ADD COLUMN origine TEXT NOT NULL DEFAULT 'guidee';
  -- zones d'une séance notée, séparées par des virgules ('haut,abdos')
  ALTER TABLE seances_guidees ADD COLUMN zones TEXT NOT NULL DEFAULT '';
  -- 'youtube' | 'salle' | 'dehors' | 'autre' | ''
  ALTER TABLE seances_guidees ADD COLUMN source TEXT NOT NULL DEFAULT '';
  ALTER TABLE seances_guidees ADD COLUMN lien TEXT NOT NULL DEFAULT '';
  -- 'facile' | 'ok' | 'dur' | ''
  ALTER TABLE seances_guidees ADD COLUMN ressenti TEXT NOT NULL DEFAULT '';
  ALTER TABLE seances_guidees ADD COLUMN note TEXT NOT NULL DEFAULT '';

  CREATE TABLE IF NOT EXISTS sport_lien (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    routine_id INTEGER NOT NULL DEFAULT 0
  );
`;

/**
 * Migration 26 : « Mes 3 ». Les tâches retenues pour un jour (choisies la veille,
 * reportées de la veille ou proposées par le moteur), dans l'ordre d'affichage.
 */
export const SQL_TABLES_TROIS = `
  CREATE TABLE IF NOT EXISTS trois (
    jour TEXT NOT NULL DEFAULT '',
    item_id INTEGER NOT NULL DEFAULT 0,
    rang INTEGER NOT NULL DEFAULT 0,
    -- 'choisi' | 'report' | 'moteur'
    source TEXT NOT NULL DEFAULT 'moteur',
    PRIMARY KEY (jour, item_id)
  );
`;

/**
 * Migration 27 : place choisie à la main dans une liste. Négatif = en haut (le plus petit d'abord),
 * positif = en bas, vide = l'ordre de l'appli.
 */
export const SQL_RANG_MANUEL = `
  ALTER TABLE items ADD COLUMN rang_manuel INTEGER;
`;

/**
 * Migration 28 : les cinq étagères pensées pour moi (mer, bouffe, temps, découvertes, gros).
 * Les anciennes clés sont rangées d'après le nom ; les nouvelles ne bougent pas, donc rejouable.
 * (lower() de SQLite ne touche pas aux accents, d'où les deux orthographes.)
 */
export const SQL_CATEGORIES_RECOMPENSES_V2 = `
  UPDATE recompenses SET categorie = CASE
    WHEN categorie IN ('mer', 'bouffe', 'temps', 'decouvertes', 'gros') THEN categorie
    WHEN categorie = 'musique' THEN 'temps'
    WHEN lower(nom) LIKE '%baignade%' OR lower(nom) LIKE '%plage%' OR lower(nom) LIKE '%calanque%'
      OR lower(nom) LIKE '%bateau%' OR lower(nom) LIKE '%paddle%' OR lower(nom) LIKE '%kayak%'
      OR lower(nom) LIKE '%rando%' OR lower(nom) LIKE '%coucher de soleil%'
      THEN 'mer'
    WHEN lower(nom) LIKE '%resto%' OR lower(nom) LIKE '%café%' OR lower(nom) LIKE '%cafe%'
      OR lower(nom) LIKE '%gâteau%' OR lower(nom) LIKE '%gateau%' OR lower(nom) LIKE '%pâtisserie%'
      OR lower(nom) LIKE '%patisserie%' OR lower(nom) LIKE '%glace%' OR lower(nom) LIKE '%brunch%'
      OR lower(nom) LIKE '%burger%' OR lower(nom) LIKE '%pizza%'
      THEN 'bouffe'
    WHEN categorie = 'sorties' THEN 'decouvertes'
    ELSE 'temps'
  END;
`;

/**
 * Migration 29 : ménage par pièce. Les pièces et tâches de départ sont créées
 * à la première ouverture de l'onglet (lib/db/menage.ts), pas ici.
 */
export const SQL_TABLES_MENAGE = `
  CREATE TABLE IF NOT EXISTS menage_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    icone TEXT NOT NULL DEFAULT 'maison',
    ordre INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS menage_taches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piece_id INTEGER NOT NULL DEFAULT 0,
    nom TEXT NOT NULL DEFAULT '',
    freq_jours INTEGER NOT NULL DEFAULT 7,
    prochaine_le TEXT NOT NULL DEFAULT '',
    fait_le TEXT,
    avant_le TEXT,
    points_donnes INTEGER NOT NULL DEFAULT 0,
    ordre INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS menage_faits (
    tache_id INTEGER NOT NULL DEFAULT 0,
    echeance TEXT NOT NULL DEFAULT '',
    jour TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (tache_id, echeance)
  );
`;

/**
 * Migration 30 : Esprit (humeur, journal de pensées, TCC, vision). Données sensibles :
 * elles restent sur l'appareil et ne vont jamais au serveur de rappels.
 */
export const SQL_TABLES_ESPRIT = `
  CREATE TABLE IF NOT EXISTS humeurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jour TEXT NOT NULL DEFAULT '',
    heure TEXT NOT NULL DEFAULT '',
    niveau INTEGER NOT NULL DEFAULT 3,
    emotions TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_humeurs_jour ON humeurs(jour);

  CREATE TABLE IF NOT EXISTS pensees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jour TEXT NOT NULL DEFAULT '',
    heure TEXT NOT NULL DEFAULT '',
    situation TEXT NOT NULL DEFAULT '',
    pensee TEXT NOT NULL DEFAULT '',
    emotions TEXT NOT NULL DEFAULT '',
    intensite_avant INTEGER,
    pieges TEXT NOT NULL DEFAULT '',
    autre_vision TEXT NOT NULL DEFAULT '',
    intensite_apres INTEGER,
    -- 0 rien | 1 à en parler en séance | 2 abordée
    a_dire INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_pensees_jour ON pensees(jour);

  CREATE TABLE IF NOT EXISTS tcc_seances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT '',
    heure TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS tcc_exercices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    consigne TEXT NOT NULL DEFAULT '',
    freq_type TEXT NOT NULL DEFAULT 'jour',
    freq_n INTEGER NOT NULL DEFAULT 1,
    lien TEXT NOT NULL DEFAULT '',
    actif INTEGER NOT NULL DEFAULT 1,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS tcc_exercices_faits (
    exercice_id INTEGER NOT NULL DEFAULT 0,
    jour TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (exercice_id, jour)
  );

  CREATE TABLE IF NOT EXISTS a_dire (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texte TEXT NOT NULL DEFAULT '',
    -- 'note' | 'humeur' | 'journal'
    source TEXT NOT NULL DEFAULT 'note',
    fait INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS bilan_semaine (
    semaine TEXT NOT NULL DEFAULT '' PRIMARY KEY,
    aide TEXT NOT NULL DEFAULT '',
    garder TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS vision_domaines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    ordre INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS vision_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domaine_id INTEGER NOT NULL DEFAULT 0,
    -- photo compressée, en data URI (data:image/jpeg;base64,…) : elle part dans la sauvegarde
    data TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS vision_phrases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domaine_id INTEGER NOT NULL DEFAULT 0,
    texte TEXT NOT NULL DEFAULT '',
    ordre INTEGER NOT NULL DEFAULT 0
  );
`;

/**
 * Transformations de données à rejouer après la restauration d'une sauvegarde
 * plus ancienne : ses lignes arrivent telles qu'elles étaient.
 */
export function transformationsApres(schemaSauvegarde: number): string[] {
  return [
    ...(schemaSauvegarde < 19 ? [SQL_MOMENTS] : []),
    ...(schemaSauvegarde < 20 ? [SQL_VERSIONS_EN_ETAPES] : []),
    ...(schemaSauvegarde < 21 ? [SQL_COULEURS_LISTES] : []),
    ...(schemaSauvegarde < 22 ? [SQL_CATEGORIES_RECOMPENSES] : []),
    ...(schemaSauvegarde < 28 ? [SQL_CATEGORIES_RECOMPENSES_V2] : []),
    ...(schemaSauvegarde < 23 ? [SQL_SKILLS_DEPUIS_PALIERS] : []),
  ];
}
