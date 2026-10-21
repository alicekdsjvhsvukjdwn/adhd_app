// Lancer : npm test
// Lot 3 : semaine des Tâches, échéances, catégories et état des récompenses.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { libelleEcheance, pointsEcheance, semaineDe } from "../lib/regles-taches.ts";
import { IDEES_RECOMPENSES, ideesRestantes } from "../lib/catalogue-recompenses.ts";
import { CATEGORIES_RECOMPENSES, categorieRecompense, ICONES_RECOMPENSES, etageres, etatRecompense } from "../lib/recompenses-regles.ts";
import { SQL_CATEGORIES_RECOMPENSES, SQL_CATEGORIES_RECOMPENSES_V2, transformationsApres } from "../lib/schema.ts";

test("semaine en cours : du lundi au dimanche, quel que soit le jour", () => {
  const attendu = [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
  ];
  assert.deepEqual(semaineDe("2026-10-12"), attendu); // lundi
  assert.deepEqual(semaineDe("2026-10-15"), attendu); // jeudi
  assert.deepEqual(semaineDe("2026-10-18"), attendu); // dimanche
});

test("semaine en cours : à cheval sur deux mois et deux années", () => {
  assert.deepEqual(semaineDe("2026-11-01"), [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ]);
  const nouvelAn = semaineDe("2027-01-01");
  assert.equal(nouvelAn[0], "2026-12-28");
  assert.equal(nouvelAn[6], "2027-01-03");
  // Passage à l'heure d'hiver (25 octobre 2026) : toujours 7 jours distincts.
  assert.equal(new Set(semaineDe("2026-10-25")).size, 7);
});

test("points d'échéance : une couleur par tâche, rangée sous son jour", () => {
  const semaine = semaineDe("2026-10-19");
  const points = pointsEcheance(
    [
      { echeance: "2026-10-20", couleur: "#5392F7" },
      { echeance: "2026-10-20", couleur: "#88E9AC" },
      { echeance: "2026-10-25", couleur: "#5392F7" },
      { echeance: null, couleur: "#6568F1" }, // sans échéance
      { echeance: "2026-10-26", couleur: "#6568F1" }, // semaine suivante
      { echeance: "2026-10-01", couleur: "#6568F1" }, // en retard, hors semaine
    ],
    semaine,
  );
  assert.deepEqual(Object.keys(points), semaine);
  assert.deepEqual(points["2026-10-20"], ["#5392F7", "#88E9AC"]);
  assert.deepEqual(points["2026-10-25"], ["#5392F7"]);
  assert.deepEqual(points["2026-10-19"], []);
});

test("raison d'une carte : l'échéance dite simplement", () => {
  assert.equal(libelleEcheance("2026-10-18", "2026-10-19"), "en retard");
  assert.equal(libelleEcheance("2026-10-19", "2026-10-19"), "échéance aujourd'hui");
  assert.equal(libelleEcheance("2026-10-20", "2026-10-19"), "échéance demain");
  assert.equal(libelleEcheance("2026-11-02", "2026-10-30"), "échéance dans 3 j");
});

const baseRecompenses = (noms) => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE recompenses (id INTEGER PRIMARY KEY, nom TEXT NOT NULL,
    categorie TEXT NOT NULL DEFAULT 'plaisirs')`);
  const ins = db.prepare("INSERT INTO recompenses (nom) VALUES (?)");
  for (const n of noms) ins.run(n);
  return db;
};
const categories = (db) =>
  Object.fromEntries(db.prepare("SELECT nom, categorie FROM recompenses").all().map((r) => [r.nom, r.categorie]));

test("migration 22 : les récompenses existantes rangées d'après leur nom", () => {
  const db = baseRecompenses([
    "Aller boire un café",
    "Un épisode de série",
    "Une pâtisserie",
    "Une heure de jeu vidéo",
    "Un moment cocooning",
    "Un nouveau livre",
    "Une séance de ciné",
    "Un album ou un concert",
    "Resto avec Léa",
    "Week-end à la mer",
    "Un truc sans mot-clé",
  ]);
  db.exec(SQL_CATEGORIES_RECOMPENSES);
  assert.deepEqual(categories(db), {
    "Aller boire un café": "plaisirs",
    "Un épisode de série": "temps",
    "Une pâtisserie": "plaisirs",
    "Une heure de jeu vidéo": "temps",
    "Un moment cocooning": "temps",
    "Un nouveau livre": "temps",
    "Une séance de ciné": "sorties",
    "Un album ou un concert": "musique",
    "Resto avec Léa": "sorties",
    "Week-end à la mer": "gros",
    "Un truc sans mot-clé": "plaisirs",
  });
});

test("migration 22 : rejouable, ne défait pas un choix fait à la main", () => {
  const db = baseRecompenses(["Une séance de ciné"]);
  db.exec(SQL_CATEGORIES_RECOMPENSES);
  db.exec("UPDATE recompenses SET categorie = 'gros'");
  db.exec(SQL_CATEGORIES_RECOMPENSES);
  assert.equal(categories(db)["Une séance de ciné"], "gros");
  // Une sauvegarde d'avant la 22 est rangée à la restauration, pas une plus récente.
  assert.ok(transformationsApres(21).includes(SQL_CATEGORIES_RECOMPENSES));
  assert.ok(!transformationsApres(22).includes(SQL_CATEGORIES_RECOMPENSES));
});

test("récompense accessible ou pas encore, selon le solde", () => {
  assert.deepEqual(etatRecompense(50, 50), { accessible: true, part: 1 });
  assert.deepEqual(etatRecompense(50, 120), { accessible: true, part: 1 });
  assert.deepEqual(etatRecompense(400, 100), { accessible: false, part: 0.25 });
  assert.deepEqual(etatRecompense(400, 0), { accessible: false, part: 0 });
});

test("étagères : les cinq, toujours, dans l'ordre et avec les bonnes couleurs", () => {
  assert.deepEqual(etageres(), ["mer", "bouffe", "temps", "decouvertes", "gros"]);
  assert.deepEqual(CATEGORIES_RECOMPENSES.map((c) => c.couleur), ["#22D3EE", "#FB923C", "#A78BFA", "#FACC15", "#60A5FA"]);
  assert.equal(categorieRecompense("plaisirs").cle, "temps"); // clé d'avant la version 28
});

test("migration 28 : anciennes catégories rangées d'après le nom, nouvelles intactes, rejouable", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE recompenses (id INTEGER PRIMARY KEY, nom TEXT NOT NULL, categorie TEXT NOT NULL)");
  const ins = db.prepare("INSERT INTO recompenses (nom, categorie) VALUES (?, ?)");
  const lignes = [
    ["Aller boire un café", "plaisirs", "bouffe"],
    ["Une pâtisserie", "plaisirs", "bouffe"],
    ["Resto avec Léa", "sorties", "bouffe"],
    ["Une séance de ciné", "sorties", "decouvertes"],
    ["Rando dans les calanques", "sorties", "mer"],
    ["Un album", "musique", "temps"],
    ["Un épisode", "temps", "temps"],
    ["Un truc", "plaisirs", "temps"],
    ["Week-end à la mer", "gros", "gros"],
    ["Déjà rangée", "mer", "mer"],
  ];
  for (const [n, c] of lignes) ins.run(n, c);
  db.exec(SQL_CATEGORIES_RECOMPENSES_V2);
  db.exec(SQL_CATEGORIES_RECOMPENSES_V2);
  const res = Object.fromEntries(db.prepare("SELECT nom, categorie FROM recompenses").all().map((r) => [r.nom, r.categorie]));
  for (const [n, , attendu] of lignes) assert.equal(res[n], attendu, n);
  assert.ok(transformationsApres(27).includes(SQL_CATEGORIES_RECOMPENSES_V2));
  assert.ok(!transformationsApres(28).includes(SQL_CATEGORIES_RECOMPENSES_V2));
});

test("catalogue d'idées : icônes connues, prix dans les fourchettes, rien d'ajouté deux fois", () => {
  const prix = Object.values(IDEES_RECOMPENSES).flat().map((i) => i.prix);
  assert.ok(prix.every((p) => p >= 20 && p <= 1000));
  for (const i of Object.values(IDEES_RECOMPENSES).flat()) assert.ok(ICONES_RECOMPENSES.includes(i.icone), i.nom);
  assert.equal(IDEES_RECOMPENSES.mer.length, 8);
  assert.equal(IDEES_RECOMPENSES.bouffe.length, 7);
  assert.equal(IDEES_RECOMPENSES.temps.length, 7);
  assert.equal(IDEES_RECOMPENSES.decouvertes.length, 6);
  const restantes = ideesRestantes("bouffe", ["glace", " RESTO "]).map((i) => i.nom);
  // Gros objectifs : rien de proposé, on les crée soi-même ; chaque étagère est triée par prix.
  assert.equal(IDEES_RECOMPENSES.gros.length, 0);
  for (const l of Object.values(IDEES_RECOMPENSES)) assert.deepEqual(l.map((x) => x.prix), l.map((x) => x.prix).sort((a, b) => a - b));
  const noms = Object.values(IDEES_RECOMPENSES).flat().map((x) => x.nom.toLowerCase());
  assert.equal(new Set(noms).size, noms.length);
  assert.deepEqual(restantes, ["Pâtisserie", "Street food", "Verre en terrasse", "Brunch", "Soirée en ville"]);
});
