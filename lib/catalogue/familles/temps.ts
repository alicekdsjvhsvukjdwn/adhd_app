import type { FamilleTemplate } from "../types";

export const ALARME_DEPART: FamilleTemplate = {
  id: "alarme-depart",
  nom: "Alarme de départ",
  categorie: "organisation",
  problemes: ["je suis souvent en retard", "je pars toujours en retard"],
  mots_cles: ["retard", "partir", "depart", "heure", "alarme", "rendez-vous"],
  moment: "matin",
  ancre_suggeree: "avant de partir de chez moi",
  variantes: [
    {
      rang: 1,
      libelle:
        "Mettre une alarme « départ » 10 minutes avant l'heure de partir",
      duree_min: 1,
      premiere_action: "Ouvrir l'appli horloge",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "À l'alarme, enfiler ses chaussures",
      duree_min: 2,
      premiere_action: "Se lever",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "À l'alarme, avoir le sac à la main et partir",
      duree_min: 5,
      premiere_action: "Prendre le sac",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Le retard vient rarement d'un manque de volonté, plutôt d'une mauvaise perception du temps qui reste. Une alarme fixée à l'avance remplace cette estimation par un signal extérieur, au moment où il faut agir.",
  source: "Barkley, externalisation du temps",
  icone: "alarme",
  palier_devoilement: 0,
  prerequis: [],
};

export const CHRONOMETRER: FamilleTemplate = {
  id: "chronometrer",
  nom: "Chronométrer ses tâches",
  categorie: "organisation",
  problemes: [
    "je sous-estime le temps que ça prend",
    "je prévois toujours trop de choses",
  ],
  mots_cles: ["temps", "duree", "estimer", "chrono", "chronometre", "planning"],
  moment: "indifferent",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Chronométrer une tâche courante",
      duree_min: 1,
      premiere_action: "Lancer le chronomètre en commençant",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Noter son estimation, puis le temps réel",
      duree_min: 2,
      premiere_action: "Écrire l'estimation avant de commencer",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Comparer estimation et temps réel sur trois tâches",
      duree_min: 5,
      premiere_action: "Écrire l'estimation avant de commencer",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Estimer une durée de l'intérieur est peu fiable dans le TDAH, et l'écart se répète d'une fois sur l'autre. Mesurer quelques tâches réelles donne des repères concrets, bien plus utiles qu'une bonne résolution.",
  source: "Barkley, externalisation du temps",
  icone: "chrono",
  palier_devoilement: 0,
  prerequis: [],
};

export const REGARDER_AGENDA: FamilleTemplate = {
  id: "regarder-agenda",
  nom: "Regarder l'agenda",
  categorie: "organisation",
  problemes: ["j'oublie mes rendez-vous"],
  mots_cles: [
    "agenda",
    "rendez-vous",
    "rdv",
    "calendrier",
    "oublier",
    "planning",
  ],
  moment: "matin",
  ancre_suggeree: "premier café",
  variantes: [
    {
      rang: 1,
      libelle: "Regarder l'agenda du jour",
      duree_min: 1,
      premiere_action: "Ouvrir l'agenda",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Regarder l'agenda du jour et du lendemain",
      duree_min: 2,
      premiere_action: "Ouvrir l'agenda",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Regarder la semaine et noter ce qu'il faut préparer",
      duree_min: 5,
      premiere_action: "Ouvrir l'agenda",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Un rendez-vous noté mais jamais relu s'oublie quand même. Rattacher la consultation de l'agenda à un geste déjà quotidien la rend automatique, sans avoir à s'en souvenir.",
  source: "Gollwitzer & Sheeran, 2006",
  icone: "agenda",
  palier_devoilement: 0,
  prerequis: [],
};

export const TROIS_CHOSES_DU_JOUR: FamilleTemplate = {
  id: "trois-choses-du-jour",
  nom: "Les choses du jour",
  categorie: "organisation",
  problemes: [
    "mes journées filent sans que je sache où",
    "j'oublie ce que je devais faire",
  ],
  mots_cles: ["priorites", "journee", "plan", "liste", "matin", "important"],
  moment: "matin",
  ancre_suggeree: "premier café",
  variantes: [
    {
      rang: 1,
      libelle: "Choisir une chose importante pour la journée",
      duree_min: 1,
      premiere_action: "Ouvrir la liste des tâches",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Choisir les trois choses du jour",
      duree_min: 2,
      premiere_action: "Ouvrir la liste des tâches",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Choisir les trois choses du jour et leur moment",
      duree_min: 5,
      premiere_action: "Ouvrir la liste des tâches",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Sans plan, la journée est absorbée par ce qui se présente. Choisir le matin un petit nombre de priorités donne une direction, sans la charge d'un planning complet.",
  source: "Safren et al., TCC adulte",
  icone: "liste",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_TEMPS: FamilleTemplate[] = [
  ALARME_DEPART,
  CHRONOMETRER,
  REGARDER_AGENDA,
  TROIS_CHOSES_DU_JOUR,
];
