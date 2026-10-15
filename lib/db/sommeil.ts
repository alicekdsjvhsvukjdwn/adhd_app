import { decalerJours } from "../dates";
import {
  dureeSommeilMin,
  ecartTypeCoucherMin,
  POINTS_NUIT,
  type Qualite,
} from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { addPoints } from "./stats";

/**
 * Sommeil : une nuit par jour du lever. Aucune autre partie de l'appli
 * (moteur, routines, Jour difficile) ne lit cette table.
 */

export type Nuit = {
  date: string;
  coucher: string;
  lever: string;
  duree_min: number;
  qualite: Qualite;
  ecrans: 0 | 1;
};

export async function getNuit(date: string): Promise<Nuit | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Nuit>(
    "SELECT date, coucher, lever, duree_min, qualite, ecrans FROM sommeil WHERE date = ?",
    date,
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

/** Enregistre ou corrige une nuit. Les points ne sont donnés qu'à la première saisie. */
export async function enregistrerNuit(n: Omit<Nuit, "duree_min">): Promise<void> {
  const db = await getDatabase();
  const maintenant = new Date().toISOString();
  const existante = await getNuit(n.date);
  await db.runAsync(
    `INSERT INTO sommeil (date, coucher, lever, duree_min, qualite, ecrans, saisi_le, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       coucher = excluded.coucher, lever = excluded.lever,
       duree_min = excluded.duree_min, qualite = excluded.qualite,
       ecrans = excluded.ecrans, maj_le = excluded.maj_le`,
    n.date,
    n.coucher,
    n.lever,
    dureeSommeilMin(n.coucher, n.lever),
    n.qualite,
    n.ecrans,
    maintenant,
    maintenant,
  );
  if (!existante) await addPoints(POINTS_NUIT);
}

export type ResumeSommeil = {
  derniere: Nuit | null;
  /** Durée moyenne des nuits notées sur les 7 derniers jours, ou null. */
  moyenne7j: number | null;
  nuits7j: number;
  /** Écart type de l'heure de coucher sur ces nuits, minutes. */
  ecartCoucher: number | null;
};

export async function resumeSommeil(): Promise<ResumeSommeil> {
  const db = await getDatabase();
  const debut = decalerJours(getAujourdhui(), -6);
  const nuits = await db.getAllAsync<Nuit>(
    "SELECT date, coucher, lever, duree_min, qualite, ecrans FROM sommeil WHERE date >= ? ORDER BY date DESC",
    debut,
  );
  const derniere = await db.getFirstAsync<Nuit>(
    "SELECT date, coucher, lever, duree_min, qualite, ecrans FROM sommeil ORDER BY date DESC LIMIT 1",
  );
  return {
    derniere,
    moyenne7j:
      nuits.length > 0
        ? nuits.reduce((s, n) => s + n.duree_min, 0) / nuits.length
        : null,
    nuits7j: nuits.length,
    ecartCoucher: ecartTypeCoucherMin(nuits.map((n) => n.coucher)),
  };
}
