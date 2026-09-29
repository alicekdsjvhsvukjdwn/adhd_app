import type { FamilleTemplate } from "../types";

export const REPAS_REGULIER: FamilleTemplate = {
  id: "repas-regulier",
  nom: "Repas à heure fixe",
  categorie: "mouvement",
  problemes: ["j'oublie de manger", "j'oublie de boire et de manger"],
  mots_cles: ["manger", "repas", "dejeuner", "faim", "collation", "oublier"],
  moment: "midi",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Une alarme à l'heure du déjeuner",
      duree_min: 1,
      premiere_action: "Ouvrir l'appli horloge",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Préparer une collation à portée de main",
      duree_min: 3,
      premiere_action: "Choisir la collation",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Trois repas à des heures à peu près fixes",
      duree_min: 1,
      premiere_action: "Regarder l'heure",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Pendant une activité absorbante, la faim passe inaperçue jusqu'à la fatigue ou l'irritabilité. Un signal extérieur à heure fixe remplace celui du corps qu'on n'entend pas.",
  source: "Barkley, externalisation de l'information",
  icone: "repas",
  palier_devoilement: 0,
  prerequis: [],
};

export const TRAITEMENT_ANCRE: FamilleTemplate = {
  id: "traitement-ancre",
  nom: "Traitement rattaché à un geste",
  categorie: "mouvement",
  problemes: ["j'oublie mon traitement"],
  mots_cles: ["traitement", "medicament", "cachet", "pilulier", "oublier"],
  moment: "matin",
  ancre_suggeree: "petit-déjeuner",
  variantes: [
    {
      rang: 1,
      libelle: "Prendre son traitement avec le petit-déjeuner",
      duree_min: 1,
      premiere_action: "Poser la boîte à côté du bol",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Ranger la boîte à l'endroit exact de la prise",
      duree_min: 1,
      premiere_action: "Déplacer la boîte",
      effort: 1,
    },
  ],
  contre_indication:
    "L'appli ne fixe ni dose ni horaire : le moment de la prise est celui convenu avec le médecin.",
  justification:
    "Rattacher la prise à un geste déjà automatique, au même endroit, évite d'avoir à s'en souvenir. C'est le principe des moments repères.",
  source: "Gollwitzer & Sheeran, 2006",
  icone: "traitement",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_CORPS: FamilleTemplate[] = [
  REPAS_REGULIER,
  TRAITEMENT_ANCRE,
];
