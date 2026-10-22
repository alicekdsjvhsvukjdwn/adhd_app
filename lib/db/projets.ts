import { avancement, couleurValide, estFaite, etatValide, iconeValide, minutesParSemaine, POINTS_PROJET_FINI, POINTS_PROJET_JOUR, projetsOublies, tempsTotal, type EtapeProjet, type EtatProjet } from "../projets-regles";
import { SQL_PROJET_TYPES_DEFAUT } from "../schema";
import { getDatabase } from "./client";
import { completer, getAujourdhui } from "./completions";
import { addItem, deleteItem } from "./items";
import { LISTE_COURSES, LISTE_PROJETS, listeSysteme } from "./listes-systeme";
import { addPoints } from "./stats";
import { placerDansTrois } from "./trois";

/**
 * Projets créatifs : galerie, étapes (une profondeur de sous-étapes), journal de bord, matériel, notes et liens.
 * Les photos sont gardées dans la base (data URI JPEG compressée par lib/photos.ts) et partent avec la sauvegarde.
 */

export type TypeProjet = { id: number; nom: string; icone: string; couleur: string };
export type Projet = {
  id: number;
  nom: string;
  type_id: number;
  etat: EtatProjet;
  pourquoi: string;
  couverture: string;
  notes: string;
  cree_le: string;
  maj_le: string;
  fini_le: string;
};
export type EtapeBdd = EtapeProjet & { projet_id: number; faite_le: string; item_id: number | null };
export type EntreeJournal = { id: number; projet_id: number; jour: string; note: string; minutes: number; cree_le: string; photos: PhotoProjet[] };
export type PhotoProjet = { id: number; projet_id: number; journal_id: number | null; data: string; finale: number; cree_le: string };
export type Materiel = { id: number; projet_id: number; nom: string; a_acheter: number; item_id: number | null };
export type LienProjet = { id: number; projet_id: number; titre: string; url: string };

const maintenant = () => new Date().toISOString();

const toucher = async (projetId: number) => {
  const db = await getDatabase();
  await db.runAsync("UPDATE projets SET maj_le = ? WHERE id = ?", maintenant(), projetId);
};

// ─── Points ─────────────────────────────────────────────────────────────

/** +5 la première fois du jour où un projet avance (séance ou étape cochée). Renvoie les points donnés. */
export async function crediterProgres(): Promise<number> {
  const db = await getDatabase();
  const jour = await getAujourdhui();
  if (await db.getFirstAsync("SELECT 1 FROM projets_points_jours WHERE jour = ?", jour)) return 0;
  await db.runAsync("INSERT INTO projets_points_jours (jour) VALUES (?)", jour);
  await addPoints(POINTS_PROJET_JOUR);
  return POINTS_PROJET_JOUR;
}

// ─── Types ──────────────────────────────────────────────────────────────

export async function listerTypes(): Promise<TypeProjet[]> {
  const db = await getDatabase();
  // Jamais vide : une sauvegarde d'avant les projets a vidé la table à la restauration.
  await db.execAsync(SQL_PROJET_TYPES_DEFAUT);
  return db.getAllAsync<TypeProjet>("SELECT id, nom, icone, couleur FROM projet_types ORDER BY id");
}

export async function ajouterType(nom: string, icone: string, couleur: string): Promise<number | null> {
  const n = nom.trim();
  if (!n) return null;
  const db = await getDatabase();
  const r = await db.runAsync("INSERT INTO projet_types (nom, icone, couleur) VALUES (?, ?, ?)", n, iconeValide(icone), couleurValide(couleur));
  return r.lastInsertRowId;
}

export async function modifierType(id: number, nom: string, icone: string, couleur: string): Promise<void> {
  const n = nom.trim();
  if (!n) return;
  const db = await getDatabase();
  await db.runAsync("UPDATE projet_types SET nom = ?, icone = ?, couleur = ? WHERE id = ?", n, iconeValide(icone), couleurValide(couleur), id);
}

/** Supprime un type ; ses projets passent dans « Autre » (le dernier type de la liste si « Autre » n'existe plus). */
export async function supprimerType(id: number): Promise<boolean> {
  const db = await getDatabase();
  const autres = await db.getAllAsync<{ id: number; nom: string }>("SELECT id, nom FROM projet_types WHERE id <> ? ORDER BY id", id);
  if (autres.length === 0) return false; // il en faut toujours un
  const repli = autres.find((t) => t.nom === "Autre") ?? autres[autres.length - 1];
  await db.runAsync("UPDATE projets SET type_id = ? WHERE type_id = ?", repli.id, id);
  await db.runAsync("DELETE FROM projet_types WHERE id = ?", id);
  return true;
}

// ─── Projets ────────────────────────────────────────────────────────────

export async function listerProjets(): Promise<(Projet & { jauge: number; faites: number; total: number })[]> {
  const db = await getDatabase();
  const projets = await db.getAllAsync<Projet>("SELECT * FROM projets ORDER BY id");
  const etapes = await db.getAllAsync<EtapeProjet & { projet_id: number }>("SELECT id, projet_id, parent_id, nom, ordre, faite FROM projet_etapes");
  return projets.map((p) => ({ ...p, ...avancement(etapes.filter((e) => e.projet_id === p.id)) }));
}

export async function lireProjet(id: number): Promise<Projet | null> {
  const db = await getDatabase();
  return (await db.getFirstAsync<Projet>("SELECT * FROM projets WHERE id = ?", id)) ?? null;
}

/** Crée un projet avec ses premières étapes (une par ligne, déjà découpées). */
export async function creerProjet(d: { nom: string; type_id: number; pourquoi?: string; couverture?: string; etapes?: string[]; etat?: EtatProjet }): Promise<number | null> {
  const nom = d.nom.trim();
  if (!nom) return null;
  const db = await getDatabase();
  const t = maintenant();
  const r = await db.runAsync(
    "INSERT INTO projets (nom, type_id, etat, pourquoi, couverture, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
    nom,
    d.type_id,
    etatValide(d.etat ?? "idee"),
    (d.pourquoi ?? "").trim(),
    d.couverture ?? "",
    t,
    t,
  );
  const id = r.lastInsertRowId;
  for (const e of d.etapes ?? []) await ajouterEtape(id, e);
  return id;
}

export async function modifierProjet(id: number, d: { nom: string; type_id: number; pourquoi: string; couverture: string }): Promise<void> {
  const nom = d.nom.trim();
  if (!nom) return;
  const db = await getDatabase();
  await db.runAsync("UPDATE projets SET nom = ?, type_id = ?, pourquoi = ?, couverture = ?, maj_le = ? WHERE id = ?", nom, d.type_id, d.pourquoi.trim(), d.couverture, maintenant(), id);
}

export async function enregistrerNotes(id: number, notes: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE projets SET notes = ?, maj_le = ? WHERE id = ?", notes, maintenant(), id);
}

/** Change l'état d'un tap. « Fini » date la réalisation ; en repartant, la date saute. */
export async function changerEtat(id: number, etat: EtatProjet): Promise<void> {
  const db = await getDatabase();
  const fini = etat === "fini" ? await getAujourdhui() : "";
  await db.runAsync("UPDATE projets SET etat = ?, fini_le = ?, maj_le = ? WHERE id = ?", etatValide(etat), fini, maintenant(), id);
  // +50 une seule fois par projet, même si on le remet en cours puis qu'on le re-termine.
  if (etat === "fini" && (await db.getFirstAsync("SELECT 1 FROM projets WHERE id = ? AND points_fini = 0", id))) {
    await db.runAsync("UPDATE projets SET points_fini = 1 WHERE id = ?", id);
    await addPoints(POINTS_PROJET_FINI);
  }
}

export async function supprimerProjet(id: number): Promise<void> {
  const db = await getDatabase();
  for (const e of await listerEtapes(id)) if (e.item_id) await retirerTache(e.item_id);
  for (const m of await listerMateriel(id)) if (m.item_id) await retirerTache(m.item_id);
  for (const t of ["projet_etapes", "projet_journal", "projet_photos", "projet_materiel", "projet_liens"]) {
    await db.runAsync(`DELETE FROM ${t} WHERE projet_id = ?`, id);
  }
  await db.runAsync("DELETE FROM projets WHERE id = ?", id);
}

// ─── Étapes ─────────────────────────────────────────────────────────────

export async function listerEtapes(projetId: number): Promise<EtapeBdd[]> {
  const db = await getDatabase();
  return db.getAllAsync<EtapeBdd>("SELECT id, projet_id, parent_id, nom, ordre, faite, faite_le, item_id FROM projet_etapes WHERE projet_id = ? ORDER BY ordre, id", projetId);
}

export async function ajouterEtape(projetId: number, nom: string, parentId: number | null = null): Promise<number | null> {
  const n = nom.trim();
  if (!n) return null;
  const db = await getDatabase();
  const m = await db.getFirstAsync<{ m: number | null }>(
    parentId === null ? "SELECT MAX(ordre) AS m FROM projet_etapes WHERE projet_id = ? AND parent_id IS NULL" : "SELECT MAX(ordre) AS m FROM projet_etapes WHERE projet_id = ? AND parent_id = ?",
    ...(parentId === null ? [projetId] : [projetId, parentId]),
  );
  const r = await db.runAsync("INSERT INTO projet_etapes (projet_id, parent_id, nom, ordre) VALUES (?, ?, ?, ?)", projetId, parentId, n, (m?.m ?? -1) + 1);
  // Une étape déjà cochée qui reçoit sa première sous-étape redevient à faire : elle suit ses sous-étapes.
  if (parentId !== null) await db.runAsync("UPDATE projet_etapes SET faite = 0, faite_le = '' WHERE id = ?", parentId);
  await toucher(projetId);
  return r.lastInsertRowId;
}

export async function renommerEtape(id: number, nom: string): Promise<void> {
  const n = nom.trim();
  if (!n) return;
  const db = await getDatabase();
  await db.runAsync("UPDATE projet_etapes SET nom = ? WHERE id = ?", n, id);
}

export async function supprimerEtape(id: number): Promise<void> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ projet_id: number; parent_id: number | null }>("SELECT projet_id, parent_id FROM projet_etapes WHERE id = ?", id);
  if (!e) return;
  for (const x of await db.getAllAsync<{ item_id: number | null }>("SELECT item_id FROM projet_etapes WHERE id = ? OR parent_id = ?", id, id)) if (x.item_id) await retirerTache(x.item_id);
  await db.runAsync("DELETE FROM projet_etapes WHERE id = ? OR parent_id = ?", id, id);
  if (e.parent_id !== null) await synchroniserParent(e.parent_id);
  await toucher(e.projet_id);
}

/** Un parent se coche quand toutes ses sous-étapes le sont, et se décoche sinon. */
async function synchroniserParent(parentId: number): Promise<void> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ projet_id: number }>("SELECT projet_id FROM projet_etapes WHERE id = ?", parentId);
  if (!e) return;
  const toutes = await listerEtapes(e.projet_id);
  const faite = estFaite(toutes, parentId);
  const enfants = toutes.filter((x) => x.parent_id === parentId);
  if (enfants.length === 0) return;
  await db.runAsync("UPDATE projet_etapes SET faite = ?, faite_le = ? WHERE id = ?", faite ? 1 : 0, faite ? await getAujourdhui() : "", parentId);
}

/**
 * Coche ou décoche une étape (inverse son état, ou le force avec `faite`).
 * Renvoie vrai si elle vient d'être cochée (utile aux points, au lot B).
 */
export async function basculerEtape(id: number, faite?: boolean): Promise<boolean> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ projet_id: number; parent_id: number | null; faite: number }>("SELECT projet_id, parent_id, faite FROM projet_etapes WHERE id = ?", id);
  if (!e) return false;
  const enfants = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM projet_etapes WHERE parent_id = ?", id);
  const nouvelle = faite ?? e.faite === 0;
  const jour = await getAujourdhui();
  if ((enfants?.n ?? 0) > 0) {
    // une étape découpée : cocher = tout cocher
    await db.runAsync("UPDATE projet_etapes SET faite = ?, faite_le = ? WHERE parent_id = ?", nouvelle ? 1 : 0, nouvelle ? jour : "", id);
  }
  await db.runAsync("UPDATE projet_etapes SET faite = ?, faite_le = ? WHERE id = ?", nouvelle ? 1 : 0, nouvelle ? jour : "", id);
  if (e.parent_id !== null) await synchroniserParent(e.parent_id);
  await toucher(e.projet_id);
  const vientDEtreCochee = nouvelle && e.faite === 0;
  if (vientDEtreCochee) {
    await crediterProgres();
    // La tâche qui la reflète (★ Pour aujourd'hui) se coche aussi, une seule fois.
    const lie = await db.getFirstAsync<{ item_id: number | null }>("SELECT item_id FROM projet_etapes WHERE id = ?", id);
    if (lie?.item_id && (await db.getFirstAsync("SELECT 1 FROM items WHERE id = ? AND statut = 'actif'", lie.item_id))) await completer(lie.item_id, "complet");
  }
  return vientDEtreCochee;
}

/** Monte (-1) ou descend (+1) une étape parmi ses voisines (même parent). */
export async function deplacerEtape(id: number, sens: -1 | 1): Promise<void> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ projet_id: number; parent_id: number | null }>("SELECT projet_id, parent_id FROM projet_etapes WHERE id = ?", id);
  if (!e) return;
  const voisines = (await listerEtapes(e.projet_id)).filter((x) => x.parent_id === e.parent_id);
  const i = voisines.findIndex((x) => x.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= voisines.length) return;
  const ordre = voisines.map((x) => x.id);
  [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  for (let k = 0; k < ordre.length; k++) await db.runAsync("UPDATE projet_etapes SET ordre = ? WHERE id = ?", k, ordre[k]);
  await toucher(e.projet_id);
}

// ─── Journal de bord ────────────────────────────────────────────────────

export async function ajouterEntree(projetId: number, d: { note?: string; minutes?: number; photos?: string[]; jour?: string }): Promise<number> {
  const db = await getDatabase();
  const jour = d.jour ?? (await getAujourdhui());
  const t = maintenant();
  const r = await db.runAsync("INSERT INTO projet_journal (projet_id, jour, note, minutes, cree_le) VALUES (?, ?, ?, ?, ?)", projetId, jour, (d.note ?? "").trim(), Math.max(0, Math.round(d.minutes ?? 0)), t);
  for (const p of d.photos ?? []) await db.runAsync("INSERT INTO projet_photos (projet_id, journal_id, data, cree_le) VALUES (?, ?, ?, ?)", projetId, r.lastInsertRowId, p, t);
  await toucher(projetId);
  if ((d.minutes ?? 0) > 0) await crediterProgres();
  return r.lastInsertRowId;
}

/** Les entrées, de la plus récente à la plus ancienne, avec leurs photos. */
export async function listerJournal(projetId: number): Promise<EntreeJournal[]> {
  const db = await getDatabase();
  const entrees = await db.getAllAsync<Omit<EntreeJournal, "photos">>("SELECT * FROM projet_journal WHERE projet_id = ? ORDER BY jour DESC, id DESC", projetId);
  const photos = await db.getAllAsync<PhotoProjet>("SELECT * FROM projet_photos WHERE projet_id = ? AND journal_id IS NOT NULL ORDER BY id", projetId);
  return entrees.map((e) => ({ ...e, photos: photos.filter((p) => p.journal_id === e.id) }));
}

export async function supprimerEntree(id: number): Promise<void> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ projet_id: number }>("SELECT projet_id FROM projet_journal WHERE id = ?", id);
  await db.runAsync("DELETE FROM projet_photos WHERE journal_id = ?", id);
  await db.runAsync("DELETE FROM projet_journal WHERE id = ?", id);
  if (e) await toucher(e.projet_id);
}

export async function tempsPasse(projetId: number): Promise<number> {
  const db = await getDatabase();
  return tempsTotal(await db.getAllAsync<{ minutes: number }>("SELECT minutes FROM projet_journal WHERE projet_id = ?", projetId));
}

/** Toutes les photos du journal, de la plus ancienne à la plus récente (pour « avant → maintenant »). */
export async function photosDuJournal(projetId: number): Promise<PhotoProjet[]> {
  const db = await getDatabase();
  return db.getAllAsync<PhotoProjet>("SELECT * FROM projet_photos WHERE projet_id = ? AND journal_id IS NOT NULL ORDER BY cree_le, id", projetId);
}

/** Photos finales d'un projet fini (Mes réalisations). */
export async function ajouterPhotoFinale(projetId: number, data: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT INTO projet_photos (projet_id, journal_id, data, finale, cree_le) VALUES (?, NULL, ?, 1, ?)", projetId, data, maintenant());
  await toucher(projetId);
}

export async function photosFinales(projetId: number): Promise<PhotoProjet[]> {
  const db = await getDatabase();
  return db.getAllAsync<PhotoProjet>("SELECT * FROM projet_photos WHERE projet_id = ? AND finale = 1 ORDER BY id", projetId);
}

export async function supprimerPhoto(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM projet_photos WHERE id = ?", id);
}

// ─── Matériel, liens ────────────────────────────────────────────────────

export async function listerMateriel(projetId: number): Promise<Materiel[]> {
  const db = await getDatabase();
  return db.getAllAsync<Materiel>("SELECT * FROM projet_materiel WHERE projet_id = ? ORDER BY a_acheter DESC, id", projetId);
}

/** Une tâche « à acheter » dans la liste Courses / achats (la même que celle de Cuisine, plus tard). */
async function tacheAchat(projetId: number, nom: string): Promise<number> {
  const p = await lireProjet(projetId);
  return addItem({ nom: p ? `${nom} (${p.nom})` : nom, type: "tache", liste_id: await listeSysteme(LISTE_COURSES) });
}

export async function ajouterMateriel(projetId: number, nom: string, aAcheter = true): Promise<void> {
  const n = nom.trim();
  if (!n) return;
  const db = await getDatabase();
  await db.runAsync("INSERT INTO projet_materiel (projet_id, nom, a_acheter, item_id) VALUES (?, ?, ?, ?)", projetId, n, aAcheter ? 1 : 0, aAcheter ? await tacheAchat(projetId, n) : null);
  await toucher(projetId);
}

/** « à acheter » ↔ « j'ai » : la tâche de courses se coche (ou se recrée) en même temps. */
export async function basculerMateriel(id: number): Promise<void> {
  const db = await getDatabase();
  const m = await db.getFirstAsync<Materiel>("SELECT * FROM projet_materiel WHERE id = ?", id);
  if (!m) return;
  if (m.a_acheter) {
    if (m.item_id && (await db.getFirstAsync("SELECT 1 FROM items WHERE id = ? AND statut = 'actif'", m.item_id))) await completer(m.item_id, "complet");
    await db.runAsync("UPDATE projet_materiel SET a_acheter = 0 WHERE id = ?", id);
  } else {
    await db.runAsync("UPDATE projet_materiel SET a_acheter = 1, item_id = ? WHERE id = ?", await tacheAchat(m.projet_id, m.nom), id);
  }
}

export async function supprimerMateriel(id: number): Promise<void> {
  const db = await getDatabase();
  const m = await db.getFirstAsync<{ item_id: number | null }>("SELECT item_id FROM projet_materiel WHERE id = ?", id);
  if (m?.item_id) await retirerTache(m.item_id);
  await db.runAsync("DELETE FROM projet_materiel WHERE id = ?", id);
}

// ─── Tâches liées : ★ Pour aujourd'hui, je m'y mets, courses ────────────

/** Supprime une tâche liée si elle est encore à faire (une tâche déjà faite reste dans l'historique). */
async function retirerTache(itemId: number): Promise<void> {
  const db = await getDatabase();
  if (await db.getFirstAsync("SELECT 1 FROM items WHERE id = ? AND statut = 'actif'", itemId)) await deleteItem(itemId);
}

/** La tâche (liste « Projets ») qui reflète une étape : créée la première fois, retrouvée ensuite. */
export async function tacheDeLEtape(etapeId: number): Promise<number | null> {
  const db = await getDatabase();
  const e = await db.getFirstAsync<{ projet_id: number; nom: string; item_id: number | null }>("SELECT projet_id, nom, item_id FROM projet_etapes WHERE id = ?", etapeId);
  if (!e) return null;
  if (e.item_id && (await db.getFirstAsync("SELECT 1 FROM items WHERE id = ? AND statut = 'actif'", e.item_id))) return e.item_id;
  const p = await lireProjet(e.projet_id);
  const item = await addItem({ nom: `${p?.nom ?? "Projet"} : ${e.nom}`, type: "tache", liste_id: await listeSysteme(LISTE_PROJETS) });
  await db.runAsync("UPDATE projet_etapes SET item_id = ? WHERE id = ?", item, etapeId);
  return item;
}

/**
 * ★ Pour aujourd'hui : l'étape devient une tâche et prend un emplacement de « Mes 3 ».
 * Renvoie false si les 3 emplacements sont déjà choisis.
 */
export async function pourAujourdhui(etapeId: number, jour: string): Promise<boolean> {
  const db = await getDatabase();
  const pris = (await db.getAllAsync<{ rang: number; item_id: number; source: string }>("SELECT rang, item_id, source FROM trois WHERE jour = ? AND rang < 3", jour)).filter((l) => l.source === "choisi");
  const item = await tacheDeLEtape(etapeId);
  if (item === null) return false;
  if (pris.some((l) => l.item_id === item)) return true; // déjà dedans
  const rang = [0, 1, 2].find((r) => !pris.some((l) => l.rang === r));
  if (rang === undefined) return false;
  await placerDansTrois(jour, rang, item);
  return true;
}

/** Vrai si la tâche de cette étape est dans « Mes 3 » aujourd'hui. */
export async function estPourAujourdhui(etapeId: number, jour: string): Promise<boolean> {
  const db = await getDatabase();
  return !!(await db.getFirstAsync("SELECT 1 FROM trois t JOIN projet_etapes e ON e.item_id = t.item_id WHERE t.jour = ? AND e.id = ?", jour, etapeId));
}

/**
 * Rattrape ce qui s'est passé côté Tâches : une tâche faite coche son étape (ou passe le matériel à « j'ai »).
 * À appeler quand on revient sur un écran de projet ; sans danger si rien n'a changé.
 */
export async function rattraperProjets(): Promise<void> {
  const db = await getDatabase();
  const etapes = await db.getAllAsync<{ id: number }>("SELECT e.id FROM projet_etapes e JOIN items i ON i.id = e.item_id WHERE e.faite = 0 AND i.statut = 'termine'");
  for (const e of etapes) await basculerEtape(e.id, true);
  await db.runAsync("UPDATE projet_materiel SET a_acheter = 0 WHERE a_acheter = 1 AND item_id IN (SELECT id FROM items WHERE statut = 'termine')");
}

// ─── Suivi › Progrès ────────────────────────────────────────────────────

export type SuiviProjets = {
  semaines: ReturnType<typeof minutesParSemaine>;
  types: TypeProjet[];
  etapesFaites8s: number;
  finis: number;
  oublies: { id: number; nom: string; jours: number }[];
};

export async function suiviProjets(aujourdhui: string): Promise<SuiviProjets> {
  const db = await getDatabase();
  const entrees = await db.getAllAsync<{ jour: string; minutes: number; type_id: number }>("SELECT j.jour, j.minutes, p.type_id FROM projet_journal j JOIN projets p ON p.id = j.projet_id");
  const semaines = minutesParSemaine(entrees, aujourdhui, 8);
  const faites = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM projet_etapes WHERE faite = 1 AND faite_le >= ?", semaines[0].lundi);
  const finis = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM projets WHERE etat = 'fini'");
  const projets = await db.getAllAsync<{ id: number; nom: string; etat: string; maj_le: string }>("SELECT id, nom, etat, maj_le FROM projets");
  return {
    semaines,
    types: await listerTypes(),
    etapesFaites8s: faites?.n ?? 0,
    finis: finis?.n ?? 0,
    oublies: projetsOublies(projets.map((p) => ({ ...p, derniere: p.maj_le.slice(0, 10) })), aujourdhui).map((p) => ({ id: p.id, nom: p.nom, jours: p.jours })),
  };
}

export async function listerLiens(projetId: number): Promise<LienProjet[]> {
  const db = await getDatabase();
  return db.getAllAsync<LienProjet>("SELECT * FROM projet_liens WHERE projet_id = ? ORDER BY id", projetId);
}

export async function ajouterLien(projetId: number, titre: string, url: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT INTO projet_liens (projet_id, titre, url) VALUES (?, ?, ?)", projetId, titre.trim() || url, url);
  await toucher(projetId);
}

export async function supprimerLien(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM projet_liens WHERE id = ?", id);
}
