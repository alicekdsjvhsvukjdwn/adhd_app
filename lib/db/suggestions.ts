import { getFamille } from "../catalogue";
import { decalerJours, jourDeCreation } from "../dates";
import { getDatabase } from "./client";
import { getAujourdhui, routineAttendueLe } from "./completions";
import { trancheDeHeure, type Tranche } from "./etat";
import { descendreVariante, modifierItem, monterVariante } from "./items";

/**
 * Ajustements suggérés : l'appli observe, propose, la personne décide.
 *
 * Les suggestions sont recalculées à chaque ouverture à partir des données
 * réelles ; seules les décisions sont stockées. Une seule suggestion à la
 * fois, au plus une décision par jour, et un refus éloigne la même
 * suggestion pendant 14 jours.
 */

export type TypeSuggestion =
  | "horaire"
  | "simplifier"
  | "alleger"
  | "monter"
  | "ajouter";

export type Suggestion = {
  cle: string;
  type: TypeSuggestion;
  itemId: number;
  titre: string;
  /** Ce sur quoi la suggestion s'appuie, en clair. */
  explication: string;
  accepter: string;
  /** Nouveau moment, pour une suggestion d'horaire. */
  valeur?: string;
  /** Écran à ouvrir après acceptation (alléger, ajouter). */
  route?: string;
};

// Seuils, regroupés ici pour pouvoir les ajuster et les documenter.
const FENETRE_DIFFICULTE_J = 14;
const MIN_JOURS_PREVUS_DIFFICULTE = 7;
const TAUX_DIFFICULTE = 0.3;

const FENETRE_HORAIRE_J = 21;
const MIN_COMPLETIONS_HORAIRE = 5;
const PART_HORAIRE = 0.7;

const AGE_INSTALLEE_J = 21;
const MIN_JOURS_PREVUS_INSTALLEE = 10;
const TAUX_INSTALLEE = 0.8;

const DELAI_AVANT_REPROPOSER_J = 14;

const MOMENT_DE_TRANCHE: Record<Tranche, string> = {
  matin: "matin",
  apres_midi: "apres-midi",
  soir: "soir",
};
const NOM_TRANCHE: Record<Tranche, string> = {
  matin: "le matin",
  apres_midi: "l'après-midi",
  soir: "le soir",
};

function trancheDuMoment(moment: string | null): Tranche | null {
  switch (moment) {
    case "reveil":
    case "matin":
      return "matin";
    case "midi":
    case "apres-midi":
    case "apres_midi":
      return "apres_midi";
    case "soir":
    case "coucher":
      return "soir";
    default:
      return null;
  }
}

const decaler = decalerJours;

/** Les n jours révolus avant aujourd'hui (aujourd'hui exclu : pas fini). */
function joursRevolus(aujourdhui: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => decaler(aujourdhui, -(i + 1)));
}

const fois = (k: number, n: number) => `${k} fois sur ${n}`;

type RoutineRow = {
  id: number;
  nom: string;
  moment: string | null;
  ancre_id: number | null;
  recurrence: string | null;
  cree_le: string;
  template_id: string | null;
  variante_rang: number | null;
};

/** La suggestion à montrer maintenant, ou null. */
export async function suggestionDuJour(): Promise<Suggestion | null> {
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();

  const decisions = await db.getAllAsync<{ cle: string; date: string }>(
    "SELECT cle, date FROM suggestions ORDER BY date DESC",
  );
  // Au plus une décision par jour : on n'enchaîne pas les questions.
  if (decisions.some((d) => d.date === aujourdhui)) return null;

  const limite = decaler(aujourdhui, -DELAI_AVANT_REPROPOSER_J);
  const bloquees = new Set(
    decisions.filter((d) => d.date > limite).map((d) => d.cle),
  );

  const routines = await db.getAllAsync<RoutineRow>(
    `SELECT id, nom, moment, ancre_id, recurrence, cree_le,
            template_id, variante_rang
     FROM items WHERE type = 'routine' AND statut = 'actif'`,
  );
  if (routines.length === 0) return null;

  const debut = decaler(aujourdhui, -FENETRE_HORAIRE_J);
  const completions = await db.getAllAsync<{
    item_id: number;
    date: string;
    heure: number | null;
  }>(
    `SELECT item_id, date, heure FROM completions
     WHERE date >= ? AND date < ? AND statut IN ('complet', 'partiel')`,
    debut,
    aujourdhui,
  );

  const difficiles: Suggestion[] = [];
  const horaires: Suggestion[] = [];
  const installees: Suggestion[] = [];

  for (const r of routines) {
    const depuis = jourDeCreation(r.cree_le);
    const siennes = completions.filter((c) => c.item_id === r.id);
    const faitesLe = new Set(siennes.map((c) => c.date));
    const famille = r.template_id ? getFamille(r.template_id) : undefined;

    const bilan = (n: number) => {
      const prevus = joursRevolus(aujourdhui, n).filter((j) =>
        routineAttendueLe(r.recurrence, depuis, j),
      );
      const faits = prevus.filter((j) => faitesLe.has(j)).length;
      return { prevus: prevus.length, faits };
    };

    // 1. Du mal à tenir
    const court = bilan(FENETRE_DIFFICULTE_J);
    if (
      court.prevus >= MIN_JOURS_PREVUS_DIFFICULTE &&
      court.faits / court.prevus < TAUX_DIFFICULTE
    ) {
      const plusSimple =
        famille && r.variante_rang !== null
          ? famille.variantes.find((v) => v.rang === r.variante_rang! - 1)
          : undefined;
      if (plusSimple) {
        difficiles.push({
          cle: `simplifier:${r.id}`,
          type: "simplifier",
          itemId: r.id,
          titre: `« ${r.nom} » a du mal à tenir. Passer à une version plus simple ?`,
          explication: `Faite ${fois(court.faits, court.prevus)} ces deux dernières semaines. Version proposée : « ${plusSimple.libelle} ».`,
          accepter: "Simplifier",
        });
      } else {
        difficiles.push({
          cle: `alleger:${r.id}`,
          type: "alleger",
          itemId: r.id,
          titre: `« ${r.nom} » a du mal à tenir. L'alléger ?`,
          explication: `Faite ${fois(court.faits, court.prevus)} ces deux dernières semaines. Moins de jours ou une version plus courte, c'est souvent ce qui fait tenir une routine.`,
          accepter: "Modifier",
          route: `/nouvelle-tache?id=${r.id}`,
        });
      }
    }

    // 2. Faite à un autre moment que prévu (pas pour une routine ancrée :
    //    c'est son moment repère qui fixe sa place)
    if (r.ancre_id === null) {
      const avecHeure = siennes.filter((c) => c.heure !== null);
      if (avecHeure.length >= MIN_COMPLETIONS_HORAIRE) {
        const compte = new Map<Tranche, number>();
        for (const c of avecHeure) {
          const t = trancheDeHeure(c.heure!);
          compte.set(t, (compte.get(t) ?? 0) + 1);
        }
        const [dominante, n] = [...compte.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0];
        const prevue = trancheDuMoment(r.moment);
        if (n / avecHeure.length >= PART_HORAIRE && dominante !== prevue) {
          horaires.push({
            cle: `horaire:${r.id}`,
            type: "horaire",
            itemId: r.id,
            titre: prevue
              ? `Tu fais souvent « ${r.nom} » ${NOM_TRANCHE[dominante]} plutôt que ${NOM_TRANCHE[prevue]}. La déplacer ?`
              : `Tu fais surtout « ${r.nom} » ${NOM_TRANCHE[dominante]}. L'y ranger ?`,
            explication: `${fois(n, avecHeure.length)} ces trois dernières semaines.`,
            accepter: "Déplacer",
            valeur: MOMENT_DE_TRANCHE[dominante],
          });
        }
      }
    }

    // 3. Bien installée
    const ageJ = Math.round(
      (Date.parse(aujourdhui + "T00:00:00Z") -
        Date.parse(depuis + "T00:00:00Z")) /
        86400000,
    );
    const long = bilan(FENETRE_HORAIRE_J);
    if (
      ageJ >= AGE_INSTALLEE_J &&
      long.prevus >= MIN_JOURS_PREVUS_INSTALLEE &&
      long.faits / long.prevus >= TAUX_INSTALLEE
    ) {
      const suivante =
        famille && r.variante_rang !== null
          ? famille.variantes.find((v) => v.rang === r.variante_rang! + 1)
          : undefined;
      if (suivante) {
        installees.push({
          cle: `monter:${r.id}`,
          type: "monter",
          itemId: r.id,
          titre: `« ${r.nom} » est bien installée. Passer à la version suivante ?`,
          explication: `Faite ${fois(long.faits, long.prevus)} ces trois dernières semaines. Version proposée : « ${suivante.libelle} ».`,
          accepter: "Passer à la suite",
        });
      } else {
        installees.push({
          cle: `ajouter:${r.id}`,
          type: "ajouter",
          itemId: r.id,
          titre: `« ${r.nom} » tient depuis trois semaines. Ajouter une nouvelle routine ?`,
          explication: `Faite ${fois(long.faits, long.prevus)}. Une habitude installée libère de la place pour la suivante.`,
          accepter: "Choisir une routine",
          route: "/mise-en-place",
        });
      }
    }
  }

  // Priorité : aider ce qui ne tient pas, puis caler les horaires, puis faire avancer.
  return (
    [...difficiles, ...horaires, ...installees].find(
      (s) => !bloquees.has(s.cle),
    ) ?? null
  );
}

/** Applique (si acceptée) et enregistre la décision. */
export async function deciderSuggestion(
  s: Suggestion,
  acceptee: boolean,
): Promise<void> {
  if (acceptee) {
    if (s.type === "horaire" && s.valeur) {
      await modifierItem(s.itemId, { moment: s.valeur });
    } else if (s.type === "simplifier") {
      await descendreVariante(s.itemId);
    } else if (s.type === "monter") {
      await monterVariante(s.itemId);
    }
    // « alleger » et « ajouter » : l'écran ouvre la route indiquée.
  }

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO suggestions (cle, type, item_id, statut, date, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    s.cle,
    s.type,
    s.itemId,
    acceptee ? "acceptee" : "refusee",
    getAujourdhui(),
    new Date().toISOString(),
  );
}
