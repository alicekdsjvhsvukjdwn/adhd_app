Roadmap — Appli TDAH (routines adaptatives)
Introduction — Cadrage du projet

Aider au quotidien avec le TDAH via une appli modulaire et adaptative, en tenant compte de la variabilité des profils (plutôt qu'une solution unique pour tous). Double objectif : outil réellement utile + démonstration de compétences (data, UX, dev) pour portfolio.

I. Conception : comprendre avant de construire
A. Recherche utilisateur et cadrage du problème — interviews, fonctions exécutives touchées différemment selon les profils, point d'entrée clair (routines) avant extension.
B. Modélisation des données — schéma initial (routines, completions, settings, badges), évolution vers event_log pour l'adaptativité.
C. Conception des mécaniques de jeu — streaks non punitifs, récompenses variables, gamification désactivable (paramètre, pas couche imposée).
II. Fondations techniques
A. Environnement — React Native/Expo, VS Code, Git/GitHub. (fait)
B. Persistance et CRUD — SQLite local, routines + historique par date. (fait)
C. Architecture logicielle — découpage lib/db.ts en fichiers par domaine, hook useRoutines(), state manager (Zustand). (à faire — priorité actuelle)
III. Couche adaptative
A. Collecte de signaux comportementaux — table event_log (type, routine, timestamp, contexte).
B. Moteur de règles et de scoring — score composite pondéré par routine (taux de complétion récent, tendance, écart horaire, variance jour/semaine) plutôt que règles binaires.
C. Suggestions, réversibilité et confiance — classification suggestion explicite vs auto-appliqué silencieux (règle : tout ce qui touche aux 3 axes de personnalisation = suggestion ; plomberie interne = silencieux). Journal d'ajustements consultable/annulable.
IV. Fonctionnalités produit
A. Rappels et notifications — expo-notifications, alimente aussi event_log.
B. Personnalisation transversale et onboarding — 3 axes (intensité gamification, ton, rigidité horaire), questionnaire comportemental initial (pas clinique).
C. Récompenses visibles — badges, niveaux, indicateurs de progression.
D. Extension modulaire — deuxième module (focus/pomodoro ou tâches) pour valider que l'architecture scale.
V. Qualité, fiabilité et méthode
A. Robustesse — gestion d'erreurs, états de chargement, cas limites.
B. Tests — tests unitaires sur logique pure (streak, scoring).
C. Process — branches par feature, GitHub Projects tenu à jour, doc continue.
VI. Valorisation portfolio
A. Déploiement — build EAS (.apk/.ipa) ou export web (Vercel).
B. Documentation technique — README (stack, architecture, captures, lancement).
C. Mise en récit — case study expliquant les choix (scoring, suggestion/silencieux, résultats des tests utilisateurs).
Conclusion — Perspectives (hors scope V1)

Clustering multi-utilisateurs, backend partagé, étude longitudinale sur l'efficacité réelle des adaptations.

Étape en cours : II.C (refactor architecture)
