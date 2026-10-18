/**
 * Règles des routines à étapes, des objectifs par semaine ou par mois
 * et du carnet, sans accès à la base : testables seules
 * (tests/regles-taches.test.mjs).
 */

/**
 * Même calcul que decalerJours de lib/dates.ts, recopié : les modules purs
 * n'importent rien, pour que Node puisse les tester tels quels.
 */
function decalerJours(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// ─── Routines à étapes : points par palier ──────────────────────────────

/** Toutes les essentielles faites. */
export const POINTS_ESSENTIELLES = 10;
/** Toutes les étapes faites (essentielles + bonus), ou essentielles un jour difficile. */
export const POINTS_TOUTES = 15;

export type EtapeDuJour = { essentielle: boolean; cochee: boolean };

/**
 * 0 : essentielles pas toutes faites ; 1 : essentielles faites ; 2 : tout fait.
 * Sans étape essentielle, une étape cochée suffit pour le palier 1
 * (sinon la routine serait faite sans rien cocher).
 */
export function palierEtapes(etapes: EtapeDuJour[]): 0 | 1 | 2 {
  if (etapes.length === 0) return 0;
  if (etapes.every((e) => e.cochee)) return 2;
  const essentielles = etapes.filter((e) => e.essentielle);
  const essentiellesFaites =
    essentielles.length > 0
      ? essentielles.every((e) => e.cochee)
      : etapes.some((e) => e.cochee);
  return essentiellesFaites ? 1 : 0;
}

/** Points du jour pour un palier. Un jour difficile, les essentielles valent la routine complète. */
export function pointsPalier(palier: 0 | 1 | 2, jourDifficile: boolean): number {
  if (palier === 0) return 0;
  if (palier === 2 || jourDifficile) return POINTS_TOUTES;
  return POINTS_ESSENTIELLES;
}

/**
 * Points à ajouter (ou retirer) pour passer de ce qui est déjà donné
 * aujourd'hui à ce que vaut le palier : cocher, décocher et recocher
 * ne donne jamais deux fois.
 */
export function deltaPoints(dejaDonnes: number, palier: 0 | 1 | 2, jourDifficile: boolean): number {
  return pointsPalier(palier, jourDifficile) - dejaDonnes;
}

// ─── Points : total, niveau ─────────────────────────────────────────────

/**
 * Ajoute (ou retire) des points au total, sans plancher : un retrait qui
 * passe sous zéro est gardé, pour qu'un recochage ne crée pas de points.
 * Paramètre : le delta.
 */
export const SQL_AJOUTER_POINTS = "UPDATE stats SET points_total = points_total + ? WHERE id = 1";

/** Total affiché : jamais négatif à l'écran. */
export const totalAffiche = (total: number) => Math.max(0, total);

/** Niveau : 1 de 0 à 99 points, 2 de 100 à 199… */
export const niveauDePoints = (total: number) => Math.floor(totalAffiche(total) / 100) + 1;

// ─── Tâches à étapes : points ───────────────────────────────────────────

/** Une tâche (ou une routine sans étapes) cochée. */
export const POINTS_COMPLETION = 10;
/** Chaque étape d'une tâche. */
export const POINTS_ETAPE = 5;
/** En plus, quand la dernière étape termine la tâche. */
export const BONUS_FIN = 10;
/** Ce que rapporte la dernière étape : l'étape, la tâche terminée et le bonus. */
export const POINTS_DERNIERE_ETAPE = POINTS_ETAPE + POINTS_COMPLETION + BONUS_FIN;

/**
 * Points d'étapes à reprendre quand une tâche est remise à faire : chaque
 * étape cochée, et le bonus si elles l'étaient toutes (c'est la dernière
 * qui l'a donné). Les points de la complétion se reprennent à part.
 */
export function pointsEtapesARetirer(cochees: number, total: number): number {
  return cochees * POINTS_ETAPE + (total > 0 && cochees >= total ? BONUS_FIN : 0);
}

// ─── Objectifs par semaine ou par mois ──────────────────────────────────

export type Periode = "semaine" | "mois";
export type Frequence = { periode: Periode; cible: number };

/** items.recurrence d'une tâche : 'semaine:3' ou 'mois:2'. Null pour une tâche unique. */
export function lireFrequence(recurrence: string | null): Frequence | null {
  const m = /^(semaine|mois):(\d+)$/.exec(recurrence ?? "");
  return m ? { periode: m[1] as Periode, cible: Math.max(1, Number(m[2])) } : null;
}

export function ecrireFrequence(f: Frequence): string {
  return `${f.periode}:${f.cible}`;
}

/** Premier jour de la période qui contient `iso` : le lundi, ou le 1er du mois. */
export function debutPeriode(iso: string, periode: Periode): string {
  if (periode === "mois") return `${iso.slice(0, 7)}-01`;
  const jour = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = dimanche
  return decalerJours(iso, -((jour + 6) % 7));
}

/** Dernier jour de la période qui contient `iso`. */
export function finPeriode(iso: string, periode: Periode): string {
  const debut = debutPeriode(iso, periode);
  if (periode === "semaine") return decalerJours(debut, 6);
  // 1er du mois suivant, moins un jour : 28, 29, 30 ou 31 sans rien supposer.
  return decalerJours(debutPeriode(decalerJours(debut, 31), "mois"), -1);
}

/** Les n dernières périodes, de la plus ancienne à celle en cours. */
export function periodesRecentes(
  aujourdhui: string,
  periode: Periode,
  n: number,
): { debut: string; fin: string }[] {
  const res: { debut: string; fin: string }[] = [];
  let debut = debutPeriode(aujourdhui, periode);
  for (let i = 0; i < n; i++) {
    res.unshift({ debut, fin: finPeriode(debut, periode) });
    debut = debutPeriode(decalerJours(debut, -1), periode);
  }
  return res;
}

/** Nombre de dates dans [debut, fin], bornes incluses. */
export function compterDans(dates: string[], debut: string, fin: string): number {
  return dates.filter((d) => d >= debut && d <= fin).length;
}

/**
 * Périodes d'affilée où l'objectif est atteint, en partant de la plus récente.
 * `comptes` va de la plus ancienne à celle en cours. La période en cours
 * n'est pas finie : pas encore atteinte, elle ne casse pas la série.
 */
export function serieAtteinte(comptes: number[], cible: number): number {
  const v = [...comptes];
  if (v.length > 0 && v[v.length - 1] < cible) v.pop();
  let n = 0;
  for (let i = v.length - 1; i >= 0 && v[i] >= cible; i--) n++;
  return n;
}

/**
 * Étapes d'une tâche « x fois par semaine / par mois » : une étape cochée
 * compte à partir de ce jour-là (inclus). La progression est gardée dans la
 * période, et repart de zéro le lendemain de chaque fois faite.
 * `derniereAvant` : date de la dernière complétion strictement avant `jour`.
 */
export function debutEtapesEnCours(
  jour: string,
  periode: Periode,
  derniereAvant: string | null,
): string {
  const debut = debutPeriode(jour, periode);
  const apres = derniereAvant ? decalerJours(derniereAvant, 1) : debut;
  return apres > debut ? apres : debut;
}

/** Nombre de jours de debut à fin, bornes incluses. */
function joursInclus(debut: string, fin: string): number {
  return Math.round((Date.parse(fin) - Date.parse(debut)) / 86400000) + 1;
}

// ─── Objectif de liste dans le moteur ───────────────────────────────────

/** Le retard d'une liste ne vaut jamais plus qu'une échéance dans une semaine environ. */
export const PLAFOND_RETARD = 0.6;

/**
 * Retard d'une liste sur son objectif, entre 0 et 1, au prorata des jours
 * écoulés : le lundi presque rien n'est attendu, le dimanche tout.
 * attendu = objectif × jours écoulés ÷ jours de la période ;
 * retard = max(0, attendu − fait) ÷ objectif.
 */
export function retardObjectif(
  fait: number,
  cible: number,
  aujourdhui: string,
  periode: Periode,
): number {
  if (cible <= 0) return 0;
  const debut = debutPeriode(aujourdhui, periode);
  const attendu =
    (cible * joursInclus(debut, aujourdhui)) /
    joursInclus(debut, finPeriode(aujourdhui, periode));
  return Math.min(1, Math.max(0, attendu - fait) / cible);
}

/**
 * Le retard passe par la composante Urgence existante, plafonné :
 * les poids ne changent pas, et une vraie échéance proche reste devant.
 */
export function urgenceAvecRetard(urgenceEcheance: number, retard: number): number {
  return Math.max(urgenceEcheance, retard * PLAFOND_RETARD);
}

export function libelleCompte(fait: number, cible: number, periode: Periode): string {
  return `${fait}/${cible} ${periode === "semaine" ? "cette semaine" : "ce mois-ci"}`;
}

// ─── Carnet ─────────────────────────────────────────────────────────────

/**
 * Requêtes du carnet. Une note est rattachée à une complétion par
 * (item_id, date), unique dans les deux tables : décocher puis recocher
 * le même jour retrouve la même note. completion_id est recopié pour
 * l'analyse (il change si la complétion est recréée).
 */
export const SQL_CARNET = {
  /** Paramètres : item_id, date, item_id, date, fait, retenu, idees, maintenant, maintenant. */
  enregistrer: `INSERT INTO notes (item_id, date, completion_id, fait, retenu, idees, cree_le, maj_le)
    VALUES (?, ?, (SELECT id FROM completions WHERE item_id = ? AND date = ?), ?, ?, ?, ?, ?)
    ON CONFLICT(item_id, date) DO UPDATE SET
      completion_id = excluded.completion_id,
      fait = excluded.fait, retenu = excluded.retenu, idees = excluded.idees,
      maj_le = excluded.maj_le`,
  /** Les fois faites d'un item, la plus récente d'abord, avec leur note. Paramètre : item_id. */
  foisFaites: `SELECT c.id AS completion_id, c.date, n.fait, n.retenu, n.idees
    FROM completions c
    LEFT JOIN notes n ON n.item_id = c.item_id AND n.date = c.date
    WHERE c.item_id = ?
    ORDER BY c.date DESC`,
  /** Toutes les notes des tâches d'une liste, la plus récente d'abord. Paramètre : liste_id. */
  carnetListe: `SELECT n.item_id, i.nom, n.date, n.fait, n.retenu, n.idees
    FROM notes n JOIN items i ON i.id = n.item_id
    WHERE i.liste_id = ?
      AND (COALESCE(n.fait, '') <> '' OR COALESCE(n.retenu, '') <> '' OR COALESCE(n.idees, '') <> '')
    ORDER BY n.date DESC, n.maj_le DESC`,
} as const;

/** Une idée par ligne non vide. */
export function idees(texte: string | null): string[] {
  return (texte ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
