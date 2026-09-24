import type { Categorie } from "../catalogue";

/**
 * Contenu de l'onglet Infos : psychoéducation courte et sourcée.
 * Le contenu vit en TypeScript, comme le catalogue : versionné avec le code,
 * relu comme du code. Tutoiement, formulations neutres en genre.
 */

export type Carte = {
  id: string;
  titre: string;
  texte: string;
  /** Une chose concrète à essayer. */
  astuce?: string;
  source?: string;
  categorie?: Categorie;
  /** Mise en avant visuelle (ex : aide d'urgence). */
  important?: boolean;
  /** Numéro appelable d'un tap. */
  appel?: { libelle: string; numero: string };
};

export type Section = {
  id: string;
  titre: string;
  intro?: string;
  cartes: Carte[];
};

export const ASTUCES: Carte[] = [
  // Sommeil
  {
    id: "lever-regulier",
    categorie: "sommeil",
    titre: "Se lever à la même heure, même le week-end",
    texte:
      "Chez beaucoup d'adultes avec un TDAH, l'horloge interne est décalée vers le soir. Une heure de lever régulière est le repère le plus solide pour la recaler.",
    astuce:
      "De la lumière du jour dans la première heure, les écrans baissés le soir.",
    source: "Kooij & Bijlenga (2013), rythme circadien et TDAH de l'adulte",
  },
  {
    id: "fin-soiree",
    categorie: "sommeil",
    titre: "Annoncer la fin de la soirée",
    texte:
      "Le soir, une activité captivante peut effacer la notion du temps. Une alarme prévue à l'avance fait le travail que l'attention ne fait pas.",
    astuce:
      "Une alarme « fin de soirée » 45 minutes avant l'heure de coucher visée.",
  },

  // Mouvement
  {
    id: "bouger-avant",
    categorie: "mouvement",
    titre: "Bouger avant une tâche difficile",
    texte:
      "Une activité physique, même courte, aide l'attention dans les moments qui suivent. L'effet est modeste, mais il est immédiat et ne coûte rien.",
    astuce:
      "10 minutes de marche, ou quelques étages d'escalier, avant de t'y mettre.",
  },
  {
    id: "bouger-pendant",
    categorie: "mouvement",
    titre: "Laisser le corps bouger",
    texte:
      "Rester immobile demande un effort, et cet effort n'est plus disponible pour la tâche. Bouger un peu aide souvent à tenir plus longtemps.",
    astuce:
      "Travailler debout, marcher pendant un appel, un objet à manipuler dans la main.",
  },

  // Organisation
  {
    id: "tout-noter",
    categorie: "organisation",
    titre: "Tout sortir de sa tête",
    texte:
      "La mémoire de travail sature vite : garder une liste en tête coûte beaucoup d'énergie et finit en oublis. Mieux vaut tout noter au même endroit, et trier plus tard.",
    astuce:
      "C'est le rôle du + de l'accueil : noter en quelques secondes, l'appli trie.",
    source: "Barkley, Taking Charge of Adult ADHD (2021)",
  },
  {
    id: "une-place",
    categorie: "organisation",
    titre: "Une place pour ce qui se perd",
    texte:
      "Clés, portefeuille, écouteurs : les chercher coûte du temps et du stress chaque jour. Un endroit fixe, visible et sur le passage évite d'avoir à s'en souvenir.",
    astuce: "Un bol ou un crochet près de la porte, et rien d'autre dedans.",
  },
  {
    id: "veille",
    categorie: "organisation",
    titre: "Décider la veille",
    texte:
      "Le matin, chaque décision en plus fatigue et retarde. Préparer le soir, c'est décider au moment où il reste encore de la marge.",
    astuce: "Sac prêt, vêtements choisis, première tâche du lendemain notée.",
  },

  // Focus
  {
    id: "commencer",
    categorie: "focus",
    titre: "Commencer par une action de deux minutes",
    texte:
      "Le blocage est souvent au démarrage, pas dans la tâche elle-même. Une première action minuscule, physique et évidente lève ce blocage : une fois la machine lancée, continuer est plus facile.",
    astuce:
      "Pas « faire le dossier », mais « ouvrir le fichier ». C'est le champ « première petite action » de l'appli.",
    source:
      "Solanto et al. (2010), thérapie métacognitive pour adultes avec TDAH",
  },
  {
    id: "si-alors",
    categorie: "focus",
    titre: "Le plan « quand… alors… »",
    texte:
      "Rattacher une action à un moment précis (« quand je pose mon café, j'ouvre mes mails ») augmente nettement les chances de passer à l'acte. C'est l'une des techniques les mieux étudiées en psychologie.",
    astuce:
      "C'est le principe des moments repères : Profil → Mes moments repères.",
    source:
      "Gollwitzer & Sheeran (2006), méta-analyse sur les intentions de mise en œuvre",
  },
  {
    id: "distractions",
    categorie: "focus",
    titre: "Écarter les distractions avant de commencer",
    texte:
      "Résister à une distraction sur le moment coûte cher. L'éloigner à l'avance est bien plus efficace.",
    astuce:
      "Téléphone dans une autre pièce, onglets fermés, notifications coupées, puis seulement le minuteur.",
    source:
      "Safren et al. (2010), thérapie cognitive et comportementale du TDAH de l'adulte",
  },
  {
    id: "blocs-courts",
    categorie: "focus",
    titre: "Travailler par blocs courts",
    texte:
      "Une durée annoncée et limitée rend une tâche moins intimidante, et une pause prévue aide à y revenir.",
    astuce:
      "Commence par 10 à 25 minutes avec l'onglet Pause, puis une vraie pause.",
  },

  // Compétences
  {
    id: "regularite",
    categorie: "competences",
    titre: "Viser la régularité, pas l'intensité",
    texte:
      "Une courte séance plusieurs fois par semaine tient plus longtemps qu'une longue séance qu'on finit par repousser. La constance compte plus que la durée.",
    astuce:
      "Fixe une durée minuscule, 10 minutes : tu peux toujours continuer.",
  },
  {
    id: "a-portee",
    categorie: "competences",
    titre: "Laisser le matériel à portée de main",
    texte:
      "Chaque étape avant de commencer est une occasion d'abandonner. Réduire cette friction fait souvent toute la différence.",
    astuce:
      "Instrument sorti de sa housse, livre sur l'oreiller, carnet ouvert sur le bureau.",
  },
];

export const SECTIONS: Section[] = [
  {
    id: "comprendre",
    titre: "Comprendre le TDAH",
    cartes: [
      {
        id: "fonctionnement",
        titre: "Un fonctionnement, pas un manque de volonté",
        texte:
          "Le TDAH est un trouble du neurodéveloppement. Il touche la régulation de l'attention, de l'activité et de l'impulsivité, et surtout les fonctions exécutives : démarrer, s'organiser, gérer le temps, garder une consigne en tête. Ce n'est ni de la paresse ni un défaut d'éducation.",
        source:
          "Faraone et al. (2021), consensus international de la World Federation of ADHD",
      },
      {
        id: "frequent",
        titre: "Fréquent, et pas seulement chez les enfants",
        texte:
          "Il concerne près de 6 % des jeunes et près de 3 % des adultes dans le monde. Il est en grande partie héréditaire : les études de jumeaux situent l'héritabilité autour de 70 à 80 %. Beaucoup d'adultes ne sont diagnostiqués que tard.",
        source:
          "Faraone et al. (2021) ; Faraone & Larsson (2019), génétique du TDAH",
      },
      {
        id: "savoir-faire",
        titre: "Savoir quoi faire ne suffit pas",
        texte:
          "Le TDAH gêne moins le savoir que le passage à l'acte au bon moment : on sait ce qu'il faudrait faire, et on n'y arrive pas. D'où l'intérêt de mettre l'information là où l'action se passe.",
        astuce:
          "Place le rappel à l'endroit exact de l'action : un post-it sur la porte, pas dans un carnet.",
        source: "Barkley, Taking Charge of Adult ADHD (2021)",
      },
      {
        id: "temps",
        titre: "Le temps se ressent autrement",
        texte:
          "Sentir le temps qui passe et se projeter est souvent difficile : une échéance lointaine motive peu, ce qui est immédiat l'emporte. Attendre une récompense coûte aussi plus cher.",
        astuce:
          "Rends le temps visible (minuteur, horloge à aiguilles) et rapproche les échéances en découpant.",
        source: "Barkley ; Sonuga-Barke (2003), modèle à double voie du TDAH",
      },
      {
        id: "emotions",
        titre: "Les émotions en font partie",
        texte:
          "Réactions rapides et intenses, frustration, découragement : la régulation des émotions est souvent touchée. Ce n'est pas un défaut de caractère, et ça se travaille.",
        source: "Shaw et al. (2014), dysrégulation émotionnelle dans le TDAH",
      },
      {
        id: "interet",
        titre: "L'intérêt guide l'attention",
        texte:
          "On peut garder son attention des heures sur ce qui passionne, et ne pas réussir à commencer ce qui ennuie. Ce n'est pas un choix : l'attention répond surtout à l'intérêt, à la nouveauté, au défi ou à l'urgence.",
        astuce:
          "Ajoute un de ces ingrédients à une tâche ennuyeuse : un défi chronométré, un autre lieu, une musique.",
      },
    ],
  },
  {
    id: "astuces",
    titre: "Astuces par domaine",
    intro: "Des idées simples, à essayer une par une.",
    cartes: ASTUCES,
  },
  {
    id: "appli",
    titre: "Pourquoi l'appli fonctionne comme ça",
    cartes: [
      {
        id: "trois-taches",
        titre: "Pourquoi seulement 3 tâches ?",
        texte:
          "Choisir dans une longue liste demande exactement l'énergie que le TDAH rend rare. L'appli fait ce tri pour toi, selon l'importance, l'échéance, ton énergie du moment et l'équilibre entre domaines. Le reste n'est pas oublié : il revient quand c'est le bon moment.",
      },
      {
        id: "serie",
        titre: "Rater un jour n'efface rien",
        texte:
          "L'appli ne retire jamais de points quand une série s'arrête. Un jour manqué arrive à tout le monde : ce qui compte, c'est de reprendre le lendemain.",
      },
      {
        id: "checkins",
        titre: "Pourquoi ces petites questions ?",
        texte:
          "Énergie, concentration, humeur : trois taps, au plus trois fois par jour. L'appli s'en sert pour proposer ce qui est faisable maintenant, et toi pour repérer tes meilleurs moments dans Progression.",
      },
      {
        id: "domaines",
        titre: "Un peu de chaque domaine",
        texte:
          "Quand un domaine est délaissé depuis quelques jours, l'appli remonte ses tâches. L'idée n'est pas de tout faire, mais de ne rien laisser de côté trop longtemps.",
      },
    ],
  },
  {
    id: "aide",
    titre: "Trouver de l'aide",
    cartes: [
      {
        id: "diagnostic",
        titre: "Se faire diagnostiquer",
        texte:
          "Le diagnostic est posé par un médecin, le plus souvent un psychiatre, à partir d'un entretien détaillé qui revient aussi sur l'enfance. Ton médecin traitant peut t'orienter. Une appli ne remplace pas ce bilan.",
      },
      {
        id: "traitements",
        titre: "Ce qui aide vraiment",
        texte:
          "Les médicaments sont les plus efficaces sur les symptômes principaux. Les thérapies cognitives et comportementales, la psychoéducation et les aménagements au travail ou aux études aident surtout au quotidien. Le plus souvent, on combine.",
        source:
          "Kooij et al. (2019), consensus européen sur le TDAH de l'adulte ; Faraone et al. (2021)",
      },
      {
        id: "association",
        titre: "Trouver des personnes qui comprennent",
        texte:
          "L'association HyperSupers – TDAH France, reconnue d'utilité publique, informe et accompagne les adultes, les enfants et leurs familles, notamment avec des rencontres entre pairs.",
      },
      {
        id: "urgence",
        titre: "Si ça ne va vraiment pas",
        texte:
          "Si tu traverses un moment très difficile ou que tu as des idées suicidaires, tu peux appeler le 3114, le numéro national de prévention du suicide : gratuit, 24 h/24, 7 j/7. En cas de danger immédiat : le 15 ou le 112.",
        important: true,
        appel: { libelle: "Appeler le 3114", numero: "3114" },
      },
    ],
  },
];

/** Une astuce différente chaque jour, la même toute la journée. */
export function astuceDuJour(dateIso: string): Carte {
  const jour = Math.floor(Date.parse(dateIso + "T00:00:00Z") / 86400000);
  return ASTUCES[((jour % ASTUCES.length) + ASTUCES.length) % ASTUCES.length];
}
