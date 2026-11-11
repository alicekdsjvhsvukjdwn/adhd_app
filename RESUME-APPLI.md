# État des lieux de l'appli — 11/11/2026

Lecture seule : rien n'a été modifié. Les tests passent tous (319 sur 319, `npm test`).

---

## 1. Écrans

### Barre d'onglets (dans l'ordre)

| # | Onglet | Fichier |
|---|--------|---------|
| 1 | Routines | `app/(tabs)/index.tsx` |
| 2 | Tâches | `app/(tabs)/taches.tsx` |
| 3 | Ménage | `app/(tabs)/menage.tsx` |
| 4 | Suivi | `app/(tabs)/suivi.tsx` |
| 5 | Récompenses | `app/(tabs)/recompenses.tsx` |
| — | Progression (cachée, sans onglet) | `app/(tabs)/progression.tsx` |
| 6 | Profil | `app/(tabs)/profil.tsx` |

Retoucher l'onglet déjà ouvert ramène à son accueil (`lib/reset-onglet.ts`).

---

### 1. Routines — `app/(tabs)/index.tsx` (787 lignes)
- **Affiche** : l'anneau des 6 domaines (remplissage du jour, bille-soleil qui avance avec l'heure), la rangée des domaines, puis les routines du domaine choisi (ou « Autres », ou « Tout »).
- **Actions** :
  - choisir l'énergie du jour : Difficile / Normal / En forme ;
  - cocher une routine, ou ses étapes (pastilles) ;
  - revenir sur hier ou avant-hier pour cocher après coup (« revenir à aujourd'hui ») ;
  - glisser ou « ⋯ » sur une routine : Modifier, Supprimer ;
  - « + Ajouter une routine ici », « Idées de routines » ;
  - pastille « 💬 Suggestion » (sauf un jour difficile).
- **Ouvre** : `/nouvelle-tache` (ajout ou modification), `/mise-en-place`, la carte suggestion.
- **Composants** : AnneauDomaines, PastilleDomaine, IconeMoment, CarteSuggestion, Options, hook `useRoutines`.

### 2. Tâches — `app/(tabs)/taches.tsx` (1 676 lignes, le plus gros fichier)
- **En haut, un sélecteur** : « Mes tâches » ou « Projets ».
- **Mes tâches affiche** :
  - la bande des jours de la semaine (avec un point les jours de rendez-vous) ;
  - « Mes 3 » du jour : 3 emplacements, puis la section Bonus (en retrait tant que les 3 ne sont pas faites) ;
  - les tâches rangées par liste, avec l'objectif de la liste (barres) ;
  - un jour passé : « Ce qui était prévu », en lecture seule ;
  - les rendez-vous Google Agenda du jour.
- **Actions** :
  - cocher une tâche ou sa prochaine étape ;
  - « + Choisir » pour remplir un emplacement, « + Ajouter un bonus » ;
  - l'étoile ★ : pour quel jour (aujourd'hui, demain, une date), en priorité ou en bonus, « Remplacer… » ;
  - appui long : Modifier, Historique, Retirer des 3, Remplacer, Libérer l'emplacement, Mettre en haut ou en bas, Remettre dans l'ordre de l'appli, Supprimer ;
  - « Une autre » (un jour difficile, une seule tâche est proposée) ;
  - noter dans le carnet après avoir coché (« 📓 Carnet ») ;
  - objectif de liste : le régler ou « Retirer l'objectif » ;
  - « + » : nouvelle tâche ;
  - bandeau « Les 3 sont faites ✓ ».
- **Feuilles du bas** : FeuilleTache (détail : C'est fait, ▶ Je commence, Historique, Modifier), FeuilleChoixTache (choisir ou créer une tâche dans un emplacement), FeuilleEtoile, menu « + », zone de note.
- **Ouvre** : `/nouvelle-tache`, `/je-commence`, `/historique`.
- **Vue Projets** : ProjetsGalerie (projets en cours, « Mes réalisations », Nouveau projet) → `/projet`, `/projet-edition`.
- **Composants** : BandeJours, CalendrierMois, BarresObjectif, Etoile, FeuilleTache, FeuilleChoixTache, FeuilleEtoile, ProjetsGalerie, ZoneNote, PlusMoins, MenuOptions, Options.

### 3. Ménage — `app/(tabs)/menage.tsx` (473 lignes)
- **En haut, un sélecteur** : « Maison » ou « Cuisine ».
- **Maison affiche** : « À faire aujourd'hui », puis les tâches « Par pièce » (où en est chaque tâche).
- **Actions** :
  - cocher une tâche ;
  - « + Nouvelle pièce », « + Ajouter une tâche » (nom et fréquence en jours) ;
  - « Modifier la pièce » : couleur, renommer, supprimer, monter ou descendre ;
  - glisser ou « ⋯ » sur une tâche : Modifier, Supprimer ;
  - un jour difficile, seules les tâches quotidiennes s'affichent.
- **Feuille du bas** : FeuilleMenage.
- **Vue Cuisine** (`components/Cuisine.tsx`), trois parties :
  - **Frigo & placards** (CuisineFrigo) : les aliments par emplacement et par catégorie, une jauge à 3 niveaux, la date de péremption ; actions : ajouter aux courses, fini, jeté, modifier, supprimer.
  - **Recettes** (CuisineRecettes) : « Avec ce que j'ai », « Toutes mes recettes », un filtre par tag, « + Nouvelle recette », « Coller une recette », « Mettre ce qui manque dans les courses ».
  - **Courses** (CuisineCourses) : la liste par rayon, la section « Projets » (matériel des projets), « Remettre dans l'inventaire », le lien vers Meal prep.
- **Ouvre** : `/recette`, `/recette-edition`, `/meal-prep`.
- **Composants** : FeuilleMenage, IconePiece, Cuisine, CuisineFrigo, CuisineRecettes, CuisineCourses, MenuOptions, Options.

### 4. Suivi — `app/(tabs)/suivi.tsx` (448 lignes)
- **Sélecteur à 3 parties** : Corps, Esprit, Progrès.
- **Corps** :
  - le grand bouton de sommeil, qui change selon l'heure : « Un tap en te couchant », « Noter mon heure de lever », « Annuler (tapé par erreur) » ;
  - « Ma semaine » en barres de sommeil ;
  - « Noter une nuit », corriger ou ajuster une nuit ;
  - la carte Sport et « + J'ai fait une séance ».
- **Esprit** (`components/EspritEcran.tsx`) :
  - l'humeur rapide (visages) ;
  - le bilan du dimanche (« Ce qui a aidé », « Une chose à garder ») ;
  - le bandeau « jour de ta séance avec toi » ;
  - 6 tuiles : Noter une pensée, Mon journal, Mon programme, Méditer, Ma vision, Lire ma vision ;
  - le lien « Régler le rappel du soir ».
- **Progrès** : l'écran Progression entier, intégré ici (voir plus bas).
- **Ouvre** : `/sommeil`, `/matin`, `/skills`, `/pensee`, `/journal`, `/tcc`, `/mediter`, `/vision`, `/vision-lecture`, `/seance-moi`, `/rappels`.
- **Composants** : EspritEcran, HumeurRapide, VisageHumeur, FeuillesSport (feuille « J'ai fait une séance »), SelecteurHeure, CalendrierMois.

### 5. Récompenses — `app/(tabs)/recompenses.tsx` (799 lignes)
- **Affiche** : le solde de points, le niveau (1 niveau tous les 100 points), les étagères par catégorie (5, toujours visibles), une barre de progression sur chaque carte, les derniers achats, « Comment gagner des points » (le barème).
- **Actions** :
  - acheter une récompense ;
  - annuler un achat du jour (remboursé) ;
  - « + Ajouter » : créer la sienne, prendre une idée en un tap, ou « Créer un gros objectif » ;
  - appui long sur une carte : Modifier, Supprimer.
- **Feuille du bas** : FeuilleAjoutRecompense, formulaire nom, icône, prix, catégorie.
- **Composants** : IconeRecompense, FeuilleAjoutRecompense, Options.

### — Progression (cachée) — `app/(tabs)/progression.tsx` (464 lignes)
- La route existe encore, mais sans onglet (`href: null`). On l'atteint par Suivi › Progrès.
- **Affiche** :
  - un choix de période : Jour, Semaine, Mois ;
  - l'avancée par domaine ;
  - la liste des tâches faites, avec « remettre à faire » ;
  - la roue du ménage ;
  - le calendrier du mois ;
  - « mesure d'adaptation » : est-ce que les tâches proposées par l'appli sont faites ? ;
  - les liens sommeil ↔ sport ;
  - des sections Humeur, Confiance, Projets et Cuisine.
- **Composants** : CalendrierMois, LiensSommeilSport, SectionHumeur, SectionConfiance, SectionProjets, SectionCuisine.

### 6. Profil — `app/(tabs)/profil.tsx` (115 lignes)
- **Affiche** : 5 entrées, puis 3 cartes et la version de l'appli.
- **Les 5 entrées** :
  - Idées de routines → `/mise-en-place` ;
  - Mes moments repères → `/ancres` ;
  - Mes listes → `/listes` ;
  - Agenda → `/agenda` ;
  - Rappels quotidiens → `/rappels`.
- **Les 3 cartes** : CarteDebutJour (l'heure où la journée de l'appli commence), CarteSauvegarde (exporter ou restaurer les données, exporter en CSV), BoutonReinitialiser (tout effacer, avec confirmation).

---

### Écrans hors onglets

| Écran | Fichier (lignes) | Atteint depuis | Ce qu'il fait |
|---|---|---|---|
| Nouvelle tâche / routine | `nouvelle-tache.tsx` (1 148) | Routines, Tâches, Historique, Mise en place | Formulaire unique « Routine » ou « Tâche ». Seul le nom est obligatoire. On peut régler : la liste, le moment, le moment repère (avant ou après), les jours, la fréquence (une fois, x fois par semaine ou par mois), l'échéance, la durée, la difficulté, l'importance, les étapes (essentielles ou bonus). `?id=` pour modifier. Ouvre `/ancres`. |
| Je commence | `je-commence.tsx` (426) | Tâches (feuille), Projet | Une tâche (ou une étape) avec un minuteur. Trois sorties : C'est fait, Encore un peu, J'arrête là. Pour un projet, la feuille « J'ai avancé » suit. |
| Historique / Carnet | `historique.tsx` (180) | Tâches | Les fois où une tâche a été faite, avec leurs notes (Fait / Retenu). Carnet d'une liste. « → En faire une tâche ». |
| Mise en place guidée | `mise-en-place.tsx` (6) + `components/MiseEnPlace.tsx` (956) | Routines (« Idées de routines »), Profil, une suggestion | Ce qui est difficile → des routines prêtes → juste après quoi → un aperçu de la journée. |
| Moments repères | `ancres.tsx` (183) | Profil, Nouvelle tâche | Liste des ancres (réveil, repas…) : activer ou ajouter. |
| Mes listes | `listes.tsx` (185) | Profil | Les catégories de tâches : nom, icône, couleur, ajout, suppression. |
| Agenda | `agenda.tsx` (102) | Profil | Coller l'adresse iCal secrète de Google Agenda : Connecter ou Déconnecter. |
| Rappels (téléphone) | `rappels.tsx` (245) | Profil, Esprit, Confiance | Rappel quotidien (heure, test) et rappels de l'Esprit (CarteRappelEsprit). |
| Rappels (web) | `rappels.web.tsx` (173) | idem | Activer les rappels par le navigateur : rappel quotidien, rappel du soir, « 30 secondes pour toi », tester une notification. |
| Sommeil (saisie) | `sommeil.tsx` (252) | Suivi › Corps, Matin | Les heures (pré-remplies), la qualité, les écrans, des flèches pour un jour oublié. |
| Matin | `matin.tsx` (186) | Suivi › Corps | Après « je me suis levée » : la nuit, puis 2 questions (qualité, écrans). |
| Sport | `skills.tsx` (524) | Suivi › Corps | 4 onglets internes : Skills, Workout, Exercices, Plan. Plus ⚙️ Mon matériel, « Mettre à jour mon niveau » et, au premier lancement, le matériel puis « Où en es-tu ? ». |
| Fiche skill | `skill.tsx` (353) | Sport › Skills | L'étape en cours, l'échelle des étapes, Noter un essai, Valider, revenir en arrière. |
| Fiche exercice | `exercice.tsx` (180) | Fiche skill, Sport › Exercices | Le bonhomme, les consignes, les variantes, mon historique, « Faire maintenant ». |
| Séance de sport | `seance-sport.tsx` (561) | 8 endroits | Lecteur série par série : repos chronométré, records 🏅, ressenti. `?liste=1` pour noter après coup. |
| Créer / modifier une séance | `seance-edition.tsx` (204) | Sport › Workout › Mes séances | Des exercices de la bibliothèque, avec séries, cible, poids, repos. |
| Séance guidée | `seance-guidee.tsx` (305) | Sport › Workout | Minuteur effort / repos. |
| Démarrer mon plan | `plan-demarrage.tsx` (331) | Sport › Plan | L'objectif, un test de niveau, les jours et la durée, le matériel (modes ajuster et nouveau cycle). |
| Méditer | `mediter.tsx` (252) | Suivi › Esprit | 5 séances guidées (minuteur et texte, pas d'audio). |
| Noter une pensée | `pensee.tsx` (190) | Esprit, Mon programme, Journal | Les colonnes de la TCC, une par écran, « passer » partout. |
| Mon journal | `journal.tsx` (185) | Esprit | Les pensées notées, filtrables par émotion. |
| Mon programme (TCC) | `tcc.tsx` (93) | Esprit | Page d'accueil : « Où j'en suis », puis 4 tuiles (Échelle, Confiance, Séance avec moi, Apprendre). |
| Mon échelle | `echelle.tsx` (286) | Mon programme | Mes situations sociales, de la plus facile à la plus dure. |
| Je le fais (exposition) | `exposition.tsx` (211) | Échelle, Journal, Pensée | Avant, pendant, après, avec deux curseurs d'anxiété. |
| Journal de confiance | `confiance.tsx` (145) | Mon programme | 1 à 3 choses bien faites par jour, rangées dans un bocal. |
| Séance avec moi | `seance-moi.tsx` (399) | Esprit, Mon programme | Un bilan hebdomadaire en 5 étapes, des objectifs, un rappel chaque semaine. |
| Apprendre | `apprendre.tsx` (65) | Mon programme | Des fiches d'une minute, qui renvoient vers les outils. |
| Ma vision | `vision.tsx` (268) | Esprit | Un tableau par domaine de vie : photos, phrases au présent, routine liée. |
| Lire ma vision | `vision-lecture.tsx` (101) | Esprit, Ma vision | Défilement en plein écran ; coche la routine liée. |
| Projet | `projet.tsx` (630) | Tâches › Projets, Progrès | La prochaine étape, les étapes, le journal de bord, des photos avant / maintenant, le matériel, les notes, les liens, Je m'y mets, Marquer comme fini. |
| Nouveau / modifier un projet | `projet-edition.tsx` (154) | Galerie, Projet | Nom, type, photo, pourquoi, premières étapes. |
| Types de projets | `projets-types.tsx` (135) | Édition de projet | Ajouter, renommer, choisir l'icône ou la couleur d'un type. |
| Recette | `recette.tsx` (175) | Cuisine › Recettes | Portions réglables, ingrédients ✓ / ✗ selon l'inventaire, étapes, « J'ai cuisiné ». |
| Écrire / coller une recette | `recette-edition.tsx` (224) | Recettes, Recette | Saisie à la main, ou texte collé et découpé automatiquement. |
| Je cuisine | `cuisiner.tsx` (135) | Recette uniquement | Une étape à la fois, minuteur, écran qui reste allumé. |
| Meal prep | `meal-prep.tsx` (159) | Cuisine › Courses | Recettes et portions de la semaine ; le reste à acheter part dans les courses. |

### Écrans ou composants qui ne sont plus reliés à rien
- **Aucun écran isolé** : chaque route est atteinte par au moins un lien.
- **`components/FeuilleSeance.tsx`** (66 lignes) : importé nulle part.
- **`lib/partage-texte.ts`** (23 lignes) : importé nulle part.
- **`progression`** : garde sa route d'onglet caché alors qu'il n'est plus affiché que dans Suivi.
- **`app/ROADMAP.md`** : rangé dans `app/`, le dossier des écrans.

---

## 2. Fonctionnalités

✅ branchée · 🙈 existe mais cachée ou difficile d'accès · 🟡 à moitié finie · ⚫ prévue, jamais faite

### Routines
| Fonctionnalité | État |
|---|---|
| Routines par moment et par domaine, anneau du jour | ✅ |
| Routines à étapes (essentielles et bonus, points par palier) | ✅ |
| Cocher après coup (hier, avant-hier) | ✅ |
| Moments repères (ancres : avant / après) | ✅ |
| Mise en place guidée (idées de routines) | ✅ (deux entrées : Routines et Profil) |
| Suggestions d'ajustement (horaire, simplifier, alléger, monter, ajouter) | ✅ |
| Routine liée au sport ou à la vision (cochée toute seule) | 🙈 (réglage enfoui dans les feuilles Sport et Vision) |

### Tâches
| Fonctionnalité | État |
|---|---|
| « Mes 3 » du jour et Bonus | ✅ |
| Étoile : planifier n'importe quel jour | ✅ |
| Moteur de tri (proposition des tâches) | ✅ |
| Jour difficile : une seule tâche, « Une autre » | ✅ |
| Listes avec couleur, icône et objectif par semaine ou par mois | ✅ |
| Tâches à étapes | ✅ |
| Je commence (minuteur, sessions) | ✅ |
| Carnet / historique d'une tâche | 🙈 (appui long ou feuille › Historique) |
| Ordre manuel (haut / bas de liste) | 🙈 (appui long) |
| Versions courte et longue d'une tâche (`version_courte`, `version_longue`) | ⚫ colonnes en base, lues par aucun écran ni par le moteur |

### Ménage
| Fonctionnalité | État |
|---|---|
| Pièces et tâches à fréquence | ✅ |
| Points si fait à temps, journal | ✅ |
| Roue du ménage (Progrès) | ✅ |

### Suivi — sommeil
| Fonctionnalité | État |
|---|---|
| Bouton couché / levé, semaine en barres | ✅ |
| Saisie complète (sommeil) et Matin (2 questions) | ✅ (deux écrans voisins, voir doublons) |

### Suivi — sport
| Fonctionnalité | État |
|---|---|
| Skills (arbre, étapes, essais, validation) | ✅ |
| Workout : séances guidées, Réveil du corps, Mes séances | ✅ |
| Bibliothèque d'exercices filtrée par matériel | ✅ |
| Plan sur 6 semaines (tests de niveau, bilan du dimanche) | ✅ (un commentaire de `skills.tsx` le dit encore « à venir ») |
| « J'ai fait une séance » (notée en 1 tap) | ✅ (3 entrées) |

### Suivi — esprit
| Fonctionnalité | État |
|---|---|
| Humeur rapide, bilan du dimanche | ✅ |
| Pensées et journal | ✅ |
| TCC : échelle, exposition, confiance, séance avec moi, fiches | ✅ (enfoui à 3–5 niveaux) |
| Méditer | 🟡 5 séances, pas d'audio (« l'audio viendra plus tard ») ; une ligne « D'autres séances à ajouter » sert de place vide |
| Exercices TCC planifiés (`tcc_exercices`), « À dire » (`a_dire`), séances TCC (`tcc_seances`) | ⚫ tables créées, aucun écran |

### Récompenses et points
| Fonctionnalité | État |
|---|---|
| Points, niveau, solde | ✅ |
| Récompenses par catégorie, achat, annulation | ✅ |
| Barème affiché | ✅ |
| Série de jours (actuelle et record) | 🙈 affichée seulement dans Suivi › Progrès |
| Réglage de la gamification, du ton et de la rigidité (table `preferences`) | ⚫ table créée, jamais lue (prévu dans la ROADMAP, partie IV.B) |

### Profil, données
| Fonctionnalité | État |
|---|---|
| Heure de début de journée | ✅ |
| Sauvegarde / restauration en JSON, export CSV | ✅ |
| Tout réinitialiser | ✅ |

### Agenda
| Fonctionnalité | État |
|---|---|
| Rendez-vous Google (iCal via le serveur de rappels), cache hors ligne | ✅ |
| Point sur la bande des jours, rendez-vous du jour dans Tâches | ✅ |
| « Charge du jour » (minutes de rendez-vous) | 🟡 fonction `chargeDuJour` écrite, jamais appelée |

### Notifications
| Fonctionnalité | État |
|---|---|
| Rappel quotidien (téléphone : programmé sur l'appareil) | ✅ |
| Rappels web par le serveur (`push-worker/`) | ✅ |
| Rappel du soir « 30 s pour toi », rappel hebdomadaire de la séance avec moi | ✅ |
| Fin du minuteur de Je commence | ✅ téléphone · 🟡 web (un bip seulement, si l'appli est ouverte) |

### Projets créatifs
| Fonctionnalité | État |
|---|---|
| Galerie, fiche, étapes, journal, photos, matériel, liens, types | ✅ |
| Points par jour d'avancée, bonus « Fini » | ✅ |
| Matériel envoyé dans les Courses | ✅ |

### Cuisine
| Fonctionnalité | État |
|---|---|
| Inventaire avec jauge, péremption, jetés | ✅ |
| Recettes (écrites ou collées), portions, Je cuisine, J'ai cuisiné | ✅ |
| Courses par rayon, Meal prep de la semaine | ✅ |
| Routine liée au meal prep (`meal_prep_semaines.routine_id`) | 🙈 |

### Vision
| Fonctionnalité | État |
|---|---|
| Domaines, photos, phrases, lecture plein écran, routine liée | ✅ (Suivi › Esprit) |

### Autres
| Fonctionnalité | État |
|---|---|
| Énergie du jour « En forme » ⚡ | 🟡 enregistrée, sans aucun effet |
| Thème clair / sombre, version web installable (PWA) | ✅ |
| Journal des évènements (`event_log`) | 🟡 écrit partout, jamais relu (sauf par l'export CSV) |

---

## 3. Base de données

Il y a 2 sources de tables : `lib/db/migrations.ts` (les migrations numérotées) et `lib/schema.ts` (les tables ajoutées ensuite, créées au démarrage). Au total, 84 tables créées. Les tables temporaires de migration (`routines`, `completions_v2`, `etat`, `etat_v2`, `etat_v3`) ont été supprimées ou renommées.

### Tables utilisées

| Domaine | Table | Colonnes principales | Écrans |
|---|---|---|---|
| Cœur | `items` | nom, moment, effort, duree_min, importance, liste_id, jours, échéance / fenêtre, étapes, rang_manuel, compteurs du moteur | Routines, Tâches, Nouvelle tâche, Je commence, Progrès |
| | `completions` | item_id, date, statut, heure, points | idem |
| | `etapes`, `etapes_cochees` | item_id, nom, ordre, essentielle / date | Routines, Tâches |
| | `notes` | item_id, date, fait, retenu, idees | Carnet (Historique, Tâches) |
| | `sessions` | item_id, debut, fin, reelle_min | Je commence |
| | `listes` | nom, icone, couleur, objectif, objectif_periode | Tâches, Mes listes |
| | `ancres` | nom, moment, active | Moments repères, Nouvelle tâche |
| | `trois` | jour, item_id, rang, bonus, origine, place_le | Tâches (Mes 3) |
| | `difficultes` | difficulte_id, choisie_le | Mise en place |
| Moteur | `decision_log` | date, item_id, score, composantes, rang, propose, exploration | Tâches (écrit), Progrès (mesure d'adaptation) |
| | `suggestions` | type, item_id, decision, date | Routines (carte suggestion) |
| | `meta` | clé / valeur (énergie du jour, vue choisie, agenda…) | partout |
| | `event_log` | type, routine_id, timestamp, contexte | **écrit seulement** |
| Points | `stats` | points_total, best_streak, rappel_actif / heure / minute | Récompenses, Rappels |
| | `recompenses`, `achats` | nom, icone, prix, categorie / date | Récompenses |
| Ménage | `menage_pieces`, `menage_taches`, `menage_faits`, `menage_journal` | nom, freq_jours, prochaine_le, fait_le, a_temps | Ménage, Progrès |
| Sommeil | `sommeil` | date, coucher, lever, duree_min, qualite, ecrans, reponses | Suivi › Corps, Sommeil, Matin, Progrès |
| Sport | `skills_etat`, `skills_historique` | skill, etape, actif / de → vers | Sport, Fiche skill |
| | `seances`, `series` | date, points / famille, exercice, objectif, realise, poids | Séance de sport, Fiche exercice |
| | `sport_reglages` | barre_traction, materiel | Sport (matériel) |
| | `seances_guidees`, `seance_perso` | date, duree_s, zones, ressenti / exercices, effort_s, repos_s | Workout, Séance guidée |
| | `sport_seances`, `sport_seances_ex` | nom / exercice_id, series, cible, poids | Mes séances, Créer une séance |
| | `sport_plan`, `sport_plan_lignes`, `sport_plan_seances`, `sport_tests`, `sport_bilans` | objectif, durée, jours / lignes / tests / bilans | Plan, Démarrer mon plan, Séance de sport |
| | `sport_lien` | routine_id | Feuilles Sport (routine liée) |
| Esprit | `humeurs` | jour, heure, niveau, emotions, note | Esprit, Progrès |
| | `pensees` | situation, pensee, emotions, intensités, pieges, autre_vision | Pensée, Journal |
| | `bilan_semaine` | semaine, aide, garder | Esprit (le dimanche) |
| | `meditations` | date, duree_s, terminee, points | Méditer |
| | `tcc_echelle`, `tcc_expositions`, `tcc_confiance`, `tcc_objectifs`, `tcc_seances_moi`, `tcc_points_jours` | situations, expositions, entrées de confiance, objectifs, séances avec moi | Mon programme et ses sous-écrans, Progrès |
| Vision | `vision_domaines`, `vision_photos`, `vision_phrases` | nom, ordre / photo / texte | Ma vision, Lire ma vision |
| Projets | `projets`, `projet_types`, `projet_etapes`, `projet_journal`, `projet_photos`, `projet_materiel`, `projet_liens`, `projets_points_jours` | nom, type, pourquoi, fini_le / étapes / journal / photos (data) | Tâches › Projets, Projet, Je commence, Courses |
| Cuisine | `aliments`, `aliments_jetes` | nom, categorie, niveau, péremption | Frigo & placards |
| | `recettes`, `recette_ingredients`, `recette_etapes` | titre, portions, temps, tags, favori | Recettes, Recette, Je cuisine |
| | `cuisines`, `cuisine_points_jours` | recette, jour, portions | J'ai cuisiné, Progrès |
| | `courses` | nom, rayon, cochee, quantite, aliment_id | Courses |
| | `meal_prep`, `meal_prep_semaines` | recette, portions / semaine, routine_id | Meal prep |

### Tables lues ou écrites par aucun écran
Elles ne servent qu'à la sauvegarde et à l'export CSV.

| Table | Remarque |
|---|---|
| `preferences` | profil, gamification, ton, rigidité : jamais utilisée |
| `a_dire` | a_dire existe aussi comme colonne de `pensees` ; la table, elle, ne sert pas |
| `tcc_seances` | jamais utilisée |
| `tcc_exercices`, `tcc_exercices_faits` | exercices TCC planifiés : jamais utilisés |
| `sport_paliers`, `paliers_historique` | anciens paliers de sport, remplacés par les skills |
| `event_log` | écrite mais jamais relue par un écran |

---

## 4. Logique

### Le moteur des « 3 du jour »
- **Classement** (`lib/db/moteur.ts`) : chaque tâche active pas encore faite reçoit un score de 0 à 1, une somme pondérée de 6 composantes :

  | Composante | Poids |
  |---|---|
  | Importance | 0,25 |
  | Bon moment (heure réelle observée, sinon le moment déclaré) | 0,20 |
  | Équilibre entre listes | 0,20 |
  | État | 0,15 — **toujours fixe**, ne change rien à l'ordre |
  | Urgence (échéance, objectif de la liste en retard) | 0,12 |
  | Négligence | 0,08 |

- **Exploration** : une place est gardée pour une tâche négligée. Chaque décision est notée dans `decision_log`.
- **Anti-oubli** (`negligence.ts`) : une tâche proposée et pas faite un jour passé voit son compteur monter, puis elle remonte dans le classement.
- **Les 3 emplacements** (`trois-regles.ts`, `db/trois.ts`) :
  - ce que je place prime ;
  - le jour même, les places vides se remplissent dans cet ordre : tâches prévues ce jour-là → non faites de la veille → moteur ;
  - les propositions sont figées à l'ouverture d'aujourd'hui ;
  - un jour futur n'affiche que ce que j'y ai placé, un jour passé est en lecture seule ;
  - les bonus sont illimités.
- **Jour difficile** : une seule tâche (d'abord la prochaine étape d'une tâche découpée, sinon une tâche de 15 min ou moins, sinon la première), et « Une autre » pour passer à la suivante.

### Points et récompenses
- Les règles sont dans `lib/regles-taches.ts`. Le total est dans `stats.points_total` ; le niveau = total ÷ 100 + 1.
- Le solde = points gagnés − achats ; le niveau ne baisse jamais quand on dépense.
- Décocher reprend les points ; cocher de nouveau ne les redonne pas deux fois.

| Action | Points |
|---|---|
| Routine ou tâche faite | +10 |
| Étape d'une tâche | +5 |
| Routine à étapes : essentielles / tout (un jour difficile, essentielles = tout) | +10 / +15 |
| Nuit complète | +5 |
| Séance de sport (une fois par jour) | +10 |
| Étape de skill | +20 |
| Skill maîtrisé | +50 |
| Méditation, exposition TCC, J'ai cuisiné, projet avancé, tâche de ménage à temps | +5 chacun (une fois par jour, ou par échéance pour le ménage) |
| Projet fini | +50 |

- Points « une fois par jour » : tables `*_points_jours` (TCC, projets, cuisine) ou colonnes `points_donnes`.

### Énergie du jour
- Choisie à la main sur Routines (Difficile / Normal / En forme) et gardée dans `meta` (`energie_routines:AAAA-MM-JJ`). Le lendemain, plus rien n'est choisi.
- **Difficile** :
  - seules les étapes essentielles s'affichent ;
  - les routines exigeantes sont mises en retrait ;
  - une seule tâche est proposée ;
  - pas de suggestion ;
  - au Ménage, seules les tâches quotidiennes ;
  - une version courte de la séance du Plan ;
  - barème des étapes plus généreux.
- **Normal / En forme** : aucun effet (« En forme » est seulement enregistré).
- Le moteur, lui, ne lit pas l'énergie : la composante État est fixe.

### Rappels
- **Téléphone** (`lib/notifications.ts`, `rappels-esprit.ts`), tout est programmé sur l'appareil :
  - un rappel quotidien générique, reprogrammé au démarrage ;
  - le rappel du soir « 30 s pour toi », qui ouvre Suivi › Esprit ;
  - le rappel hebdomadaire de la séance avec moi ;
  - la fin du minuteur de Je commence.
- **Web** (`notifications.web.ts`, `push-web.ts`) : le navigateur s'abonne et le serveur `push-worker/` (Cloudflare) envoie les rappels. Seuls l'abonnement et les heures partent. Les rappels de la base ne servent pas sur le web.

### Agenda
- Google Agenda, en lecture seule : l'adresse iCal secrète est envoyée une seule fois au serveur `push-worker/` (`src/ics.ts`). Elle n'est pas gardée dans l'appli.
- L'appli demande les rendez-vous au serveur (`lib/agenda.ts`) et garde les derniers reçus dans `meta`, pour le hors-ligne.
- Affichage : dans Tâches, les rendez-vous du jour et un point sur la bande des jours.

### Suggestions d'ajustement (`lib/db/suggestions.ts`)
| Cas | Seuil | Suggestion |
|---|---|---|
| Routine dure à tenir | moins de 30 % faite sur 14 jours | simplifier ou alléger |
| Faite à une autre heure que prévu | 70 % des fois sur 21 jours | changer d'horaire |
| Routine bien installée | plus de 80 % faite après 21 jours | monter ou ajouter |

- Une seule suggestion à la fois, une seule décision par jour. Après un refus, la même suggestion revient 14 jours plus tard.

---

## 5. Taille et poids

| Dossier | Fichiers | Lignes |
|---|---|---|
| `app/(tabs)/` | 8 | 4 854 |
| `app/` (hors onglets) | 37 | 9 464 |
| `components/` | 61 | 8 261 |
| `lib/` (racine) | 49 | 7 231 |
| `lib/db/` | 46 | 7 839 |
| `lib/catalogue/` | 13 | 2 441 |
| `hooks/` | 2 | 75 |
| `tests/` | 35 | 5 470 |
| **Total (sans les tests)** | **216** | **≈ 40 200** |

À côté : `push-worker/src` (4 fichiers, 577 lignes) et `app-example/` (modèle Expo de départ, non suivi par git).

### Les 10 plus gros fichiers
| # | Fichier | Lignes |
|---|---|---|
| 1 | `app/(tabs)/taches.tsx` | 1 676 |
| 2 | `app/nouvelle-tache.tsx` | 1 148 |
| 3 | `components/MiseEnPlace.tsx` | 956 |
| 4 | `lib/db/migrations.ts` | 895 |
| 5 | `lib/schema.ts` | 890 |
| 6 | `app/(tabs)/recompenses.tsx` | 799 |
| 7 | `app/(tabs)/index.tsx` | 787 |
| 8 | `lib/csv.ts` | 741 |
| 9 | `components/FeuillesSport.tsx` | 657 |
| 10 | `app/projet.tsx` | 630 |

### Les écrans les plus lourds à maintenir
1. **Tâches** : 1 676 lignes, environ 15 états, 4 feuilles, 3 sortes de jour (aujourd'hui, futur, passé), le jour difficile, l'agenda, la vue Projets.
2. **Nouvelle tâche** : 1 148 lignes, routine et tâche dans un seul formulaire.
3. **Sport** (`skills.tsx` + OngletPlan + OngletSeances + OngletExercices + MesSeances + FeuillesSport + 6 écrans) : ≈ 3 500 lignes et 4 systèmes de séances qui cohabitent.
4. **Mise en place** : 956 lignes pour un parcours rarement utilisé.
5. **Esprit / TCC** : 11 écrans et 6 tables.
6. **Récompenses** : 799 lignes, dont le formulaire écrit directement dans l'écran.

---

## 6. Candidats à la simplification

Rien n'a été changé. Classement par effet probable sur la simplicité, du plus fort au plus faible.

### A. Effet fort
| # | Candidat | Constat |
|---|---|---|
| 1 | **Sport : 4 systèmes de séances** | Séances guidées (`seances_guidees`), Mes séances (`sport_seances`), Plan (`sport_plan_*`), séances de skills (`seances`/`series`). « J'ai fait une séance » existe à 3 endroits. Les fusionner en un seul modèle de séance allégerait ≈ 10 tables et plusieurs écrans. |
| 2 | **Tâches : écran trop chargé** | Mes 3 + Bonus + étoile multi-jours + listes + objectifs + agenda + carnet + Projets dans un seul fichier. Sortir « Projets » de cet onglet et retirer l'étoile multi-jours (doublon avec « + Choisir ») réduirait nettement. |
| 3 | **TCC enfouie** | Suivi › Esprit › Mon programme › Échelle › Je le fais, soit 5 niveaux. La séance avec moi a 3 entrées. Apprendre est à 4 niveaux. |
| 4 | **Progression en double** | Une route d'onglet cachée et son contenu intégré dans Suivi › Progrès. Garder une seule forme. |
| 5 | **Sommeil : 3 entrées** | Bouton de Suivi, `sommeil.tsx` et `matin.tsx` font presque la même saisie. |

### B. Effet moyen
| # | Candidat | Constat |
|---|---|---|
| 6 | Tables et colonnes jamais utilisées | Tables `preferences`, `a_dire`, `tcc_seances`, `tcc_exercices`, `tcc_exercices_faits`, `sport_paliers`, `paliers_historique`, et colonnes `items.version_courte` / `version_longue` : présentes seulement dans la sauvegarde et le CSV. |
| 7 | `event_log` écrite, jamais relue | Écrite à chaque coche, ajout ou notification, mais rien ne la lit. Soit lui donner un usage, soit l'arrêter. |
| 8 | Composante « État » du moteur | 15 % du score, toujours fixe à 0,5. Elle n'est gardée que pour comparer avec les anciens scores. |
| 9 | Énergie « En forme » | Un bouton sans effet : 2 niveaux (Difficile / Normal) suffiraient. |
| 10 | Mise en place guidée | 956 lignes pour un parcours atteint depuis Profil et « Idées de routines ». Deux entrées pour la même chose. |
| 11 | 3 tables « points une fois par jour » | `tcc_points_jours`, `projets_points_jours`, `cuisine_points_jours`, plus les colonnes `points_donnes` : le même mécanisme écrit 5 fois. |
| 12 | Esprit : tuiles en double | « Ma vision » et « Lire ma vision » ; « Noter une pensée » dans Esprit et dans Mon programme. |

### C. Effet faible (ménage dans le code)
| # | Candidat | Constat |
|---|---|---|
| 13 | Fichiers morts | `components/FeuilleSeance.tsx` (66 lignes), `lib/partage-texte.ts` (23 lignes). |
| 14 | Fonctions exportées jamais appelées | `basculerEtoile` (ancienne API de l'étoile), `chargeDuJour`, `premierLibre`, `tempsPasse`, `ideesRestantes`, `emotionsFrequentes`, `couleurJauge`, `couleurSeance`, `nomRayon`, `uniteDe`, `indexSemaine`, `ilYa`, `TYPES_DEFAUT`, `UNITES`. |
| 15 | Types d'évènements hérités | `routine_completee`, `routine_ajoutee`… dans `events.ts` (avant l'unification routines / tâches). |
| 16 | Commentaires périmés | « Plan : le coach (à venir) » dans `skills.tsx` ; `recompenses-regles.ts` cite un test `tests/recompenses.test.mjs` qui n'existe pas. |
| 17 | Fichiers mal rangés | `app/ROADMAP.md` dans le dossier des écrans ; `app-example/` resté du modèle Expo. |
| 18 | Écrans très minces | `mise-en-place.tsx` (6 lignes), `Cuisine.tsx` (39), `apprendre.tsx` (65), `tcc.tsx` (93) : des pages de passage qui pourraient se fondre dans leur parent. |
| 19 | Méditer, ligne « D'autres séances à ajouter » | Une place vide affichée à l'écran. |
