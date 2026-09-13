import type { FamilleTemplate } from "../types";

export const POINT_DE_DEPOT: FamilleTemplate = {
  id: "point-de-depot",
  nom: "Point de dépôt fixe",
  categorie: "organisation",
  problemes: ["je perds mes affaires", "je cherche mes clés tous les matins"],
  mots_cles: [
    "cles",
    "perdre",
    "chercher",
    "portefeuille",
    "telephone",
    "poser",
    "entree",
  ],
  moment: "indifferent",
  ancre_suggeree: "au moment où je rentre chez moi",
  variantes: [
    {
      rang: 1,
      libelle: "Poser ses clés au même endroit en rentrant",
      duree_min: 1,
      premiere_action: "Choisir l'endroit et y poser les clés maintenant",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Vider ses poches au même endroit en rentrant",
      duree_min: 1,
      premiere_action: "Poser un bol ou un crochet près de la porte",
      effort: 1,
    },
    {
      rang: 3,
      libelle: "Préparer le sac du lendemain au point de dépôt",
      duree_min: 5,
      premiere_action: "Poser le sac près de la porte",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Retenir où l'on a posé un objet mobilise la mémoire de travail au moment le moins disponible, en rentrant. Un emplacement unique et physique remplace cette mémorisation par un geste, et rend la recherche inutile.",
  source: "Barkley, externalisation de l'information",
  icone: "cles",
  palier_devoilement: 0,
  prerequis: [],
};

export const VIDER_CAPTURE: FamilleTemplate = {
  id: "vider-capture",
  nom: "Vider la boîte de capture",
  categorie: "organisation",
  problemes: [
    "j'ai des choses en tête que j'oublie",
    "ma liste de tâches me stresse",
  ],
  mots_cles: ["capture", "boite", "liste", "vider", "trier", "notes", "idees"],
  moment: "soir",
  ancre_suggeree: "après le repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Regarder la boîte de capture sans rien faire d'autre",
      duree_min: 2,
      premiere_action: "Ouvrir l'écran de capture",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Traiter trois éléments de la boîte",
      duree_min: 5,
      premiere_action: "Ouvrir l'écran de capture",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Vider entièrement la boîte",
      duree_min: 15,
      premiere_action: "Ouvrir l'écran de capture",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer si la boîte contient plus d'une vingtaine d'éléments : proposer d'abord un archivage groupé.",
  justification:
    "Une boîte de capture n'a d'intérêt que si elle est vidée : sinon elle devient une source d'anxiété plutôt qu'un déchargement. Le passage régulier entretient la confiance dans le système, et c'est cette confiance qui permet de déposer sans retenir.",
  source: "Solanto, thérapie métacognitive",
  icone: "boite",
  palier_devoilement: 1,
  prerequis: [],
};

export const REMISE_A_ZERO_PIECE: FamilleTemplate = {
  id: "remise-a-zero-piece",
  nom: "Remise à zéro d'une pièce",
  categorie: "organisation",
  problemes: [
    "mon appartement part en vrille",
    "je ne sais pas par où commencer pour ranger",
  ],
  mots_cles: ["ranger", "rangement", "desordre", "menage", "piece", "nettoyer"],
  moment: "indifferent",
  ancre_suggeree: "avant de me coucher",
  variantes: [
    {
      rang: 1,
      libelle: "Ranger cinq objets",
      duree_min: 2,
      premiere_action: "Prendre un objet qui traîne",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Dégager une seule surface",
      duree_min: 5,
      premiere_action: "Choisir la surface et prendre le premier objet",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Dix minutes de rangement minuté sur une pièce",
      duree_min: 10,
      premiere_action: "Lancer le minuteur",
      effort: 2,
    },
    {
      rang: 4,
      libelle: "Remise à zéro complète d'une pièce",
      duree_min: 25,
      premiere_action: "Lancer le minuteur",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer les variantes 3 et 4 quand l'énergie déclarée est basse : un rangement interrompu laisse la pièce dans un état pire qu'avant.",
  justification:
    "Le blocage vient de l'ampleur perçue, pas de la difficulté du geste. Borner le périmètre — une surface, un minuteur — rend la tâche finie et donc démarrable, alors que « ranger l'appartement » n'a pas de fin.",
  source: "Safren et al., TCC adulte",
  icone: "rangement",
  palier_devoilement: 1,
  prerequis: [],
};

export const ADMINISTRATIF: FamilleTemplate = {
  id: "administratif",
  nom: "Courrier et administratif",
  categorie: "organisation",
  problemes: [
    "je laisse traîner les papiers et les mails importants",
    "j'ai peur d'ouvrir mon courrier",
  ],
  mots_cles: [
    "courrier",
    "papiers",
    "administratif",
    "mail",
    "facture",
    "dossier",
    "impots",
  ],
  moment: "indifferent",
  ancre_suggeree: "après le déjeuner",
  variantes: [
    {
      rang: 1,
      libelle: "Ouvrir une enveloppe, sans rien traiter",
      duree_min: 2,
      premiere_action: "Prendre l'enveloppe du dessus",
      effort: 2,
    },
    {
      rang: 2,
      libelle: "Traiter un seul document",
      duree_min: 10,
      premiere_action: "Prendre le document du dessus",
      effort: 3,
    },
    {
      rang: 3,
      libelle: "Vingt minutes minutées d'administratif",
      duree_min: 20,
      premiere_action: "Lancer le minuteur",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer en fin de journée ni quand l'énergie déclarée est basse : c'est la catégorie de tâche la plus coûteuse en fonctions exécutives.",
  justification:
    "L'évitement administratif se nourrit de lui-même : plus on attend, plus l'ouverture du courrier devient coûteuse. Séparer explicitement « ouvrir » de « traiter » permet de franchir la première marche sans s'engager sur la suite.",
  source: "Safren et al., TCC adulte",
  icone: "courrier",
  palier_devoilement: 1,
  prerequis: [],
};

export const PREPARER_LA_VEILLE: FamilleTemplate = {
  id: "preparer-la-veille",
  nom: "Préparer la veille",
  categorie: "organisation",
  problemes: ["mes matins sont la panique", "je pars toujours en retard"],
  mots_cles: ["preparer", "veille", "sac", "vetements", "matin", "retard"],
  moment: "soir",
  ancre_suggeree: "après le repas du soir",
  variantes: [
    {
      rang: 1,
      libelle: "Sortir les vêtements du lendemain",
      duree_min: 2,
      premiere_action: "Ouvrir l'armoire",
      effort: 1,
    },
    {
      rang: 2,
      libelle: "Préparer le sac et le poser près de la porte",
      duree_min: 5,
      premiere_action: "Prendre le sac",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Préparer vêtements, sac et repas du lendemain",
      duree_min: 15,
      premiere_action: "Ouvrir l'armoire",
      effort: 2,
    },
  ],
  contre_indication: null,
  justification:
    "Les décisions prises le soir sont moins coûteuses que les mêmes décisions prises le matin, quand les fonctions exécutives ne sont pas encore disponibles. Déplacer la charge de décision d'un moment à l'autre est souvent plus efficace que de chercher à la réduire.",
  source: "Barkley, point de performance",
  icone: "sac",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_ORGANISATION: FamilleTemplate[] = [
  POINT_DE_DEPOT,
  VIDER_CAPTURE,
  REMISE_A_ZERO_PIECE,
  ADMINISTRATIF,
  PREPARER_LA_VEILLE,
];
