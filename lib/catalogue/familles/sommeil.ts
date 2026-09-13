import type { FamilleTemplate } from "../types";

export const LEVER_CONSTANT: FamilleTemplate = {
  id: "lever-constant",
  nom: "Heure de lever stable",
  categorie: "sommeil",
  problemes: [
    "je n'arrive pas à me lever",
    "mes journées commencent n'importe quand",
  ],
  mots_cles: [
    "lever",
    "reveil",
    "matin",
    "snooze",
    "debout",
    "horaire",
    "rythme",
  ],
  moment: "reveil",
  ancre_suggeree: "sonnerie du réveil",
  variantes: [
    {
      rang: 1,
      libelle: "Poser les pieds au sol à la sonnerie",
      duree_min: 1,
      premiere_action: "Sortir un pied de la couette",
      effort: 2,
    },
    {
      rang: 2,
      libelle: "Se lever et ouvrir les rideaux",
      duree_min: 2,
      premiere_action: "Poser les pieds au sol",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Se lever et sortir de la chambre",
      duree_min: 5,
      premiere_action: "Poser les pieds au sol",
      effort: 3,
    },
    {
      rang: 4,
      libelle: "Se lever, sortir, boire un verre d'eau à la lumière",
      duree_min: 10,
      premiere_action: "Poser les pieds au sol",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer si l'heure de lever visée est avancée de plus d'une heure par rapport à l'heure habituelle : le décalage se fait par paliers de 15 minutes.",
  justification:
    "Le retard de phase est fréquent dans le TDAH adulte. C'est la régularité de l'heure de lever, pas celle du coucher, qui réancre le rythme circadien, et la lumière du matin en est le signal principal.",
  source: "Kooij & Bijlenga, 2013",
  icone: "lever",
  palier_devoilement: 0,
  prerequis: [],
};

export const MISE_EN_ROUTE_COUCHER: FamilleTemplate = {
  id: "mise-en-route-coucher",
  nom: "Mise en route du coucher",
  categorie: "sommeil",
  problemes: [
    "je me couche toujours trop tard",
    "je n'arrive pas à arrêter ma soirée",
  ],
  mots_cles: ["coucher", "soir", "dormir", "tard", "nuit", "veille", "arreter"],
  moment: "soir",
  ancre_suggeree: "fin du repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Mettre une alarme « fin de soirée »",
      duree_min: 1,
      premiere_action: "Ouvrir l'appli horloge",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "À l'alarme, ranger une chose et se brosser les dents",
      duree_min: 5,
      premiere_action: "Se lever du canapé",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Enchaînement court de coucher : dents, eau, lit",
      duree_min: 10,
      premiere_action: "Se lever du canapé",
      effort: 2,
    },
    {
      rang: 4,
      libelle: "Enchaînement complet, dernière heure calme",
      duree_min: 30,
      premiere_action: "Se lever du canapé",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer en même temps qu'une avancée de l'heure de lever : une seule modification du rythme à la fois.",
  justification:
    "Ce n'est pas l'envie de dormir qui manque le soir, c'est la capacité à interrompre l'activité en cours. Le blocage porte sur l'arrêt, pas sur l'endormissement : le levier est donc un signal externe de fin, pas une résolution.",
  source: "Kroese et al., procrastination du coucher",
  icone: "coucher",
  palier_devoilement: 0,
  prerequis: [],
};

export const ECRANS_SOIR: FamilleTemplate = {
  id: "ecrans-soir",
  nom: "Écrans avant le coucher",
  categorie: "sommeil",
  problemes: [
    "je scrolle au lit pendant des heures",
    "je me couche toujours trop tard",
  ],
  mots_cles: ["ecran", "telephone", "scroll", "lit", "soir", "tablette"],
  moment: "coucher",
  ancre_suggeree: "moment où je pose la tête sur l'oreiller",
  variantes: [
    {
      rang: 1,
      libelle: "Charger le téléphone hors de portée du lit",
      duree_min: 1,
      premiere_action: "Déplacer le chargeur de l'autre côté de la pièce",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Poser le téléphone hors de la chambre au coucher",
      duree_min: 1,
      premiere_action: "Prendre le téléphone en main",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Dernière demi-heure sans écran",
      duree_min: 30,
      premiere_action: "Poser le téléphone sur la table",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer si le téléphone sert de réveil sans solution de remplacement disponible.",
  justification:
    "L'effet de la lumière sur le rythme circadien est réel mais modeste. Le vrai problème est le contenu : une activité engageante et sans fin naturelle repousse le coucher parce qu'il faut une décision volontaire pour s'arrêter. Éloigner l'objet coûte moins que résister.",
  source: "Hale & Guan, revue écrans et sommeil",
  icone: "ecran",
  palier_devoilement: 1,
  prerequis: ["mise-en-route-coucher"],
};

export const LUMIERE_MATIN: FamilleTemplate = {
  id: "lumiere-matin",
  nom: "Lumière du matin",
  categorie: "sommeil",
  problemes: [
    "je suis dans le brouillard le matin",
    "mes journées commencent n'importe quand",
  ],
  mots_cles: ["lumiere", "soleil", "matin", "dehors", "rideaux", "circadien"],
  moment: "matin",
  ancre_suggeree: "premier café",
  variantes: [
    {
      rang: 1,
      libelle: "Ouvrir les rideaux au lever",
      duree_min: 1,
      premiere_action: "Marcher jusqu'à la fenêtre",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Prendre le petit-déjeuner près de la fenêtre",
      duree_min: 10,
      premiere_action: "Poser sa tasse près de la fenêtre",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Sortir 10 minutes dans la première heure",
      duree_min: 10,
      premiere_action: "Mettre ses chaussures",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "L'exposition lumineuse du matin est le signal le plus puissant pour avancer la phase circadienne. C'est la contrepartie indispensable d'un coucher plus tôt : sans elle, l'horloge interne ne bouge pas.",
  source: "Kooij & Bijlenga, 2013",
  icone: "soleil",
  palier_devoilement: 1,
  prerequis: ["lever-constant"],
};

export const SORTIE_DE_LIT: FamilleTemplate = {
  id: "sortie-de-lit",
  nom: "Sortir du lit sans replonger",
  categorie: "sommeil",
  problemes: ["je me rendors après le réveil", "je n'arrive pas à me lever"],
  mots_cles: ["snooze", "rendormir", "couette", "replonger", "reveil", "lit"],
  moment: "reveil",
  ancre_suggeree: "sonnerie du réveil",
  variantes: [
    {
      rang: 1,
      libelle: "Poser le réveil hors de portée du lit",
      duree_min: 1,
      premiere_action: "Déplacer le réveil ce soir",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Boire le verre d'eau posé la veille au chevet",
      duree_min: 1,
      premiere_action: "Tendre le bras vers le verre",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Se lever et rabattre la couette",
      duree_min: 2,
      premiere_action: "Poser les pieds au sol",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Au réveil, les fonctions exécutives sont au plus bas : une décision de volonté échoue presque toujours. Ce qui marche est de rendre le retour au lit physiquement moins accessible, décidé la veille, quand la capacité de décision était disponible.",
  source: "Barkley, point de performance",
  icone: "lit",
  palier_devoilement: 1,
  prerequis: ["lever-constant"],
};

export const FAMILLES_SOMMEIL: FamilleTemplate[] = [
  LEVER_CONSTANT,
  MISE_EN_ROUTE_COUCHER,
  ECRANS_SOIR,
  LUMIERE_MATIN,
  SORTIE_DE_LIT,
];
