// Lancer : npm test
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  compterDans,
  debutPeriode,
  deltaPoints,
  finPeriode,
  idees,
  lireFrequence,
  libelleCompte,
  palierEtapes,
  periodesRecentes,
  pointsPalier,
  PLAFOND_RETARD,
  retardObjectif,
  urgenceAvecRetard,
  serieAtteinte,
  SQL_CARNET,
} from "../lib/regles-taches.ts";

const E = (essentielle, cochee) => ({ essentielle, cochee });

test("paliers : essentielles, puis tout", () => {
  const etapes = [E(true, false), E(true, false), E(false, false)];
  assert.equal(palierEtapes(etapes), 0);
  assert.equal(palierEtapes([E(true, true), E(true, false), E(false, true)]), 0);
  assert.equal(palierEtapes([E(true, true), E(true, true), E(false, false)]), 1);
  assert.equal(palierEtapes([E(true, true), E(true, true), E(false, true)]), 2);
  // Sans essentielle : il faut au moins une étape cochée.
  assert.equal(palierEtapes([E(false, false), E(false, false)]), 0);
  assert.equal(palierEtapes([E(false, true), E(false, false)]), 1);
  assert.equal(palierEtapes([]), 0);
});

test("points : normal 10 puis 15, jour difficile 15 dès les essentielles", () => {
  assert.equal(pointsPalier(0, false), 0);
  assert.equal(pointsPalier(1, false), 10);
  assert.equal(pointsPalier(2, false), 15);
  assert.equal(pointsPalier(1, true), 15);
  assert.equal(pointsPalier(2, true), 15);
});

test("décochage et recochage : jamais de points en double dans la journée", () => {
  // On suit ce qui a été donné, comme la colonne completions.points.
  let donnes = 0;
  let total = 0;
  const passer = (palier, jd = false) => {
    const d = deltaPoints(donnes, palier, jd);
    total += d;
    donnes += d;
  };
  passer(1); // essentielles : +10
  passer(2); // tout : +5
  assert.equal(total, 15);
  passer(1); // une bonus décochée : −5
  assert.equal(total, 10);
  passer(0); // une essentielle décochée : −10
  assert.equal(total, 0);
  passer(1);
  passer(2);
  passer(1);
  passer(2); // coche, décoche, recoche…
  assert.equal(total, 15);
  passer(2, true); // jour difficile activé après coup : rien de plus
  assert.equal(total, 15);
});

test("semaine : du lundi au dimanche", () => {
  assert.equal(debutPeriode("2026-10-15", "semaine"), "2026-10-12"); // jeudi → lundi
  assert.equal(debutPeriode("2026-10-12", "semaine"), "2026-10-12"); // lundi
  assert.equal(debutPeriode("2026-10-18", "semaine"), "2026-10-12"); // dimanche
  assert.equal(finPeriode("2026-10-15", "semaine"), "2026-10-18");
  // Semaine à cheval sur deux mois
  assert.equal(debutPeriode("2026-11-01", "semaine"), "2026-10-26");
});

test("mois : fin de mois, 1er du mois, février", () => {
  assert.equal(debutPeriode("2026-10-31", "mois"), "2026-10-01");
  assert.equal(debutPeriode("2026-11-01", "mois"), "2026-11-01");
  assert.equal(finPeriode("2026-10-01", "mois"), "2026-10-31");
  assert.equal(finPeriode("2026-11-15", "mois"), "2026-11-30");
  assert.equal(finPeriode("2027-02-03", "mois"), "2027-02-28");
  assert.equal(finPeriode("2028-02-03", "mois"), "2028-02-29");
  assert.equal(finPeriode("2026-12-31", "mois"), "2026-12-31");

  const faits = ["2026-10-30", "2026-10-31", "2026-11-01"];
  // Le 31 compte pour octobre, le 1er repart à zéro pour novembre.
  assert.equal(compterDans(faits, "2026-10-01", finPeriode("2026-10-01", "mois")), 2);
  assert.equal(compterDans(faits, debutPeriode("2026-11-01", "mois"), finPeriode("2026-11-01", "mois")), 1);
});

test("périodes récentes et série d'objectifs atteints", () => {
  const p = periodesRecentes("2026-10-15", "mois", 3);
  assert.deepEqual(p.map((x) => x.debut), ["2026-08-01", "2026-09-01", "2026-10-01"]);
  assert.equal(p[0].fin, "2026-08-31");
  assert.equal(periodesRecentes("2026-10-15", "semaine", 8).length, 8);

  // Période en cours pas encore atteinte : la série tient depuis les précédentes.
  assert.equal(serieAtteinte([3, 1, 3, 4, 1], 3), 2);
  assert.equal(serieAtteinte([3, 3, 3], 3), 3);
  assert.equal(serieAtteinte([3, 2, 0], 3), 0);
  assert.equal(serieAtteinte([], 3), 0);
});

test("fréquence et libellé de la carte", () => {
  assert.deepEqual(lireFrequence("semaine:3"), { periode: "semaine", cible: 3 });
  assert.deepEqual(lireFrequence("mois:2"), { periode: "mois", cible: 2 });
  assert.equal(lireFrequence(null), null);
  assert.equal(lireFrequence("quotidien"), null);
  assert.equal(libelleCompte(2, 3, "semaine"), "2/3 cette semaine");
  assert.equal(libelleCompte(1, 2, "mois"), "1/2 ce mois-ci");
});

test("idées : une par ligne", () => {
  assert.deepEqual(idees("Appeler Paul\n\n  Relire le devis  \r\n"), ["Appeler Paul", "Relire le devis"]);
  assert.deepEqual(idees(null), []);
});

test("carnet : la note reste liée à la bonne complétion", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE items (id INTEGER PRIMARY KEY, nom TEXT, liste_id INTEGER);
    CREATE TABLE completions (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, date TEXT, UNIQUE(item_id, date));
    CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL DEFAULT '', completion_id INTEGER, fait TEXT, retenu TEXT, idees TEXT,
      cree_le TEXT NOT NULL DEFAULT '', maj_le TEXT NOT NULL DEFAULT '', UNIQUE(item_id, date));
    INSERT INTO items VALUES (1, 'Courir', 7), (2, 'Ranger', 7), (3, 'Autre liste', 8);
    INSERT INTO completions (item_id, date) VALUES (1, '2026-10-13'), (1, '2026-10-15'), (2, '2026-10-15'), (3, '2026-10-15');
  `);
  const noter = (item, date, fait, idees = null) =>
    db.prepare(SQL_CARNET.enregistrer).run(item, date, item, date, fait, null, idees, "t", "t");

  noter(1, "2026-10-15", "5 km");
  const fois = db.prepare(SQL_CARNET.foisFaites).all(1);
  assert.deepEqual(fois.map((f) => [f.date, f.fait]), [["2026-10-15", "5 km"], ["2026-10-13", null]]);
  const idCompletion = db.prepare("SELECT id FROM completions WHERE item_id = 1 AND date = '2026-10-15'").get().id;
  assert.equal(db.prepare("SELECT completion_id FROM notes").get().completion_id, idCompletion);
  // La même tâche, le même jour : pas d'autre complétion touchée.
  assert.equal(db.prepare(SQL_CARNET.foisFaites).all(2)[0].fait, null);

  // Décocher puis recocher : nouvelle complétion, même note, completion_id à jour au prochain enregistrement.
  db.exec("DELETE FROM completions WHERE item_id = 1 AND date = '2026-10-15'");
  db.exec("INSERT INTO completions (item_id, date) VALUES (1, '2026-10-15')");
  assert.equal(db.prepare(SQL_CARNET.foisFaites).all(1)[0].fait, "5 km");
  noter(1, "2026-10-15", "5 km, sous la pluie", "Acheter un k-way");
  const nouvelId = db.prepare("SELECT id FROM completions WHERE item_id = 1 AND date = '2026-10-15'").get().id;
  assert.equal(db.prepare("SELECT completion_id FROM notes WHERE item_id = 1").get().completion_id, nouvelId);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM notes").get().n, 1);

  // Carnet de la liste 7 : seulement ses tâches, notes non vides.
  noter(2, "2026-10-15", "");
  noter(3, "2026-10-15", "hors liste");
  const carnet = db.prepare(SQL_CARNET.carnetListe).all(7);
  assert.deepEqual(carnet.map((n) => n.nom), ["Courir"]);
});

test("changement d'énergie : points des routines à étapes recalculés, sans double", () => {
  // Même règle que recalculerPointsEtapesDuJour : on part de ce qui est déjà donné.
  let donnes = 10; // essentielles faites, jour normal
  let total = 10;
  const changer = (palier, jd) => {
    const d = deltaPoints(donnes, palier, jd);
    total += d;
    donnes += d;
  };
  changer(1, true); // passe en Jour difficile : +5
  assert.equal(total, 15);
  changer(1, true); // re-choisi : rien
  assert.equal(total, 15);
  changer(1, false); // repasse en Normal : −5
  assert.equal(total, 10);
  // Tout fait : 15 quel que soit l'état, rien ne bouge.
  donnes = 15;
  total = 15;
  changer(2, true);
  changer(2, false);
  assert.equal(total, 15);
});

test("retard sur l'objectif : au prorata des jours écoulés", () => {
  // Semaine du lundi 12 au dimanche 18 octobre 2026, objectif 5.
  assert.ok(retardObjectif(0, 5, "2026-10-12", "semaine") < 0.15); // lundi : 1/7 attendu
  assert.equal(retardObjectif(5, 5, "2026-10-14", "semaine"), 0); // en avance : 0
  assert.ok(Math.abs(retardObjectif(1, 5, "2026-10-18", "semaine") - 0.8) < 1e-9); // dimanche, 1/5
  assert.equal(retardObjectif(0, 5, "2026-10-18", "semaine"), 1); // plafonné à 1
  // Mois de 31 jours, objectif 2 : le 31 sans rien fait, retard plein.
  assert.equal(retardObjectif(0, 2, "2026-10-31", "mois"), 1);
  assert.ok(retardObjectif(0, 2, "2026-10-01", "mois") < 0.05);
  assert.equal(retardObjectif(0, 0, "2026-10-31", "mois"), 0);
});

test("urgence : le retard est plafonné à 0,6, une échéance proche reste devant", () => {
  assert.equal(urgenceAvecRetard(1, 1), 1); // échéance aujourd'hui
  assert.equal(urgenceAvecRetard(0, 1), PLAFOND_RETARD);
  assert.equal(urgenceAvecRetard(0.2, 0.5), 0.3);
  assert.equal(urgenceAvecRetard(0.7, 0.5), 0.7);
  assert.equal(urgenceAvecRetard(0, 0), 0);
});

test("moteur : le retard enregistré ne compte qu'à travers l'urgence, poids inchangés", async () => {
  const { POIDS, scoreTotal } = await import("../lib/moteur-regles.ts");
  const somme = Object.values(POIDS).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(somme - 1) < 1e-9);
  const base = { urgence: 0, importance: 0.5, moment: 0.5, equilibre: 0.5, etat: 0.5, negligence: 0 };
  // retard_liste seul (journal) : aucun effet sur le score.
  assert.equal(scoreTotal({ ...base, retard_liste: 1 }), scoreTotal(base));
  // À travers l'urgence plafonnée : effet borné à 0,6 × poids de l'urgence.
  const avec = scoreTotal({ ...base, urgence: urgenceAvecRetard(0, 1) });
  assert.ok(Math.abs(avec - scoreTotal(base) - PLAFOND_RETARD * POIDS.urgence) < 1e-9);
});
