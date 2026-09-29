import type { FamilleTemplate } from "../types";

export const VERIFICATION_SORTIE: FamilleTemplate = {
  id: "verification-sortie",
  nom: "Vérification avant de sortir",
  categorie: "organisation",
  problemes: ["je perds mes affaires", "j'oublie des choses en partant"],
  mots_cles: [
    "cles",
    "portefeuille",
    "telephone",
    "oublier",
    "sortir",
    "partir",
  ],
  moment: "matin",
  ancre_suggeree: "avant de partir de chez moi",
  variantes: [
    {
      rang: 1,
      libelle: "Vérifier clés, téléphone et portefeuille avant de sortir",
      duree_min: 1,
      premiere_action: "Toucher sa poche",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Vérifier la liste collée sur la porte avant de sortir",
      duree_min: 1,
      premiere_action: "Regarder la porte",
      effort: 1,
    },
  ],
  contre_indication: null,
  justification:
    "Au moment de partir, l'attention est déjà dehors. Une vérification courte, toujours identique et toujours au même endroit évite de compter sur la mémoire à l'instant où elle est le moins disponible.",
  source: "Barkley, point de performance",
  icone: "porte",
  palier_devoilement: 0,
  prerequis: [],
};

export const UN_MESSAGE_PAR_JOUR: FamilleTemplate = {
  id: "un-message-par-jour",
  nom: "Répondre aux messages en petite dose",
  categorie: "organisation",
  problemes: ["je laisse traîner mes messages et mes mails"],
  mots_cles: ["messages", "mails", "repondre", "sms", "retard", "boite"],
  moment: "matin",
  ancre_suggeree: "premier café",
  variantes: [
    {
      rang: 1,
      libelle: "Répondre à un message",
      duree_min: 2,
      premiere_action: "Ouvrir la messagerie",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Répondre au message le plus ancien",
      duree_min: 3,
      premiere_action: "Ouvrir la messagerie",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Dix minutes de réponses, au minuteur",
      duree_min: 10,
      premiere_action: "Lancer le minuteur",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Les messages en attente pèsent plus lourd à mesure qu'ils vieillissent. Une petite dose fixe, rattachée à un moment du quotidien, évite l'accumulation sans exiger de tout traiter.",
  source: "Gollwitzer & Sheeran, 2006",
  icone: "message",
  palier_devoilement: 0,
  prerequis: [],
};

export const REGARDER_SON_COMPTE: FamilleTemplate = {
  id: "regarder-son-compte",
  nom: "Regarder son compte",
  categorie: "organisation",
  problemes: ["je dépense sans y penser", "j'évite de regarder mon compte"],
  mots_cles: ["argent", "banque", "compte", "depenses", "budget", "achats"],
  moment: "indifferent",
  recurrence: "hebdo",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Ouvrir son compte, sans rien faire d'autre",
      duree_min: 2,
      premiere_action: "Ouvrir l'appli de la banque",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Regarder les dépenses de la semaine",
      duree_min: 5,
      premiere_action: "Ouvrir l'appli de la banque",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Noter les dépenses imprévues de la semaine",
      duree_min: 10,
      premiere_action: "Ouvrir l'appli de la banque",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Éviter de regarder ses comptes entretient l'inquiétude et les mauvaises surprises. Un coup d'œil court et régulier rend l'information visible avant qu'elle ne devienne un problème.",
  source: "Barkley, externalisation de l'information",
  icone: "banque",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_QUOTIDIEN: FamilleTemplate[] = [
  VERIFICATION_SORTIE,
  UN_MESSAGE_PAR_JOUR,
  REGARDER_SON_COMPTE,
];
