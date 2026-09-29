# Cahier des charges — Application d'aide au quotidien pour le TDAH

_Document de référence du projet `tdah-routines` (dépôt GitHub `adhd_app`). Il décrit l'application telle qu'elle fonctionne, avec les règles et les seuils tels qu'ils sont dans le code._

---

## 1. Le projet

### 1.1 Le problème

Les applications de suivi d'habitudes demandent à l'utilisateur de faire lui-même ce que le TDAH rend difficile : trier, choisir par quoi commencer, se souvenir de revenir, tenir une liste à jour. Elles affichent tout, tout le temps, et sanctionnent souvent la moindre interruption (série perdue, points retirés).

### 1.2 La thèse

**L'utilisateur dépose, l'appli décide.** La personne note ce qu'elle a à faire en quelques secondes. Une couche cachée trie et priorise à sa place, en tenant compte de l'importance, de l'échéance, du moment de la journée, de son énergie et de l'équilibre entre les domaines de sa vie. L'écran principal ne montre que ce qui compte maintenant.

### 1.3 Objectifs

- Réduire la charge de décision au quotidien.
- Installer des routines durables plutôt qu'en accumuler.
- S'adapter à la personne à partir de ses données réelles, sans jamais imposer un changement visible.
- Rester bienveillant : aucune punition, aucune mécanique de dépendance.

### 1.4 Contexte

Projet personnel, conçu et développé seule, qui sert de support à un dossier UX / data. Il mobilise la conception centrée utilisateur, la modélisation de données, un algorithme de décision explicable et une réflexion sur la mesure de son effet.

---

## 2. Cadre scientifique

| Idée                                                                                                                                            | Source                                        | Traduction dans l'appli                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Le TDAH touche surtout les fonctions exécutives et le passage à l'acte, plus que le savoir. Il faut mettre l'information là où l'action a lieu. | Barkley, _Taking Charge of Adult ADHD_ (2021) | Écran d'action unique, rappels, première petite action affichée |
| Aversion au délai : ce qui est immédiat l'emporte sur ce qui est lointain.                                                                      | Sonuga-Barke (2003), modèle à double voie     | Échéances rapprochées, récompense immédiate à la complétion     |
| Le blocage est au démarrage. Une première action minuscule le lève.                                                                             | Solanto et al. (2010), thérapie métacognitive | Champ « première petite action » sur chaque routine et tâche    |
| Réduire les distractions en amont, organiser, planifier.                                                                                        | Safren et al. (2010), TCC du TDAH de l'adulte | Onglet Pause (minuteur), tri automatique                        |
| Les intentions de mise en œuvre (« quand X, alors Y ») augmentent nettement le passage à l'acte.                                                | Gollwitzer & Sheeran (2006), méta-analyse     | Moments repères (ancres)                                        |
| Rythme circadien souvent décalé chez l'adulte avec TDAH.                                                                                        | Kooij & Bijlenga (2013) ; Kooij et al. (2019) | Routines de sommeil, prise en compte du moment de la journée    |
| Mesures courtes et répétées dans la journée plutôt qu'un bilan rétrospectif.                                                                    | Méthode d'échantillonnage d'expérience (EMA)  | Check-in d'état, jusqu'à 3 fois par jour                        |

Les contenus de psychoéducation de l'onglet Infos citent en plus le consensus international de la World Federation of ADHD (Faraone et al., 2021), Faraone & Larsson (2019) et Shaw et al. (2014).

---

## 3. Architecture technique

- **Framework** : React Native avec Expo (SDK 57), TypeScript, navigation par fichiers avec expo-router.
- **Données** : SQLite local (expo-sqlite). Aucune donnée ne quitte le téléphone.
- **Graphiques** : react-native-svg (anneaux de progression).
- **Tests** : sur iPhone via Expo Go.
- **Versionnement** : Git, dépôt GitHub `adhd_app`.

### 3.1 Organisation du code

```
app/
  (tabs)/          Onglets : index (Aujourd'hui), pause, progression, infos, profil
  _layout.tsx      Démarrage : initialisation de la base, écoute des notifications
  nouvelle-tache.tsx   Ajouter / modifier une tâche ou une routine
  etat.tsx, onboarding.tsx, problemes.tsx, ancres.tsx, rappels.tsx
components/        BandeauEtat, CarteSuggestion, BoutonReinitialiser
hooks/             useRoutines
lib/
  dates.ts         Toutes les dates de calendrier, en heure locale
  theme.ts, theme-categories.ts
  catalogue/       Familles de routines, en TypeScript
  infos/contenu.ts Contenus de psychoéducation
  db/              Accès aux données, moteur, suggestions, migrations
docs/              Ce document
```

### 3.2 Base de données et migrations

Les tables principales sont créées par des migrations versionnées (`PRAGMA user_version`). Chaque migration s'exécute une seule fois, dans l'ordre, en transaction ; on n'en modifie jamais une ancienne.

| Version | Contenu                                                                             |
| ------- | ----------------------------------------------------------------------------------- |
| 1       | Tables héritées de la première version                                              |
| 2       | Table unifiée `items`, `completions` par item, journal des décisions `decision_log` |
| 3       | `sessions` (minuteur de focus, respiration)                                         |
| 4       | `etat` (check-in)                                                                   |
| 5       | Check-in sans créneau fixe : heure exacte au lieu de matin/soir                     |
| 6       | `suggestions` (décisions sur les ajustements proposés)                              |

D'autres tables sont créées au démarrage hors migrations : `ancres`, `stats`, `preferences`, `event_log`, `meta`. La fonction `initialiserBase()` (`lib/db/demarrage.ts`) regroupe tout ce qui rend la base utilisable ; elle est appelée au démarrage et après une réinitialisation.

### 3.3 Dates

Toute date de calendrier passe par `lib/dates.ts` et se calcule en heure locale : la journée bascule à minuit. Les instants précis (horodatages) restent en ISO UTC. Les calculs « dans n jours » se font sur la date elle-même, ce qui les rend insensibles aux changements d'heure.

---

## 4. Modèle de données

### 4.1 Items

Une seule table pour tout ce que la personne dépose.

| Champ                                                        | Rôle                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `type`                                                       | `routine` (récurrente), `tache` (ponctuelle), `evenement` (daté, jamais trié) |
| `statut`                                                     | `actif`, `pause`, `archive`, `termine`                                        |
| `recurrence`                                                 | `quotidien`, `jours:1,3,5` (0 = dimanche), `hebdo`, ou vide pour une tâche    |
| `categorie`                                                  | Domaine : sommeil, mouvement, organisation, focus, compétences                |
| `moment`                                                     | Moment de la journée prévu                                                    |
| `importance`                                                 | 1 bonus, 2 utile, 3 essentiel                                                 |
| `echeance`                                                   | Date limite d'une tâche                                                       |
| `duree_min`, `effort`                                        | Pour adapter les propositions à l'énergie                                     |
| `premiere_action`                                            | La petite action qui permet de démarrer                                       |
| `ancre_id`, `ancre_position`                                 | Rattachement à un moment repère (avant / après)                               |
| `template_id`, `variante_rang`                               | Provenance du catalogue et niveau de difficulté                               |
| `fenetre_debut_h`, `fenetre_fin_h`                           | Contrainte externe (ex. un service ouvert de 9 h à 17 h)                      |
| `heure_reelle_moy`, `duree_reelle_moy_min`, `nb_completions` | Observation accumulée                                                         |
| `nb_propositions_sans_action`                                | Compteur de négligence                                                        |

### 4.2 Autres tables

| Table          | Contenu                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `completions`  | Une ligne par item et par jour : statut (complet, partiel), heure, durée réelle |
| `decision_log` | Ce que le moteur a proposé, avec le score et le détail de ses composantes       |
| `etat`         | Check-ins : date, heure exacte, énergie, concentration, humeur (1 à 3)          |
| `sessions`     | Sessions de focus ou de régulation : durée prévue et durée réelle               |
| `suggestions`  | Décisions prises sur les ajustements proposés (acceptée, refusée)               |
| `ancres`       | Moments repères ; 8 pré-remplis, désactivés par défaut                          |
| `stats`        | Points, meilleure série, réglage du rappel quotidien                            |
| `preferences`  | Profil choisi, intensité de la gamification, ton, rigidité horaire              |
| `event_log`    | Journal des événements (ajouts, complétions, notifications…)                    |

---

## 5. Écrans

| Écran                  | Rôle                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Aujourd'hui**        | Écran d'action : routines du jour et tâches triées                                      |
| **Ajouter / Modifier** | Saisie rapide d'une tâche ou d'une routine, et correction                               |
| **Pause**              | Démarrer une tâche avec un minuteur, ou redescendre avec une respiration guidée         |
| **Progression**        | Ce qui avance : taux, domaines, tâches faites, état selon le moment, calendrier, année  |
| **Infos**              | Psychoéducation : comprendre le TDAH, astuces, fonctionnement de l'appli, aide          |
| **Profil**             | Catalogue de routines, moments repères, rappels, check-in, onboarding, réinitialisation |
| Check-in               | Trois questions : énergie, concentration, humeur                                        |
| Onboarding             | Choix d'un profil de départ (Semeur, Sprinter, Apaisé)                                  |

L'interface est pensée pour être utilisable d'une main, quelle qu'elle soit : actions principales pleine largeur ou centrées, navigation en bas.

### 5.1 Aujourd'hui

De haut en bas :

1. **Série et points**, selon l'intensité de gamification choisie.
2. **Invitation au check-in**, si elle est due (voir 8).
3. **Suggestion d'ajustement**, s'il y en a une (voir 10).
4. **Pastilles d'équilibre** : une par domaine, colorée dès qu'une complétion a eu lieu dans ce domaine aujourd'hui.
5. **Routines**, regroupées en Matin, Après-midi, Soir et À tout moment, avec un compteur (ex. 2/5). Une routine cochée reste visible, barrée. Seules les routines prévues ce jour-là apparaissent.
6. **Tâches** : les 3 propositions du moteur, avec la raison du choix, la durée et la première action.

Actions : toucher pour cocher ; glisser vers la gauche pour modifier ou supprimer (avec confirmation) ; « + » à côté de chaque titre pour ajouter. Après avoir coché une tâche, un bandeau « Annuler » reste affiché 6 secondes.

Les routines et les tâches ne sont pas mélangées : les routines se font toutes, chaque jour prévu (l'enjeu est la régularité) ; les tâches doivent être filtrées (l'enjeu est la priorisation).

### 5.2 Ajouter / Modifier

Un seul écran, avec un choix en haut : **Une fois** (tâche) ou **Régulièrement** (routine). Seul le nom est obligatoire.

- Tâche : importance (essentiel, utile, bonus), échéance (aucune, aujourd'hui, demain, dans 3 jours, 1 semaine, 2 semaines).
- Routine : moment (matin, après-midi, soir, à tout moment) et jours de la semaine.
- Commun : domaine, durée estimée, première petite action.

En modification, les champs sont pré-remplis et le type peut changer (une tâche devient une routine en gardant son historique).

---

## 6. Le moteur de tri

### 6.1 Ce qu'il trie

Les **tâches** actives, non faites aujourd'hui, dont la fenêtre horaire éventuelle est ouverte. Les routines ne sont pas triées : elles s'affichent par moment de la journée.

### 6.2 Le score

Chaque tâche reçoit un score entre 0 et 1, somme pondérée de six composantes elles-mêmes ramenées entre 0 et 1.

| Composante | Poids | Calcul                                                                                                                                                                  |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Importance | 0,25  | Importance déclarée : 1 → 0 ; 2 → 0,5 ; 3 → 1                                                                                                                           |
| Moment     | 0,20  | Proximité entre l'heure actuelle et le bon moment de la tâche (heure réelle observée en priorité, sinon moment déclaré). Nulle au-delà de 4 h d'écart ; 0,5 sans repère |
| Équilibre  | 0,20  | 1 si le domaine a été délaissé ces 7 derniers jours, 0 s'il est sur-servi, 0,5 si neutre                                                                                |
| État       | 0,15  | Adéquation entre l'effort de la tâche et l'énergie du dernier check-in du jour. Une énergie basse écarte les tâches coûteuses                                           |
| Urgence    | 0,12  | 0 sans échéance, monte à l'approche de l'échéance (horizon de 14 jours), 1 en retard                                                                                    |
| Négligence | 0,08  | Nombre de jours où la tâche a été proposée sans être faite, saturé à 5                                                                                                  |

Les poids sont fixés à la main, ce qui permet au système de fonctionner dès le premier jour sans historique. L'observation accumulée corrige les composantes (heure réelle, négligence, équilibre), pas les poids.

### 6.3 La sélection

- Trois tâches ou moins : tout est affiché.
- Au-delà : les deux meilleures, plus une place d'**exploration** réservée à la tâche la plus négligée parmi les autres. L'écran n'est jamais figé et aucune tâche ne disparaît pour toujours.

Chaque carte affiche la raison de sa présence, tirée de la composante qui pèse le plus (« Échéance proche », « Pour varier les domaines », « Revient dans la boucle »…).

### 6.4 Équilibre entre domaines

Pour chaque domaine utilisé par la personne, on compare le nombre de complétions des 7 derniers jours à une part équitable (total ÷ nombre de domaines utilisés). Score = 1 − complétions ÷ (2 × part équitable), borné entre 0 et 1. Un domaine sans aucun item actif reste neutre.

### 6.5 Filet anti-oubli

Au premier lancement de chaque jour, pour chaque jour révolu depuis le dernier traitement, les tâches proposées ce jour-là mais non faites voient leur compteur de négligence augmenter de 1. Les jours où l'appli n'a pas été ouverte sont rattrapés. Compléter une tâche remet son compteur à zéro.

### 6.6 Journal des décisions

Les propositions de la première ouverture de chaque jour sont enregistrées dans `decision_log`, avec le score, le détail des composantes, le rang et l'énergie du moment. Ce journal sert à déboguer le tri et à mesurer s'il est suivi.

---

## 7. Domaines

| Domaine         | Couleur     | Contenu                                           |
| --------------- | ----------- | ------------------------------------------------- |
| 🌙 Sommeil      | Bleu-indigo | Réveil, coucher, rythme                           |
| 🏃 Mouvement    | Terracotta  | Activité physique, pauses actives                 |
| 🗂️ Organisation | Olive       | Rangement, préparation, capture                   |
| 🎯 Focus        | Ocre        | Concentration et démarrage                        |
| 🎨 Compétences  | Prune       | Apprendre, pratiquer, créer (instrument, langue…) |

Le catalogue de routines couvre les quatre premiers domaines (20 familles). Chaque famille propose plusieurs variantes de difficulté croissante, une première action, une justification et une source. Le domaine Compétences sert aux routines et tâches créées librement.

---

## 8. Check-in d'état

Trois questions à trois niveaux : énergie, concentration, humeur.

| Règle                                               | Valeur                                          |
| --------------------------------------------------- | ----------------------------------------------- |
| Invitations par jour                                | 3 au maximum                                    |
| Écart minimal entre deux invitations                | 3 heures                                        |
| Pause après un refus (croix)                        | 1 heure                                         |
| Nouveau check-in à moins de 30 minutes du précédent | Corrige le précédent au lieu d'en ajouter un    |
| Points                                              | +5 pour chacun des 3 premiers check-ins du jour |

L'heure exacte est enregistrée. Le moment de la journée (matin avant 12 h, après-midi jusqu'à 18 h, soir ensuite) est déduit à l'affichage. Le moteur utilise le check-in le plus récent de la journée ; celui de la veille n'est jamais utilisé.

---

## 9. Progression

### 9.1 Périodes

Un sélecteur Jour / Semaine / Mois (aujourd'hui, 7 et 30 derniers jours glissants) pilote le taux global, les anneaux et la liste des tâches faites.

### 9.2 Routine attendue

Une règle unique, partagée par l'accueil et Progression, dit si une routine est attendue un jour donné : jamais avant sa création ; toujours le jour de sa création ; les jours choisis pour une routine « certains jours » ; le même jour de la semaine que sa création pour une routine hebdomadaire ; tous les jours sinon. Un jour non prévu ne compte jamais comme raté.

### 9.3 Contenu

- **Taux global** : routines faites ÷ routines attendues sur la période (une complétion partielle compte pour moitié).
- **Anneaux par domaine** : même calcul par domaine, avec le nombre de tâches faites dans ce domaine.
- **Tâches faites** : liste avec date et domaine. Toucher une tâche permet de la remettre à faire si elle a été cochée par erreur.
- **Comment tu vas, selon le moment** : jauges d'énergie, de concentration et d'humeur par moment de la journée, uniquement pour les moments où la personne a répondu. La période annoncée suit les données réelles (« Aujourd'hui », « Ces deux derniers jours », « Ces 12 derniers jours »). La phrase de conclusion ne compare deux moments que s'ils ont chacun au moins 2 réponses, et seulement si leurs jauges diffèrent.
- **Ce que l'appli apprend** : voir 11.
- **Calendrier du mois** : chaque jour coloré selon son intensité, de 0 à 4. Score du jour = part des routines attendues faites + 0,25 par tâche terminée, plafonné à 1. Toucher un jour ouvre son récapitulatif : taux, barres par domaine, check-ins avec leur heure, liste de ce qui a été fait (jamais de ce qui manque).
- **Année** : une ligne par mois, une case par jour, même échelle. Les jours antérieurs à la première utilisation restent neutres.

---

## 10. Ajustements suggérés

L'appli observe, propose, et la personne décide. Aucun changement visible n'est appliqué sans son accord.

| Situation                                         | Condition                                                                                                                                                              | Proposition                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Une routine a du mal à tenir                      | Au moins 7 jours prévus sur les 14 derniers, faite moins de 3 fois sur 10                                                                                              | Version plus simple (routine du catalogue) ou allègement via l'écran de modification (routine libre) |
| Une routine est faite à un autre moment que prévu | Au moins 5 complétions en 21 jours, dont au moins 70 % dans le même moment de la journée, différent du moment prévu. Pas pour une routine rattachée à un moment repère | La déplacer                                                                                          |
| Une routine est bien installée                    | Existe depuis au moins 21 jours, au moins 10 jours prévus sur les 21 derniers, faite au moins 8 fois sur 10                                                            | Version suivante (catalogue) ou ajout d'une nouvelle routine                                         |

Règles d'affichage :

- une seule suggestion à la fois, sur l'accueil, avec les données qui la justifient (« Faite 2 fois sur 14 ces deux dernières semaines ») ;
- au plus une décision par jour ;
- une suggestion acceptée ou écartée (« Pas maintenant ») ne revient pas avant 14 jours ;
- priorité : aider ce qui ne tient pas, puis caler les horaires, puis faire avancer ;
- aujourd'hui n'est jamais compté : la journée n'est pas finie.

Les seuils sont regroupés en tête de `lib/db/suggestions.ts`.

---

## 11. Mesure

Deux indicateurs sont affichés dans Progression :

- la part des tâches proposées par le moteur qui ont été faites le jour même, sur 14 jours ;
- le nombre de suggestions acceptées sur le nombre de suggestions décidées.

Ces indicateurs disent si les propositions sont suivies, pas si le tri aide mieux qu'un autre ordre : une tâche proposée peut être faite parce qu'elle était facile. Pour mesurer un effet, il faudra une comparaison (voir 15).

---

## 12. Gamification et éthique

- **Points** : 10 par routine ou tâche complète, 5 si partielle, 5 par check-in (3 premiers du jour). Niveau = points ÷ 100, arrondi à l'inférieur, + 1.
- **Série** : nombre de jours consécutifs avec au moins une complétion. Tant que la journée n'est pas finie, la série de la veille est conservée.
- **Intensité réglable** par profil : aucune, discrète, complète.

Principes :

- aucun point retiré quand une série s'arrête ; seule l'annulation immédiate d'une complétion reprend ses points ;
- pas de récompense aléatoire, pas de notification culpabilisante ;
- les invitations (check-in, suggestions) sont toujours refusables, et un refus est respecté ;
- les données restent sur le téléphone ;
- l'onglet Infos rappelle que l'appli ne remplace pas un avis médical et donne un accès direct au 3114.

---

## 13. Autres fonctions

- **Moments repères** : rattacher une routine avant ou après un moment déjà ancré dans la journée (le café, le brossage de dents…).
- **Rappel quotidien** : une notification à l'heure choisie.
- **Pause** : minuteur de focus (durée prévue et durée réelle enregistrées) et respiration guidée en cohérence cardiaque.
- **Infos** : astuce du jour, cartes dépliables sourcées, astuces filtrables par domaine, explication du fonctionnement de l'appli, aide.
- **Réinitialisation** : supprime la base, annule les rappels et relance l'initialisation, comme une première installation. « Refaire l'onboarding » permet de changer de profil sans rien perdre.

---

## 14. Choix de conception

| Choix                                                      | Alternative écartée                      | Raison                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Trois tâches à l'écran, le reste masqué                    | Liste complète                           | Choisir dans une longue liste coûte exactement l'énergie qui manque                              |
| Routines et tâches sur le même écran, en deux blocs        | Deux onglets séparés                     | Ce qui n'est pas sous les yeux est oublié                                                        |
| Moteur explicable (score par composantes, raison affichée) | Modèle appris opaque                     | Confiance, débogage, et fonctionnement dès le premier jour                                       |
| Poids fixés à la main                                      | Poids appris                             | Pas assez de données au début ; l'observation corrige les composantes                            |
| Check-in selon le temps écoulé, 3 fois par jour au plus    | Créneaux fixes matin / soir              | La bascule à heure fixe posait la question au mauvais moment                                     |
| Affichage de l'état selon les données disponibles          | Colonnes fixes matin / après-midi / soir | Ne pas afficher ce que les données ne permettent pas de dire                                     |
| Anneaux par domaine                                        | Camembert                                | Le camembert montre une répartition, déjà visible sur l'accueil ; les anneaux montrent l'avancée |
| Suggestions à valider                                      | Ajustements automatiques                 | Un changement visible imposé casse la confiance                                                  |
| Récapitulatif d'un jour : seulement ce qui a été fait      | Liste de ce qui manque                   | Revenir sur un jour passé ne doit pas devenir une liste de reproches                             |
| Onglet Infos                                               | Onglet Jardin (compagnon)                | La psychoéducation apporte davantage à ce stade ; le code du compagnon est conservé              |

Pistes explorées puis mises de côté : un monde en pixel art à explorer (déplacement horizontal, maisons par thème), une maison à décorer avec des meubles gagnés, un éditeur de meubles, des outils débloquant des zones. Elles relevaient d'un jeu plus que d'un outil, et représentaient une charge de création d'assets hors de portée en solo.

---

## 15. Limites et perspectives

**Limites connues**

- La mesure de l'effet du tri n'a pas de point de comparaison.
- Les rares complétions enregistrées entre minuit et 2 h du matin avant le passage à l'heure locale restent comptées la veille.
- Le catalogue n'a pas encore de familles pour le domaine Compétences.
- Aucun test auprès d'utilisateurs autres que la conceptrice.

**Perspectives**

- **Jour témoin** : un jour par semaine, les trois tâches tirées au hasard, pour comparer les taux de réussite avec les jours triés. Un vrai protocole expérimental, au prix d'une expérience un peu dégradée ce jour-là.
- **Tests utilisateurs** avec des adultes TDAH : compréhension du tri, acceptation des suggestions, charge perçue.
- **Rappels adaptatifs**, calés sur l'heure réelle des complétions.
- **Retour du compagnon**, dans Progression, comme récompense visuelle de la régularité.
- **Classification automatique** des routines créées librement (domaine, effort), aujourd'hui faite par mots-clés.
- **Nouveaux domaines** : santé au sens large, connaissance de soi.
