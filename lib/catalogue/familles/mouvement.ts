import type { FamilleTemplate } from "../types";

export const BOUGER_MATIN: FamilleTemplate = {
  id: "bouger-matin",
  nom: "Bouger le matin",
  categorie: "mouvement",
  problemes: [
    "je suis dans le brouillard le matin",
    "je ne bouge jamais de la journée",
  ],
  mots_cles: ["bouger", "matin", "sport", "activer", "reveiller", "corps"],
  moment: "matin",
  ancre_suggeree: "après le petit-déjeuner",
  variantes: [
    {
      rang: 1,
      libelle: "Deux minutes de mouvement libre",
      duree_min: 2,
      premiere_action: "Se mettre debout au milieu de la pièce",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Dix minutes de mouvement",
      duree_min: 10,
      premiere_action: "Se mettre debout au milieu de la pièce",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Vingt minutes d'activité soutenue",
      duree_min: 20,
      premiere_action: "Mettre ses chaussures",
      effort: 3,
    },
  ],
  contre_indication: null,
  justification:
    "L'exercice aérobie est le levier non médicamenteux le mieux documenté dans le TDAH. Le format compte peu : c'est la régularité et l'intensité modérée qui produisent l'effet, pas la performance.",
  source: "Mehren et al., exercice et TDAH adulte",
  icone: "mouvement",
  palier_devoilement: 0,
  prerequis: [],
};

export const MARCHE_QUOTIDIENNE: FamilleTemplate = {
  id: "marche-quotidienne",
  nom: "Marche quotidienne",
  categorie: "mouvement",
  problemes: [
    "je ne bouge jamais de la journée",
    "je reste enfermée toute la journée",
  ],
  mots_cles: ["marche", "marcher", "sortir", "dehors", "promenade", "pas"],
  moment: "indifferent",
  ancre_suggeree: "après le déjeuner",
  variantes: [
    {
      rang: 1,
      libelle: "Sortir cinq minutes devant chez soi",
      duree_min: 5,
      premiere_action: "Mettre ses chaussures",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Marcher dix minutes",
      duree_min: 10,
      premiere_action: "Mettre ses chaussures",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Marcher vingt minutes",
      duree_min: 20,
      premiere_action: "Mettre ses chaussures",
      effort: 2,
    },
    {
      rang: 4,
      libelle: "Marcher trente minutes ou plus",
      duree_min: 30,
      premiere_action: "Mettre ses chaussures",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "La marche cumule deux effets : l'activité physique modérée et l'exposition à la lumière naturelle, qui agit sur le rythme circadien. C'est la routine avec le meilleur rapport bénéfice sur coût d'entrée.",
  source: "Mehren et al. ; Kooij & Bijlenga, 2013",
  icone: "marche",
  palier_devoilement: 0,
  prerequis: [],
};

export const BOUGER_AVANT_FOCUS: FamilleTemplate = {
  id: "bouger-avant-focus",
  nom: "Bouger avant une session de concentration",
  categorie: "mouvement",
  problemes: ["je n'arrive pas à me concentrer", "je n'arrive pas à commencer"],
  mots_cles: [
    "bouger",
    "avant",
    "concentration",
    "focus",
    "activer",
    "demarrer",
  ],
  moment: "indifferent",
  ancre_suggeree: "juste avant de m'asseoir pour travailler",
  variantes: [
    {
      rang: 1,
      libelle: "Deux minutes de mouvement avant de s'asseoir",
      duree_min: 2,
      premiere_action: "Se lever et s'éloigner du bureau",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Cinq minutes de mouvement soutenu avant de s'asseoir",
      duree_min: 5,
      premiere_action: "Se lever et s'éloigner du bureau",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Dix minutes de marche rapide avant une longue session",
      duree_min: 10,
      premiere_action: "Mettre ses chaussures",
      effort: 2,
    },
  ],
  contre_indication:
    "Ne pas proposer si l'utilisateur est déjà en session : l'interruption coûterait plus que le bénéfice.",
  justification:
    "Au-delà de l'effet à long terme, une session d'exercice aérobie améliore le contrôle inhibiteur et l'attention pendant l'heure qui suit. Placer le mouvement juste avant une tâche exigeante exploite cette fenêtre.",
  source: "Pontifex et al., effets aigus de l'exercice",
  icone: "eclair",
  palier_devoilement: 1,
  prerequis: [],
};

export const DECHARGE_CORPORELLE: FamilleTemplate = {
  id: "decharge-corporelle",
  nom: "Décharge corporelle",
  categorie: "mouvement",
  problemes: [
    "je suis tendue et je n'arrive pas à me poser",
    "j'ai besoin de bouger tout le temps",
  ],
  mots_cles: [
    "etirement",
    "tension",
    "decharge",
    "agitation",
    "corps",
    "detendre",
    "secouer",
  ],
  moment: "indifferent",
  ancre_suggeree: "fin de journée de travail",
  variantes: [
    {
      rang: 1,
      libelle: "Une minute à secouer les bras et les jambes",
      duree_min: 1,
      premiere_action: "Se lever",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Trois étirements debout",
      duree_min: 3,
      premiere_action: "Se lever et lever les bras",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Dix minutes d'étirements guidés",
      duree_min: 10,
      premiere_action: "Poser un tapis ou une serviette au sol",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "L'agitation motrice n'est pas un défaut à corriger : elle accompagne souvent l'effort attentionnel. Lui donner une sortie délibérée coûte moins que de la réprimer, et évite qu'elle interrompe autre chose.",
  source: "Barkley, régulation motrice",
  icone: "etirement",
  palier_devoilement: 1,
  prerequis: [],
};

export const BOIRE_EAU: FamilleTemplate = {
  id: "boire-eau",
  nom: "Boire de l'eau",
  categorie: "mouvement",
  problemes: [
    "j'oublie de boire et de manger",
    "je me rends compte le soir que je n'ai rien bu",
  ],
  mots_cles: ["eau", "boire", "hydratation", "soif", "gourde", "verre"],
  moment: "indifferent",
  ancre_suggeree: "chaque fois que je m'assois à mon bureau",
  variantes: [
    {
      rang: 1,
      libelle: "Un verre d'eau au réveil",
      duree_min: 1,
      premiere_action: "Prendre un verre dans le placard",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Garder une gourde pleine en vue",
      duree_min: 2,
      premiere_action: "Remplir la gourde et la poser sur le bureau",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Boire un verre à chaque repas et entre les deux",
      duree_min: 1,
      premiere_action: "Poser un verre à côté de l'assiette",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Ce n'est pas un problème de volonté mais de signal : les sensations corporelles passent facilement inaperçues pendant une activité absorbante. La solution est visuelle — un contenant en vue — et non un rappel de plus.",
  source: "Barkley, externalisation de l'information",
  icone: "eau",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_MOUVEMENT: FamilleTemplate[] = [
  BOUGER_MATIN,
  MARCHE_QUOTIDIENNE,
  BOUGER_AVANT_FOCUS,
  DECHARGE_CORPORELLE,
  BOIRE_EAU,
];
