import { dateLocale } from "../dates";
import {
  dureeSommeilMin,
  ecrireCoucher,
  hhmmMaintenant,
  jourDuLever,
  lireCoucher,
  nuitRapporte,
  POINTS_NUIT,
  reponsesCompletes,
  type Coucher,
  type Qualite,
  type ReponsesMatin,
} from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { addPoints } from "./stats";

/**
 * Sommeil : une nuit par jour du lever. Aucune autre partie de l'appli
 * (moteur, routines, Jour difficile) ne lit cette table.
 * La nuit en cours (coucher tapé, pas encore levée) vit dans meta.
 */

export type Nuit = {
  date: string;
  coucher: string;
  lever: string;
  duree_min: number;
  qualite: Qualite;
  ecrans: 0 | 1;
  /** 0 tant que qualité et écrans du matin ne sont pas donnés (valeurs par défaut). */
  reponses: 0 | 1;
};

const COLONNES = "date, coucher, lever, duree_min, qualite, ecrans, reponses";
const CLE_EN_COURS = "nuit_en_cours";
const cleReponses = (date: string) => `nuit_reponses:${date}`;

async function lireMeta(cle: string): Promise<string | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ valeur: string }>("SELECT valeur FROM meta WHERE cle = ?", cle);
  return r?.valeur ?? null;
}

async function ecrireMeta(cle: string, valeur: string | null): Promise<void> {
  const db = await getDatabase();
  if (valeur === null) await db.runAsync("DELETE FROM meta WHERE cle = ?", cle);
  else await db.runAsync("INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)", cle, valeur);
}

export async function getNuit(date: string): Promise<Nuit | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Nuit>(`SELECT ${COLONNES} FROM sommeil WHERE date = ?`, date);
}

export async function nuitsEntre(debut: string, fin: string): Promise<Nuit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Nuit>(
    `SELECT ${COLONNES} FROM sommeil WHERE date >= ? AND date <= ? ORDER BY date`,
    debut,
    fin,
  );
}

/** Heures à pré-remplir : celles de la nuit précédente la plus proche, sinon 23:00 → 07:00. */
export async function heuresParDefaut(
  date: string,
): Promise<{ coucher: string; lever: string }> {
  const db = await getDatabase();
  const veille = await db.getFirstAsync<{ coucher: string; lever: string }>(
    "SELECT coucher, lever FROM sommeil WHERE date < ? ORDER BY date DESC LIMIT 1",
    date,
  );
  return veille ?? { coucher: "23:00", lever: "07:00" };
}

/** Points de la nuit, une seule fois : quand ses réponses passent à « données ». */
async function pointsSiComplete(date: string, avant: Nuit | null): Promise<void> {
  if (avant?.reponses === 1) return;
  if (nuitRapporte(date, getAujourdhui())) await addPoints(POINTS_NUIT);
}

/** Écran de saisie complet (« corriger ») : la nuit a toutes ses réponses. */
export async function enregistrerNuit(n: Omit<Nuit, "duree_min" | "reponses">): Promise<void> {
  const db = await getDatabase();
  const maintenant = new Date().toISOString();
  const existante = await getNuit(n.date);
  await db.runAsync(
    `INSERT INTO sommeil (date, coucher, lever, duree_min, qualite, ecrans, reponses, saisi_le, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       coucher = excluded.coucher, lever = excluded.lever,
       duree_min = excluded.duree_min, qualite = excluded.qualite,
       ecrans = excluded.ecrans, reponses = 1, maj_le = excluded.maj_le`,
    n.date,
    n.coucher,
    n.lever,
    dureeSommeilMin(n.coucher, n.lever),
    n.qualite,
    n.ecrans,
    maintenant,
    maintenant,
  );
  await ecrireMeta(cleReponses(n.date), null);
  await pointsSiComplete(n.date, existante);
}

// ─── En un geste ────────────────────────────────────────────────────────

export const getNuitEnCours = async (): Promise<Coucher | null> =>
  lireCoucher(await lireMeta(CLE_EN_COURS));

/** « Je vais dormir » : l'heure de coucher, maintenant. */
export async function jeVaisDormir(): Promise<void> {
  await ecrireMeta(CLE_EN_COURS, ecrireCoucher({ date: dateLocale(), heure: hhmmMaintenant() }));
}

/** « Couchée à … · ajuster ». */
export const ajusterCoucher = (c: Coucher) => ecrireMeta(CLE_EN_COURS, ecrireCoucher(c));

/** Tap « Je vais dormir » par erreur. */
export const annulerNuitEnCours = () => ecrireMeta(CLE_EN_COURS, null);

/**
 * « Je me suis levée » : écrit la nuit tout de suite (rien ne se perd), réponses
 * à 0 jusqu'aux taps du matin. `coucher` : la nuit en cours, ou l'heure
 * donnée après un oubli du soir. `lever` : maintenant, sauf oubli du matin.
 * Une nuit déjà notée garde ses réponses. Renvoie le jour de la nuit.
 */
export async function jeMeLeve(p: { coucher?: Coucher; lever?: string } = {}): Promise<string> {
  const coucher = p.coucher ?? (await getNuitEnCours());
  if (!coucher) throw new Error("Pas de nuit en cours");
  const date = jourDuLever(coucher);
  const lever = p.lever ?? hhmmMaintenant();
  const db = await getDatabase();
  const maintenant = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sommeil (date, coucher, lever, duree_min, reponses, saisi_le, maj_le)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       coucher = excluded.coucher, lever = excluded.lever,
       duree_min = excluded.duree_min, maj_le = excluded.maj_le`,
    date,
    coucher.heure,
    lever,
    dureeSommeilMin(coucher.heure, lever),
    maintenant,
    maintenant,
  );
  await ecrireMeta(CLE_EN_COURS, null);
  return date;
}

/** Heures ajustées après « Je me suis levée » : réponses et points inchangés. */
export async function corrigerHeures(date: string, coucher: string, lever: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE sommeil SET coucher = ?, lever = ?, duree_min = ?, maj_le = ? WHERE date = ?",
    coucher,
    lever,
    dureeSommeilMin(coucher, lever),
    new Date().toISOString(),
    date,
  );
}

export async function getReponses(date: string): Promise<ReponsesMatin> {
  const nuit = await getNuit(date);
  if (nuit?.reponses === 1) return { qualite: nuit.qualite, ecrans: nuit.ecrans };
  try {
    return JSON.parse((await lireMeta(cleReponses(date))) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Un tap du matin (qualité ou écrans), gardé tout de suite. Avec les deux,
 * la nuit est complète : réponses à 1, et les points une fois.
 */
export async function repondre(date: string, r: ReponsesMatin): Promise<void> {
  const avant = await getNuit(date);
  const toutes = { ...(await getReponses(date)), ...r };
  const db = await getDatabase();
  if (avant?.reponses === 1) {
    // Déjà complète : on corrige simplement.
    await db.runAsync(
      "UPDATE sommeil SET qualite = ?, ecrans = ?, maj_le = ? WHERE date = ?",
      toutes.qualite ?? avant.qualite,
      toutes.ecrans ?? avant.ecrans,
      new Date().toISOString(),
      date,
    );
    return;
  }
  if (!reponsesCompletes(toutes)) {
    await ecrireMeta(cleReponses(date), JSON.stringify(toutes));
    return;
  }
  await db.runAsync(
    "UPDATE sommeil SET qualite = ?, ecrans = ?, reponses = 1, maj_le = ? WHERE date = ?",
    toutes.qualite,
    toutes.ecrans,
    new Date().toISOString(),
    date,
  );
  await ecrireMeta(cleReponses(date), null);
  await pointsSiComplete(date, avant);
}
