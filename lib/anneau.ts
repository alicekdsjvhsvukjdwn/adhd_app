/**
 * L'anneau de l'onglet Routines : remplissage des domaines, position de la
 * bille-soleil, domaine sélectionné par défaut, géométrie des arcs.
 * Sans accès à la base ni au téléphone, et sans import : testable seul
 * (tests/anneau.test.mjs). Le palier des étapes et le moment arrivent déjà
 * calculés (palierEtapes, momentStocke).
 */
import type { Categorie } from "./catalogue";
import type { Moment } from "./moments";

/**
 * Les 6 domaines, dans l'ordre de l'anneau (sens des aiguilles d'une montre,
 * depuis le haut). Même ordre que ORDRE_CATEGORIES (vérifié par les tests).
 */
export const DOMAINES: Categorie[] = [
  "emotions",
  "mouvement",
  "competences",
  "organisation",
  "focus",
  "sommeil",
];
export type Domaine = Categorie;
/** Routines sans domaine : une puce à part, sans arc. */
export type Selection = Domaine | "autres";

// ─── Remplissage ────────────────────────────────────────────────────────

/** Part d'une routine à étapes quand ses essentielles sont faites (hors jour difficile). */
export const PART_ESSENTIELLES = 2 / 3;

export type RoutineAnneau = {
  categorie: string | null;
  faitAujourdhui: boolean;
  /** Palier des étapes du jour (palierEtapes) ; null pour une routine sans étapes. */
  palier: 0 | 1 | 2 | null;
  /** Moment repère, sinon moment déclaré (momentStocke) ; null = à tout moment. */
  moment: Moment | null;
};

/**
 * Part d'une routine dans son domaine, de 0 à 1.
 * Sans étapes : faite = 1. À étapes : essentielles faites = 2/3, tout = 1 ;
 * un jour difficile, les essentielles suffisent (comme pour les points).
 */
export function partRoutine(r: RoutineAnneau, jourDifficile: boolean): number {
  if (r.palier === null) return r.faitAujourdhui ? 1 : 0;
  if (r.palier === 2) return 1;
  if (r.palier === 1) return jourDifficile ? 1 : PART_ESSENTIELLES;
  return 0;
}

/** Domaine d'une routine pour l'anneau, ou « autres » sans domaine. */
export function selectionDe(categorie: string | null): Selection {
  return (DOMAINES as string[]).includes(categorie ?? "")
    ? (categorie as Domaine)
    : "autres";
}

/**
 * Remplissage d'un domaine (0 à 1) : la moyenne des parts de ses routines
 * prévues aujourd'hui. null pour un domaine sans routine aujourd'hui.
 */
export function remplissage(
  routines: RoutineAnneau[],
  domaine: Selection,
  jourDifficile: boolean,
): number | null {
  const siennes = routines.filter((r) => selectionDe(r.categorie) === domaine);
  if (siennes.length === 0) return null;
  return siennes.reduce((s, r) => s + partRoutine(r, jourDifficile), 0) / siennes.length;
}

// ─── Domaine sélectionné par défaut ─────────────────────────────────────

const ORDRE_MOMENTS: Moment[] = ["reveil", "matin", "midi", "apres_midi", "soir", "coucher"];

/**
 * Distance d'un moment au moment en cours : 0 pour maintenant, puis les
 * moments à venir, puis ceux déjà passés (le plus récent d'abord).
 * Une routine sans moment se fait « à tout moment » : juste après maintenant.
 */
function distance(m: Moment | null, courant: Moment): number {
  const i = m ? ORDRE_MOMENTS.indexOf(m) : -1;
  if (i < 0) return 0.5;
  const c = ORDRE_MOMENTS.indexOf(courant);
  return i >= c ? i - c : ORDRE_MOMENTS.length + (c - i);
}

/**
 * Le domaine de la prochaine routine à faire, selon le moment. Tout est fait :
 * le premier domaine qui a des routines aujourd'hui ; aucune : le premier.
 * L'ordre d'origine départage deux routines au même moment.
 */
export function domaineParDefaut(routines: RoutineAnneau[], courant: Moment): Selection {
  const aFaire = routines
    .map((r, i) => ({ r, i, d: distance(r.moment, courant) }))
    .filter((x) => !x.r.faitAujourdhui)
    .sort((a, b) => a.d - b.d || a.i - b.i);
  if (aFaire.length > 0) return selectionDe(aFaire[0].r.categorie);
  const avec = DOMAINES.find((d) => routines.some((r) => selectionDe(r.categorie) === d));
  return avec ?? (routines.length > 0 ? "autres" : DOMAINES[0]);
}

// ─── Bille-soleil ───────────────────────────────────────────────────────

/**
 * Angle de la bille, en degrés depuis le haut, dans le sens des aiguilles :
 * 0 à 6 h, 360 (tour complet) à minuit. Entre minuit et 6 h, le tour est complet.
 */
export function angleBille(heure: number): number {
  if (heure < 6) return 360;
  return Math.min(360, ((heure - 6) / 18) * 360);
}

// ─── Géométrie ──────────────────────────────────────────────────────────

/** Écart entre deux arcs, en degrés. */
export const ECART_ARCS = 7;

/** Début et fin (degrés depuis le haut) de l'arc du domaine i sur n. */
export function bornesArc(i: number, n = DOMAINES.length, ecart = ECART_ARCS) {
  const part = 360 / n;
  return { debut: i * part + ecart / 2, fin: (i + 1) * part - ecart / 2 };
}

/** Point du cercle à `angle` degrés depuis le haut, sens des aiguilles. */
export function point(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Chemin SVG d'un arc de `debut` à `fin` (degrés depuis le haut). */
export function cheminArc(cx: number, cy: number, r: number, debut: number, fin: number): string {
  const balayage = Math.min(fin - debut, 359.99);
  const a = point(cx, cy, r, debut);
  const b = point(cx, cy, r, debut + balayage);
  const grand = balayage > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return `M ${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r)} 0 ${grand} 1 ${f(b.x)} ${f(b.y)}`;
}

/**
 * Domaine touché sur l'anneau, d'après le point (x, y) dans un carré de
 * côté `taille` : seulement sur la bande des arcs (± tolérance), null ailleurs.
 */
export function domaineAuPoint(
  x: number,
  y: number,
  taille: number,
  rayonArcs: number,
  tolerance: number,
): Domaine | null {
  const dx = x - taille / 2;
  const dy = y - taille / 2;
  const d = Math.hypot(dx, dy);
  if (Math.abs(d - rayonArcs) > tolerance) return null;
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  return DOMAINES[Math.floor(angle / (360 / DOMAINES.length)) % DOMAINES.length];
}
