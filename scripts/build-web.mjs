// Fabrique le site web dans dist/ : export Expo, puis balises « appli installable »
// dans index.html (le mode « single » d'Expo n'utilise pas +html.tsx).
// Lancer : npm run build:web
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const maintenant = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
const r = spawnSync("npx", ["expo", "export", "--platform", "web", "--clear"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_BUILD: maintenant },
});
if (r.status !== 0) process.exit(r.status ?? 1);

const BALISES = `
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#05080A" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Routines" />
<title>Routines</title>
<style>html,body{background:#05080A;overscroll-behavior:none}</style>
`;

const fichier = "dist/index.html";
let html = readFileSync(fichier, "utf8");
html = html.replace(/<meta name="viewport"[^>]*>/, "").replace(/<title>[\s\S]*?<\/title>/, "");
if (!html.includes("</head>")) throw new Error("index.html : pas de </head>");
html = html.replace("</head>", `${BALISES}</head>`).replace('<html lang="en">', '<html lang="fr">');
writeFileSync(fichier, html);
console.log("Balises installables ajoutées à dist/index.html");
