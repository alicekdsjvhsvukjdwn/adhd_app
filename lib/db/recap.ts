/**
 * Récap du dimanche (règles : lib/recap-regles.ts). Tout est recalculé à partir des données ;
 * la table recap_semaine ne garde que ce que j'ai écrit ou choisi (fierté, piste).
 */
import { decalerJours, getDebutJour } from "../dates";
import { compterParZone, type CleZone, type Zone } from "../journee-regles";
import { objectifProche } from "../recompenses-regles";
import {
  CLE_RECAP,
  ideePour,
  lireReglagesRecap,
  MIN_ENTREES_RECAP,
  semaineDuRecap,
  zonePiste,
  zonesRetrouvees,
  type EntreeRecap,
  type Mesure,
  type ReglagesRecap,
} from "../recap-regles";
import { semaineDe } from "../regles-taches";
import { skill } from "../skills";
import { hhmmMaintenant } from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui, getRoutinesAvecStatutDuJour } from "./completions";
import { addItem } from "./items";
import { getListes } from "./listes";
import { entreesEntre, getZones } from "./journee";
import { ecrireMeta, lireMeta } from "./meta";
import { getRecompenses, lireObjectif, soldePoints } from "./recompenses";

export async function getReglagesRecap(): Promise<ReglagesRecap> {
  return lireReglagesRecap(await lireMeta(CLE_RECAP));
}

export async function ecrireReglagesRecap(r: ReglagesRecap): Promise<void> {
  await ecrireMeta(CLE_RECAP, JSON.stringify(r));
}

// ─── Points par jour (relevé du total) ──────────────────────────────────

/** Points gagnés entre deux jours compris ; null s'il n'y a pas de relevé avant le premier (pas assez de données). */
export async function pointsEntre(debut: string, fin: string): Promise<number | null> {
  const db = await getDatabase();
  const avant = await db.getFirstAsync<{ total: number }>("SELECT total FROM points_jours WHERE jour < ? ORDER BY jour DESC LIMIT 1", debut);
  const apres = await db.getFirstAsync<{ total: number }>("SELECT total FROM points_jours WHERE jour <= ? ORDER BY jour DESC LIMIT 1", fin);
  if (!avant || !apres) return null;
  return Math.max(0, apres.total - avant.total);
}

/** Moyenne de points par jour sur les 14 derniers jours ; null si les relevés couvrent moins de 7 jours. */
export async function moyennePoints14(): Promise<number | null> {
  const db = await getDatabase();
  const auj = getAujourdhui();
  const premier = await db.getFirstAsync<{ jour: string; total: number }>(
    "SELECT jour, total FROM points_jours WHERE jour >= ? ORDER BY jour LIMIT 1",
    decalerJours(auj, -14),
  );
  const dernier = await db.getFirstAsync<{ jour: string; total: number }>("SELECT jour, total FROM points_jours ORDER BY jour DESC LIMIT 1");
  if (!premier || !dernier) return null;
  const jours = Math.round((Date.parse(dernier.jour) - Date.parse(premier.jour)) / 86400000);
  if (jours < 7) return null;
  return Math.max(0, dernier.total - premier.total) / jours;
}

// ─── Les chiffres d'une semaine ─────────────────────────────────────────

async function compte(sql: string, ...p: string[]): Promise<number> {
  const db = await getDatabase();
  return (await db.getFirstAsync<{ n: number | null }>(sql, ...p))?.n ?? 0;
}

export async function mesures(lundi: string): Promise<Mesure[]> {
  const db = await getDatabase();
  const fin = decalerJours(lundi, 6);
  const sport =
    (await compte(
      `SELECT COUNT(*) AS n FROM seances s WHERE s.date BETWEEN ? AND ?
       AND (s.fin IS NOT NULL OR EXISTS (SELECT 1 FROM series x WHERE x.seance_id = s.id AND x.realise > 0))`,
      lundi,
      fin,
    )) + (await compte("SELECT COUNT(*) AS n FROM seances_guidees WHERE date BETWEEN ? AND ?", lundi, fin));
  let faites = 0;
  let prevues = 0;
  for (const j of semaineDe(lundi)) {
    if (j > getAujourdhui()) break;
    const r = await getRoutinesAvecStatutDuJour(j);
    prevues += r.length;
    faites += r.filter((x) => x.faitAujourdhui).length;
  }
  const sommeil = (await db.getFirstAsync<{ m: number | null }>("SELECT AVG(duree_min) AS m FROM sommeil WHERE date BETWEEN ? AND ?", lundi, fin))?.m ?? null;
  const tcc =
    (await compte("SELECT COUNT(*) AS n FROM tcc_expositions WHERE jour BETWEEN ? AND ?", lundi, fin)) +
    (await compte("SELECT COUNT(*) AS n FROM tcc_seances_moi WHERE jour BETWEEN ? AND ?", lundi, fin)) +
    (await compte("SELECT COUNT(*) AS n FROM pensees WHERE jour BETWEEN ? AND ?", lundi, fin));
  return [
    { cle: "sport", titre: "Séances de sport", valeur: sport },
    { cle: "cuisine", titre: "Repas maison", valeur: await compte("SELECT COUNT(*) AS n FROM cuisines WHERE jour BETWEEN ? AND ?", lundi, fin) },
    { cle: "routines", titre: "Routines faites", valeur: prevues ? (100 * faites) / prevues : null, unite: "%" },
    { cle: "sommeil", titre: "Sommeil moyen", valeur: sommeil === null ? null : Math.round(sommeil), unite: "min" },
    { cle: "tcc", titre: "Exercices TCC", valeur: tcc },
    { cle: "menage", titre: "Ménage", valeur: await compte("SELECT COUNT(*) AS n FROM menage_journal WHERE jour BETWEEN ? AND ?", lundi, fin) },
    { cle: "projets", titre: "Étapes de projets", valeur: await compte("SELECT COUNT(*) AS n FROM projet_etapes WHERE faite = 1 AND faite_le BETWEEN ? AND ?", lundi, fin) },
    { cle: "meditation", titre: "Méditations", valeur: await compte("SELECT COUNT(*) AS n FROM meditations WHERE date BETWEEN ? AND ?", lundi, fin) },
  ];
}

/** « Première fois » : nouvelle étape de skill, nouvelle recette, zone retrouvée après 14 jours. */
async function premieresFois(lundi: string, entrees: EntreeRecap[], zones: Zone[]): Promise<string[]> {
  const db = await getDatabase();
  const fin = decalerJours(lundi, 6);
  const sortie: string[] = [];
  for (const s of await db.getAllAsync<{ skill: string; origine: string }>(
    "SELECT DISTINCT skill, origine FROM skills_historique WHERE date BETWEEN ? AND ? AND origine IN ('valide', 'maitrise')",
    lundi,
    fin,
  )) {
    const nom = skill(s.skill)?.nom ?? s.skill;
    sortie.push(s.origine === "maitrise" ? `Skill maîtrisé : ${nom}` : `Nouvelle étape réussie : ${nom}`);
  }
  for (const r of await db.getAllAsync<{ titre: string }>(
    `SELECT MIN(titre) AS titre FROM cuisines c WHERE jour BETWEEN ? AND ?
       AND NOT EXISTS (SELECT 1 FROM cuisines d WHERE d.recette_id = c.recette_id AND d.jour < ?)
     GROUP BY recette_id`,
    lundi,
    fin,
    lundi,
  )) {
    sortie.push(`Nouvelle recette faite : ${r.titre}`);
  }
  const dernieres: Record<string, string | null> = {};
  for (const z of zones) {
    dernieres[z.cle] = (await db.getFirstAsync<{ j: string | null }>("SELECT MAX(jour) AS j FROM journal WHERE zone = ? AND jour < ? AND masque = 0", z.cle, lundi))?.j ?? null;
  }
  for (const z of zonesRetrouvees(entrees, dernieres, lundi)) {
    const libelle = zones.find((x) => x.cle === z)?.libelle ?? z;
    sortie.push(`« ${libelle} » revient, après plus de 14 jours`);
  }
  return sortie.slice(0, 3);
}

export type LigneRecap = {
  semaine_debut: string;
  vu_le: string | null;
  fierte: string | null;
  piste_zone: string | null;
  piste_texte: string | null;
  piste_ajoutee: number;
};

export async function lireLigneRecap(lundi: string): Promise<LigneRecap | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LigneRecap>("SELECT * FROM recap_semaine WHERE semaine_debut = ?", lundi);
}

/** Tout ce qu'il faut pour les 6 cartes d'une semaine. */
export async function donneesRecap(lundi: string) {
  const fin = decalerJours(lundi, 6);
  const [zones, entrees, cette, avant, reglages, ligne, points, recompenses, solde, objectifId] = await Promise.all([
    getZones(),
    entreesEntre(lundi, fin),
    mesures(lundi),
    mesures(decalerJours(lundi, -7)),
    getReglagesRecap(),
    lireLigneRecap(lundi),
    pointsEntre(lundi, fin),
    getRecompenses(),
    soldePoints(),
    lireObjectif(),
  ]);
  const comptes = compterParZone(entrees);
  const zonePropo = (ligne?.piste_zone as CleZone | null) ?? zonePiste(zones, comptes);
  return {
    lundi,
    zones,
    entrees,
    comptes,
    court: entrees.length < MIN_ENTREES_RECAP,
    cette,
    avant,
    premieres: await premieresFois(lundi, entrees, zones),
    piste:
      reglages.piste && zonePropo
        ? { zone: zonePropo, texte: ligne?.piste_texte ?? ideePour(zonePropo, lundi, reglages.idees), ajoutee: !!ligne?.piste_ajoutee }
        : null,
    points,
    objectif: objectifProche(recompenses, solde, objectifId),
    fierte: ligne?.fierte ?? "",
  };
}

async function assurerLigne(lundi: string) {
  const db = await getDatabase();
  await db.runAsync("INSERT OR IGNORE INTO recap_semaine (semaine_debut) VALUES (?)", lundi);
}

/** À l'ouverture : vu, et la piste proposée est enregistrée (la même à chaque réouverture). */
export async function marquerVu(lundi: string, piste: { zone: string; texte: string } | null): Promise<void> {
  const db = await getDatabase();
  await assurerLigne(lundi);
  await db.runAsync("UPDATE recap_semaine SET vu_le = COALESCE(vu_le, ?) WHERE semaine_debut = ?", new Date().toISOString(), lundi);
  if (piste)
    await db.runAsync(
      "UPDATE recap_semaine SET piste_zone = COALESCE(piste_zone, ?), piste_texte = COALESCE(piste_texte, ?) WHERE semaine_debut = ?",
      piste.zone,
      piste.texte,
      lundi,
    );
}

export async function ecrireFierte(lundi: string, texte: string): Promise<void> {
  const db = await getDatabase();
  await assurerLigne(lundi);
  await db.runAsync("UPDATE recap_semaine SET fierte = ? WHERE semaine_debut = ?", texte.trim() || null, lundi);
}

/** « Ajouter cette idée » : une tâche dans « À ne pas oublier » (première liste), une seule fois. */
export async function ajouterIdee(lundi: string, texte: string): Promise<void> {
  const db = await getDatabase();
  const l = await lireLigneRecap(lundi);
  if (l?.piste_ajoutee) return;
  const listes = await getListes();
  await addItem({ nom: texte, type: "tache", liste_id: listes[0]?.id ?? null });
  await assurerLigne(lundi);
  await db.runAsync("UPDATE recap_semaine SET piste_ajoutee = 1 WHERE semaine_debut = ?", lundi);
}

/** Le lundi du récap disponible maintenant, et s'il n'a pas encore été ouvert. */
export async function recapDisponible(): Promise<{ lundi: string; nouveau: boolean }> {
  const r = await getReglagesRecap();
  const lundi = semaineDuRecap(getAujourdhui(), hhmmMaintenant(), r.heure, getDebutJour());
  const l = await lireLigneRecap(lundi);
  const db = await getDatabase();
  const aDesEntrees = !!(await db.getFirstAsync("SELECT 1 FROM journal WHERE jour BETWEEN ? AND ? AND masque = 0", lundi, decalerJours(lundi, 6)));
  return { lundi, nouveau: aDesEntrees && !l?.vu_le };
}

/** Suivi › Mes semaines : les semaines passées qui ont des entrées, la plus récente d'abord. */
export async function semainesPassees(): Promise<{ lundi: string; total: number; comptes: Record<string, number> }[]> {
  const db = await getDatabase();
  const { lundi: dernier } = await recapDisponible();
  const premier = (await db.getFirstAsync<{ j: string | null }>("SELECT MIN(jour) AS j FROM journal WHERE masque = 0"))?.j;
  if (!premier) return [];
  const sortie: { lundi: string; total: number; comptes: Record<string, number> }[] = [];
  for (let l = dernier; l >= semaineDe(premier)[0]; l = decalerJours(l, -7)) {
    const e = await entreesEntre(l, decalerJours(l, 6));
    if (e.length) sortie.push({ lundi: l, total: e.length, comptes: compterParZone(e) });
  }
  return sortie;
}
