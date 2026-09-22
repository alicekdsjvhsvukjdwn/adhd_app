# Cahier des charges — Application TDAH

## 1. Concept général

Application mobile "tout-en-un" d'aide au quotidien pour personnes TDAH, appuyée sur la littérature scientifique (pas seulement un suivi de routines). L'application combine un suivi d'habitudes gamifié, une couche d'adaptation automatique en arrière-plan, et un espace visuel de récompense.

Objectif du projet : dossier UX / portfolio pour la recherche d'emploi (data / UX).

Stack technique : React Native + Expo. Développement sous Windows (PowerShell). Projet local `tdah-routines`, dépôt GitHub `adhd_app`.

## 2. Direction artistique

- Style pixel/2D façon premiers Pokémon
- Application classique à quelques écrans avec décor pixel — pas de monde explorable ni de déplacement horizontal en v1 (reporté en vision v2)
- Personnage imposé (non créé par l'utilisateur), qui gagne des items au fil de l'usage selon les progrès réels
- Interface pensée ambidextre dès le départ (pas de question gaucher/droitier) : actions principales centrées ou accessibles des deux côtés, navigation en bas de l'écran, aucune action critique reléguée dans un seul coin

## 3. Structure de l'application (5 écrans)

### 3.1 Aujourd'hui
- Liste des routines du jour, triées automatiquement par ordre d'importance décroissante
- Chaque routine affiche son état (fait / à faire) et le gain associé
- Écran d'entrée principal, celui ouvert plusieurs fois par jour

### 3.2 Détail / édition d'une routine
- Créer ou modifier une routine
- Champs :
  - **Nom** : court, libre
  - **Fréquence** : ponctuelle ou récurrente (jours concernés si récurrente)
  - **Type de progression** : action simple (fait / pas fait) ou seuil (nombre à atteindre)
  - **Importance** : essentiel / utile / bonus — pilote le tri de l'écran Aujourd'hui
  - **Horaire** : un seul créneau dans la journée à la création (volontairement minimal)
- L'évolution de l'horaire est ensuite gérée par la couche adaptative, sous forme de suggestion à valider (voir section 4)

### 3.3 Progression
- Statistiques de suivi
- Séries (streaks)
- Historique des complétions

### 3.4 Scène / jardin
- Espace visuel gamifié où vit le personnage imposé
- Le personnage évolue et gagne des items selon les progrès réels (séries, routines complétées)
- Lien direct entre gain concret et récompense visuelle
- Remplace le monde explorable de l'ancienne version

### 3.5 Réglages
- Préférences générales
- Gestion des ajustements automatiques (consultation de l'historique, annulation)

## 4. Logique adaptative en arrière-plan

Cœur du produit : une couche qui tourne en arrière-plan pour s'adapter à la personne et trier automatiquement ce qui est déposé dans l'application.

### Données observées
- Heures de complétion des routines
- Taux de réussite par routine
- Régularité / irrégularité
- Moments d'abandon ou de décrochage

### Ajustements invisibles (appliqués automatiquement)
- Appliqués sans intervention de l'utilisateur
- Historique consultable et possibilité d'annuler
- Exemples : réordonnancement fin, ajustement des rappels

### Ajustements visibles (suggérés à valider)
- Proposés explicitement, l'utilisateur valide ou refuse
- Exemples : proposition de faire évoluer l'horaire d'une routine (à partir de l'heure de complétion réelle observée), suggestion de désactiver un module peu suivi

## 5. Types de routines / quêtes

Deux axes combinables :
- **Fréquence** : ponctuelle (acquise une fois) ou récurrente (se réinitialise, typiquement quotidienne)
- **Progression** : action simple (fait / pas fait) ou seuil/compteur (ex : 3/3 verres d'eau)

Importance : déclarée par l'utilisateur à la création sur 3 niveaux (essentiel / utile / bonus), sert au tri d'affichage sur l'écran Aujourd'hui.

## 6. Thèmes de contenu (v1)

Maximum 5-6 thèmes, la profondeur du contenu grandit plutôt que le nombre de thèmes (limite la charge de création en solo) :
- Sommeil
- Eau / hydratation
- Mouvement
- Concentration
- Organisation
- Connaissance de soi (quêtes de lecture / réflexion sur le TDAH, plusieurs quêtes faciles par jour ; la progression ici influence les récompenses ailleurs)

## 7. Récompenses

- Items / meubles pré-faits gagnés selon les progrès réels
- Affichés dans la scène / jardin autour du personnage
- Éditeur de création de meubles : reporté en v2

## 8. Points d'écran à finaliser (théorie en cours)

- Onboarding (2 écrans) : présentation de l'appli via le personnage imposé, puis création guidée d'une première routine (évite l'écran vide au démarrage)
- Écran de récompense / déblocage (célébration à la complétion)

## 9. Vision v2 (reporté, à ne pas construire maintenant)

- Monde explorable en 2D horizontal (déplacement façon Mario, carte des mondes, maisons-thèmes, monuments interactifs, effet de défilement)
- Maison personnelle façon Sims (grille de placement des meubles)
- Éditeur pixel art pour créer ses propres meubles
- Outils et obstacles : éléments de décor bloqués débloqués par un outil polyvalent, donnant accès à des coffres
- Système de paliers de déblocage combinés (points + jours)
- Thème Santé (large, transversal)

## 10. Modèle de données (aperçu)

- `Utilisateur` : réglages
- `Personnage` : apparence imposée, items gagnés
- `Routine` : nom, fréquence, type de progression, valeur seuil, progression actuelle, importance (essentiel / utile / bonus), horaire, récompense associée, dernière complétion
- `Progression` : séries, historique de complétions
- `Item` : nom, sprite, condition d'obtention
- `Ajustement` : type (invisible / suggéré), donnée source, état (appliqué / proposé / annulé), horodatage