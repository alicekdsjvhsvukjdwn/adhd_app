import { getDatabase } from "./client";

/**
 * Migrations versionnées via PRAGMA user_version.
 * Chaque migration s'exécute une seule fois, dans l'ordre, en transaction.
 * Pour en ajouter une : append dans MIGRATIONS, ne jamais modifier les précédentes.
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
