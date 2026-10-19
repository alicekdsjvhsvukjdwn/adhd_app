import type { Categorie } from "../catalogue";
import {
  debutPeriode,
  finPeriode,
  lireFrequence,
  retardObjectif,
  urgenceAvecRetard,
  type Periode,
} from "../regles-taches";
import {
  clamp01,
  ETAT_NEUTRE,
  raisonDominante,
  scoreTotal,
} from "../moteur-regles";
import { HEURE_PAR_MOMENT, momentStocke } from "../moments";
import { categorieEffective, equilibreParCategorie } from "./categories";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { logDecisions, type Composantes, type Decision } from "./decisions";
import { estJourDifficile } from "./jour-difficile";
import { traiterNegligence } from "./negligence";

export { POIDS } from "../moteur-regles";

/**
 * Le moteur de tri : "l'utilisateur dépose, l'appli décide".
 *
 * Chaque tâche active non faite aujourd'hui reçoit un score entre 0 et 1,
 * (les routines, elles, sont affichées par moment et ne sont pas triées),
 * somme pondérée de six composantes normalisées. On garde le haut du
 * classement, en réservant une place à un item négligé (exploration),
 * pour que l'écran ne soit jamais figé et que rien ne meure de faim.
 *
 * Les poids sont écrits à la main : le système marche dès le jour 1
 * (démarrage à froid). L'observation accumulée (heure_reelle_moy,
 * nb_propositions_sans_action, équilibre des catégories...) corrige
 * ensuite les composantes, pas les poids.
 *
 * Aucune énergie n'est lue : ni bilan de la journée, ni choix à la main.
 * Le tri marche de la même façon que la personne réponde ou non.
 */

/** Nombre de places affichées sur l'écran Aujourd'hui. */
const TOP = 3;

/** Tolérance autour du bon moment (en heures) avant que le score tombe à 0. */
const FENETRE_MOMENT_H = 4;

/** Au-delà de cet horizon, une échéance n'est plus « urgente ». */
const HORIZON_URGENCE_J = 14;

/** Nombre de propositions ignorées à partir duquel la négligence sature. */
const SEUIL_NEGLIGENCE = 5;

type CandidatRow = {
  id: number;
  nom: string;
  type: string;
  categorie: string | null;
  template_id: string | null;
  importance: number;
  duree_min: number | null;
  premiere_action: string | null;
  echeance: string | null;
  heure_reelle_moy: number | null;
  nb_propositions_sans_action: number;
  moment_effectif: string | null;
  liste_id: number | null;
  recurrence: string | null;
  /** Calculé après la requête, pour les tâches « x fois par période ». */
  compte?: Proposition["compte"];
  /** Nom de la liste quand son retard sur l'objectif fait l'urgence de la tâche. */
  pourObjectif?: string;
};

export type Proposition = {
  itemId: number;
  liste_id: number | null;
  /** Tâche « x fois par semaine / par mois » : où on en est sur la période. */
  compte: { fait: number; cible: number; periode: Periode } | null;
  nom: string;
  premiere_action: string | null;
  duree_min: number | null;
  echeance: string | null;
  score: number;
  composantes: Composantes;
  rang: number;
  propose: boolean;
  exploration: boolean;
  raison: string;
};

function scoreUrgence(echeance: string | null): number {
  if (!echeance) return 0; // une routine quotidienne n'a pas d'échéance
  const jours = Math.floor(
    (new Date(echeance + "T00:00:00").getTime() -
      new Date(getAujourdhui() + "T00:00:00").getTime()) /
      86400000,
  );
  if (jours < 0) return 1; // en retard : urgence maximale
  return clamp01(1 - jours / HORIZON_URGENCE_J);
}

function scoreMoment(c: CandidatRow, heureActuelle: number): number {
  // L'observation (heure réelle moyenne) prime sur le moment déclaré.
  let heureIdeale: number | null = c.heure_reelle_moy;
  if (heureIdeale == null && c.moment_effectif) {
    const m = momentStocke(c.moment_effectif);
    heureIdeale = m ? HEURE_PAR_MOMENT[m] : null;
  }
  if (heureIdeale == null) return 0.5; // sans repère : ni favorisé ni pénalisé
  const ecart = Math.abs(heureActuelle - heureIdeale);
  return clamp01(1 - ecart / FENETRE_MOMENT_H);
}

/**
 * Calcule le classement complet des items actifs non faits aujourd'hui.
 * Renvoie TOUT le classement : `propose` marque le top affiché,
 * `exploration` marque la place réservée à un item négligé.
 */
export async function genererPropositions(): Promise<Proposition[]> {
  const db = await getDatabase();
  await traiterNegligence(); // rattrape les jours écoulés avant de scorer

  const date = getAujourdhui();
  const heureActuelle = new Date().getHours() + new Date().getMinutes() / 60;
  const equilibre = await equilibreParCategorie(7);

  const candidats = await db.getAllAsync<CandidatRow>(
    `SELECT i.id, i.nom, i.type, i.categorie, i.template_id,
            i.importance, i.duree_min,
            i.premiere_action, i.echeance, i.heure_reelle_moy,
            i.nb_propositions_sans_action,
            i.liste_id, i.recurrence,
            COALESCE(a.moment, i.moment) AS moment_effectif
     FROM items i
     LEFT JOIN ancres a ON a.id = i.ancre_id
     LEFT JOIN completions c ON c.item_id = i.id AND c.date = ?
     WHERE i.statut = 'actif'
       AND i.type = 'tache'
       AND c.id IS NULL`,
    date,
  );

  // Tâche « x fois par période » : proposée tant que le compte est sous
  // l'objectif, puis plus rien jusqu'au lundi ou au 1er du mois.
  for (const c of candidats) {
    const f = lireFrequence(c.recurrence);
    if (!f) continue;
    const r = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM completions WHERE item_id = ? AND date >= ? AND date <= ?",
      c.id,
      debutPeriode(date, f.periode),
      finPeriode(date, f.periode),
    );
    c.compte = { fait: r?.n ?? 0, cible: f.cible, periode: f.periode };
  }

  const proposables = candidats.filter(
    (c) => !(c.compte && c.compte.fait >= c.compte.cible),
  );

  const retards = await retardsDesListes(date);
  // Un jour difficile, la tâche unique doit rester la plus petite, pas la plus en retard.
  const jourDifficile = await estJourDifficile();

  const notes = proposables.map((c) => {
    const cat = categorieEffectiveLocale(c);
    const urgenceEcheance = scoreUrgence(c.echeance);
    const liste = c.liste_id !== null ? retards.get(c.liste_id) : undefined;
    const urgence = liste && !jourDifficile
      ? urgenceAvecRetard(urgenceEcheance, liste.retard)
      : urgenceEcheance;
    if (urgence > urgenceEcheance) c.pourObjectif = liste?.nom;
    const composantes: Composantes = {
      urgence,
      importance: clamp01((c.importance - 1) / 2), // 1..3 => 0, .5, 1
      moment: scoreMoment(c, heureActuelle),
      equilibre: cat ? equilibre[cat] : 0.5,
      etat: ETAT_NEUTRE,
      negligence: clamp01(c.nb_propositions_sans_action / SEUIL_NEGLIGENCE),
      // Enregistré même un jour difficile (non appliqué), pour l'analyse.
      ...(liste ? { retard_liste: liste.retard } : {}),
    };
    return { c, composantes, score: scoreTotal(composantes) };
  });

  notes.sort((a, b) => b.score - a.score);

  const propositions: Proposition[] = [];

  // Si tout tient dans l'écran, rien n'est masqué : pas d'exploration.
  if (notes.length <= TOP) {
    notes.forEach((n, i) => {
      propositions.push(construire(n, i + 1, true, false));
    });
    await journaliserSiPremierDuJour(propositions);
    return propositions;
  }

  // Sinon : TOP-1 vrais meilleurs + 1 place d'exploration prise dans le reste.
  const gardes = notes.slice(0, TOP - 1);
  const reste = notes.slice(TOP - 1);

  // Exploration : le plus négligé du reste (à défaut, le mieux classé du reste).
  reste.sort(
    (a, b) =>
      b.c.nb_propositions_sans_action - a.c.nb_propositions_sans_action ||
      b.score - a.score,
  );
  const explore = reste[0];

  gardes.forEach((n, i) =>
    propositions.push(construire(n, i + 1, true, false)),
  );
  const px = construire(explore, TOP, true, true);
  px.raison = "Revient dans la boucle";
  propositions.push(px);

  // Le reste garde un rang pour le journal, mais n'est pas proposé.
  reste
    .slice(1)
    .forEach((n, i) =>
      propositions.push(construire(n, TOP + 1 + i, false, false)),
    );

  await journaliserSiPremierDuJour(propositions);
  return propositions;
}

/** Catégorie effective : colonne de l'item, sinon celle du catalogue. */
function categorieEffectiveLocale(c: CandidatRow): Categorie | null {
  return categorieEffective(c.categorie, c.template_id);
}

function construire(
  n: { c: CandidatRow; composantes: Composantes; score: number },
  rang: number,
  propose: boolean,
  exploration: boolean,
): Proposition {
  return {
    itemId: n.c.id,
    liste_id: n.c.liste_id,
    compte: n.c.compte ?? null,
    nom: n.c.nom,
    premiere_action: n.c.premiere_action,
    duree_min: n.c.duree_min,
    echeance: n.c.echeance,
    score: n.score,
    composantes: n.composantes,
    rang,
    propose,
    exploration,
    raison: raisonAvecObjectif(n),
  };
}

/**
 * Journalise une seule fois par jour, à la première génération.
 * Éviter de réécrire à chaque focus d'écran garde le decision_log lisible
 * et la métrique de taux de réussite juste.
 */
async function journaliserSiPremierDuJour(propositions: Proposition[]) {
  const db = await getDatabase();
  const dejaFait = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM decision_log WHERE date = ?",
    getAujourdhui(),
  );
  if (dejaFait && dejaFait.n > 0) return;

  const aLogger: Decision[] = propositions
    .filter((p) => p.propose)
    .map((p) => ({
      itemId: p.itemId,
      score: p.score,
      composantes: p.composantes,
      rang: p.rang,
      propose: p.propose,
      exploration: p.exploration,
      raison: p.raison,
    }));

  // etat_energie reste vide : le moteur ne lit plus d'énergie.
  if (aLogger.length > 0) await logDecisions(aLogger, null);
}

/** « Échéance proche » qui vient en fait du retard d'une liste : on le dit. */
function raisonAvecObjectif(n: { c: CandidatRow; composantes: Composantes }): string {
  const raison = raisonDominante(n.composantes);
  return raison === "Échéance proche" && n.c.pourObjectif
    ? `Pour l'objectif de ${n.c.pourObjectif}`
    : raison;
}

/** Retard de chaque liste qui a un objectif, sur la période en cours. */
async function retardsDesListes(
  date: string,
): Promise<Map<number, { nom: string; retard: number }>> {
  const db = await getDatabase();
  const listes = await db.getAllAsync<{
    id: number;
    nom: string;
    objectif: number;
    objectif_periode: Periode;
  }>(
    "SELECT id, nom, objectif, objectif_periode FROM listes WHERE objectif IS NOT NULL AND objectif_periode IS NOT NULL",
  );
  const res = new Map<number, { nom: string; retard: number }>();
  for (const l of listes) {
    const r = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM completions c JOIN items i ON i.id = c.item_id
       WHERE i.liste_id = ? AND i.type = 'tache' AND c.date >= ? AND c.date <= ?`,
      l.id,
      debutPeriode(date, l.objectif_periode),
      date,
    );
    res.set(l.id, {
      nom: l.nom,
      retard: retardObjectif(r?.n ?? 0, l.objectif, date, l.objectif_periode),
    });
  }
  return res;
}
