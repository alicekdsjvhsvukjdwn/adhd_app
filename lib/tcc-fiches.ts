/**
 * Fiches « Apprendre » du programme de TCC en autonomie : une minute chacune, factuelles et neutres,
 * sans diagnostic. Chaque fiche renvoie vers l'outil qui sert à l'appliquer. Sans accès à la base.
 */

export type OutilFiche = { libelle: string; route: string };

export type Fiche = {
  id: string;
  titre: string;
  /** Une idée en une phrase, visible avant d'ouvrir la fiche. */
  resume: string;
  /** Paragraphes courts. */
  texte: string[];
  outil: OutilFiche;
};

const ECHELLE: OutilFiche = { libelle: "Ouvrir mon échelle", route: "/echelle" };
const PENSEES: OutilFiche = { libelle: "Noter une pensée", route: "/pensee" };
const CONFIANCE: OutilFiche = { libelle: "Ouvrir mon journal de confiance", route: "/confiance" };

export const FICHES: Fiche[] = [
  {
    id: "cercle",
    titre: "Le cercle de l'anxiété sociale",
    resume: "Éviter soulage sur le moment, mais entretient la peur.",
    texte: [
      "Quand une situation sociale fait peur, l'envie de l'éviter est naturelle. Et éviter soulage tout de suite.",
      "Le problème, c'est ce que ce soulagement apprend : « j'ai échappé à un danger ». La fois suivante, la peur est un peu plus forte, et l'envie d'éviter aussi. Le cercle se resserre.",
      "On en sort par de petits pas, un à la fois, pas par un grand saut. C'est le rôle de l'échelle.",
    ],
    outil: ECHELLE,
  },
  {
    id: "exposition",
    titre: "Pourquoi y aller petit à petit",
    resume: "On apprend que ce qu'on craignait arrive moins, ou moins fort.",
    texte: [
      "L'exposition graduelle consiste à s'approcher peu à peu de ce qui fait peur, en commençant par le plus facile.",
      "Chaque fois, on compare ce qu'on avait prévu et ce qui s'est vraiment passé. C'est cet écart qui enseigne quelque chose : souvent, c'est plus supportable que prévu.",
      "L'anxiété peut monter, puis redescendre. Pas besoin d'attendre qu'elle disparaisse pour que ça compte. Refaire la même marche plusieurs fois aide aussi.",
    ],
    outil: ECHELLE,
  },
  {
    id: "securite",
    titre: "Les comportements de sécurité",
    resume: "Les petites béquilles qui empêchent d'apprendre que ça va.",
    texte: [
      "Ce sont des petites choses qu'on fait pour se sentir plus en sécurité : éviter le regard, préparer chaque phrase, garder son téléphone en main, rester près de la sortie.",
      "Elles aident sur le moment. Mais si on les utilise, le cerveau retient « ça s'est bien passé grâce à ça », et pas « ça se passe bien ».",
      "Pas la peine de tout enlever d'un coup. Les repérer est déjà un premier pas : l'appli te les propose en pastilles après chaque exposition.",
    ],
    outil: ECHELLE,
  },
  {
    id: "lecture",
    titre: "Lire dans les pensées",
    resume: "Être sûre de ce que l'autre pense de moi, sans le savoir.",
    texte: [
      "« Elle trouve que je suis bizarre. » C'est un piège de pensée courant : on traite une supposition comme un fait.",
      "Une question utile : qu'est-ce que je sais vraiment, et qu'est-ce que j'imagine ? D'autres explications sont presque toujours possibles : la personne est fatiguée, pressée, pense à autre chose.",
      "Dans le journal de pensées, l'étape « une autre façon de voir » sert à ça.",
    ],
    outil: PENSEES,
  },
  {
    id: "projection",
    titre: "Prévoir le pire",
    resume: "Imaginer que ça va mal tourner, comme si c'était certain.",
    texte: [
      "« Je vais bafouiller et tout le monde va rire. » On se raconte la suite avant qu'elle ait eu lieu, et on la raconte en noir.",
      "Le test le plus simple : écrire sa prédiction avant, puis noter ce qui s'est passé. C'est ce que fait l'appli à chaque exposition.",
      "Avec le temps, on voit à quelle fréquence les prédictions se réalisent vraiment.",
    ],
    outil: PENSEES,
  },
  {
    id: "personnalisation",
    titre: "Tout prendre pour soi",
    resume: "Croire que ce qui arrive aux autres est lié à moi.",
    texte: [
      "Quelqu'un ne répond pas, fait la tête, coupe la conversation : « c'est à cause de moi ».",
      "La personnalisation fait oublier tout le reste : la journée de l'autre, son humeur, ses soucis. Beaucoup de choses n'ont rien à voir avec nous.",
      "Quand ça arrive, on peut se demander : quelles autres raisons pourraient expliquer ça ?",
    ],
    outil: PENSEES,
  },
  {
    id: "attention",
    titre: "L'attention tournée vers soi",
    resume: "Se regarder de l'extérieur pendant qu'on parle.",
    texte: [
      "Dans une situation sociale, on a tendance à surveiller ce qu'on dit, comment on a l'air, si ça se voit qu'on est tendue.",
      "Cette surveillance prend de la place : on écoute moins l'autre, on vit moins la situation, et on se juge sur une image qui n'est pas celle que les autres voient.",
      "Ramener doucement l'attention vers l'extérieur aide : ce que dit la personne, ce qu'il y a autour, ses mains, sa voix.",
    ],
    outil: ECHELLE,
  },
  {
    id: "compassion",
    titre: "Se parler comme à une amie",
    resume: "La confiance grandit mieux avec de la douceur qu'avec des reproches.",
    texte: [
      "On se dit souvent des choses qu'on ne dirait jamais à une amie : « tu es nulle, tu aurais dû ».",
      "L'auto-compassion, c'est faire à l'inverse : reconnaître que c'est difficile, se rappeler que beaucoup de gens ressentent ça, et se parler avec gentillesse. Ce n'est pas de la complaisance : on a plus de force pour essayer quand on ne se punit pas.",
      "Chaque semaine, la séance avec toi se termine par un mot gentil. Tu peux aussi relire ton journal de confiance.",
    ],
    outil: CONFIANCE,
  },
  {
    id: "prediction",
    titre: "Tester une prédiction",
    resume: "Une expérience : ce que je crains contre ce qui arrive.",
    texte: [
      "Plutôt que de se demander si la pensée est vraie, on peut la traiter comme une hypothèse à tester.",
      "Avant : j'écris ce que je crains et à quel point j'ai peur (0 à 100). Après : j'écris ce qui s'est vraiment passé et l'anxiété ressentie.",
      "Dans le journal de pensées, « Tester cette pensée » transforme une pensée en marche de l'échelle.",
    ],
    outil: PENSEES,
  },
];

export const fiche = (id: string) => FICHES.find((f) => f.id === id);
