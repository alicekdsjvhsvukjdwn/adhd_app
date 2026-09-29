import type { FamilleTemplate } from "../types";

export const VIDER_SA_TETE: FamilleTemplate = {
  id: "vider-sa-tete",
  nom: "Vider sa tête sur papier",
  categorie: "emotions",
  problemes: [
    "j'ai trop de choses en tête",
    "mon cerveau tourne quand je veux dormir",
  ],
  mots_cles: [
    "tete",
    "pensees",
    "ruminer",
    "ecrire",
    "papier",
    "dormir",
    "charge",
  ],
  moment: "indifferent",
  ancre_suggeree: "avant de me coucher",
  variantes: [
    {
      rang: 1,
      libelle: "Noter sur papier ce qui trotte dans la tête",
      duree_min: 3,
      premiere_action: "Prendre un papier et un stylo",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Tout noter, puis entourer la seule chose à faire demain",
      duree_min: 5,
      premiere_action: "Prendre un papier et un stylo",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Tout noter et trier : à faire, à confier, à laisser",
      duree_min: 10,
      premiere_action: "Prendre un papier et un stylo",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Ce qui reste en tête tourne en boucle parce que le cerveau essaie de ne pas l'oublier. Le poser sur papier le met à l'extérieur : écrire ses choses à faire avant de dormir aide même à s'endormir plus vite.",
  source: "Scullin et al., 2018",
  icone: "papier",
  palier_devoilement: 0,
  prerequis: [],
};

export const RESPIRATION_LENTE: FamilleTemplate = {
  id: "respiration-lente",
  nom: "Respiration lente",
  categorie: "emotions",
  problemes: ["tout me semble trop d'un coup", "j'ai besoin de redescendre"],
  mots_cles: [
    "respirer",
    "respiration",
    "stress",
    "calme",
    "angoisse",
    "redescendre",
  ],
  moment: "indifferent",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Trois respirations lentes",
      duree_min: 1,
      premiere_action: "Poser une main sur le ventre",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Deux minutes de respiration lente",
      duree_min: 2,
      premiere_action: "Poser une main sur le ventre",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Cinq minutes de respiration lente",
      duree_min: 5,
      premiere_action: "Poser une main sur le ventre",
      effort: 1,
    },
  ],
  contre_indication: null,
  justification:
    "Ralentir sa respiration, autour de six respirations par minute, agit sur le système nerveux et aide la tension à redescendre. C'est un geste disponible partout, en quelques secondes.",
  source: "Zaccaro et al., 2018",
  icone: "souffle",
  palier_devoilement: 0,
  prerequis: [],
};

export const DELAI_AVANT_DE_REPONDRE: FamilleTemplate = {
  id: "delai-avant-de-repondre",
  nom: "Un délai avant de réagir",
  categorie: "emotions",
  problemes: ["mes émotions montent très vite", "je réagis sur le coup"],
  mots_cles: ["colere", "enerver", "reagir", "impulsif", "emotion", "dispute"],
  moment: "indifferent",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Attendre 90 secondes avant de répondre",
      duree_min: 2,
      premiere_action: "Poser le téléphone ou reculer d'un pas",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Quitter la pièce quelques minutes avant de répondre",
      duree_min: 5,
      premiere_action: "Dire « je reviens »",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Reporter la réponse à plus tard, par écrit",
      duree_min: 2,
      premiere_action: "Noter ce qu'on voulait répondre",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "L'impulsivité touche aussi les émotions : la réaction part avant la réflexion. Un délai court, décidé à l'avance, laisse à l'émotion le temps de redescendre avant d'agir.",
  source: "Barkley, inhibition et régulation émotionnelle",
  icone: "pause",
  palier_devoilement: 0,
  prerequis: [],
};

export const NOMMER_SON_EMOTION: FamilleTemplate = {
  id: "nommer-son-emotion",
  nom: "Mettre un mot sur son émotion",
  categorie: "emotions",
  problemes: [
    "mes émotions montent très vite",
    "je ne sais pas ce que je ressens",
  ],
  mots_cles: ["emotion", "ressentir", "nommer", "journal", "humeur"],
  moment: "soir",
  ancre_suggeree: "après le repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Mettre un mot sur ce que je ressens",
      duree_min: 1,
      premiere_action: "Choisir un mot",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Noter l'émotion du jour et ce qui l'a déclenchée",
      duree_min: 3,
      premiere_action: "Choisir un mot",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Noter l'émotion, son déclencheur et ce qui a aidé",
      duree_min: 5,
      premiere_action: "Choisir un mot",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Mettre des mots sur une émotion en diminue l'intensité : c'est un effet mesuré en laboratoire, appelé étiquetage affectif. Le faire régulièrement aide aussi à repérer ce qui déclenche les débordements.",
  source: "Lieberman et al., 2007",
  icone: "mot",
  palier_devoilement: 0,
  prerequis: [],
};

export const UNE_CHOSE_FAITE: FamilleTemplate = {
  id: "une-chose-faite",
  nom: "Ce qui s'est bien passé",
  categorie: "emotions",
  problemes: [
    "je me décourage vite",
    "mes journées filent sans que je sache où",
  ],
  mots_cles: ["reussite", "decouragement", "bilan", "positif", "soir", "fier"],
  moment: "soir",
  ancre_suggeree: "avant de me coucher",
  variantes: [
    {
      rang: 1,
      libelle: "Noter une chose faite aujourd'hui",
      duree_min: 1,
      premiere_action: "Ouvrir la capture",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Noter trois choses qui se sont bien passées",
      duree_min: 3,
      premiere_action: "Ouvrir la capture",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Noter trois choses et ce qui les a rendues possibles",
      duree_min: 5,
      premiere_action: "Ouvrir la capture",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "On retient plus facilement ce qui a raté que ce qui a marché. Noter chaque soir ce qui s'est bien passé rééquilibre ce bilan ; l'exercice des « trois bonnes choses » a été évalué sur plusieurs semaines.",
  source: "Seligman et al., 2005",
  icone: "etoile",
  palier_devoilement: 0,
  prerequis: [],
};

export const MOMENT_SANS_ECRAN: FamilleTemplate = {
  id: "moment-sans-ecran",
  nom: "Un moment sans écran",
  categorie: "emotions",
  problemes: [
    "j'ai du mal à me détendre",
    "mon cerveau tourne quand je veux dormir",
  ],
  mots_cles: ["detente", "ecran", "calme", "repos", "soir", "decrocher"],
  moment: "soir",
  ancre_suggeree: "après le repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Cinq minutes sans écran",
      duree_min: 5,
      premiere_action: "Poser le téléphone dans une autre pièce",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Quinze minutes d'activité calme choisie à l'avance",
      duree_min: 15,
      premiere_action: "Poser le téléphone dans une autre pièce",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Une demi-heure calme avant le coucher",
      duree_min: 30,
      premiere_action: "Poser le téléphone dans une autre pièce",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Les écrans offrent une stimulation sans fin naturelle, qui empêche de décrocher même en fin de journée. Un moment court, sans écran et choisi à l'avance, donne un vrai temps de récupération.",
  source: "Hale & Guan, revue écrans et sommeil",
  icone: "calme",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_EMOTIONS: FamilleTemplate[] = [
  VIDER_SA_TETE,
  RESPIRATION_LENTE,
  DELAI_AVANT_DE_REPONDRE,
  NOMMER_SON_EMOTION,
  UNE_CHOSE_FAITE,
  MOMENT_SANS_ECRAN,
];
