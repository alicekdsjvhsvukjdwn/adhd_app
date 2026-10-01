# Cahier des charges — Application d'aide au quotidien pour le TDAH

_Document de référence du projet `tdah-routines` (dépôt GitHub `adhd_app`). Il décrit l'application telle qu'elle fonctionne, avec les règles et les seuils tels qu'ils sont dans le code._

---

## 1. Le projet

### 1.1 Le problème

Les applications de suivi d'habitudes demandent à l'utilisateur de faire lui-même ce que le TDAH rend difficile : trier, choisir par quoi commencer, se souvenir de revenir, tenir une liste à jour. Elles affichent tout, tout le temps, et sanctionnent souvent la moindre interruption (série perdue, points retirés).

### 1.2 La thèse

**L'utilisateur dépose, l'appli décide.** La personne note ce qu'elle a à faire en quelques secondes. Une couche cachée trie et priorise à sa place, en tenant compte de l'importance, de l'échéance, du moment de la journée et de l'équilibre entre les domaines de sa vie, sans rien lui demander de plus. L'écran principal ne montre que ce qui compte maintenant.

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
| Réduire les distractions en amont, organiser, planifier.                                                                                        | Safren et al. (2010), TCC du TDAH de l'adulte | Découpage des tâches en étapes, tri automatique                 |
| Les intentions de mise en œuvre (« quand X, alors Y ») augmentent nettement le passage à l'acte.                                                | Gollwitzer & Sheeran (2006), méta-analyse     | Moments repères (ancres)                                        |
| Rythme circadien souvent décalé chez l'adulte avec TDAH.                                                                                        | Kooij & Bijlenga (2013) ; Kooij et al. (2019) | Routines de sommeil, prise en compte du moment de la journée    |
| Mesures courtes et répétées dans la journée plutôt qu'un bilan rétrospectif.                                                                    | Méthode d'échantillonnage d'expérience (EMA)  | Bilan de la journée en un tap, facultatif                       |

Chaque famille du catalogue porte sa justification et, quand elle existe, sa source.

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
  (tabs)/          Onglets : index (Routines), taches, recompenses, progression, profil
  _layout.tsx      Démarrage : initialisation de la base, écoute des notifications
  nouvelle-tache.tsx   Ajouter / modifier / supprimer une tâche ou une routine
  mes-routines.tsx     Toutes les routines par domaine, suggestion d'ajustement
  onboarding.tsx, mise-en-place.tsx   Mise en place guidée (premier lancement, puis depuis Profil)
  problemes.tsx, ancres.tsx, rappels.tsx, reglages.tsx
  scene.tsx        Essai de scène en pixel art, hors navigation
components/        MiseEnPlace, CalendrierMois, BilanJournee, CarteSuggestion, CarteSauvegarde, BoutonReinitialiser
hooks/             useRoutines
lib/
  dates.ts         Toutes les dates de calendrier, en heure locale
  versions.ts      Versions d'une routine (courte les jours difficiles)
  moteur-regles.ts, routines-maintenant.ts, modification-item.ts, sauvegarde-format.ts
                   Logique pure, testée par npm test (tests/)
  theme.ts, theme-categories.ts
  catalogue/       Difficultés et familles de routines, en TypeScript
  db/              Accès aux données, moteur, suggestions, récompenses, migrations
  db.ts            Réexporte les modules de db/
docs/              Ce document, conception de la mise en place guidée
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
| 7       | `difficultes` (choisies à la mise en place)                                         |
| 8       | Versions courte et longue des routines, version faite, `etapes` des tâches          |
| 9       | `recompenses` et `achats`                                                           |
| 10      | `etat` : concentration et humeur facultatives (bilan de la journée)                  |

La table `sessions` n'est plus alimentée depuis la suppression de l'onglet Pause ; elle est conservée, car on ne modifie pas une migration passée.

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
| `categorie`                                                  | Domaine : sommeil, mouvement, organisation, focus, emotions, competences      |
| `moment`                                                     | Moment de la journée prévu                                                    |
| `importance`                                                 | 1 bonus, 2 utile, 3 essentiel                                                 |
| `echeance`                                                   | Date limite d'une tâche                                                       |
| `duree_min`, `effort`                                        | Durée et difficulté (1 facile, 2 moyenne, 3 exigeante), selon l'énergie       |
| `version_courte`, `version_longue`                           | Versions d'une routine écrites par la personne (sinon : catalogue)            |
| `premiere_action`                                            | La petite action qui permet de démarrer                                       |
| `ancre_id`, `ancre_position`                                 | Rattachement à un moment repère (avant / après)                               |
| `template_id`, `variante_rang`                               | Provenance du catalogue et niveau de difficulté                               |
| `fenetre_debut_h`, `fenetre_fin_h`                           | Contrainte externe (ex. un service ouvert de 9 h à 17 h)                      |
| `heure_reelle_moy`, `duree_reelle_moy_min`, `nb_completions` | Observation accumulée                                                         |
| `nb_propositions_sans_action`                                | Compteur de négligence                                                        |

### 4.2 Autres tables

| Table          | Contenu                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `completions`  | Une ligne par item et par jour : statut (complet, partiel), heure, durée réelle, version faite |
| `etapes`       | Étapes d'une grosse tâche, dans l'ordre, faites ou non                          |
| `decision_log` | Ce que le moteur a proposé, avec le score et le détail de ses composantes       |
| `etat`         | Bilans de la journée (énergie seule) et anciens check-ins (énergie, concentration, humeur, 1 à 3), avec l'heure exacte |
| `suggestions`  | Décisions prises sur les ajustements proposés (acceptée, refusée)               |
| `difficultes`  | Difficultés choisies à la mise en place                                         |
| `recompenses`  | Récompenses réelles choisies par la personne, avec leur prix en points          |
| `achats`       | Récompenses achetées ; nom et prix recopiés pour garder l'historique            |
| `ancres`       | Moments repères ; 8 pré-remplis, désactivés par défaut                          |
| `stats`        | Points gagnés au total, meilleure série, réglage du rappel quotidien            |
| `preferences`  | Intensité de la gamification, ton, rigidité horaire, onboarding fait            |
| `meta`         | Valeurs techniques, dont l'énergie choisie pour la journée                      |
| `event_log`    | Journal des événements (ajouts, complétions, notifications…)                    |
| `sessions`     | Héritée de l'onglet Pause, plus alimentée                                       |

---

## 5. Écrans

| Écran                  | Rôle                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Routines**           | Que faire maintenant : les routines du jour, rangées par moment, et « Jour difficile » |
| **Tâches**             | Saisie en une ligne, tâches triées par le moteur, étapes des grosses tâches             |
| **Récompenses**        | Solde de points, récompenses personnelles, achats                                       |
| **Progression**        | Ce qui avance : taux, domaines, tâches faites, état selon le moment, calendrier, année  |
| **Profil**             | Idées de routines, moments repères, rappels, réglages, sauvegarde, réinitialisation     |
| Ajouter / Modifier     | Saisie d'une tâche ou d'une routine, correction, suppression                            |
| Mes routines           | Toutes les routines actives par domaine, suggestion d'ajustement, modifier, supprimer   |
| Mise en place guidée   | Choix de routines à partir des difficultés (voir `docs/mise-en-place-guidee.md`)        |

Au premier lancement, la mise en place guidée sert d'onboarding. Elle reste accessible depuis Profil → Idées de routines.

L'interface est pensée pour être utilisable d'une main, quelle qu'elle soit : actions principales pleine largeur ou centrées, navigation en bas.

Les routines et les tâches ne sont pas mélangées : les routines se font toutes, chaque jour prévu (l'enjeu est la régularité) ; les tâches doivent être filtrées (l'enjeu est la priorisation).

### 5.1 Routines

L'écran ne répond qu'à « que dois-je faire maintenant ? ». De haut en bas :

1. **En-tête** : « Routines » et « + » (formulaire court en mode routine).
2. **Jour difficile** : un interrupteur valable pour la journée seulement (voir 5.5).
3. **Série de N jours · N faites** : la série si les points et la série sont activés et qu'elle vaut au moins 1 ; « N faites » dès qu'une routine est faite, même sans points. Jamais de compteur « faites / prévues ».
4. **Les routines prévues aujourd'hui, par moment** : Matin, Après-midi, Soir, À tout moment (le moment repère prime sur le moment déclaré). Le moment en cours (matin avant 12 h, après-midi jusqu'à 18 h, soir ensuite) et « À tout moment » sont dépliés ; les autres tiennent sur une ligne, « Matin · 3 routines », et se déplient d'un tap. Un moment passé se présente exactement comme un moment à venir : pas de mot de reproche.
5. **Gérer mes routines** : lien vers l'écran du même nom, avec « · 1 suggestion » en texte neutre quand une suggestion attend (jamais en jour difficile).

**Une ligne de routine** : une case à cocher, l'action en gros (la version du jour), le déclencheur en petit gris (« Après le café ») s'il y en a un. Rien d'autre. Toucher coche ou décoche, avec un retour haptique ; ce qui est fait est grisé et descend en bas de son moment.

Sans routine, une carte mène à la mise en place guidée. Modifier et supprimer se font depuis « Mes routines ».

### 5.1 bis Mes routines

Toutes les routines actives, prévues aujourd'hui ou non, rangées par domaine, avec « Rien pour l'instant · Trouver une idée » pour un domaine vide et un groupe « Sans domaine ». La suggestion d'ajustement s'y affiche (voir 10), sauf un jour difficile. Toucher une routine ouvre sa modification ; la glisser vers la gauche propose de la supprimer, avec confirmation.

### 5.2 Tâches

1. **Noter en une ligne** : le nom suffit, le domaine est deviné par mots-clés. « Plus d'options » ouvre l'écran complet.
2. **À faire maintenant** : les propositions du moteur (voir 6), avec la raison du choix, la durée et la première action. Une tâche sans étapes propose « Découper en étapes » ; une tâche découpée affiche ses étapes, une barre de progression et l'étape suivante en gras.
3. **Plus tard** : le reste du classement, replié par défaut.
4. **Calendrier du mois** des tâches.

Après avoir coché une tâche ou une étape, un bandeau « Annuler » reste affiché 6 secondes.

### 5.3 Ajouter / Modifier

Un seul écran, avec un choix en haut : **Une fois** (tâche) ou **Régulièrement** (routine). Seul le nom est obligatoire. Pour une tâche, le formulaire court ne montre que le nom ; pour une routine, le nom, le moment et les jours. Tout le reste est dans « Plus d'options », ouvert d'office en modification.

- Tâche : importance (essentiel, utile, bonus), échéance (aucune, aujourd'hui, demain, dans 3 jours, 1 semaine, 2 semaines), étapes.
- Routine : moment (matin, après-midi, soir, à tout moment), jours de la semaine, difficulté (facile, moyenne, exigeante), version courte, moment repère (« Aucun » ou un moment repère actif, avant ou après, « après » par défaut ; un lien mène à « Mes moments repères » s'il n'y en a aucun).
- Commun : domaine, durée estimée, première petite action.

Une tâche n'a pas de difficulté : son coût se lit dans sa durée estimée, si elle est donnée.

En modification, les champs sont pré-remplis et le type peut changer (une tâche devient une routine en gardant son historique). Un bouton « Supprimer cette routine / tâche » est visible en bas, avec confirmation. Changer le moment repère ne touche qu'à l'item : les complétions passées restent, et la routine se range au moment de son nouveau repère.

**Supprimer** (depuis Mes routines, l'écran de modification ou l'onglet Tâches) efface l'item, ses complétions et ses étapes. Les points gagnés restent (aucun point n'est retiré, voir 12). Comme Progression et la série se calculent à partir des complétions et des routines existantes, l'item disparaît aussi des jours passés, et la série peut baisser si c'était la seule chose faite un jour donné. Le message de confirmation dit tout cela, le même partout (`confirmationSuppression`, `lib/db/items.ts`) : « « … » et son historique seront effacés. Elle disparaîtra aussi des jours passés dans Progression, et ta série peut changer. Tes points restent. »

### 5.4 Versions d'une routine

La normale est la routine telle qu'elle est. La courte est celle écrite par la personne ; à défaut, pour une routine du catalogue, le niveau le plus simple de la famille ; sinon, la normale. Un jour difficile, la courte s'affiche ; sinon, la normale. Les deux rapportent les mêmes points.

La version longue n'est plus saisie ni affichée. Celles déjà écrites restent en base, et l'enregistrement d'une routine les réécrit telles quelles.

### 5.5 Jour difficile

Un interrupteur sur l'écran Routines, stocké dans `meta` pour la journée : le lendemain, il repart désactivé. Chaque activation et désactivation est enregistrée dans `event_log` (`jour_difficile_active`, `jour_difficile_desactive`), ce qui garde l'historique des jours difficiles.

Effets : toutes les routines en version courte ; les routines exigeantes non faites rangées dans « Si l'énergie revient », repliée ; pas de suggestion d'ajustement.

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
| État       | 0,15  | Constante à 0,5 : le moteur ne lit aucune énergie (ni bilan, ni choix à la main). Le poids est gardé pour que les scores restent comparables à ceux déjà enregistrés ; une constante ne change pas l'ordre du classement |
| Urgence    | 0,12  | 0 sans échéance, monte à l'approche de l'échéance (horizon de 14 jours), 1 en retard                                                                                    |
| Négligence | 0,08  | Nombre de jours où la tâche a été proposée sans être faite, saturé à 5                                                                                                  |

Les poids sont fixés à la main, ce qui permet au système de fonctionner dès le premier jour sans historique. L'observation accumulée corrige les composantes (heure réelle, négligence, équilibre), pas les poids.

### 6.3 La sélection

- Trois tâches ou moins : tout est affiché.
- Au-delà : les deux meilleures, plus une place d'**exploration** réservée à la tâche la plus négligée parmi les autres. L'écran n'est jamais figé et aucune tâche ne disparaît pour toujours.
- Le reste du classement est rangé dans « Plus tard », replié.

Chaque carte affiche la raison de sa présence, tirée de la composante qui pèse le plus (« Échéance proche », « Pour varier les domaines », « Revient dans la boucle »…). La composante État, constante, n'est jamais une raison ; si aucune composante ne pèse, la carte dit « À faire quand tu peux ».

### 6.4 Équilibre entre domaines

Pour chaque domaine utilisé par la personne, on compare le nombre de complétions des 7 derniers jours à une part équitable (total ÷ nombre de domaines utilisés). Score = 1 − complétions ÷ (2 × part équitable), borné entre 0 et 1. Un domaine sans aucun item actif reste neutre.

### 6.5 Filet anti-oubli

Au premier lancement de chaque jour, pour chaque jour révolu depuis le dernier traitement, les tâches proposées ce jour-là mais non faites voient leur compteur de négligence augmenter de 1. Les jours où l'appli n'a pas été ouverte sont rattrapés. Compléter une tâche remet son compteur à zéro.

### 6.6 Journal des décisions

Les propositions de la première ouverture de chaque jour sont enregistrées dans `decision_log`, avec le score, le détail des composantes et le rang (la colonne d'énergie reste vide depuis que le moteur n'en lit plus). Ce journal sert à déboguer le tri et à mesurer s'il est suivi.

---

## 7. Domaines

| Domaine         | Couleur     | Contenu                                           |
| --------------- | ----------- | ------------------------------------------------- |
| 🌙 Sommeil      | Bleu-indigo | Réveil, coucher, rythme                           |
| 🌿 Corps        | Terracotta  | Bouger, manger, boire, traitement                 |
| 🗂️ Organisation | Olive       | Rangement, temps, administratif, capture          |
| 🎯 Focus        | Ocre        | Concentration et démarrage                        |
| 💭 Émotions     | Bleu-vert   | Charge mentale, émotions, détente                 |
| 🎨 Compétences  | Prune       | Apprendre, pratiquer, créer, garder le lien       |

Le domaine Corps garde l'identifiant interne `mouvement`.

Le catalogue couvre les six domaines (42 familles). Chaque famille propose plusieurs variantes de difficulté croissante, les difficultés auxquelles elle répond, une première action, un moment repère suggéré, une justification et, quand elle existe, une source. Les 34 difficultés de la mise en place sont dans `lib/catalogue/difficultes.ts`.

---

## 8. Bilan de la journée

En haut de Progression : « Comment était ta journée ? », trois choix en un tap (Difficile, Moyenne, Bonne).

- Facultatif : pas d'invitation, pas de rappel, pas de points.
- Un seul bilan par jour : toucher un autre choix remplace le premier.
- Enregistré dans `etat` avec l'énergie seule (concentration et humeur vides) et l'heure du tap.
- **Jamais lu par le moteur ni par l'affichage des routines** : sans bilan, rien ne change.

Les anciens check-ins à trois questions (énergie, concentration, humeur) restent en base. Seuls eux alimentent les jauges « Comment tu vas, selon le moment » et le récapitulatif d'un jour : un bilan ne dit rien d'un moment précis.

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
- **Comment était ta journée ?** : le bilan du jour (voir 8), en haut de l'écran.
- **Comment tu vas, selon le moment** : jauges d'énergie, de concentration et d'humeur par moment de la journée, calculées sur les anciens check-ins complets seulement, et uniquement pour les moments où la personne a répondu. La période annoncée suit les données réelles (« Aujourd'hui », « Ces deux derniers jours », « Ces 12 derniers jours »). La phrase de conclusion ne compare deux moments que s'ils ont chacun au moins 2 réponses, et seulement si leurs jauges diffèrent.
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

- une seule suggestion à la fois, dans « Mes routines » (l'écran Routines n'en montre qu'un repère neutre, « · 1 suggestion », sur le lien), jamais un jour difficile, avec les données qui la justifient (« Faite 2 fois sur 14 ces deux dernières semaines ») ;
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

- **Points** : 10 par routine faite (quelle que soit sa version) ou tâche terminée, 5 par étape d'une grosse tâche et 10 de bonus quand toutes sont faites. Le bilan de la journée ne rapporte rien. Niveau = points gagnés au total ÷ 100, arrondi à l'inférieur, + 1.
- **Récompenses** : la personne crée ses propres récompenses réelles (un café, un épisode…) avec un prix en points ; des idées sont proposées, calibrées sur environ 60 points par jour. Solde = points gagnés − achats. Dépenser ne fait jamais baisser le niveau. Un achat peut être annulé le jour même.
- **Série** : nombre de jours consécutifs avec au moins une complétion. Tant que la journée n'est pas finie, la série de la veille est conservée.
- **Intensité réglable** dans Profil → Réglages : aucune (ni points ni série), discrète (série seule), complète.

Principes :

- aucun point retiré quand une série s'arrête ; seule l'annulation immédiate d'une complétion reprend ses points ;
- pas de récompense aléatoire, pas de notification culpabilisante ;
- les suggestions sont toujours refusables, et un refus est respecté ; le bilan de la journée n'est jamais demandé ;
- les données restent sur le téléphone, sauf si la personne exporte une sauvegarde : le fichier contient tout, check-ins et rappels de traitement compris, et l'écran le dit ;
- Profil et la mise en place donnent un accès direct au 3114 ; l'appli rappelle un traitement sans jamais donner de dose ni d'horaire médical.

---

## 13. Autres fonctions

- **Moments repères** : rattacher une routine avant ou après un moment déjà ancré dans la journée (le café, le brossage de dents…).
- **Rappel quotidien** : une notification à l'heure choisie.
- **Mise en place guidée** : choisir une ou deux difficultés, recevoir des routines minuscules adaptées, les rattacher à un moment repère. Détail dans `docs/mise-en-place-guidee.md`.
- **Sauvegarde** (Profil → Mes données) : « Exporter » écrit toutes les tables dans un fichier JSON, avec la version du schéma, et ouvre la feuille de partage. « Restaurer » fait choisir un fichier, le valide entièrement avant de toucher à la base, demande confirmation, puis remplace toutes les données en une seule transaction (tout ou rien) et recale le rappel quotidien. Une sauvegarde d'une version plus récente de l'appli est refusée ; une plus ancienne est reprise colonne par colonne. Format et validation : `lib/sauvegarde-format.ts`.
- **Réinitialisation** : supprime la base, annule les rappels et relance l'initialisation, comme une première installation.

---

## 14. Choix de conception

| Choix                                                      | Alternative écartée                      | Raison                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Trois tâches à l'écran, le reste masqué                    | Liste complète                           | Choisir dans une longue liste coûte exactement l'énergie qui manque                              |
| Routines et tâches dans deux onglets                       | Le même écran, en deux blocs             | _À compléter_                                                                                    |
| Mise en place par les difficultés                          | Choix d'un profil, formulaire            | Reconnaître sa situation dans une liste coûte bien moins que la formuler                         |
| Interrupteur « Jour difficile » (version courte), mêmes points | Sélecteur d'énergie à 3 niveaux      | Une seule décision par jour, et faire la version courte un jour difficile, c'est réussir sa journée |
| Écran Routines limité à « que faire maintenant »           | Statistiques, domaines et calendrier sur le même écran | Tout le reste détourne de l'action ; la gestion va dans « Mes routines »            |
| Moteur explicable (score par composantes, raison affichée) | Modèle appris opaque                     | Confiance, débogage, et fonctionnement dès le premier jour                                       |
| Poids fixés à la main                                      | Poids appris                             | Pas assez de données au début ; l'observation corrige les composantes                            |
| Bilan de la journée en un tap, facultatif, dans Progression | Check-in à trois questions, proposé jusqu'à 3 fois par jour | Chaque question coûte de l'attention ; un tri qui dépendrait des réponses pénaliserait ceux qui ne répondent pas |
| Affichage de l'état selon les données disponibles          | Colonnes fixes matin / après-midi / soir | Ne pas afficher ce que les données ne permettent pas de dire                                     |
| Anneaux par domaine                                        | Camembert                                | Le camembert montre une répartition, déjà visible sur l'accueil ; les anneaux montrent l'avancée |
| Suggestions à valider                                      | Ajustements automatiques                 | Un changement visible imposé casse la confiance                                                  |
| Récapitulatif d'un jour : seulement ce qui a été fait      | Liste de ce qui manque                   | Revenir sur un jour passé ne doit pas devenir une liste de reproches                             |
| Onglet Récompenses (récompenses réelles)                   | Onglet Infos, onglet Jardin (compagnon)  | _À compléter_                                                                                    |

Pistes explorées puis mises de côté : un monde en pixel art à explorer (déplacement horizontal, maisons par thème), une maison à décorer avec des meubles gagnés, un éditeur de meubles, des outils débloquant des zones. Elles relevaient d'un jeu plus que d'un outil, et représentaient une charge de création d'assets hors de portée en solo.

---

## 15. Limites et perspectives

**Limites connues**

- La mesure de l'effet du tri n'a pas de point de comparaison.
- Les rares complétions enregistrées entre minuit et 2 h du matin avant le passage à l'heure locale restent comptées la veille.
- Aucun test auprès d'utilisateurs autres que la conceptrice.

**Points ouverts, à traiter à l'étape 6 (Progression)**

- **Arrêter plutôt que supprimer** : proposer d'arrêter une routine (`archiverItem`, déjà présent) en gardant son passé. Il faut pour cela que Progression compte les routines arrêtées sur les jours où elles existaient (aujourd'hui `routinesSuivies` ne lit que les routines actives) et que la série soit calculée indépendamment de l'existence actuelle des routines.
- **Tâches supprimées dans « Ce que l'appli apprend »** : leurs propositions passées restent dans `decision_log` et comptent comme « proposées, pas faites ». Les exclure du calcul, ou les marquer.

**Perspectives**

- **Jour témoin** : un jour par semaine, les trois tâches tirées au hasard, pour comparer les taux de réussite avec les jours triés. Un vrai protocole expérimental, au prix d'une expérience un peu dégradée ce jour-là.
- **Tests utilisateurs** avec des adultes TDAH : compréhension du tri, acceptation des suggestions, charge perçue.
- **Rappels adaptatifs**, calés sur l'heure réelle des complétions.
- **Retour du compagnon**, dans Progression, comme récompense visuelle de la régularité.
- **Classification automatique** des routines créées librement (domaine, effort), aujourd'hui faite par mots-clés.
- **Nouveaux domaines** : santé au sens large, connaissance de soi.
