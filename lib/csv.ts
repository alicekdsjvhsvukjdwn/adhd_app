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
    table: "Routines, tâches et événements (une ligne par élément).",
    colonnes: {
      id: "identifiant",
      nom: "texte affiché",
      type: "'routine' (revient) | 'tache' (ponctuelle) | 'evenement' (daté)",
      statut: "'actif' | 'pause' | 'archive' | 'termine'",
      recurrence: "routines : 'quotidien' | 'hebdo' (même jour que la création) | 'jours:1,3,5' (0 = dimanche) ; vide pour une tâche",
      template_id: "famille du catalogue d'origine, vide si écrite à la main",
      variante_rang: "niveau dans la famille du catalogue",
      categorie: "domaine : 'sommeil' | 'mouvement' | 'organisation' | 'focus' | 'competences' | 'emotions' ; vide = sans domaine",
      moment: "moment voulu : 'reveil' | 'matin' | 'midi' | 'apres-midi' (ou 'apres_midi', ancien) | 'soir' | 'coucher' | 'indifferent' ; vide = à tout moment",
      effort: "difficulté 1 (facile) à 3 (exigeante) ; routines seulement",
      duree_min: "durée estimée, minutes",
      premiere_action: "première action de deux minutes",
      importance: "1 (peu) à 3 (très)",
      ancre_id: "moment repère (table ancres)",
      ancre_position: "'avant' | 'apres' le moment repère",
      echeance: `tâches : ${JOUR}`,
      effort_total_min: "non utilisé",
      taille_seance_min: "non utilisé",
      temps_passe_min: "minutes passées (sessions), entier",
      fenetre_jours: "contrainte de jours (non utilisé à l'écran)",
      fenetre_debut_h: "heure à partir de laquelle l'item est proposable (0–23)",
      fenetre_fin_h: "heure avant laquelle l'item est proposable (0–23)",
      date_evenement: JOUR,
      heure_evenement: "HH:MM",
      duree_reelle_moy_min: "durée réelle moyenne observée, minutes",
      heure_reelle_moy: "heure moyenne de réalisation, heure locale décimale (14.5 = 14 h 30)",
      nb_completions: "nombre de fois faite",
      nb_propositions_sans_action: "propositions ignorées d'affilée (moteur de tri)",
      cree_le: ISO,
      maj_le: ISO,
      version_courte: "version courte écrite à la main (jour difficile)",
      version_longue: "version longue écrite à la main (en forme)",
      liste_id: "tâches : liste (table listes)",
    },
  },
  completions: {
    table: "Une ligne par item fait un jour donné.",
    colonnes: {
      id: "identifiant",
      item_id: "item (table items)",
      date: JOUR,
      statut: "'complet' (+10 points) | 'partiel' (+5)",
      heure: "heure locale de la coche, 0–23",
      duree_reelle_min: "durée réelle, minutes (si connue)",
      horodatage: ISO,
      version: "version faite : 'courte' | 'normale' | 'longue'",
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
      composantes: "JSON : urgence, importance, moment, equilibre, etat, negligence (chacune 0 à 1)",
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
    table: "Bilan de la journée (énergie seule) et anciens check-ins (énergie, concentration, humeur).",
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
    table: "Minuteurs « Je commence » et sessions de régulation.",
    colonnes: {
      id: "identifiant",
      type: "'focus' | 'regulation'",
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
    table: "Étapes des grosses tâches.",
    colonnes: {
      id: "identifiant",
      item_id: "tâche (table items)",
      nom: "texte",
      ordre: "position, 0 = première",
      faite: BOOL,
      faite_le: ISO,
    },
  },
  recompenses: {
    table: "Récompenses réelles définies.",
    colonnes: { id: "identifiant", nom: "texte", icone: "emoji", prix: "points", cree_le: ISO },
  },
  achats: {
    table: "Récompenses achetées (nom et prix recopiés). Solde = stats.points_total − somme des prix.",
    colonnes: {
      id: "identifiant",
      recompense_id: "récompense d'origine, vide si supprimée",
      nom: "texte",
      icone: "emoji",
      prix: "points",
      date: JOUR,
      horodatage: ISO,
    },
  },
  listes: {
    table: "Listes de tâches.",
    colonnes: { id: "identifiant", nom: "texte", icone: "emoji", ordre: "position", cree_le: ISO },
  },
  ancres: {
    table: "Moments repères auxquels rattacher les routines.",
    colonnes: {
      id: "identifiant",
      nom: "texte",
      moment: "'reveil' | 'matin' | 'midi' | 'apres-midi' | 'soir' | 'coucher'",
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
    table: "Une seule ligne : anciens réglages.",
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
      cle: "'energie_routines:AAAA-MM-JJ' (choix du jour sur Routines) | 'jour_difficile:AAAA-MM-JJ' | 'negligence_dernier_jour_traite'",
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
