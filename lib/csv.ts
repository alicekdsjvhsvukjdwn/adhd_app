/**
 * Export CSV pour l'analyse (pandas, tableur), sans accès à la base :
 * testable seul (tests/csv.test.mjs).
 * UTF-8, séparateur virgule, une ligne d'en-têtes, fins de ligne CRLF (RFC 4180).
 */

export type Valeur = string | number | null;
export type Ligne = Record<string, Valeur>;

/** « 2026-10-15 08:30:00 » (datetime('now') de SQLite, en UTC) → ISO « 2026-10-15T08:30:00Z ». */
const DATETIME_SQLITE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

export function echapperCsv(v: Valeur): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  const m = DATETIME_SQLITE.exec(s);
  if (m) s = `${m[1]}T${m[2]}Z`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function versCsv(colonnes: string[], lignes: Ligne[]): string {
  return [colonnes, ...lignes.map((l) => colonnes.map((c) => l[c]))]
    .map((valeurs) => valeurs.map(echapperCsv).join(","))
    .join("\r\n")
    .concat("\r\n");
}

// ─── LISEZMOI ───────────────────────────────────────────────────────────

const ISO = "horodatage ISO 8601 en UTC (ex. 2026-10-15T06:42:10.123Z)";
const JOUR = "date du calendrier local, AAAA-MM-JJ";
const BOOL = "0 = non, 1 = oui";

/** Description de chaque table et de ses colonnes connues. */
const DOC: Record<string, { table: string; colonnes: Record<string, string> }> = {
  items: {
    table: "Routines et tâches (une ligne par élément).",
    colonnes: {
      id: "identifiant",
      nom: "texte affiché",
      type: "'routine' (revient certains jours) | 'tache' (une fois, ou x fois par semaine / mois)",
      statut: "'actif' | 'termine' (tâche unique faite) ; 'pause' et 'archive' : anciens, plus écrits",
      recurrence: "routines : 'quotidien' | 'hebdo' (même jour que la création) | 'jours:1,3,5' (0 = dimanche) ; tâches : 'semaine:3' | 'mois:2' (x fois par période, semaine du lundi au dimanche) ou vide (tâche unique)",
      template_id: "famille du catalogue d'origine, vide si écrite à la main",
      variante_rang: "niveau dans la famille du catalogue",
      categorie: "domaine : 'sommeil' | 'mouvement' | 'organisation' | 'focus' | 'competences' | 'emotions' ; vide = sans domaine",
      moment: "moment voulu : 'reveil' | 'matin' | 'midi' | 'apres_midi' | 'soir' | 'coucher' ; vide = à tout moment (avant la version 19 : aussi 'apres-midi' et 'indifferent')",
      effort: "difficulté 1 (facile) à 3 (exigeante) ; routines seulement",
      duree_min: "durée estimée, minutes",
      premiere_action: "première action de deux minutes",
      importance: "1 (peu) à 3 (très)",
      ancre_id: "moment repère (table ancres)",
      ancre_position: "'avant' | 'apres' le moment repère",
      echeance: `tâches : ${JOUR}`,
      effort_total_min: "non utilisé (toujours vide)",
      taille_seance_min: "non utilisé (toujours vide)",
      temps_passe_min: "minutes passées (sessions), entier",
      fenetre_jours: "non utilisé (toujours vide)",
      fenetre_debut_h: "non utilisé (toujours vide)",
      fenetre_fin_h: "non utilisé (toujours vide)",
      date_evenement: "non utilisé (toujours vide)",
      heure_evenement: "non utilisé (toujours vide)",
      duree_reelle_moy_min: "durée réelle moyenne observée, minutes",
      heure_reelle_moy: "heure moyenne de réalisation, heure locale décimale (14.5 = 14 h 30)",
      nb_completions: "nombre de fois faite",
      nb_propositions_sans_action: "propositions ignorées d'affilée (moteur de tri)",
      cree_le: ISO,
      maj_le: ISO,
      version_courte: "ancienne version courte écrite à la main ; devenue une étape essentielle à la version 20, plus écrite",
      version_longue: "ancienne version longue écrite à la main ; devenue une étape bonus à la version 20, plus écrite",
      liste_id: "tâches : liste (table listes)",
    },
  },
  completions: {
    table: "Une ligne par item fait un jour donné.",
    colonnes: {
      id: "identifiant",
      item_id: "item (table items)",
      date: JOUR,
      statut: "'complet' ('partiel' : ancien, jamais écrit)",
      heure: "heure locale de la coche, 0–23",
      duree_reelle_min: "durée réelle, minutes (si connue)",
      horodatage: ISO,
      version: "routine sans étapes : 'normale' ; routine à étapes : palier atteint 'essentielles' | 'toutes' ; avant la version 20 : 'courte' | 'normale' | 'longue'",
      points: "points donnés pour cette complétion (routine à étapes : 10 ou 15) ; vide = barème du statut (complet 10, partiel 5), anciennes lignes",
    },
  },
  decision_log: {
    table: "Classements du moteur de tri des tâches, une fois par jour.",
    colonnes: {
      id: "identifiant",
      horodatage: ISO,
      date: JOUR,
      item_id: "item classé",
      score: "score total, 0 à 1",
      composantes: "JSON : urgence, importance, moment, equilibre, etat, negligence (chacune 0 à 1) ; retard_liste (0 à 1) si la liste a un objectif : retard au prorata de la période, compté dans urgence (max avec l'échéance, plafonné à 0,6), sauf un jour difficile",
      rang: "rang dans le classement (1 = premier)",
      propose: `affiché dans « À faire maintenant » : ${BOOL}`,
      exploration: `proposé pour revenir dans la boucle : ${BOOL}`,
      raison: "phrase affichée",
      etat_energie: "vide depuis octobre 2026 (le moteur ne lit plus l'énergie)",
    },
  },
  event_log: {
    table: "Journal des actions (une ligne par événement).",
    colonnes: {
      id: "identifiant",
      type: "type d'événement (item_complete, jour_difficile_active, session_terminee…)",
      routine_id: "item concerné, vide sinon",
      timestamp: ISO,
      contexte: "JSON libre, propre à chaque type",
    },
  },
  etat: {
    table: "Historique, plus écrit depuis la version 20 : bilans de la journée (énergie seule) et anciens check-ins (énergie, concentration, humeur). L'énergie du jour est dans meta (energie_routines).",
    colonnes: {
      id: "identifiant",
      date: JOUR,
      heure: "heure locale décimale (14.5 = 14 h 30)",
      energie: "1 = bas, 2 = moyen, 3 = haut",
      focus: "concentration 1–3 ; vide pour un bilan de la journée",
      humeur: "1–3 ; vide pour un bilan de la journée",
      horodatage: ISO,
    },
  },
  sessions: {
    table: "Minuteurs « Je commence ».",
    colonnes: {
      id: "identifiant",
      type: "'creneau' (Je commence) ; 'focus' | 'regulation' : anciens, plus écrits",
      item_id: "tâche concernée, vide sinon",
      libelle: "texte",
      estimation_min: "durée prévue, minutes",
      reelle_min: "durée réelle, minutes (décimale)",
      debut: ISO,
      fin: ISO,
      date: JOUR,
      terminee: `minuteur allé au bout : ${BOOL}`,
    },
  },
  suggestions: {
    table: "Décisions sur les suggestions d'ajustement.",
    colonnes: {
      id: "identifiant",
      cle: "type:item_id",
      type: "'horaire' | 'simplifier' | 'alleger' | 'monter' | 'ajouter'",
      item_id: "item concerné",
      statut: "'acceptee' | 'refusee'",
      date: JOUR,
      horodatage: ISO,
    },
  },
  difficultes: {
    table: "Difficultés choisies à la mise en place.",
    colonnes: { id: "identifiant", difficulte_id: "identifiant du catalogue", choisie_le: ISO },
  },
  etapes: {
    table: "Étapes des grosses tâches et des routines à étapes.",
    colonnes: {
      id: "identifiant",
      item_id: "tâche ou routine (table items)",
      nom: "texte",
      ordre: "position, 0 = première",
      faite: `tâches seulement : ${BOOL} (les routines : voir etapes_cochees)`,
      faite_le: JOUR,
      essentielle: "routines : 1 = essentielle, 0 = bonus ; 1 pour les tâches",
    },
  },
  etapes_cochees: {
    table: "Étapes cochées des routines (chaque jour) et des tâches « x fois par semaine / mois » (remises à zéro après chaque fois faite) : une ligne par étape et par jour.",
    colonnes: {
      id: "identifiant",
      etape_id: "étape (table etapes)",
      item_id: "routine (table items)",
      date: JOUR,
      horodatage: ISO,
    },
  },
  notes: {
    table: "Carnet : une note facultative par tâche faite (même item_id et date que la complétion).",
    colonnes: {
      id: "identifiant",
      item_id: "tâche (table items)",
      date: `${JOUR} ; avec item_id, retrouve la ligne de completions`,
      completion_id: "complétion au moment de l'écriture (change si la tâche a été décochée puis recochée)",
      fait: "ce que j'ai fait, texte libre",
      retenu: "ce que j'en retiens, texte libre",
      idees: "idées, une par ligne",
      cree_le: ISO,
      maj_le: ISO,
    },
  },
  recompenses: {
    table: "Récompenses réelles définies.",
    colonnes: {
      id: "identifiant",
      nom: "texte",
      icone: "icône au trait ('cafe', 'ecran', 'gateau', 'ticket', 'musique', 'montagne', 'casque', 'vinyle', 'clavier', 'lit', 'livre', 'cadeau', 'etoile', 'avion', 'manette') ou emoji des premières versions",
      prix: "points",
      cree_le: ISO,
      categorie: "'plaisirs' | 'sorties' | 'musique' | 'temps' (temps pour moi) | 'gros' (gros objectifs)",
    },
  },
  achats: {
    table: "Récompenses achetées (nom et prix recopiés). Solde = stats.points_total − somme des prix.",
    colonnes: {
      id: "identifiant",
      recompense_id: "récompense d'origine, vide si supprimée",
      nom: "texte",
      icone: "icône au trait ou emoji (comme recompenses.icone)",
      prix: "points",
      date: JOUR,
      horodatage: ISO,
    },
  },
  listes: {
    table: "Listes de tâches.",
    colonnes: {
      id: "identifiant",
      nom: "texte",
      icone: "emoji",
      ordre: "position",
      cree_le: ISO,
      objectif: "tâches à faire dans la liste par période ; vide = pas d'objectif",
      objectif_periode: "'semaine' (lundi → dimanche) | 'mois'",
      couleur: "clé de la palette : 'bleu' | 'orange' | 'vert' | 'violet' | 'rose' | 'sarcelle' | 'ocre' | 'ardoise'",
    },
  },
  ancres: {
    table: "Moments repères auxquels rattacher les routines.",
    colonnes: {
      id: "identifiant",
      nom: "texte",
      moment: "'matin' | 'midi' | 'apres_midi' | 'soir'",
      active: BOOL,
    },
  },
  stats: {
    table: "Une seule ligne : points et réglage du rappel.",
    colonnes: {
      id: "toujours 1",
      points_total: "points gagnés au total (ne baisse pas avec les achats ; le niveau = points_total // 100 + 1)",
      best_streak: "meilleure série de jours",
      rappel_actif: BOOL,
      rappel_heure: "0–23",
      rappel_minute: "0–59",
    },
  },
  preferences: {
    table: "Une seule ligne : anciens réglages, ni lus ni écrits par l'appli (gardés pour les sauvegardes).",
    colonnes: {
      id: "toujours 1",
      profil: "texte",
      onboarding_fait: BOOL,
      gamification: "'complete' | 'discrete' | 'aucune'",
      ton: "texte",
      rigidite: "texte",
    },
  },
  meta: {
    table: "Valeurs diverses, clé → valeur.",
    colonnes: {
      cle: "'energie_routines:AAAA-MM-JJ' (choix du jour sur Routines : 1 = jour difficile, 2 = normal, 3 = en forme) | 'jour_difficile:AAAA-MM-JJ' (ancien, plus écrit depuis la version 20) | 'vue_routines:AAAA-MM-JJ' (domaine, 'autres' ou 'tout' choisi sur Routines) | 'negligence_dernier_jour_traite'",
      valeur: "energie_routines : 1 = jour difficile, 2 = normal, 3 = en forme ; jour_difficile : 1",
    },
  },
  sommeil: {
    table: "Une ligne par nuit, datée du jour du lever.",
    colonnes: {
      date: `jour du lever, ${JOUR}`,
      coucher: "heure de coucher, HH:MM (heure locale)",
      lever: "heure de lever, HH:MM (heure locale)",
      duree_min: "durée calculée, minutes (passage de minuit compris)",
      qualite: "qualité ressentie : 1 = mauvaise, 2 = moyenne, 3 = bonne",
      ecrans: `écrans avant de dormir : ${BOOL}`,
      saisi_le: ISO,
      maj_le: ISO,
    },
  },
  sport_reglages: {
    table: "Une seule ligne : réglages du sport.",
    colonnes: {
      id: "toujours 1",
      barre_traction: `barre de traction disponible : ${BOOL}`,
      configure_le: ISO,
    },
  },
  sport_paliers: {
    table: "Palier actuel de chaque famille d'exercices.",
    colonnes: {
      famille: "'pousser' | 'tirer' | 'jambes' | 'gainage'",
      palier: "1 = le plus facile",
      maj_le: ISO,
    },
  },
  seances: {
    table: "Séances de sport (faites en entier ou en partie).",
    colonnes: {
      id: "identifiant",
      date: JOUR,
      debut: ISO,
      fin: `${ISO} ; vide si la séance n'a pas été terminée`,
      points_donnes: "points accordés pour la séance (10, ou 0 si aucune série faite)",
    },
  },
  series: {
    table: "Une ligne par série réalisée.",
    colonnes: {
      id: "identifiant",
      seance_id: "séance (table seances)",
      famille: "'pousser' | 'tirer' | 'jambes' | 'gainage'",
      palier: "palier au moment de la série",
      exercice: "nom de l'exercice au moment de la série",
      numero: "1 à 3",
      unite: "'reps' (répétitions) | 's' (secondes)",
      objectif_bas: "objectif bas, même unité",
      objectif_haut: "objectif haut, même unité",
      realise: "réellement fait, même unité (0 possible seulement si la séance n'a pas été terminée)",
    },
  },
  paliers_historique: {
    table: "Changements de palier.",
    colonnes: {
      id: "identifiant",
      date: JOUR,
      horodatage: ISO,
      famille: "'pousser' | 'tirer' | 'jambes' | 'gainage'",
      de: "palier d'avant (vide au départ)",
      vers: "palier proposé ou choisi",
      origine: "'depart' | 'propose_accepte' | 'propose_refuse' (le palier ne change pas) | 'manuel'",
    },
  },
};

export function lisezmoi(
  tables: { nom: string; colonnes: string[]; lignes: number }[],
  exporteLe: string,
): string {
  const blocs = tables.map((t) => {
    const doc = DOC[t.nom];
    const cols = t.colonnes.map(
      (c) => `  - ${c} : ${doc?.colonnes[c] ?? "(non documentée)"}`,
    );
    return [`${t.nom}.csv  (${t.lignes} lignes)`, `  ${doc?.table ?? "(table non documentée)"}`, ...cols].join("\r\n");
  });
  return [
    "Export des données de l'appli tdah-routines",
    `Exporté le ${exporteLe}`,
    "",
    "Format : un CSV par table, UTF-8, séparateur virgule, une ligne d'en-têtes.",
    "Valeur vide = NULL. Dates du calendrier en AAAA-MM-JJ (heure locale),",
    "horodatages en ISO 8601 UTC. En pandas :",
    "  pd.read_csv('sommeil.csv', parse_dates=['date'])",
    "",
    ...blocs.flatMap((b) => [b, ""]),
  ].join("\r\n");
}
