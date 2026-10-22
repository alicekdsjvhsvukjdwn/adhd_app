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
 * Migration 31 : jours de la semaine d'une tâche régulière (« 1,3,5 », 0 = dimanche).
 * Ces jours-là elle est due et proposée en priorité pour Mes 3. Vide = pas de jour précis.
 */
export const SQL_JOURS_TACHE = `
  ALTER TABLE items ADD COLUMN jours TEXT;
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
 * Migration 35 : le plan de sport (le coach). Un plan actif à la fois : ses séances types (sport_plan_lignes, avec
 * la fourchette visée et le compteur de séances au plafond), la suite des séances à faire (sport_plan_seances, avec
 * leur jour, qui se décale si j'en rate une), mes tests de niveau et les bilans du dimanche.
 */
export const SQL_PLAN_SPORT = `
  CREATE TABLE IF NOT EXISTS sport_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 'force' | 'skill' | 'tonifier' | 'mobilite'
    objectif TEXT NOT NULL DEFAULT 'force',
    -- id du skill (objectif 'skill'), sinon vide
    skill TEXT NOT NULL DEFAULT '',
    -- jours de la semaine choisis, « 1,3,5 » (0 = dimanche)
    jours TEXT NOT NULL DEFAULT '',
    duree INTEGER NOT NULL DEFAULT 30,
    -- niveaux de départ (JSON)
    niveaux TEXT NOT NULL DEFAULT '',
    -- 'actif' | 'termine'
    statut TEXT NOT NULL DEFAULT 'actif',
    debut TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sport_plan_lignes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL DEFAULT 0,
    slot INTEGER NOT NULL DEFAULT 0,
    rang INTEGER NOT NULL DEFAULT 0,
    exercice_id TEXT NOT NULL DEFAULT '',
    series INTEGER NOT NULL DEFAULT 3,
    bas INTEGER NOT NULL DEFAULT 8,
    haut INTEGER NOT NULL DEFAULT 12,
    poids REAL,
    repos_s INTEGER NOT NULL DEFAULT 45,
    -- 'base' | 'skill'
    role TEXT NOT NULL DEFAULT 'base',
    -- séances de suite au haut de la fourchette
    atteint INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_sport_plan_lignes ON sport_plan_lignes(plan_id, slot, rang);
  CREATE TABLE IF NOT EXISTS sport_plan_seances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL DEFAULT 0,
    ordre INTEGER NOT NULL DEFAULT 0,
    slot INTEGER NOT NULL DEFAULT 0,
    semaine INTEGER NOT NULL DEFAULT 1,
    nom TEXT NOT NULL DEFAULT '',
    jour TEXT NOT NULL DEFAULT '',
    -- 'a_faire' | 'faite'
    statut TEXT NOT NULL DEFAULT 'a_faire',
    -- bilan du dimanche : -1, 0 ou +1 série
    ajust INTEGER NOT NULL DEFAULT 0,
    seance_id INTEGER,
    fait_le TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sport_plan_seances ON sport_plan_seances(plan_id, ordre);
  CREATE TABLE IF NOT EXISTS sport_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL DEFAULT 0,
    jour TEXT NOT NULL DEFAULT '',
    -- 'pompes' | 'dips' | 'planche' | 'tuck_lsit' | 'squats' | 'pont'
    cle TEXT NOT NULL DEFAULT '',
    valeur INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sport_bilans (
    -- lundi de la semaine
    semaine TEXT NOT NULL DEFAULT '',
    plan_id INTEGER NOT NULL DEFAULT 0,
    -- 'facile' | 'ok' | 'dur'
    ressenti TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (semaine, plan_id)
  );
`;

/**
 * Migration 34 : séances de sport construites sur la bibliothèque (lot 2 du Sport). Une séance faite reste dans
 * `seances` (nom, origine, ressenti en plus) et chaque série dans `series` avec son exercice de la bibliothèque et
 * son poids : on voit ce qu'on a vraiment fait, série par série. « Mes séances » vivent dans sport_seances.
 */
export const SQL_SEANCES_SPORT = `
  ALTER TABLE seances ADD COLUMN nom TEXT NOT NULL DEFAULT '';
  -- '' (skills) | 'perso' | 'proposee' | 'exercice' | 'notee'
  ALTER TABLE seances ADD COLUMN origine TEXT NOT NULL DEFAULT '';
  ALTER TABLE seances ADD COLUMN ressenti TEXT NOT NULL DEFAULT '';
  ALTER TABLE series ADD COLUMN exercice_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE series ADD COLUMN poids REAL;
  CREATE INDEX IF NOT EXISTS idx_series_exercice ON series(exercice_id);

  CREATE TABLE IF NOT EXISTS sport_seances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sport_seances_ex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seance_id INTEGER NOT NULL DEFAULT 0,
    rang INTEGER NOT NULL DEFAULT 0,
    exercice_id TEXT NOT NULL DEFAULT '',
    series INTEGER NOT NULL DEFAULT 3,
    cible INTEGER NOT NULL DEFAULT 10,
    poids REAL,
    repos_s INTEGER NOT NULL DEFAULT 45
  );
  CREATE INDEX IF NOT EXISTS idx_sport_seances_ex ON sport_seances_ex(seance_id, rang);
`;

/**
 * Migration 33 : TCC en autonomie (anxiété sociale, confiance en soi). Données sensibles : elles restent
 * sur l'appareil. Les anciennes tables de la TCC avec un thérapeute (tcc_seances, tcc_exercices,
 * tcc_exercices_faits, a_dire) restent telles quelles : l'appli ne les lit plus, la sauvegarde et le CSV les gardent.
 */
export const SQL_TCC_AUTONOME = `
  CREATE TABLE IF NOT EXISTS tcc_echelle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    -- anxiété imaginée, 0 à 100
    anxiete INTEGER NOT NULL DEFAULT 50,
    -- pensée du journal que cette marche permet de tester
    pensee_id INTEGER,
    archivee INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS tcc_expositions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    situation_id INTEGER NOT NULL DEFAULT 0,
    jour TEXT NOT NULL DEFAULT '',
    anx_prevue INTEGER,
    crainte TEXT NOT NULL DEFAULT '',
    -- vide tant que l'exposition n'est pas terminée
    anx_reelle INTEGER,
    vecu TEXT NOT NULL DEFAULT '',
    retenu TEXT NOT NULL DEFAULT '',
    -- comportements de sécurité utilisés, séparés par des |
    securite TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_tcc_expositions_jour ON tcc_expositions(jour);
  CREATE TABLE IF NOT EXISTS tcc_confiance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jour TEXT NOT NULL DEFAULT '',
    texte TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_tcc_confiance_jour ON tcc_confiance(jour);
  CREATE TABLE IF NOT EXISTS tcc_objectifs (
    -- lundi de la semaine
    semaine TEXT NOT NULL DEFAULT '',
    -- 'expositions' | 'confiance' | 'experiences' | 'seance'
    genre TEXT NOT NULL DEFAULT '',
    cible INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (semaine, genre)
  );
  CREATE TABLE IF NOT EXISTS tcc_seances_moi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jour TEXT NOT NULL DEFAULT '',
    semaine TEXT NOT NULL DEFAULT '',
    humeur_moy REAL,
    anx_prevue_moy REAL,
    anx_reelle_moy REAL,
    expositions INTEGER NOT NULL DEFAULT 0,
    confiance INTEGER NOT NULL DEFAULT 0,
    -- objectifs de la semaine et ce qui a été fait, en JSON
    objectifs TEXT NOT NULL DEFAULT '',
    retenu TEXT NOT NULL DEFAULT '',
    prochain_pas TEXT NOT NULL DEFAULT '',
    situation_id INTEGER,
    -- objectifs choisis pour la semaine suivante, en JSON
    objectifs_suivants TEXT NOT NULL DEFAULT '',
    mot_gentil TEXT NOT NULL DEFAULT ''
  );
  -- Un jour avec exposition ou séance avec moi-même rapporte 5 points, une seule fois.
  CREATE TABLE IF NOT EXISTS tcc_points_jours (
    jour TEXT PRIMARY KEY NOT NULL DEFAULT ''
  );
`;

/**
 * Migration 32 : ménage. Une couleur par pièce ; supprimer une pièce ou une tâche la retire
 * sans effacer son historique (supprimee_le) ; un journal des cochages pour les stats du Progrès.
 * Les couleurs de départ suivent l'ordre des pièces (8 teintes distinctes, voir lib/menage-regles.ts).
 */
export const SQL_MENAGE_V2 = `
  ALTER TABLE menage_pieces ADD COLUMN couleur TEXT NOT NULL DEFAULT '';
  ALTER TABLE menage_pieces ADD COLUMN supprimee_le TEXT;
  ALTER TABLE menage_taches ADD COLUMN supprimee_le TEXT;
  CREATE TABLE IF NOT EXISTS menage_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tache_id INTEGER NOT NULL DEFAULT 0,
    piece_id INTEGER NOT NULL DEFAULT 0,
    jour TEXT NOT NULL DEFAULT '',
    echeance TEXT NOT NULL DEFAULT '',
    a_temps INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_menage_journal_jour ON menage_journal(jour);
  UPDATE menage_pieces SET couleur = CASE (
      SELECT COUNT(*) FROM menage_pieces p2
      WHERE p2.ordre < menage_pieces.ordre OR (p2.ordre = menage_pieces.ordre AND p2.id < menage_pieces.id)
    ) % 8
    WHEN 0 THEN 'orange' WHEN 1 THEN 'cyan' WHEN 2 THEN 'violet' WHEN 3 THEN 'jaune'
    WHEN 4 THEN 'rose' WHEN 5 THEN 'bleu' WHEN 6 THEN 'vert' ELSE 'corail' END
    WHERE couleur = '';

  -- Reprise de ce qui existait : seuls les cochages qui avaient rapporté des points étaient notés.
  INSERT INTO menage_journal (tache_id, piece_id, jour, echeance, a_temps)
    SELECT f.tache_id, t.piece_id, f.jour, f.echeance, CASE WHEN julianday(f.jour) - julianday(f.echeance) <= 1 THEN 1 ELSE 0 END
    FROM menage_faits f JOIN menage_taches t ON t.id = f.tache_id;
`;

/** Une sauvegarde d'avant la migration 32 n'a pas de journal : on le refait depuis menage_faits (sans doublon). */
export const SQL_JOURNAL_DEPUIS_FAITS = `
  INSERT INTO menage_journal (tache_id, piece_id, jour, echeance, a_temps)
    SELECT f.tache_id, t.piece_id, f.jour, f.echeance, CASE WHEN julianday(f.jour) - julianday(f.echeance) <= 1 THEN 1 ELSE 0 END
    FROM menage_faits f JOIN menage_taches t ON t.id = f.tache_id
    WHERE NOT EXISTS (SELECT 1 FROM menage_journal j WHERE j.tache_id = f.tache_id AND j.echeance = f.echeance);
`;

/** Migration 36 : projets créatifs (galerie, étapes, journal de bord, matériel, notes et liens). */
export const SQL_PROJETS = `
  CREATE TABLE IF NOT EXISTS projet_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    icone TEXT NOT NULL DEFAULT 'sparkles',
    couleur TEXT NOT NULL DEFAULT '#4ADE80'
  );
  CREATE TABLE IF NOT EXISTS projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    type_id INTEGER NOT NULL DEFAULT 0,
    -- 'idee' | 'en_cours' | 'en_pause' | 'fini'
    etat TEXT NOT NULL DEFAULT 'idee',
    pourquoi TEXT NOT NULL DEFAULT '',
    -- photo de couverture (data URI JPEG compressée), vide = icône du type
    couverture TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    cree_le TEXT NOT NULL DEFAULT '',
    maj_le TEXT NOT NULL DEFAULT '',
    fini_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_etapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL DEFAULT 0,
    -- sous-étape : l'étape parente (une seule profondeur)
    parent_id INTEGER,
    nom TEXT NOT NULL DEFAULT '',
    ordre INTEGER NOT NULL DEFAULT 0,
    faite INTEGER NOT NULL DEFAULT 0,
    faite_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL DEFAULT 0,
    jour TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    minutes INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL DEFAULT 0,
    journal_id INTEGER,
    data TEXT NOT NULL DEFAULT '',
    -- 1 = photo finale (Mes réalisations)
    finale INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_materiel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL DEFAULT 0,
    nom TEXT NOT NULL DEFAULT '',
    -- 1 = à acheter, 0 = je l'ai
    a_acheter INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS projet_liens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL DEFAULT 0,
    titre TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_projet_etapes ON projet_etapes (projet_id);
  CREATE INDEX IF NOT EXISTS idx_projet_journal ON projet_journal (projet_id);
  CREATE INDEX IF NOT EXISTS idx_projet_photos ON projet_photos (projet_id);
`;

/** Types de départ, posés une fois (et reposés par listerTypes si la liste est vide, après la restauration d'une sauvegarde d'avant les projets). */
export const SQL_PROJET_TYPES_DEFAUT = `
  INSERT INTO projet_types (nom, icone, couleur)
    SELECT nom, icone, couleur FROM (
      SELECT 1 AS o, 'Électronique / Arduino' AS nom, 'cpu' AS icone, '#22D3EE' AS couleur
      UNION ALL SELECT 2, 'Peinture & dessin', 'palette', '#F472B6'
      UNION ALL SELECT 3, 'Artisanat', 'scissors', '#FB923C'
      UNION ALL SELECT 4, 'Musique', 'music', '#A78BFA'
      UNION ALL SELECT 5, 'Autre', 'sparkles', '#4ADE80'
    ) WHERE NOT EXISTS (SELECT 1 FROM projet_types) ORDER BY o;
`;

/**
 * Migration 37 : les étapes et le matériel d'un projet peuvent devenir des tâches (liste « Projets » et « Courses / achats »),
 * points par jour de projet, et un projet d'exemple (créé une seule fois, supprimable).
 */
export const SQL_PROJETS_V2 = `
  ALTER TABLE projet_etapes ADD COLUMN item_id INTEGER;
  ALTER TABLE projet_materiel ADD COLUMN item_id INTEGER;
  ALTER TABLE projets ADD COLUMN points_fini INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE IF NOT EXISTS projets_points_jours (
    jour TEXT PRIMARY KEY
  );
  INSERT INTO projets (nom, type_id, etat, pourquoi, cree_le, maj_le)
    SELECT 'Réveil lumineux ESP32',
           COALESCE((SELECT id FROM projet_types WHERE nom LIKE 'Électronique%' ORDER BY id LIMIT 1), 0),
           'idee', 'Un exemple pour voir comment ça marche : tu peux le supprimer.',
           strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
  INSERT INTO projet_etapes (projet_id, nom, ordre)
    SELECT (SELECT MAX(id) FROM projets), nom, ordre FROM (
      SELECT 0 AS ordre, 'Choisir les composants' AS nom
      UNION ALL SELECT 1, 'Commander'
      UNION ALL SELECT 2, 'Faire clignoter une LED'
      UNION ALL SELECT 3, 'Connecter au Wi-Fi'
      UNION ALL SELECT 4, 'Relier à l''appli'
    );
`;

/** Migration 38 : Cuisine (vegan) : inventaire, recettes, repas cuisinés, courses, meal prep. */
export const SQL_CUISINE = `
  CREATE TABLE IF NOT EXISTS aliments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    -- 'frigo' | 'congelateur' | 'placard' | 'epices'
    emplacement TEXT NOT NULL DEFAULT 'placard',
    categorie TEXT NOT NULL DEFAULT 'conserves',
    -- 'plein' | 'peu' | 'presque_fini'
    niveau TEXT NOT NULL DEFAULT 'plein',
    -- date de péremption (AAAA-MM-JJ), vide si inconnue
    peremption TEXT NOT NULL DEFAULT '',
    ouvert_le TEXT NOT NULL DEFAULT '',
    -- 1 = toujours là (sel, huile…) : ne baisse jamais et n'est jamais proposé aux courses
    toujours_la INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS recettes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL DEFAULT '',
    -- photo (data URI JPEG compressée), vide sinon
    photo TEXT NOT NULL DEFAULT '',
    portions INTEGER NOT NULL DEFAULT 2,
    prep_min INTEGER NOT NULL DEFAULT 0,
    cuisson_min INTEGER NOT NULL DEFAULT 0,
    -- tags séparés par des virgules
    tags TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    favori INTEGER NOT NULL DEFAULT 0,
    -- 1 = idée de départ fournie par l'appli
    depart INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT '',
    maj_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS recette_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recette_id INTEGER NOT NULL DEFAULT 0,
    ordre INTEGER NOT NULL DEFAULT 0,
    nom TEXT NOT NULL DEFAULT '',
    quantite REAL,
    unite TEXT NOT NULL DEFAULT '',
    -- nom de l'aliment du catalogue relié, vide sinon
    aliment TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS recette_etapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recette_id INTEGER NOT NULL DEFAULT 0,
    ordre INTEGER NOT NULL DEFAULT 0,
    texte TEXT NOT NULL DEFAULT '',
    minuteur_min INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS cuisines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recette_id INTEGER NOT NULL DEFAULT 0,
    titre TEXT NOT NULL DEFAULT '',
    jour TEXT NOT NULL DEFAULT '',
    portions INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    rayon TEXT NOT NULL DEFAULT 'autre',
    cochee INTEGER NOT NULL DEFAULT 0,
    -- 'manuel' | 'frigo' | 'recette' | 'meal_prep'
    source TEXT NOT NULL DEFAULT 'manuel',
    aliment_id INTEGER,
    cree_le TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS meal_prep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- lundi de la semaine, AAAA-MM-JJ
    semaine TEXT NOT NULL DEFAULT '',
    recette_id INTEGER NOT NULL DEFAULT 0,
    portions INTEGER NOT NULL DEFAULT 2
  );
  CREATE TABLE IF NOT EXISTS meal_prep_semaines (
    semaine TEXT PRIMARY KEY,
    jour_batch TEXT NOT NULL DEFAULT '',
    routine_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS aliments_jetes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL DEFAULT '',
    jour TEXT NOT NULL DEFAULT '',
    -- 'jete' | 'fini'
    raison TEXT NOT NULL DEFAULT 'jete'
  );
  CREATE TABLE IF NOT EXISTS cuisine_points_jours (
    jour TEXT PRIMARY KEY
  );
  CREATE INDEX IF NOT EXISTS idx_recette_ingredients ON recette_ingredients (recette_id);
  CREATE INDEX IF NOT EXISTS idx_recette_etapes ON recette_etapes (recette_id);
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
    ...(schemaSauvegarde < 32 ? [SQL_JOURNAL_DEPUIS_FAITS] : []),
  ];
}
