import type { FamilleTemplate } from "../types";

export const PRATIQUE_REGULIERE: FamilleTemplate = {
  id: "pratique-reguliere",
  nom: "Pratique courte et régulière",
  categorie: "competences",
  problemes: [
    "j'arrête les activités qui me plaisent",
    "j'abandonne mes loisirs au bout de quelques semaines",
  ],
  mots_cles: [
    "musique",
    "instrument",
    "guitare",
    "piano",
    "dessin",
    "chant",
    "loisir",
    "pratique",
    "sport",
  ],
  moment: "soir",
  recurrence: "jours:1,3,5",
  ancre_suggeree: "après le repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Cinq minutes de pratique",
      duree_min: 5,
      premiere_action: "Sortir le matériel",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Dix minutes de pratique",
      duree_min: 10,
      premiere_action: "Sortir le matériel",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Vingt minutes de pratique",
      duree_min: 20,
      premiere_action: "Sortir le matériel",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Une habitude s'installe par la répétition dans un même contexte, et rater une séance ne remet pas les compteurs à zéro. Une séance courte et régulière tient bien mieux qu'une longue séance qu'on repousse.",
  source: "Lally et al., 2010",
  icone: "pratique",
  palier_devoilement: 0,
  prerequis: [],
};

export const MATERIEL_A_PORTEE: FamilleTemplate = {
  id: "materiel-a-portee",
  nom: "Matériel à portée de main",
  categorie: "competences",
  problemes: [
    "j'arrête les activités qui me plaisent",
    "je repousse mes loisirs",
  ],
  mots_cles: ["materiel", "instrument", "livre", "carnet", "loisir", "ranger"],
  moment: "indifferent",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Laisser le matériel sorti et visible",
      duree_min: 1,
      premiere_action: "Choisir l'endroit où le laisser",
      effort: 1,
    },
    {
      rang: 2,
      libelle:
        "Préparer le matériel de la prochaine séance à la fin de celle-ci",
      duree_min: 2,
      premiere_action: "Laisser le matériel en place",
      effort: 1,
    },
  ],
  contre_indication: null,
  justification:
    "Chaque étape avant de commencer est une occasion d'abandonner. Un matériel déjà sorti transforme « il faudrait que je m'y mette » en un geste immédiat.",
  source: "Barkley, point de performance",
  icone: "materiel",
  palier_devoilement: 0,
  prerequis: [],
};

export const APPRENDRE_CHAQUE_JOUR: FamilleTemplate = {
  id: "apprendre-chaque-jour",
  nom: "Apprendre un peu chaque jour",
  categorie: "competences",
  problemes: ["je n'arrive pas à apprendre régulièrement"],
  mots_cles: [
    "apprendre",
    "langue",
    "cours",
    "lire",
    "lecture",
    "formation",
    "etudier",
  ],
  moment: "matin",
  ancre_suggeree: "premier café",
  variantes: [
    {
      rang: 1,
      libelle: "Cinq minutes d'apprentissage",
      duree_min: 5,
      premiere_action: "Ouvrir le livre ou l'appli",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Dix minutes d'apprentissage",
      duree_min: 10,
      premiere_action: "Ouvrir le livre ou l'appli",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Quinze minutes, puis noter ce qui a été appris",
      duree_min: 15,
      premiere_action: "Ouvrir le livre ou l'appli",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Rattacher un apprentissage court à un geste déjà quotidien le rend automatique au fil des semaines, sans dépendre de la motivation du jour.",
  source: "Lally et al., 2010 ; Gollwitzer & Sheeran, 2006",
  icone: "livre",
  palier_devoilement: 0,
  prerequis: [],
};

export const DONNER_DES_NOUVELLES: FamilleTemplate = {
  id: "donner-des-nouvelles",
  nom: "Donner des nouvelles",
  categorie: "competences",
  problemes: [
    "je perds le contact avec mes proches",
    "j'oublie de donner des nouvelles",
  ],
  mots_cles: [
    "amis",
    "famille",
    "proches",
    "message",
    "appeler",
    "nouvelles",
    "contact",
  ],
  moment: "indifferent",
  recurrence: "hebdo",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Envoyer un message à une personne proche",
      duree_min: 2,
      premiere_action: "Ouvrir la conversation",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Appeler une personne proche",
      duree_min: 10,
      premiere_action: "Ouvrir les contacts",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Garder le lien demande peu à chaque fois, mais rien ne le rappelle : les semaines passent sans qu'on s'en rende compte. Un rendez-vous hebdomadaire rend le geste régulier.",
  source: "Gollwitzer & Sheeran, 2006",
  icone: "proches",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_COMPETENCES: FamilleTemplate[] = [
  PRATIQUE_REGULIERE,
  MATERIEL_A_PORTEE,
  APPRENDRE_CHAQUE_JOUR,
  DONNER_DES_NOUVELLES,
];
