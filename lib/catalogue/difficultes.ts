/**
 * Les difficultés proposées dans la mise en place guidée.
 *
 * Écrites à la première personne, concrètes, sans jugement, sans vocabulaire
 * médical, sans accord en genre, 45 caractères au plus. Chacune renvoie à une
 * ou deux familles du catalogue, proposées dans leur version la plus simple.
 * Voir docs/mise-en-place-guidee.md.
 */

export type Theme = { id: string; titre: string; icone: string };

export type Difficulte = {
  id: string;
  libelle: string;
  icone: string;
  theme: string;
  /** Identifiants de familles du catalogue, par ordre de préférence. */
  routines: string[];
  /** Fait partie des 8 affichées d'abord. */
  frequente?: boolean;
  /** Afficher un lien discret vers l'aide de l'onglet Infos. */
  lienAide?: boolean;
};

export const THEMES: Theme[] = [
  { id: "sommeil", titre: "Dormir et se lever", icone: "🌙" },
  { id: "demarrer", titre: "Démarrer et rester concentré", icone: "🎯" },
  { id: "temps", titre: "Gérer le temps", icone: "⏱️" },
  { id: "organisation", titre: "S'organiser au quotidien", icone: "🗂️" },
  { id: "corps", titre: "Prendre soin de son corps", icone: "🌿" },
  { id: "emotions", titre: "Émotions et charge mentale", icone: "💭" },
  { id: "compte", titre: "Ce qui compte pour moi", icone: "🎨" },
];

export const DIFFICULTES: Difficulte[] = [
  // Dormir et se lever
  {
    id: "lever",
    libelle: "Je n'arrive pas à me lever",
    icone: "⏰",
    theme: "sommeil",
    routines: ["lever-constant", "sortie-de-lit"],
    frequente: true,
  },
  {
    id: "coucher-tard",
    libelle: "Je me couche trop tard",
    icone: "🌙",
    theme: "sommeil",
    routines: ["mise-en-route-coucher", "ecrans-soir"],
    frequente: true,
  },
  {
    id: "tete-qui-tourne",
    libelle: "Mon cerveau tourne quand je veux dormir",
    icone: "🌀",
    theme: "sommeil",
    routines: ["vider-sa-tete", "moment-sans-ecran"],
  },
  {
    id: "fatigue",
    libelle: "La fatigue me tombe dessus en journée",
    icone: "🥱",
    theme: "sommeil",
    routines: ["lumiere-matin", "lever-constant"],
  },

  // Démarrer et rester concentré
  {
    id: "commencer",
    libelle: "J'ai du mal à commencer",
    icone: "🚦",
    theme: "demarrer",
    routines: ["demarrage-cinq-minutes", "bouger-avant-focus"],
    frequente: true,
  },
  {
    id: "dernier-moment",
    libelle: "Je fais tout au dernier moment",
    icone: "⏳",
    theme: "demarrer",
    routines: ["decouper-tache", "demarrage-cinq-minutes"],
    frequente: true,
  },
  {
    id: "distraction",
    libelle: "Je me laisse distraire tout le temps",
    icone: "📱",
    theme: "demarrer",
    routines: ["preparer-espace", "session-minutee"],
    frequente: true,
  },
  {
    id: "finir",
    libelle: "Je commence plein de choses sans les finir",
    icone: "🧩",
    theme: "demarrer",
    routines: ["choisir-a-finir", "prochaine-action"],
  },
  {
    id: "hyperfocus",
    libelle: "Je ne vois plus le temps passer",
    icone: "🔁",
    theme: "demarrer",
    routines: ["pauses-regulieres", "session-minutee"],
  },
  {
    id: "ennui",
    libelle: "Je décroche vite sur ce qui m'ennuie",
    icone: "😶",
    theme: "demarrer",
    routines: ["changer-de-cadre", "session-minutee"],
  },

  // Gérer le temps
  {
    id: "retard",
    libelle: "Je suis souvent en retard",
    icone: "🏃",
    theme: "temps",
    routines: ["alarme-depart", "preparer-la-veille"],
    frequente: true,
  },
  {
    id: "estimer",
    libelle: "Je sous-estime le temps que ça prend",
    icone: "⏱️",
    theme: "temps",
    routines: ["chronometrer", "session-minutee"],
  },
  {
    id: "rendez-vous",
    libelle: "J'oublie mes rendez-vous",
    icone: "📅",
    theme: "temps",
    routines: ["regarder-agenda"],
  },
  {
    id: "journees",
    libelle: "Mes journées filent sans que je sache où",
    icone: "🌫️",
    theme: "temps",
    routines: ["trois-choses-du-jour", "une-chose-faite"],
  },

  // S'organiser au quotidien
  {
    id: "oublier",
    libelle: "J'oublie ce que je devais faire",
    icone: "📝",
    theme: "organisation",
    routines: ["vider-capture", "trois-choses-du-jour"],
    frequente: true,
  },
  {
    id: "perdre",
    libelle: "Je perds mes affaires",
    icone: "🔑",
    theme: "organisation",
    routines: ["point-de-depot", "verification-sortie"],
    frequente: true,
  },
  {
    id: "desordre",
    libelle: "Le désordre s'accumule chez moi",
    icone: "🧺",
    theme: "organisation",
    routines: ["remise-a-zero-piece"],
  },
  {
    id: "papiers",
    libelle: "Les papiers et l'administratif s'accumulent",
    icone: "📬",
    theme: "organisation",
    routines: ["administratif"],
  },
  {
    id: "messages",
    libelle: "Je laisse traîner mes messages et mes mails",
    icone: "💬",
    theme: "organisation",
    routines: ["un-message-par-jour", "administratif"],
  },
  {
    id: "argent",
    libelle: "Je dépense sans y penser",
    icone: "💳",
    theme: "organisation",
    routines: ["regarder-son-compte"],
  },

  // Prendre soin de son corps
  {
    id: "bouger",
    libelle: "Je ne bouge pas assez",
    icone: "🚶",
    theme: "corps",
    routines: ["marche-quotidienne", "bouger-matin"],
  },
  {
    id: "immobile",
    libelle: "Je reste des heures sans bouger",
    icone: "🪑",
    theme: "corps",
    routines: ["pauses-regulieres", "decharge-corporelle"],
  },
  {
    id: "manger",
    libelle: "J'oublie de manger",
    icone: "🍽️",
    theme: "corps",
    routines: ["repas-regulier"],
  },
  {
    id: "boire",
    libelle: "J'oublie de boire",
    icone: "💧",
    theme: "corps",
    routines: ["boire-eau"],
  },
  {
    id: "traitement",
    libelle: "J'oublie mon traitement",
    icone: "💊",
    theme: "corps",
    routines: ["traitement-ancre"],
  },

  // Émotions et charge mentale
  {
    id: "trop-en-tete",
    libelle: "J'ai trop de choses en tête",
    icone: "🧠",
    theme: "emotions",
    routines: ["vider-sa-tete", "trois-choses-du-jour"],
  },
  {
    id: "trop-d-un-coup",
    libelle: "Tout me semble trop d'un coup",
    icone: "🌊",
    theme: "emotions",
    routines: ["respiration-lente", "vider-sa-tete"],
    lienAide: true,
  },
  {
    id: "emotions-vite",
    libelle: "Mes émotions montent très vite",
    icone: "🌋",
    theme: "emotions",
    routines: ["delai-avant-de-repondre", "nommer-son-emotion"],
  },
  {
    id: "decourage",
    libelle: "Je me décourage vite",
    icone: "🌧️",
    theme: "emotions",
    routines: ["une-chose-faite"],
  },
  {
    id: "detendre",
    libelle: "J'ai du mal à me détendre",
    icone: "🛋️",
    theme: "emotions",
    routines: ["moment-sans-ecran", "decharge-corporelle"],
  },

  // Ce qui compte pour moi
  {
    id: "activite",
    libelle: "J'arrête les activités qui me plaisent",
    icone: "🎸",
    theme: "compte",
    routines: ["pratique-reguliere", "materiel-a-portee"],
  },
  {
    id: "projets",
    libelle: "J'abandonne mes projets en route",
    icone: "🚧",
    theme: "compte",
    routines: ["prochaine-action"],
  },
  {
    id: "apprendre",
    libelle: "Je n'arrive pas à apprendre régulièrement",
    icone: "📚",
    theme: "compte",
    routines: ["apprendre-chaque-jour"],
  },
  {
    id: "proches",
    libelle: "Je perds le contact avec mes proches",
    icone: "🤝",
    theme: "compte",
    routines: ["donner-des-nouvelles"],
  },
];

/** Pour « Je ne sais pas par où commencer » : utiles quel que soit le profil. */
export const DEMARRAGE_UNIVERSEL = [
  "lever-constant",
  "vider-capture",
  "une-chose-faite",
];
