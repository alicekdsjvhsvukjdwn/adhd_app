import type { FamilleTemplate } from "../types";

export const SESSION_MINUTEE: FamilleTemplate = {
  id: "session-minutee",
  nom: "Session minutée courte",
  categorie: "focus",
  problemes: [
    "je n'arrive pas à me concentrer",
    "je pars dans tous les sens quand je travaille",
  ],
  mots_cles: [
    "minuteur",
    "session",
    "concentration",
    "focus",
    "pomodoro",
    "travailler",
    "chrono",
  ],
  moment: "indifferent",
  ancre_suggeree: "quand je m'assois à mon bureau",
  variantes: [
    {
      rang: 1,
      libelle: "Dix minutes minutées",
      duree_min: 10,
      premiere_action: "Lancer le minuteur",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Vingt minutes minutées",
      duree_min: 20,
      premiere_action: "Lancer le minuteur",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Vingt-cinq minutes puis une pause",
      duree_min: 25,
      premiere_action: "Lancer le minuteur",
      effort: 2,
    },
    {
      rang: 4,
      libelle: "Deux sessions de vingt-cinq minutes enchaînées",
      duree_min: 60,
      premiere_action: "Lancer le minuteur",
      effort: 3,
    },
  ],
  contre_indication: null,
  justification:
    "Un minuteur visible remplace l'estimation interne du temps écoulé, qui est peu fiable dans le TDAH. Il borne aussi l'engagement : accepter vingt minutes est beaucoup plus facile qu'accepter « travailler cet après-midi ».",
  source: "Barkley, externalisation du temps",
  icone: "minuteur",
  palier_devoilement: 0,
  prerequis: [],
};

export const DEMARRAGE_CINQ_MINUTES: FamilleTemplate = {
  id: "demarrage-cinq-minutes",
  nom: "Démarrage à cinq minutes",
  categorie: "focus",
  problemes: [
    "je n'arrive pas à commencer",
    "je repousse toujours la même tâche",
  ],
  mots_cles: [
    "commencer",
    "demarrer",
    "procrastination",
    "repousser",
    "lancer",
    "blocage",
  ],
  moment: "indifferent",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Deux minutes sur la tâche, avec droit d'arrêt",
      duree_min: 2,
      premiere_action: "Lancer le minuteur et ouvrir ce qu'il faut",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Cinq minutes sur la tâche, avec droit d'arrêt",
      duree_min: 5,
      premiere_action: "Lancer le minuteur et ouvrir ce qu'il faut",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Dix minutes sur la tâche la plus repoussée",
      duree_min: 10,
      premiere_action: "Lancer le minuteur et ouvrir ce qu'il faut",
      effort: 3,
    },
  ],
  contre_indication:
    "L'engagement d'arrêt doit être réel : si l'appli pousse à continuer au-delà, le mécanisme cesse de fonctionner les fois suivantes.",
  justification:
    "Le blocage porte sur l'initiation, pas sur l'exécution : une fois commencé, on continue souvent bien au-delà. Réduire l'engagement à quelques minutes, avec un droit d'arrêt explicite, abaisse le coût de la première marche.",
  source: "Safren et al., TCC adulte",
  icone: "demarrage",
  palier_devoilement: 0,
  prerequis: [],
};

export const PREPARER_ESPACE: FamilleTemplate = {
  id: "preparer-espace",
  nom: "Préparer l'espace avant de commencer",
  categorie: "focus",
  problemes: [
    "je me disperse dès que je m'assois",
    "je n'arrive pas à me concentrer",
  ],
  mots_cles: [
    "bureau",
    "espace",
    "distraction",
    "telephone",
    "notifications",
    "preparer",
    "installer",
  ],
  moment: "indifferent",
  ancre_suggeree: "juste avant de m'asseoir pour travailler",
  variantes: [
    {
      rang: 1,
      libelle: "Mettre le téléphone hors de vue",
      duree_min: 1,
      premiere_action: "Prendre le téléphone et le poser ailleurs",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Dégager le bureau et poser de l'eau",
      duree_min: 3,
      premiere_action: "Enlever ce qui traîne sur le bureau",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Espace dégagé, téléphone ailleurs, notifications coupées",
      duree_min: 5,
      premiere_action: "Prendre le téléphone et le poser ailleurs",
      effort: 2,
    },
  ],
  contre_indication:
    "Ne pas laisser cette routine devenir un substitut à la tâche : plafonner à cinq minutes.",
  justification:
    "Réduire la distraction en amont coûte moins que lutter contre elle pendant la session, puisque la résistance mobilise les mêmes ressources que la tâche elle-même. Cela s'applique au moment où l'on s'installe, pas plus tard.",
  source: "Barkley, point de performance",
  icone: "bureau",
  palier_devoilement: 1,
  prerequis: [],
};

export const PAUSES_REGULIERES: FamilleTemplate = {
  id: "pauses-regulieres",
  nom: "Pause régulière pendant le travail",
  categorie: "focus",
  problemes: [
    "je m'accroche des heures et je m'effondre après",
    "j'oublie de manger quand je travaille",
  ],
  mots_cles: [
    "pause",
    "hyperfocus",
    "couper",
    "souffler",
    "epuisement",
    "enchainer",
  ],
  moment: "indifferent",
  ancre_suggeree: "fin de chaque session minutée",
  variantes: [
    {
      rang: 1,
      libelle: "Se lever une minute à la fin d'une session",
      duree_min: 1,
      premiere_action: "Se lever",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Cinq minutes de pause debout, sans écran",
      duree_min: 5,
      premiere_action: "Se lever et s'éloigner du bureau",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Pause de cinq minutes avec mouvement et un verre d'eau",
      duree_min: 5,
      premiere_action: "Se lever et s'éloigner du bureau",
      effort: 2,
    },
  ],
  contre_indication:
    "Ne jamais interrompre une session en cours par une notification : la pause se propose à la fin, pas pendant.",
  justification:
    "Cette routine ne vise pas la distraction mais l'hyperfocus, qui fait perdre les signaux de faim, de soif et de fatigue. La pause n'a pas à être décidée sur le moment : c'est une limite posée à l'avance.",
  source: "Barkley ; Ashinoff & Abu-Akel sur l'hyperfocus",
  icone: "pause",
  palier_devoilement: 1,
  prerequis: ["session-minutee"],
};

export const PROCHAINE_ACTION: FamilleTemplate = {
  id: "prochaine-action",
  nom: "Poser la prochaine action avant de s'arrêter",
  categorie: "focus",
  problemes: [
    "je n'arrive pas à reprendre ce que j'avais commencé",
    "je perds le fil entre deux sessions",
  ],
  mots_cles: [
    "reprendre",
    "suite",
    "fil",
    "note",
    "prochaine",
    "arreter",
    "relancer",
  ],
  moment: "indifferent",
  ancre_suggeree: "à la fin de chaque session de travail",
  variantes: [
    {
      rang: 1,
      libelle: "Écrire en une phrase la prochaine action",
      duree_min: 1,
      premiere_action: "Ouvrir la capture et écrire une ligne",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Noter la prochaine action et laisser le matériel en place",
      duree_min: 2,
      premiere_action: "Ouvrir la capture et écrire une ligne",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Noter où j'en suis, ce qui bloque, et la prochaine action",
      duree_min: 5,
      premiere_action: "Ouvrir la capture et écrire une ligne",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Le coût de reprise est ce qui fait abandonner les projets longs : retrouver le contexte mobilise la mémoire de travail, et l'effort décourage avant même de commencer. Écrire la suite au moment où le contexte est encore chargé supprime ce coût.",
  source: "Solanto, thérapie métacognitive",
  icone: "note",
  palier_devoilement: 1,
  prerequis: [],
};

export const FAMILLES_FOCUS: FamilleTemplate[] = [
  SESSION_MINUTEE,
  DEMARRAGE_CINQ_MINUTES,
  PREPARER_ESPACE,
  PAUSES_REGULIERES,
  PROCHAINE_ACTION,
];
