import type { FamilleTemplate } from "../types";

export const DECOUPER_TACHE: FamilleTemplate = {
  id: "decouper-tache",
  nom: "Découper la tâche qui bloque",
  categorie: "focus",
  problemes: ["je fais tout au dernier moment", "une tâche me paraît énorme"],
  mots_cles: [
    "decouper",
    "etapes",
    "enorme",
    "dernier moment",
    "urgence",
    "projet",
    "gros",
  ],
  moment: "matin",
  ancre_suggeree: "premier café",
  variantes: [
    {
      rang: 1,
      libelle: "Écrire la toute première étape de la tâche qui bloque",
      duree_min: 2,
      premiere_action: "Écrire le nom de la tâche",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Découper la tâche en étapes de dix minutes",
      duree_min: 5,
      premiere_action: "Écrire le nom de la tâche",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Découper la tâche et caler la première étape dans la journée",
      duree_min: 10,
      premiere_action: "Écrire le nom de la tâche",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Une tâche grosse et floue n'a pas de point d'entrée : c'est l'échéance qui finit par la déclencher, au dernier moment. La découper en étapes courtes crée des débuts possibles bien avant l'urgence.",
  source: "Safren et al., TCC adulte",
  icone: "decouper",
  palier_devoilement: 0,
  prerequis: [],
};

export const CHOISIR_A_FINIR: FamilleTemplate = {
  id: "choisir-a-finir",
  nom: "Choisir une chose à finir",
  categorie: "focus",
  problemes: ["je commence plein de choses sans les finir"],
  mots_cles: ["finir", "terminer", "en cours", "abandonner", "eparpiller"],
  moment: "soir",
  ancre_suggeree: "après le repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Le soir, choisir une seule chose à finir demain",
      duree_min: 2,
      premiere_action: "Regarder ce qui est en cours",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Choisir la chose à finir et noter sa dernière étape",
      duree_min: 3,
      premiere_action: "Regarder ce qui est en cours",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Finir une chose en cours avant d'en commencer une nouvelle",
      duree_min: 10,
      premiere_action: "Ouvrir la chose à finir",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Commencer apporte de la nouveauté, finir n'en apporte plus : les tâches restent ouvertes aux trois quarts. Désigner la veille une seule chose à terminer donne une cible nette au lieu d'un tas de choses en cours.",
  source: "Solanto, thérapie métacognitive",
  icone: "cible",
  palier_devoilement: 0,
  prerequis: [],
};

export const CHANGER_DE_CADRE: FamilleTemplate = {
  id: "changer-de-cadre",
  nom: "Changer de cadre pour une tâche ennuyeuse",
  categorie: "focus",
  problemes: ["je décroche vite sur ce qui m'ennuie"],
  mots_cles: [
    "ennui",
    "ennuyeux",
    "decrocher",
    "motivation",
    "defi",
    "musique",
    "lieu",
  ],
  moment: "indifferent",
  ancre_suggeree: null,
  variantes: [
    {
      rang: 1,
      libelle: "Changer de lieu pour une tâche ennuyeuse",
      duree_min: 1,
      premiere_action: "Prendre son matériel et changer de pièce",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Transformer la tâche en défi chronométré",
      duree_min: 2,
      premiere_action: "Lancer un minuteur plus court que prévu",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Réserver une musique aux tâches ennuyeuses",
      duree_min: 1,
      premiere_action: "Lancer la playlist réservée",
      effort: 1,
    },
  ],
  contre_indication: null,
  justification:
    "L'attention suit l'intérêt, la nouveauté et le défi plus que l'importance. Quand la tâche n'en apporte pas, on peut les ajouter autour d'elle : un autre cadre, une contrainte de temps, un rituel sonore.",
  source: "Barkley, externalisation de la motivation",
  icone: "cadre",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_DEMARRER: FamilleTemplate[] = [
  DECOUPER_TACHE,
  CHOISIR_A_FINIR,
  CHANGER_DE_CADRE,
];
