/**
 * Ma journée se remplit toute seule (règles : lib/journal-auto-regles.ts).
 * Les entrées 'auto' se déduisent des données de chaque jour : la synchronisation crée ce qui manque,
 * met à jour ce qui a changé (« Routines du matin · 4/5 ») et retire ce dont l'action a été annulée.
 * Elle tourne à l'ouverture de Ma journée, des Récompenses, du Suivi et du récap : aucun écran source n'est modifié.
 * Une entrée auto rapporte 0 point ; elle colore sa zone et compte pour le bonus des 4 zones (aujourd'hui seulement).
 */
import { decalerJours } from "../dates";
import { getDatabase } from "./client";
import { getAujourdhui, getRoutinesAvecStatutDuJour } from "./completions";
import { lireMeta, ecrireMeta } from "./meta";
import { getEntree, supprimerEntree, verifierBonus } from "./journee";
import { noterPointsDuJour } from "./stats";
import { zoneDeTache } from "../journee-regles";
import {
  CLE_LIENS,
  difference,
  heureDe,
  lireLiens,
  momentAuto,
  regrouperRoutines,
  zoneDe,
  type Existante,
  type Liens,
  type Voulue,
} from "../journal-auto-regles";
import { MEDITATIONS } from "../meditations";
import { ID_REVEIL, ZONES as ZONES_SPORT } from "../seances";

export async function getLiens(): Promise<Liens> {
  return lireLiens(await lireMeta(CLE_LIENS));
}

export async function ecrireLiens(l: Liens): Promise<void> {
  await ecrireMeta(CLE_LIENS, JSON.stringify(l));
}

const minutes = (s: number | null | undefined) => (s && s >= 60 ? Math.round(s / 60) : null);
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function nomSeanceGuidee(seance: string, zones: string | null): string {
  if (seance === ID_REVEIL) return "Ma routine du matin";
  const nomZone = (c: string) => ZONES_SPORT.find((z) => z.cle === c)?.nom;
  if (seance === "note") {
    const z = (zones ?? "").split(",").map(nomZone).filter(Boolean);
    return z.length ? `Séance · ${z.join(", ")}` : "Séance de sport";
  }
  const z = nomZone(seance.split("-")[0]);
  return z ? `Séance guidée · ${z}` : "Séance guidée";
}

/** Tout ce que les autres parties de l'appli disent d'un jour. */
async function collecter(jour: string, liens: Liens): Promise<(Voulue & { moment?: ReturnType<typeof momentAuto> })[]> {
  const db = await getDatabase();
  const v: (Voulue & { moment?: ReturnType<typeof momentAuto> })[] = [];

  // Routines : regroupées par moment.
  const routines = await getRoutinesAvecStatutDuJour(jour);
  const heures = new Map(
    (await db.getAllAsync<{ item_id: number; heure: number | null }>("SELECT item_id, heure FROM completions WHERE date = ?", jour)).map((c) => [c.item_id, c.heure]),
  );
  v.push(
    ...regrouperRoutines(
      routines.map((r) => ({ categorie: r.categorie, moment: r.ancre_moment ?? r.moment, heure: heures.get(r.id) ?? null, fait: r.faitAujourdhui })),
      liens,
    ),
  );

  // Sport : séances (Mes séances terminées, essais de skills) et séances guidées ou notées.
  for (const s of await db.getAllAsync<{ id: number; nom: string | null; debut: string; fin: string | null; ex: string | null }>(
    `SELECT s.id, s.nom, s.debut, s.fin,
            (SELECT GROUP_CONCAT(DISTINCT x.exercice) FROM series x WHERE x.seance_id = s.id AND x.realise > 0) AS ex
     FROM seances s WHERE s.date = ?`,
    jour,
  )) {
    const skill = !s.nom && !!s.ex;
    if (!s.fin && !s.ex) continue;
    const duree = s.fin ? (new Date(s.fin).getTime() - new Date(s.debut).getTime()) / 1000 : 0;
    v.push({
      source: "sport",
      source_id: `seance:${s.id}`,
      lien: skill ? "sport:skill" : "sport:seance",
      texte: s.nom ? s.nom : `Skills · ${(s.ex ?? "").split(",").join(", ")}`,
      duree_min: minutes(duree),
      heure: heureDe(s.debut),
    });
  }
  for (const s of await db.getAllAsync<{ id: number; seance: string; duree_s: number; horodatage: string; zones: string | null }>(
    "SELECT id, seance, duree_s, horodatage, zones FROM seances_guidees WHERE date = ?",
    jour,
  )) {
    v.push({ source: "sport", source_id: `guidee:${s.id}`, lien: "sport:seance", texte: nomSeanceGuidee(s.seance, s.zones), duree_min: minutes(s.duree_s), heure: heureDe(s.horodatage) });
  }

  // Ménage : une entrée par pièce.
  for (const m of await db.getAllAsync<{ piece_id: number; nom: string | null; n: number }>(
    `SELECT j.piece_id, p.nom, COUNT(*) AS n FROM menage_journal j LEFT JOIN menage_pieces p ON p.id = j.piece_id
     WHERE j.jour = ? GROUP BY j.piece_id`,
    jour,
  )) {
    v.push({ source: "menage", source_id: `piece:${m.piece_id}`, lien: "menage", texte: `Ménage · ${m.nom || "une pièce"}${m.n > 1 ? ` (${m.n})` : ""}` });
  }

  // Cuisine : recettes faites, meal prep, courses validées.
  for (const c of await db.getAllAsync<{ id: number; titre: string; cree_le: string }>("SELECT id, titre, cree_le FROM cuisines WHERE jour = ?", jour)) {
    v.push({ source: "cuisine", source_id: `recette:${c.id}`, lien: "cuisine:recette", texte: `Cuisiné : ${c.titre}`, heure: heureDe(c.cree_le) });
  }
  for (const m of await db.getAllAsync<{ semaine: string }>("SELECT semaine FROM meal_prep_semaines WHERE jour_batch = ?", jour)) {
    v.push({ source: "cuisine", source_id: `mealprep:${m.semaine}`, lien: "cuisine:mealprep", texte: "Meal prep" });
  }
  for (const c of await db.getAllAsync<{ id: number; n: number; horodatage: string }>("SELECT id, n, horodatage FROM courses_faites WHERE jour = ?", jour)) {
    v.push({ source: "cuisine", source_id: `courses:${c.id}`, lien: "cuisine:courses", texte: `Courses faites · ${pluriel(c.n, "article")}`, heure: heureDe(c.horodatage) });
  }

  // TCC : expositions, séances avec moi-même ; journaux de pensées et de confiance, une entrée par jour.
  for (const e of await db.getAllAsync<{ id: number }>("SELECT id FROM tcc_expositions WHERE jour = ?", jour)) {
    v.push({ source: "tcc", source_id: `exposition:${e.id}`, lien: "tcc", texte: "Exposition (TCC)" });
  }
  for (const s of await db.getAllAsync<{ id: number }>("SELECT id FROM tcc_seances_moi WHERE jour = ?", jour)) {
    v.push({ source: "tcc", source_id: `seance:${s.id}`, lien: "tcc", texte: "Ma séance avec moi-même" });
  }
  const nPensees = (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM pensees WHERE jour = ?", jour))?.n ?? 0;
  if (nPensees) v.push({ source: "tcc", source_id: `pensees:${jour}`, lien: "tcc", texte: nPensees > 1 ? `Journal de pensées (${nPensees})` : "Journal de pensées" });
  const nConfiance = (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM tcc_confiance WHERE jour = ?", jour))?.n ?? 0;
  if (nConfiance) v.push({ source: "tcc", source_id: `confiance:${jour}`, lien: "tcc", texte: "Journal de confiance" });

  // Méditations.
  for (const m of await db.getAllAsync<{ id: number; seance: string; duree_s: number; horodatage: string }>(
    "SELECT id, seance, duree_s, horodatage FROM meditations WHERE date = ?",
    jour,
  )) {
    const titre = MEDITATIONS.find((x) => x.id === m.seance)?.titre;
    v.push({ source: "meditation", source_id: `${m.id}`, lien: "meditation", texte: titre ? `Méditation · ${titre}` : "Méditation", duree_min: minutes(m.duree_s) ?? 1, heure: heureDe(m.horodatage) });
  }

  // Humeur : une entrée par jour, ressenti = la dernière humeur notée.
  const humeurs = await db.getAllAsync<{ niveau: number; heure: string }>("SELECT niveau, heure FROM humeurs WHERE jour = ? ORDER BY heure, id", jour);
  if (humeurs.length) {
    const d = humeurs[humeurs.length - 1];
    v.push({
      source: "humeur",
      source_id: jour,
      lien: "humeur",
      texte: humeurs.length > 1 ? `Humeur notée (${humeurs.length} fois)` : "Humeur notée",
      ressenti: d.niveau,
      heure: Number(d.heure.slice(0, 2)) || null,
    });
  }

  // Projets : chaque étape cochée (pas l'étape parente cochée avec ses sous-étapes).
  for (const e of await db.getAllAsync<{ id: number; nom: string; projet: string | null }>(
    `SELECT e.id, e.nom, p.nom AS projet FROM projet_etapes e LEFT JOIN projets p ON p.id = e.projet_id
     WHERE e.faite = 1 AND e.faite_le = ? AND NOT EXISTS (SELECT 1 FROM projet_etapes c WHERE c.parent_id = e.id)`,
    jour,
  )) {
    v.push({ source: "projet", source_id: `${e.id}`, lien: "projet", texte: e.projet ? `${e.projet} : ${e.nom}` : e.nom });
  }

  // Récompenses utilisées (avec le souvenir s'il y en a un).
  for (const a of await db.getAllAsync<{ id: number; nom: string; categorie: string | null; horodatage: string; souvenir_texte: string | null; souvenir_ressenti: number | null }>(
    `SELECT a.id, a.nom, r.categorie, a.horodatage, a.souvenir_texte, a.souvenir_ressenti
     FROM achats a LEFT JOIN recompenses r ON r.id = a.recompense_id WHERE a.date = ?`,
    jour,
  )) {
    const cat = ["mer", "bouffe", "temps", "decouvertes", "gros"].includes(a.categorie ?? "") ? a.categorie : "temps";
    v.push({
      source: "recompense",
      source_id: `${a.id}`,
      lien: `recompense:${cat}`,
      texte: a.souvenir_texte?.trim() ? `${a.nom} · ${a.souvenir_texte.trim()}` : a.nom,
      ressenti: a.souvenir_ressenti,
      heure: heureDe(a.horodatage),
    });
  }

  // Tâches cochées ailleurs (pas depuis Ma journée, pas le reflet d'une étape de projet) : la zone de leur liste.
  for (const t of await db.getAllAsync<{ id: number; nom: string; heure: number | null; liste_nom: string | null; liste_zone: string | null }>(
    `SELECT i.id, i.nom, c.heure, l.nom AS liste_nom, l.zone AS liste_zone
     FROM completions c JOIN items i ON i.id = c.item_id LEFT JOIN listes l ON l.id = i.liste_id
     WHERE c.date = ? AND i.type = 'tache'
       AND NOT EXISTS (SELECT 1 FROM journal j WHERE j.tache_id = i.id AND j.jour = c.date AND j.origine != 'auto')
       AND NOT EXISTS (SELECT 1 FROM projet_etapes pe WHERE pe.item_id = i.id)`,
    jour,
  )) {
    v.push({ source: "tache", source_id: `${t.id}`, zone: zoneDeTache(t), texte: t.nom, heure: t.heure });
  }
  return v;
}

/** Met les entrées auto d'un jour en accord avec les données. `bonus` : vérifier le bonus des 4 zones (aujourd'hui). */
export async function synchroniserJour(jour: string, opts: { bonus?: boolean; liens?: Liens } = {}): Promise<boolean> {
  const db = await getDatabase();
  const liens = opts.liens ?? (await getLiens());
  const collectees = await collecter(jour, liens);
  // La zone d'une entrée existante n'est jamais changée ici : un changement à la main reste.
  const voulues = collectees.flatMap((x) => {
    const zone = zoneDe(x, liens);
    return zone ? [{ ...x, zone }] : [];
  });
  const existantes = await db.getAllAsync<Existante>(
    "SELECT id, source, source_id, texte, duree_min, ressenti, texte_perso FROM journal WHERE jour = ? AND origine = 'auto'",
    jour,
  );
  const { ajouter, maj, supprimer } = difference(voulues, existantes);
  const auj = getAujourdhui();
  const maintenant = new Date();
  for (const id of supprimer) await db.runAsync("DELETE FROM journal WHERE id = ?", id);
  for (const m of maj) await db.runAsync("UPDATE journal SET texte = ?, duree_min = ?, ressenti = ? WHERE id = ?", m.texte, m.duree_min, m.ressenti, m.id);
  for (const a of ajouter) {
    const moment = (a as { moment?: ReturnType<typeof momentAuto> }).moment ?? momentAuto(a.heure, jour, auj, maintenant.getHours());
    const r = await db.runAsync(
      `INSERT INTO journal (jour, cree_le, moment, zone, texte, duree_min, ressenti, points, origine, source, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'auto', ?, ?)`,
      jour,
      maintenant.toISOString(),
      moment,
      a.zone,
      a.texte,
      a.duree_min ?? null,
      a.ressenti ?? null,
      a.source,
      a.source_id,
    );
    if (a.source === "recompense") await db.runAsync("UPDATE achats SET journal_id = ? WHERE id = ?", r.lastInsertRowId, Number(a.source_id));
  }
  return opts.bonus ? verifierBonus(jour) : false;
}

/** Les 8 jours encore modifiables ; le bonus seulement pour aujourd'hui. Renvoie true si le bonus vient d'être gagné. */
export async function synchroniserJournal(): Promise<boolean> {
  const auj = getAujourdhui();
  const liens = await getLiens();
  for (let i = 7; i >= 1; i--) await synchroniserJour(decalerJours(auj, -i), { liens });
  const bonus = await synchroniserJour(auj, { bonus: true, liens });
  await noterPointsDuJour();
  return bonus;
}

/** meta : jour du remplissage rétroactif (le bouton de Profil ne sert qu'une fois, il peut être relancé sans doublon). */
export const CLE_RETRO = "journal_retro";

/** Crée les entrées auto des `n` derniers jours, sans aucun point ni bonus. Renvoie le nombre d'entrées créées. */
export async function remplirDepuis(n = 30): Promise<number> {
  const db = await getDatabase();
  const avant = (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM journal WHERE origine = 'auto'"))?.n ?? 0;
  const auj = getAujourdhui();
  const liens = await getLiens();
  for (let i = n; i >= 0; i--) await synchroniserJour(decalerJours(auj, -i), { liens });
  await ecrireMeta(CLE_RETRO, auj);
  const apres = (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM journal WHERE origine = 'auto'"))?.n ?? 0;
  return apres - avant;
}

/** Appui long › Masquer : l'entrée reste en base (masque = 1) pour ne pas être recréée. */
export async function masquerEntree(id: number, masque = true): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE journal SET masque = ? WHERE id = ? AND origine = 'auto'", masque ? 1 : 0, id);
}

/**
 * Fusionner ma note avec l'entrée auto qui lui ressemble : l'entrée auto prend mon texte (et mes détails),
 * ma note est supprimée avec ses points (l'action d'origine a déjà rapporté).
 */
export async function fusionner(noteId: number, autoId: number): Promise<void> {
  const db = await getDatabase();
  const note = await getEntree(noteId);
  if (!note) return;
  await db.runAsync(
    "UPDATE journal SET texte = ?, texte_perso = 1, duree_min = COALESCE(?, duree_min), ressenti = COALESCE(?, ressenti) WHERE id = ? AND origine = 'auto'",
    note.texte,
    note.duree_min,
    note.ressenti,
    autoId,
  );
  await supprimerEntree(noteId);
}
