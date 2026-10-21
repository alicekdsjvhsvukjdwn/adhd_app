import {
  COLONNES_STATS,
  SQL_CATEGORIES_RECOMPENSES,
  SQL_CATEGORIES_RECOMPENSES_V2,
  SQL_COULEURS_LISTES,
  SQL_SEANCES_NOTEES,
  SQL_SKILLS_DEPUIS_PALIERS,
  SQL_TABLES_LOT4,
  SQL_TABLES_ESPRIT,
  SQL_TABLES_MENAGE,
  SQL_TABLES_TROIS,
  SQL_TABLES_SEANCES_GUIDEES,
  SQL_MOMENTS,
  SQL_RANG_MANUEL,
  SQL_JOURS_TACHE,
  SQL_MENAGE_V2,
  SQL_TCC_AUTONOME,
  SQL_TABLES_HORS_MIGRATIONS,
  SQL_VERSIONS_EN_ETAPES,
} from "../schema";
import { getDatabase } from "./client";

/**
 * Migrations versionnées via PRAGMA user_version.
 * Chaque migration s'exécute une seule fois, dans l'ordre, en transaction.
 * Pour en ajouter une : append dans MIGRATIONS, ne jamais modifier les précédentes.
 *
 * Sauvegardes (lib/db/sauvegarde.ts) : une sauvegarde plus ancienne est
 * restaurée colonne par colonne dans le schéma actuel. Une nouvelle colonne
 * NOT NULL doit donc avoir un DEFAULT, et une migration qui transforme des
 * données (comme la 5) doit garder les anciennes colonnes lisibles, sinon
 * les sauvegardes d'avant ne se restaurent plus.
 */

type Migration = {
  version: number;
  nom: string;
  run: (db: Awaited<ReturnType<typeof getDatabase>>) => Promise<void>;
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    nom: "baseline — tables héritées",
    run: async (db) => {
      // Idempotent : ne fait rien sur une base existante,
      // crée le minimum sur une installation neuve.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS routines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nom TEXT NOT NULL,
          fait INTEGER NOT NULL DEFAULT 0,
          ancre_id INTEGER,
          ancre_position TEXT DEFAULT 'apres'
        );
        CREATE TABLE IF NOT EXISTS completions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          routine_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          statut TEXT NOT NULL DEFAULT 'complet',
          UNIQUE(routine_id, date)
        );
      `);
    },
  },

  {
    version: 2,
    nom: "file unifiée items + completions par item + decision_log",
    run: async (db) => {
      await db.execAsync(`
        CREATE TABLE items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nom TEXT NOT NULL,

          -- 'routine' (récurrent) | 'tache' (ponctuel) | 'evenement' (daté, jamais scoré)
          type TEXT NOT NULL DEFAULT 'routine',
          -- 'actif' | 'pause' | 'archive' | 'termine'
          statut TEXT NOT NULL DEFAULT 'actif',

          -- NULL = ponctuel. Sinon 'quotidien' | 'jours:1,3,5' | 'hebdo'
          recurrence TEXT,

          -- provenance catalogue (le catalogue lui-même vit en TypeScript)
          template_id TEXT,
          variante_rang INTEGER,

          -- métadonnées de scoring : valeurs de départ, écrasées par l'observation
          categorie TEXT,
          moment TEXT,
          effort INTEGER,
          duree_min INTEGER,
          premiere_action TEXT,
          importance INTEGER NOT NULL DEFAULT 2,

          -- ancrage (intentions d'implémentation)
          ancre_id INTEGER,
          ancre_position TEXT,

          -- spécifique aux tâches ponctuelles
          echeance TEXT,
          effort_total_min INTEGER,
          taille_seance_min INTEGER,
          temps_passe_min INTEGER NOT NULL DEFAULT 0,

          -- contraintes externes (ex : appeler la sécu = jours ouvrés, 9h-17h)
          fenetre_jours TEXT,
          fenetre_debut_h INTEGER,
          fenetre_fin_h INTEGER,

          -- spécifique aux événements
          date_evenement TEXT,
          heure_evenement TEXT,

          -- observation accumulée (remplit les métadonnées manquantes)
          duree_reelle_moy_min REAL,
          heure_reelle_moy REAL,
          nb_completions INTEGER NOT NULL DEFAULT 0,
          nb_propositions_sans_action INTEGER NOT NULL DEFAULT 0,

          cree_le TEXT NOT NULL,
          maj_le TEXT NOT NULL
        );

        CREATE INDEX idx_items_statut ON items(statut, type);
        CREATE INDEX idx_items_echeance ON items(echeance);
      `);

      await db.execAsync(`
        INSERT INTO items (
          id, nom, type, statut, recurrence,
          ancre_id, ancre_position, cree_le, maj_le
        )
        SELECT
          id, nom, 'routine', 'actif', 'quotidien',
          ancre_id, ancre_position,
          datetime('now'), datetime('now')
        FROM routines;
      `);

      await db.execAsync(`
        CREATE TABLE completions_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          statut TEXT NOT NULL DEFAULT 'complet',
          heure INTEGER,
          duree_reelle_min INTEGER,
          horodatage TEXT,
          UNIQUE(item_id, date)
        );

        INSERT INTO completions_v2 (item_id, date, statut)
        SELECT routine_id, date, statut FROM completions;

        DROP TABLE completions;
        ALTER TABLE completions_v2 RENAME TO completions;
        DROP TABLE routines;

        CREATE INDEX idx_completions_date ON completions(date);
        CREATE INDEX idx_completions_item ON completions(item_id, date);
      `);

      await db.execAsync(`
        CREATE TABLE decision_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          horodatage TEXT NOT NULL,
          date TEXT NOT NULL,
          item_id INTEGER NOT NULL,
          score REAL NOT NULL,
          composantes TEXT NOT NULL,
          rang INTEGER NOT NULL,
          propose INTEGER NOT NULL DEFAULT 0,
          exploration INTEGER NOT NULL DEFAULT 0,
          raison TEXT,
          etat_energie INTEGER
        );

        CREATE INDEX idx_decision_date ON decision_log(date);
      `);
    },
  },

  {
    version: 3,
    nom: "sessions de focus et de régulation",
    run: async (db) => {
      await db.execAsync(`
        CREATE TABLE sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          -- 'focus' (minuteur sur une tâche) | 'regulation' (respiration, pause)
          type TEXT NOT NULL DEFAULT 'focus',

          -- rattachement facultatif : une session peut porter sur rien de précis
          item_id INTEGER,
          libelle TEXT,

          -- le cœur de l'intérêt : ce qu'on avait prévu vs ce qui s'est passé
          estimation_min INTEGER,
          reelle_min REAL,

          debut TEXT NOT NULL,
          fin TEXT,
          date TEXT NOT NULL,

          -- 0 = interrompue avant la fin du minuteur, 1 = allée au bout
          terminee INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_sessions_date ON sessions(date);
        CREATE INDEX idx_sessions_item ON sessions(item_id);
      `);
    },
  },

  {
    version: 4,
    nom: "check-in d'état",
    run: async (db) => {
      await db.execAsync(`
        CREATE TABLE etat (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,

          -- 'matin' | 'soir' : deux mesures par jour, pour voir la variation
          -- intra-journée — c'est elle qui explique qu'une routine passe
          -- à 10h et pas à 18h.
          fenetre TEXT NOT NULL,

          -- 1 = bas, 2 = moyen, 3 = haut
          energie INTEGER NOT NULL,
          focus INTEGER NOT NULL,
          humeur INTEGER NOT NULL,

          horodatage TEXT NOT NULL,
          UNIQUE(date, fenetre)
        );

        CREATE INDEX idx_etat_date ON etat(date);
      `);
    },
  },

  {
    version: 5,
    nom: "check-in d'état sans créneau fixe (heure exacte)",
    run: async (db) => {
      // Plus de créneau matin/soir ni de limite à une mesure par créneau :
      // on enregistre l'heure exacte, le moment de la journée est déduit
      // à l'affichage selon les données réellement disponibles.
      await db.execAsync(`
        CREATE TABLE etat_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,

          -- heure locale décimale (14.5 = 14 h 30)
          heure REAL NOT NULL,

          -- 1 = bas, 2 = moyen, 3 = haut
          energie INTEGER NOT NULL,
          focus INTEGER NOT NULL,
          humeur INTEGER NOT NULL,

          horodatage TEXT NOT NULL
        );

        INSERT INTO etat_v2 (id, date, heure, energie, focus, humeur, horodatage)
        SELECT id, date,
               CASE fenetre WHEN 'matin' THEN 10 ELSE 19 END,
               energie, focus, humeur, horodatage
        FROM etat;

        DROP TABLE etat;
        ALTER TABLE etat_v2 RENAME TO etat;

        CREATE INDEX idx_etat_date ON etat(date);
      `);

      // L'heure réelle des anciens check-ins est dans l'horodatage (UTC) :
      // JavaScript connaît le fuseau du téléphone, SQLite non.
      const anciens = await db.getAllAsync<{ id: number; horodatage: string }>(
        "SELECT id, horodatage FROM etat",
      );
      for (const r of anciens) {
        const d = new Date(r.horodatage);
        if (isNaN(d.getTime())) continue;
        await db.runAsync(
          "UPDATE etat SET heure = ? WHERE id = ?",
          d.getHours() + d.getMinutes() / 60,
          r.id,
        );
      }
    },
  },

  {
    version: 6,
    nom: "suggestions d'ajustement",
    run: async (db) => {
      // Les suggestions sont calculées à la volée ; on garde seulement les
      // décisions, pour ne pas reproposer trop tôt et pour mesurer
      // combien sont acceptées.
      await db.execAsync(`
        CREATE TABLE suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          -- type:item_id, ex. 'horaire:12'
          cle TEXT NOT NULL,
          -- 'horaire' | 'simplifier' | 'alleger' | 'monter' | 'ajouter'
          type TEXT NOT NULL,
          item_id INTEGER,

          -- 'acceptee' | 'refusee'
          statut TEXT NOT NULL,
          date TEXT NOT NULL,
          horodatage TEXT NOT NULL
        );

        CREATE INDEX idx_suggestions_cle ON suggestions(cle);
      `);
    },
  },

  {
    version: 7,
    nom: "difficultés choisies à la mise en place",
    run: async (db) => {
      // Ce que la personne a dit trouver difficile : sert à marquer ses choix
      // précédents, et plus tard à choisir quoi proposer.
      await db.execAsync(`
        CREATE TABLE difficultes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          difficulte_id TEXT NOT NULL UNIQUE,
          choisie_le TEXT NOT NULL
        );
      `);
    },
  },

  {
    version: 8,
    nom: "versions selon l'énergie et étapes des tâches",
    run: async (db) => {
      await db.execAsync(`
        -- Versions courte et longue écrites par la personne (sinon : catalogue)
        ALTER TABLE items ADD COLUMN version_courte TEXT;
        ALTER TABLE items ADD COLUMN version_longue TEXT;

        -- Version faite ce jour-là : 'courte' | 'normale' | 'longue'
        ALTER TABLE completions ADD COLUMN version TEXT;

        -- Étapes d'une grosse tâche
        CREATE TABLE etapes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL,
          nom TEXT NOT NULL,
          ordre INTEGER NOT NULL,
          faite INTEGER NOT NULL DEFAULT 0,
          faite_le TEXT
        );

        CREATE INDEX idx_etapes_item ON etapes(item_id);
      `);
    },
  },

  {
    version: 9,
    nom: "récompenses",
    run: async (db) => {
      await db.execAsync(`
        -- Récompenses réelles choisies par la personne
        CREATE TABLE recompenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nom TEXT NOT NULL,
          icone TEXT,
          prix INTEGER NOT NULL,
          cree_le TEXT NOT NULL
        );

        -- Achats : nom et prix recopiés, pour garder l'historique
        -- même si la récompense est modifiée ou supprimée ensuite.
        -- Solde à dépenser = points gagnés au total − somme des achats.
        CREATE TABLE achats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recompense_id INTEGER,
          nom TEXT NOT NULL,
          icone TEXT,
          prix INTEGER NOT NULL,
          date TEXT NOT NULL,
          horodatage TEXT NOT NULL
        );

        CREATE INDEX idx_achats_date ON achats(date);
      `);
    },
  },

  {
    version: 10,
    nom: "bilan de la journée : concentration et humeur facultatives",
    run: async (db) => {
      // Le bilan n'enregistre que l'énergie. SQLite ne sait pas retirer un
      // NOT NULL : on recopie la table, comme pour la migration 5.
      await db.execAsync(`
        CREATE TABLE etat_v3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,

          -- heure locale décimale (14.5 = 14 h 30)
          heure REAL NOT NULL,

          -- 1 = bas, 2 = moyen, 3 = haut
          energie INTEGER NOT NULL,
          -- NULL pour un bilan de la journée (énergie seule)
          focus INTEGER,
          humeur INTEGER,

          horodatage TEXT NOT NULL
        );

        INSERT INTO etat_v3 (id, date, heure, energie, focus, humeur, horodatage)
        SELECT id, date, heure, energie, focus, humeur, horodatage FROM etat;

        DROP TABLE etat;
        ALTER TABLE etat_v3 RENAME TO etat;

        CREATE INDEX idx_etat_date ON etat(date);
      `);
    },
  },

  {
    version: 11,
    nom: "listes de tâches",
    run: async (db) => {
      // Listes (Quotidien, Travail…) : un rangement des tâches, distinct des
      // domaines bien-être (sommeil, corps…) qui servent à l'équilibre.
      // Rejouable : une version de test l'avait numérotée 10 par erreur.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS listes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nom TEXT NOT NULL,
          icone TEXT,
          ordre INTEGER NOT NULL DEFAULT 0,
          cree_le TEXT NOT NULL
        );
      `);

      const colonnes = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(items)",
      );
      if (!colonnes.some((c) => c.name === "liste_id")) {
        await db.execAsync("ALTER TABLE items ADD COLUMN liste_id INTEGER;");
      }

      const n = await db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM listes",
      );
      if ((n?.n ?? 0) === 0) {
        await db.execAsync(`
          INSERT INTO listes (nom, icone, ordre, cree_le) VALUES
            ('Quotidien', '🏠', 0, datetime('now')),
            ('Travail', '💼', 1, datetime('now')),
            ('Administratif', '📬', 2, datetime('now')),
            ('Compétences', '🎨', 3, datetime('now')),
            ('Perso', '💛', 4, datetime('now'));
        `);
      }

      // Les tâches sans liste rejoignent Quotidien
      await db.execAsync(`
        UPDATE items SET liste_id = (SELECT id FROM listes WHERE nom = 'Quotidien')
        WHERE type = 'tache' AND liste_id IS NULL;
      `);
    },
  },

  {
    version: 12,
    nom: "sommeil",
    run: async (db) => {
      // Une nuit par jour du lever. La durée est stockée (calculée à la
      // saisie) pour que l'analyse n'ait rien à recalculer.
      await db.execAsync(`
        CREATE TABLE sommeil (
          date TEXT PRIMARY KEY,
          -- heures locales HH:MM
          coucher TEXT NOT NULL DEFAULT '',
          lever TEXT NOT NULL DEFAULT '',
          duree_min INTEGER NOT NULL DEFAULT 0,
          -- 1 = mauvaise, 2 = moyenne, 3 = bonne
          qualite INTEGER NOT NULL DEFAULT 2,
          ecrans INTEGER NOT NULL DEFAULT 0,
          saisi_le TEXT NOT NULL DEFAULT '',
          maj_le TEXT NOT NULL DEFAULT ''
        );
      `);
    },
  },

  {
    version: 13,
    nom: "sport : callisthénie guidée",
    run: async (db) => {
      await db.execAsync(`
        CREATE TABLE sport_reglages (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          barre_traction INTEGER NOT NULL DEFAULT 0,
          configure_le TEXT NOT NULL DEFAULT ''
        );

        -- 'pousser' | 'tirer' | 'jambes' | 'gainage'
        CREATE TABLE sport_paliers (
          famille TEXT PRIMARY KEY,
          palier INTEGER NOT NULL DEFAULT 1,
          maj_le TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE seances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL DEFAULT '',
          debut TEXT NOT NULL DEFAULT '',
          -- NULL tant que la séance n'est pas terminée
          fin TEXT,
          points_donnes INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_seances_date ON seances(date);

        -- Exercice et objectif recopiés : l'historique reste lisible
        -- même si les échelles changent.
        CREATE TABLE series (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          seance_id INTEGER NOT NULL DEFAULT 0,
          famille TEXT NOT NULL DEFAULT '',
          palier INTEGER NOT NULL DEFAULT 0,
          exercice TEXT NOT NULL DEFAULT '',
          numero INTEGER NOT NULL DEFAULT 0,
          -- 'reps' | 's'
          unite TEXT NOT NULL DEFAULT 'reps',
          objectif_bas INTEGER NOT NULL DEFAULT 0,
          objectif_haut INTEGER NOT NULL DEFAULT 0,
          realise INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_series_famille ON series(famille, palier);

        -- 'depart' | 'propose_accepte' | 'propose_refuse' | 'manuel'
        CREATE TABLE paliers_historique (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL DEFAULT '',
          horodatage TEXT NOT NULL DEFAULT '',
          famille TEXT NOT NULL DEFAULT '',
          de INTEGER,
          vers INTEGER NOT NULL DEFAULT 0,
          origine TEXT NOT NULL DEFAULT ''
        );
      `);
    },
  },

  {
    version: 14,
    nom: "routines à étapes et points par complétion",
    run: async (db) => {
      await db.execAsync(`
        -- Routines : une étape est essentielle (1) ou bonus (0).
        -- Les étapes des tâches existantes restent essentielles.
        ALTER TABLE etapes ADD COLUMN essentielle INTEGER NOT NULL DEFAULT 1;

        -- Étapes d'une routine cochées un jour donné (elles repartent
        -- à zéro chaque jour ; etapes.faite ne sert qu'aux tâches).
        CREATE TABLE etapes_cochees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          etape_id INTEGER NOT NULL DEFAULT 0,
          item_id INTEGER NOT NULL DEFAULT 0,
          date TEXT NOT NULL DEFAULT '',
          horodatage TEXT NOT NULL DEFAULT '',
          UNIQUE(etape_id, date)
        );
        CREATE INDEX idx_etapes_cochees_item ON etapes_cochees(item_id, date);

        -- Points réellement donnés pour cette complétion. NULL (anciennes
        -- lignes) = barème par statut (complet 10, partiel 5).
        ALTER TABLE completions ADD COLUMN points INTEGER;
      `);
    },
  },

  {
    version: 15,
    nom: "objectifs de liste par semaine ou par mois",
    run: async (db) => {
      await db.execAsync(`
        -- Nombre de tâches à faire dans la liste par période ; NULL = pas d'objectif.
        ALTER TABLE listes ADD COLUMN objectif INTEGER;
        -- 'semaine' | 'mois'
        ALTER TABLE listes ADD COLUMN objectif_periode TEXT;
      `);
    },
  },

  {
    version: 16,
    nom: "carnet : notes des tâches faites",
    run: async (db) => {
      // Une note par complétion, retrouvée par (item_id, date) : décocher
      // puis recocher le même jour garde la note.
      await db.execAsync(`
        CREATE TABLE notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL DEFAULT 0,
          date TEXT NOT NULL DEFAULT '',
          completion_id INTEGER,
          fait TEXT,
          retenu TEXT,
          idees TEXT,
          cree_le TEXT NOT NULL DEFAULT '',
          maj_le TEXT NOT NULL DEFAULT '',
          UNIQUE(item_id, date)
        );
      `);
    },
  },

  {
    version: 17,
    nom: "couleur des listes",
    run: async (db) => {
      // Clé de la palette (lib/theme-listes.ts), pas une couleur : lisible en clair et en sombre.
      await db.execAsync(`
        ALTER TABLE listes ADD COLUMN couleur TEXT;
        UPDATE listes SET couleur = 'orange' WHERE nom = 'Quotidien';
        UPDATE listes SET couleur = 'bleu' WHERE nom = 'Travail';
        UPDATE listes SET couleur = 'ardoise' WHERE nom = 'Administratif';
        UPDATE listes SET couleur = 'violet' WHERE nom = 'Compétences';
        UPDATE listes SET couleur = 'rose' WHERE nom = 'Perso';
      `);
      // Listes renommées ou ajoutées : une couleur encore libre chacune.
      // Recopie volontaire de l'ordre de la palette : une migration ne doit
      // pas changer si la palette change plus tard.
      const palette = ["bleu", "orange", "vert", "violet", "rose", "sarcelle", "ocre", "ardoise"];
      const sans = await db.getAllAsync<{ id: number }>(
        "SELECT id FROM listes WHERE couleur IS NULL ORDER BY ordre, id",
      );
      const prises = (
        await db.getAllAsync<{ couleur: string }>(
          "SELECT couleur FROM listes WHERE couleur IS NOT NULL",
        )
      ).map((r) => r.couleur);
      for (const l of sans) {
        const c = palette.find((x) => !prises.includes(x)) ?? palette[prises.length % palette.length];
        prises.push(c);
        await db.runAsync("UPDATE listes SET couleur = ? WHERE id = ?", c, l.id);
      }
    },
  },

  {
    version: 18,
    nom: "rangement : tables créées hors migrations",
    run: async (db) => {
      // ancres, stats, preferences, event_log, meta : créées jusqu'ici à la demande.
      await db.execAsync(SQL_TABLES_HORS_MIGRATIONS);
      const colonnes = (
        await db.getAllAsync<{ name: string }>("PRAGMA table_info(stats)")
      ).map((c) => c.name);
      for (const c of COLONNES_STATS) {
        if (!colonnes.includes(c.nom)) await db.execAsync(c.sql);
      }
    },
  },

  {
    version: 19,
    nom: "moments : une seule orthographe",
    run: async (db) => {
      await db.execAsync(SQL_MOMENTS);
    },
  },

  {
    version: 20,
    nom: "versions courte et longue devenues des étapes",
    run: async (db) => {
      await db.execAsync(SQL_VERSIONS_EN_ETAPES);
    },
  },

  {
    version: 21,
    nom: "nouvelle palette des listes",
    run: async (db) => {
      await db.execAsync(SQL_COULEURS_LISTES);
    },
  },

  {
    version: 22,
    nom: "catégories des récompenses",
    run: async (db) => {
      // 'plaisirs' | 'sorties' | 'musique' | 'temps' | 'gros' (lib/recompenses-regles.ts)
      await db.execAsync(`
        ALTER TABLE recompenses ADD COLUMN categorie TEXT NOT NULL DEFAULT 'plaisirs';
      `);
      await db.execAsync(SQL_CATEGORIES_RECOMPENSES);
    },
  },

  {
    version: 23,
    nom: "sommeil en un geste, méditation, arbre de skills",
    run: async (db) => {
      // 0 tant que la qualité et les écrans du matin ne sont pas donnés
      // (nuit écrite dès « Je me lève ») ; les nuits d'avant restent à 1.
      await db.execAsync(`
        ALTER TABLE sommeil ADD COLUMN reponses INTEGER NOT NULL DEFAULT 1;
      `);
      await db.execAsync(SQL_TABLES_LOT4);
      await db.execAsync(SQL_SKILLS_DEPUIS_PALIERS);
    },
  },

  {
    version: 24,
    nom: "séances guidées",
    run: async (db) => {
      await db.execAsync(SQL_TABLES_SEANCES_GUIDEES);
    },
  },

  {
    version: 25,
    nom: "séances de sport notées, routine liée au sport",
    run: async (db) => {
      await db.execAsync(SQL_SEANCES_NOTEES);
    },
  },

  {
    version: 26,
    nom: "mes 3 tâches du jour",
    run: async (db) => {
      await db.execAsync(SQL_TABLES_TROIS);
    },
  },

  {
    version: 27,
    nom: "place d'une tâche choisie à la main dans sa liste",
    run: async (db) => {
      await db.execAsync(SQL_RANG_MANUEL);
    },
  },

  {
    version: 28,
    nom: "étagères de récompenses : mer, bouffe, temps, découvertes, gros",
    run: async (db) => {
      await db.execAsync(SQL_CATEGORIES_RECOMPENSES_V2);
    },
  },

  {
    version: 29,
    nom: "ménage par pièce",
    run: async (db) => {
      await db.execAsync(SQL_TABLES_MENAGE);
    },
  },

  {
    version: 30,
    nom: "esprit : humeur, journal de pensées, TCC, vision",
    run: async (db) => {
      await db.execAsync(SQL_TABLES_ESPRIT);
    },
  },

  {
    version: 31,
    nom: "jours de la semaine d'une tâche régulière",
    run: async (db) => {
      await db.execAsync(SQL_JOURS_TACHE);
    },
  },

  {
    version: 32,
    nom: "ménage : couleur par pièce, suppression sans perte d'historique, journal",
    run: async (db) => {
      await db.execAsync(SQL_MENAGE_V2);
    },
  },

  {
    version: 33,
    nom: "TCC en autonomie : échelle d'exposition, journal de confiance, séances avec moi-même",
    run: async (db) => {
      await db.execAsync(SQL_TCC_AUTONOME);
    },
  },
];

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const versionActuelle = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= versionActuelle) continue;

    try {
      await db.withTransactionAsync(async () => {
        await migration.run(db);
      });
      // PRAGMA n'accepte pas de paramètre lié : la version vient du code, pas de l'utilisateur.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      console.log(`[db] migration ${migration.version} — ${migration.nom}`);
    } catch (e) {
      console.error(`[db] échec migration ${migration.version}`, e);
      throw e;
    }
  }
}
