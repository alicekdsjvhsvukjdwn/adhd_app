import type { Categorie } from "../catalogue";
import { categorieEffective, equilibreParCategorie } from "./categories";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { logDecisions, type Composantes, type Decision } from "./decisions";
import { energieDuJour } from "./energie";
import { traiterNegligence } from "./negligence";

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
 */

/** Poids de départ. Somme = 1, donc le score reste dans [0, 1]. */
export const POIDS = {
  importance: 0.25,
  moment: 0.2,
  equilibre: 0.2,
  etat: 0.15,
  urgence: 0.12,
  negligence: 0.08,
} as const;

/** Nombre de places affichées sur l'écran Aujourd'hui. */
const TOP = 3;

/** Heure « idéale » par moment déclaré, quand l'observation manque. */
const HEURE_PAR_MOMENT: Record<string, number> = {
  reveil: 7,
  matin: 9,
  midi: 12.5,
  apres_midi: 15.5,
  "apres-midi": 15.5,
  soir: 19,
  coucher: 22,
};

/** Tolérance autour du bon moment (en heures) avant que le score tombe à 0. */
const FENETRE_MOMENT_H = 4;

/** Au-delà de cet horizon, une échéance n'est plus « urgente ». */
const HORIZON_URGENCE_J = 14;

/** Nombre de propositions ignorées à partir duquel la négligence sature. */
const SEUIL_NEGLIGENCE = 5;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

type CandidatRow = {
  id: number;
  nom: string;
  type: string;
  categorie: string | null;
  template_id: string | null;
  importance: number;
  effort: number | null;
  duree_min: number | null;
  premiere_action: string | null;
  echeance: string | null;
  heure_reelle_moy: number | null;
  nb_propositions_sans_action: number;
  fenetre_debut_h: number | null;
  fenetre_fin_h: number | null;
  moment_effectif: string | null;
};

export type Proposition = {
  itemId: number;
  nom: string;
  premiere_action: string | null;
  duree_min: number | null;
  score: number;
  composantes: Composantes;
  rang: number;
  propose: boolean;
  exploration: boolean;
  raison: string;
};

/**
 * Énergie du check-in le plus récent de la journée.
 * Celle d'hier ne dit rien de maintenant : sans check-in du jour, neutre.
 */
async function dernierEtatEnergie(): Promise<number | null> {
  // Le choix fait à la main sur l'onglet Routines prime, puis le check-in du jour.
  const { niveau } = await energieDuJour();
  return niveau;
}

/** Effort perçu de l'item, ramené dans [0, 1]. Neutre (0.5) si rien de connu. */
function effortNormalise(c: CandidatRow): number {
  if (c.effort != null) return clamp01((c.effort - 1) / 2); // effort 1..3
  if (c.duree_min != null) return clamp01(c.duree_min / 60); // 1 h = plein effort
  return 0.5;
}

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
    heureIdeale = HEURE_PAR_MOMENT[c.moment_effectif] ?? null;
  }
  if (heureIdeale == null) return 0.5; // sans repère : ni favorisé ni pénalisé
  const ecart = Math.abs(heureActuelle - heureIdeale);
  return clamp01(1 - ecart / FENETRE_MOMENT_H);
}

function scoreEtat(c: CandidatRow, energie: number | null): number {
  const energieNorm = energie == null ? 0.5 : clamp01((energie - 1) / 2);
  const effort = effortNormalise(c);
  // Tant que l'effort tient dans la capacité du moment, score plein.
  // Au-delà, on pénalise l'écart : énergie basse => on écarte les gros items.
  return clamp01(1 - Math.max(0, effort - energieNorm));
}

/** Phrase courte « pourquoi celui-là », tirée de la composante dominante. */
function raisonDominante(comp: Composantes): string {
  const contributions: [number, string][] = [
    [comp.urgence * POIDS.urgence, "Échéance proche"],
    [comp.importance * POIDS.importance, "Important pour toi"],
    [comp.moment * POIDS.moment, "C'est le bon moment"],
    [comp.equilibre * POIDS.equilibre, "Pour varier les domaines"],
    [comp.etat * POIDS.etat, "Adapté à ton énergie"],
    [comp.negligence * POIDS.negligence, "Pas fait depuis un moment"],
  ];
  contributions.sort((a, b) => b[0] - a[0]);
  return contributions[0][1];
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
  const energie = await dernierEtatEnergie();
  const equilibre = await equilibreParCategorie(7);

  const candidats = await db.getAllAsync<CandidatRow>(
    `SELECT i.id, i.nom, i.type, i.categorie, i.template_id,
            i.importance, i.effort, i.duree_min,
            i.premiere_action, i.echeance, i.heure_reelle_moy,
            i.nb_propositions_sans_action,
            i.fenetre_debut_h, i.fenetre_fin_h,
            COALESCE(a.moment, i.moment) AS moment_effectif
     FROM items i
     LEFT JOIN ancres a ON a.id = i.ancre_id
     LEFT JOIN completions c ON c.item_id = i.id AND c.date = ?
     WHERE i.statut = 'actif'
       AND i.type = 'tache'
       AND c.id IS NULL`,
    date,
  );

  // Contrainte externe dure : hors de sa fenêtre horaire, un item
  // (ex : appeler un service ouvert 9 h-17 h) n'est pas proposable maintenant.
  const proposables = candidats.filter((c) => {
    if (c.fenetre_debut_h != null && heureActuelle < c.fenetre_debut_h)
      return false;
    if (c.fenetre_fin_h != null && heureActuelle >= c.fenetre_fin_h)
      return false;
    return true;
  });

  const notes = proposables.map((c) => {
    const cat = categorieEffectiveLocale(c);
    const composantes: Composantes = {
      urgence: scoreUrgence(c.echeance),
      importance: clamp01((c.importance - 1) / 2), // 1..3 => 0, .5, 1
      moment: scoreMoment(c, heureActuelle),
      equilibre: cat ? equilibre[cat] : 0.5,
      etat: scoreEtat(c, energie),
      negligence: clamp01(c.nb_propositions_sans_action / SEUIL_NEGLIGENCE),
    };
    const score =
      composantes.urgence * POIDS.urgence +
      composantes.importance * POIDS.importance +
      composantes.moment * POIDS.moment +
      composantes.equilibre * POIDS.equilibre +
      composantes.etat * POIDS.etat +
      composantes.negligence * POIDS.negligence;
    return { c, composantes, score };
  });

  notes.sort((a, b) => b.score - a.score);

  const propositions: Proposition[] = [];

  // Si tout tient dans l'écran, rien n'est masqué : pas d'exploration.
  if (notes.length <= TOP) {
    notes.forEach((n, i) => {
      propositions.push(construire(n, i + 1, true, false));
    });
    await journaliserSiPremierDuJour(propositions, energie);
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

  await journaliserSiPremierDuJour(propositions, energie);
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
    nom: n.c.nom,
    premiere_action: n.c.premiere_action,
    duree_min: n.c.duree_min,
    score: n.score,
    composantes: n.composantes,
    rang,
    propose,
    exploration,
    raison: raisonDominante(n.composantes),
  };
}

/**
 * Journalise une seule fois par jour, à la première génération.
 * Éviter de réécrire à chaque focus d'écran garde le decision_log lisible
 * et la métrique de taux de réussite juste.
 */
async function journaliserSiPremierDuJour(
  propositions: Proposition[],
  energie: number | null,
) {
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

  if (aLogger.length > 0) await logDecisions(aLogger, energie);
}
