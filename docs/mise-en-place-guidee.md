# Mise en place guidée — conception

_Remplace l'onboarding actuel (choix d'un profil) et l'ajout de routine par formulaire. Objectif : qu'une personne avec un TDAH ait ses premières routines en place en moins d'une minute, sans rien écrire et sans connaître le vocabulaire de l'appli._

---

## 1. Pourquoi l'entrée par les difficultés

Demander « quelles routines veux-tu mettre en place ? » suppose de savoir ce qui aiderait, donc d'avoir déjà fait le travail. Demander « qu'est-ce qui est difficile en ce moment ? » part de ce que la personne vit, et laisse l'appli faire le lien avec des solutions.

C'est aussi plus facile cognitivement : **reconnaître** sa situation dans une liste coûte bien moins que de la **formuler** soi-même. Pour quelqu'un dont la mémoire de travail sature vite, c'est la différence entre répondre et abandonner.

---

## 2. Principes ergonomiques

### 2.1 Réduire les décisions

| Principe                        | Application                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Une question par écran          | 3 étapes, une barre de progression, retour toujours possible                                                          |
| Peu de choix visibles à la fois | 8 difficultés affichées d'abord, les autres derrière « Voir d'autres difficultés »                                    |
| Des choix déjà faits            | Une routine pré-cochée par difficulté, un moment repère pré-sélectionné quand le catalogue en suggère un              |
| Commencer petit                 | 2 difficultés et 3 routines au maximum au départ, avec la raison affichée : ce qui démarre petit tient plus longtemps |
| Rien à écrire                   | Tout se fait en touchant. La recherche libre existe, mais en option                                                   |
| Toujours une sortie             | « Je ne sais pas par où commencer » et « Passer » à chaque étape, sans pénalité                                       |

### 2.2 Des formulations qu'on reconnaît

| Règle                                 | Oui                                           | Non                              |
| ------------------------------------- | --------------------------------------------- | -------------------------------- |
| Première personne, situation concrète | « Je n'arrive pas à me lever »                | « Sommeil »                      |
| Décrire ce qui se passe, pas juger    | « Je remets à plus tard »                     | « Je suis nul pour m'organiser » |
| Pas de vocabulaire médical            | « Tout me semble trop d'un coup »             | « Surcharge émotionnelle »       |
| Pas d'accord en genre                 | « La fatigue me tombe dessus »                | « Je suis fatigué·e »            |
| Court                                 | 45 caractères au plus, 2 lignes sur une tuile | Une phrase longue                |

### 2.3 Accessibilité physique

- Zones de toucher d'au moins 44 points, tuiles en 2 colonnes, boutons principaux pleine largeur en bas (atteignables au pouce, de chaque main).
- Icône + texte sur chaque tuile : l'icône aide à repérer, le texte évite toute ambiguïté.
- Retour visuel immédiat à la sélection (fond coloré, coche, compteur « 1 sur 2 »).

### 2.4 Pas de bouton grisé

Un bouton grisé ne dit pas pourquoi il ne marche pas. Le bouton du bas reste actif et change de libellé :

- rien de choisi : « Passer », qui mène aux routines les plus universelles ;
- une ou deux difficultés : « Continuer ».

Toucher une troisième difficulté affiche : « Deux pour commencer. Retire-en une pour choisir celle-ci. »

---

## 3. Le parcours

### Étape 1 — Qu'est-ce qui est difficile en ce moment ?

- Sous-titre : « Choisis-en une ou deux. Tu pourras en ajouter d'autres plus tard. »
- 8 tuiles fréquentes (voir 4.1).
- « Voir d'autres difficultés » : la liste complète par thème (voir 4.2), un thème ouvert à la fois, et en haut un champ « Ou décris-le avec tes mots » qui cherche dans les formulations et les mots-clés du catalogue.
- En bas : « Je ne sais pas par où commencer » (bouton secondaire) et « Continuer ».

### Étape 2 — Voilà par quoi commencer

- Pour chaque difficulté choisie, deux routines au plus, toujours dans leur version la plus simple (1 à 5 minutes). La première est pré-cochée.
- Chaque carte : le nom, le moment, la durée, et « Pourquoi ça aide » replié sur une ligne (tiré de la justification du catalogue).
- 3 routines cochées au maximum au total.
- « Créer la mienne » en lien secondaire, qui ouvre la création libre.

### Étape 3 — Juste après quoi ? (facultative)

- Pour chaque routine retenue : « Juste après quoi ? », avec les moments repères en pastilles. Celui que le catalogue suggère est pré-sélectionné.
- « Passer » saute toute l'étape. Les moments repères choisis sont activés automatiquement.

### Fin — C'est prêt

- Un aperçu de la journée : Matin, Après-midi, Soir, avec les routines à leur place.
- Bouton « C'est parti », qui ouvre l'accueil déjà rempli.

### Réutilisation

- Le « + » à côté de « Routines » rouvre le même parcours, avec les difficultés déjà choisies marquées.
- Les difficultés choisies sont enregistrées : elles serviront à mettre en avant les astuces correspondantes dans Infos, et à choisir quoi proposer quand l'appli suggère d'ajouter une routine.

---

## 4. Les difficultés

### 4.1 Les 8 affichées d'abord

Elles couvrent les difficultés qui reviennent le plus chez l'adulte avec un TDAH : démarrer, gérer le temps, les oublis, la distraction, le sommeil.

| Tuile                                | Thème                        |
| ------------------------------------ | ---------------------------- |
| J'ai du mal à commencer              | Démarrer et rester concentré |
| Je fais tout au dernier moment       | Démarrer et rester concentré |
| Je me laisse distraire tout le temps | Démarrer et rester concentré |
| Je suis souvent en retard            | Gérer le temps               |
| J'oublie ce que je devais faire      | S'organiser au quotidien     |
| Je perds mes affaires                | S'organiser au quotidien     |
| Je n'arrive pas à me lever           | Dormir et se lever           |
| Je me couche trop tard               | Dormir et se lever           |

### 4.2 La liste complète, par thème

La liste de référence est dans `lib/catalogue/difficultes.ts` (34 difficultés) ; les noms exacts des routines sont ceux du catalogue. Chaque difficulté est associée à une ou deux routines de départ. Toutes sont volontairement minuscules : on les fait monter en difficulté plus tard, avec les suggestions d'ajustement.

#### 🌙 Dormir et se lever — domaine Sommeil

| Difficulté                              | Routine 1                                                    | Routine 2                                                 |
| --------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Je n'arrive pas à me lever              | Poser les pieds au sol à la sonnerie (matin, 1 min)          | Poser le réveil hors de portée du lit (soir, 1 min)       |
| Je me couche trop tard                  | Mettre une alarme « fin de soirée » (soir, 1 min)            | Charger le téléphone hors de la chambre (soir, 1 min)     |
| Mon cerveau tourne quand je veux dormir | Noter sur papier ce qui trotte dans la tête (coucher, 3 min) | Lumières tamisées 30 min avant le coucher (soir, 1 min)   |
| La fatigue me tombe dessus en journée   | 5 minutes de lumière du jour après le lever (matin, 5 min)   | Se lever à la même heure, week-end compris (matin, 1 min) |

#### ▶️ Démarrer et rester concentré — domaine Focus

| Difficulté                                 | Routine 1                                                                  | Routine 2                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| J'ai du mal à commencer                    | Choisir la première action de 2 minutes de la journée (matin, 2 min)       | Lancer un minuteur de 5 minutes « juste pour voir » (à tout moment, 5 min)       |
| Je fais tout au dernier moment             | Découper la tâche la plus lourde en étapes de 10 minutes (matin, 3 min)    | Se fixer une échéance intermédiaire plus tôt que la vraie (à tout moment, 1 min) |
| Je me laisse distraire tout le temps       | Téléphone dans une autre pièce avant de travailler (à tout moment, 1 min)  | Fermer onglets et notifications avant de commencer (à tout moment, 1 min)        |
| Je commence plein de choses sans les finir | Une seule tâche ouverte à la fois, noter les autres (à tout moment, 1 min) | Le soir, choisir une seule chose à finir demain (soir, 2 min)                    |
| Je ne vois plus le temps passer            | Mettre une alarme d'arrêt avant de commencer (à tout moment, 1 min)        | Se lever et boire à chaque fin de minuteur (à tout moment, 2 min)                |
| Je décroche vite sur ce qui m'ennuie       | Changer de lieu pour les tâches ennuyeuses (à tout moment, 1 min)          | Transformer la tâche en défi chronométré (à tout moment, 2 min)                  |

#### ⏱️ Gérer le temps — domaine Organisation

| Difficulté                               | Routine 1                                                           | Routine 2                                                      |
| ---------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Je suis souvent en retard                | Alarme « départ » 10 minutes avant l'heure de partir (matin, 1 min) | Préparer son sac la veille (soir, 3 min)                       |
| Je sous-estime le temps que ça prend     | Chronométrer une tâche courante par jour (à tout moment, 1 min)     | Doubler chaque estimation de durée (matin, 1 min)              |
| J'oublie mes rendez-vous                 | Regarder l'agenda chaque matin (matin, 2 min)                       | Noter un rendez-vous dès qu'il est fixé (à tout moment, 1 min) |
| Mes journées filent sans que je sache où | Choisir les 3 choses du jour (matin, 2 min)                         | Le soir, noter une chose faite (soir, 1 min)                   |

#### 🗂️ S'organiser au quotidien — domaine Organisation

| Difficulté                                  | Routine 1                                                       | Routine 2                                                             |
| ------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| J'oublie ce que je devais faire             | Tout noter dans l'appli dès que ça vient (à tout moment, 1 min) | Relire sa liste chaque matin (matin, 2 min)                           |
| Je perds mes affaires                       | Vider ses poches dans un bol à l'entrée (soir, 1 min)           | Vérifier clés, téléphone, portefeuille avant de sortir (matin, 1 min) |
| Le désordre s'accumule chez moi             | 5 minutes de rangement au minuteur (soir, 5 min)                | Dégager une seule surface par jour (à tout moment, 3 min)             |
| Les papiers et l'administratif s'accumulent | Une boîte unique pour tout papier reçu (à tout moment, 1 min)   | 10 minutes d'administratif, toujours le même jour (hebdo, 10 min)     |
| Je laisse traîner mes messages et mes mails | Répondre à un message pendant le café (matin, 2 min)            | Trier ses mails 5 minutes, sans y répondre (à tout moment, 5 min)     |
| Je dépense sans y penser                    | Attendre 24 h avant un achat non prévu (à tout moment, 1 min)   | Regarder son compte une fois par semaine (hebdo, 3 min)               |

#### 🌿 Prendre soin de son corps — domaine Corps (actuel « Mouvement »)

| Difficulté                      | Routine 1                                                   | Routine 2                                                     |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Je ne bouge pas assez           | 10 minutes de marche après le déjeuner (après-midi, 10 min) | 2 minutes d'étirements au lever (matin, 2 min)                |
| Je reste des heures sans bouger | Se lever à chaque fin de minuteur (à tout moment, 1 min)    | Marcher pendant les appels (à tout moment)                    |
| J'oublie de manger              | Alarme à l'heure du déjeuner (midi, 1 min)                  | Préparer une collation la veille (soir, 3 min)                |
| J'oublie de boire               | Un verre d'eau au réveil (matin, 1 min)                     | Une bouteille d'eau visible sur le bureau (matin, 1 min)      |
| J'oublie mon traitement         | Le prendre avec le petit-déjeuner (matin, 1 min)            | Laisser le pilulier à côté de la brosse à dents (soir, 1 min) |

L'appli rappelle de prendre un traitement, elle ne donne jamais d'indication de dose ni d'horaire médical : c'est au médecin de les fixer.

#### 💭 Émotions et charge mentale — nouveau domaine Émotions

| Difficulté                     | Routine 1                                                     | Routine 2                                                                   |
| ------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| J'ai trop de choses en tête    | Vider sa tête sur papier, 3 minutes (matin, 3 min)            | Choisir une seule priorité du jour (matin, 1 min)                           |
| Tout me semble trop d'un coup  | 2 minutes de respiration lente (à tout moment, 2 min)         | Poser tout le reste et choisir une seule chose (à tout moment, 1 min)       |
| Mes émotions montent très vite | Attendre 90 secondes avant de répondre (à tout moment, 2 min) | Mettre un mot sur ce que je ressens (soir, 1 min)                           |
| Je me décourage vite           | Le soir, noter une chose réussie (soir, 1 min)                | Se parler comme à un ami : une phrase prête à relire (à tout moment, 1 min) |
| J'ai du mal à me détendre      | 5 minutes sans écran (soir, 5 min)                            | Une activité calme choisie à l'avance (soir, 10 min)                        |

Choisir « Tout me semble trop d'un coup » affiche aussi, discrètement, un lien vers la carte « Si ça ne va vraiment pas » de l'onglet Infos.

#### 🎨 Ce qui compte pour moi — domaine Compétences

| Difficulté                                | Routine 1                                                                        | Routine 2                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| J'arrête les activités qui me plaisent    | 10 minutes, 3 jours par semaine (soir, 10 min)                                   | Laisser le matériel sorti et à portée de main (à tout moment, 1 min) |
| J'abandonne mes projets en route          | Noter la prochaine petite étape à la fin de chaque séance (à tout moment, 1 min) | Un seul projet actif à la fois (hebdo, 2 min)                        |
| Je n'arrive pas à apprendre régulièrement | 5 minutes par jour avec le café (matin, 5 min)                                   | Choisir un créneau fixe, même court (hebdo, 2 min)                   |
| Je perds le contact avec mes proches      | Envoyer un message à quelqu'un une fois par semaine (hebdo, 2 min)               | Noter les anniversaires dès qu'on y pense (à tout moment, 1 min)     |

### 4.3 « Je ne sais pas par où commencer »

Trois routines universelles, utiles quel que soit le profil, chacune d'une minute :

1. Se lever à la même heure (matin)
2. Tout noter dans l'appli dès que ça vient (à tout moment)
3. Le soir, noter une chose faite (soir)

---

## 5. Conséquences sur l'appli

- **Domaines** : « Mouvement » s'affiche désormais « Corps » (l'identifiant interne ne change pas), et un domaine « Émotions » s'ajoute, avec sa couleur. On passe à 6 domaines.
- **Catalogue** : les routines ci-dessus s'ajoutent aux familles existantes, avec leurs formulations de difficultés, leurs mots-clés, leur moment, leur moment repère suggéré, leur première action, une justification et, quand elle existe, une source. Celles qui existent déjà gardent leur identifiant.
- **Onboarding** : le choix d'un profil disparaît de l'entrée. Les réglages de ton et de points restent modifiables dans Profil.
- **Pause** : l'onglet disparaît. La respiration guidée pourra revenir comme action d'une routine du domaine Émotions.
- **Nouvelle donnée** : les difficultés choisies, enregistrées pour la suite.

---

## 6. Ce qu'on mesurera

- Durée de la mise en place (objectif : moins d'une minute).
- Étape à laquelle les personnes abandonnent, s'il y en a une.
- Part des routines choisies encore actives et faites après 7 jours.
- Difficultés les plus choisies, pour ajuster les 8 tuiles affichées en premier.
