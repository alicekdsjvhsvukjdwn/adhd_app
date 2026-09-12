import { getDatabase } from "./client";

export type ProfilChoisi =
  | "semeur"
  | "sprinter"
  | "apaise"
  | "personnalise"
  | null;

export type IntensiteGamification = "aucune" | "discrete" | "complete";
export type TonMessages = "neutre" | "encourageant" | "apaisant";
export type RigiditeHoraire = "souple" | "moyenne" | "stricte";

export type Preferences = {
  profil: ProfilChoisi;
  onboardingFait: boolean;
  gamification: IntensiteGamification;
  ton: TonMessages;
  rigidite: RigiditeHoraire;
};

// Configurations préétablies par profil
export const CONFIGS_PROFILS: Record<
  Exclude<ProfilChoisi, "personnalise" | null>,
  Omit<Preferences, "profil" | "onboardingFait">
> = {
  semeur: {
    gamification: "discrete",
    ton: "encourageant",
    rigidite: "souple",
  },
  sprinter: {
    gamification: "complete",
    ton: "encourageant",
    rigidite: "moyenne",
  },
  apaise: {
    gamification: "aucune",
    ton: "apaisant",
    rigidite: "souple",
  },
};

// Valeurs par défaut si aucun profil choisi (utilisateur qui a skippé)
const PREFERENCES_DEFAUT: Preferences = {
  profil: null,
  onboardingFait: false,
  gamification: "complete",
  ton: "neutre",
  rigidite: "moyenne",
};

export async function initPreferences() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      profil TEXT,
      onboarding_fait INTEGER NOT NULL DEFAULT 0,
      gamification TEXT NOT NULL DEFAULT 'complete',
      ton TEXT NOT NULL DEFAULT 'neutre',
      rigidite TEXT NOT NULL DEFAULT 'moyenne'
    );
  `);
  await db.runAsync("INSERT OR IGNORE INTO preferences (id) VALUES (1)");
}

export async function getPreferences(): Promise<Preferences> {
  await initPreferences();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    profil: string | null;
    onboarding_fait: number;
    gamification: string;
    ton: string;
    rigidite: string;
  }>(
    "SELECT profil, onboarding_fait, gamification, ton, rigidite FROM preferences WHERE id = 1",
  );

  if (!row) return PREFERENCES_DEFAUT;

  return {
    profil: (row.profil as ProfilChoisi) ?? null,
    onboardingFait: row.onboarding_fait === 1,
    gamification: row.gamification as IntensiteGamification,
    ton: row.ton as TonMessages,
    rigidite: row.rigidite as RigiditeHoraire,
  };
}

export async function setProfil(
  profil: Exclude<ProfilChoisi, "personnalise" | null>,
) {
  await initPreferences();
  const db = await getDatabase();
  const config = CONFIGS_PROFILS[profil];
  await db.runAsync(
    "UPDATE preferences SET profil = ?, onboarding_fait = 1, gamification = ?, ton = ?, rigidite = ? WHERE id = 1",
    profil,
    config.gamification,
    config.ton,
    config.rigidite,
  );
}

export async function setProfilPersonnalise() {
  await initPreferences();
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE preferences SET profil = ?, onboarding_fait = 1 WHERE id = 1",
    "personnalise",
  );
}

export async function skipOnboarding() {
  await initPreferences();
  const db = await getDatabase();
  await db.runAsync("UPDATE preferences SET onboarding_fait = 1 WHERE id = 1");
}

export async function resetOnboarding() {
  await initPreferences();
  const db = await getDatabase();
  await db.runAsync("UPDATE preferences SET onboarding_fait = 0 WHERE id = 1");
}

export async function updateAxe(
  axe: "gamification" | "ton" | "rigidite",
  valeur: string,
) {
  await initPreferences();
  const db = await getDatabase();
  const colonneMap = {
    gamification: "gamification",
    ton: "ton",
    rigidite: "rigidite",
  };
  await db.runAsync(
    `UPDATE preferences SET ${colonneMap[axe]} = ? WHERE id = 1`,
    valeur,
  );
}
