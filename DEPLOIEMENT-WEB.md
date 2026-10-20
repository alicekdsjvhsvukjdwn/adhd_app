# Publier la version web (iPhone, gratuit)

Deux choses à publier sur Cloudflare, toutes deux gratuites :

- **le site** (l'appli elle-même) : un Worker Cloudflare avec fichiers statiques (config : `wrangler.toml` à la racine) ;
- **le serveur de rappels** (`push-worker/`) : un Cloudflare Worker, qui garde seulement l'abonnement aux notifications et les heures choisies. Aucune donnée de l'appli ne lui est envoyée.

Toutes les commandes se tapent dans un terminal, dans le dossier du projet. Expo Go reste ton outil de développement : rien ici ne le change.

> **À savoir avant de commencer**
> - Sur iPhone, l'appli installée sur l'écran d'accueil a **son propre stockage**, séparé de Safari. Installe-la d'abord, puis restaure ta sauvegarde *dans l'appli installée* (étape 6).
> - Les rappels exigent iOS 16.4 ou plus, et l'appli ouverte depuis son icône (pas dans Safari).
> - La clé partagée entre le site et le Worker finit dans le code du site. Elle sert à éviter qu'un inconnu s'abonne à ton Worker, pas à protéger des secrets : le site est non indexé (`robots`, `noindex`) et c'est un usage personnel.

## 1. Compte Cloudflare et connexion

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up (ou utilise le tien).
2. Dans le terminal :

   ```
   npx wrangler login
   ```

   Une page s'ouvre : autorise l'accès.

## 2. L'adresse du site

Le site est publié comme un Worker avec fichiers statiques (config : `wrangler.toml` à la racine, nom `routines`). Son adresse est de la forme `https://routines.TON-SOUS-DOMAINE.workers.dev` ; elle s'affiche à la première publication (étape 4). Pour la connaître avant, regarde ton sous-domaine dans le tableau de bord Cloudflare › Workers & Pages. **Note l'adresse** : elle va dans `ORIGINE` à l'étape 3.

## 3. Publier le Worker de rappels

```
cd push-worker
npm install
```

1. **Stockage des abonnements** :

   ```
   npx wrangler kv namespace create ABONNES
   ```

   Copie l'`id` affiché dans `push-worker/wrangler.toml`, à la place de `REMPLACER_PAR_L_ID_DU_KV`.

2. **Dans `push-worker/wrangler.toml`**, règle aussi :
   - `ORIGINE` : l'adresse du site notée à l'étape 2 (sans `/` à la fin) ;
   - `VAPID_SUBJECT` : `mailto:` suivi d'une adresse à toi.

3. **Clés VAPID** (l'identité du serveur de rappels) :

   ```
   npx web-push generate-vapid-keys
   ```

   Ça affiche une clé publique et une clé privée. Garde-les sous la main.

4. **Secrets** (chaque commande te demande de coller la valeur) :

   ```
   npx wrangler secret put VAPID_PUBLIC
   npx wrangler secret put VAPID_PRIVATE
   npx wrangler secret put CLE_PARTAGEE
   ```

   - `VAPID_PUBLIC` : la clé publique de l'étape 3 ;
   - `VAPID_PRIVATE` : la clé privée ;
   - `CLE_PARTAGEE` : un mot de passe long de ton choix. Pour en fabriquer un :
     `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

5. **Publier** :

   ```
   npx wrangler deploy
   ```

   Wrangler affiche l'adresse du Worker, du genre `https://routines-push.TON-COMPTE.workers.dev`. **Note-la.** Le cron (toutes les 15 minutes) est activé par ce déploiement.

Puis reviens à la racine du projet : `cd ..`

## 4. Publier le site

1. Copie `.env.example` en `.env.local` et remplis les trois valeurs :
   - `EXPO_PUBLIC_PUSH_URL` : l'adresse du Worker (étape 3.5) ;
   - `EXPO_PUBLIC_PUSH_CLE` : la même valeur que `CLE_PARTAGEE` ;
   - `EXPO_PUBLIC_VAPID_PUBLIC` : la clé publique VAPID.

2. Fabriquer le site dans `dist/` :

   ```
   npm run build:web
   ```

3. Publier (depuis la racine du projet) :

   ```
   npx wrangler deploy
   ```

   Wrangler affiche l'adresse du site. N'utilise pas `wrangler pages …` : Cloudflare le redirige vers ce mode et déploie sans demander.

Ouvre l'adresse du site dans le navigateur de l'ordinateur pour vérifier qu'elle s'affiche.

## 5. Sur l'iPhone

1. Ouvre l'adresse du site dans **Safari** (pas dans une autre appli).
2. Bouton **Partager** › **Sur l'écran d'accueil** › **Ajouter**.
3. Ferme Safari et ouvre **Routines** depuis son icône.
4. Profil › **Rappels quotidiens** › **Activer les rappels** › autorise les notifications. Choisis l'heure du rappel quotidien et, si tu veux, celui du soir. « Tester une notification » en envoie une tout de suite.

## 6. Reprendre tes données depuis Expo Go

1. Dans Expo Go : Profil › **Exporter** › enregistre le fichier dans Fichiers / iCloud Drive.
2. Dans l'appli installée : Profil › **Restaurer** › choisis ce fichier. Même format, toutes les tables.

Ensuite, exporte régulièrement (Profil › **Exporter**) : les données vivent dans le navigateur de l'iPhone, et l'appli te le rappelle si ta dernière sauvegarde a plus de 7 jours.

## 7. Republier après une modification

- **Le site** :

  ```
  npm run build:web
  npx wrangler deploy
  ```

  Le téléphone charge la nouvelle version à la prochaine ouverture de l'appli. La date de publication est affichée en bas de Profil.

- **Le Worker** (seulement si tu changes `push-worker/`) :

  ```
  cd push-worker
  npx wrangler deploy
  ```

## En cas de souci

- **« Les données ne s'ouvrent pas »** : ferme complètement l'appli (glisser vers le haut dans le sélecteur d'applis) puis rouvre-la.
- **Pas de notification** : vérifie iOS ≥ 16.4, l'appli ouverte depuis l'icône, Réglages › Notifications › Routines autorisées. Puis « Tester une notification » dans Rappels. Pour voir ce que fait le Worker : `cd push-worker` puis `npx wrangler tail`.
- **Se désabonner** : Rappels › « Désactiver les rappels sur cet appareil ».
