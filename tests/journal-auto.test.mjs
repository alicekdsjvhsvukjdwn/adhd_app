// Lancer : npm test
// « Ma journée » se remplit toute seule : entrées auto par source, regroupement des routines, 0 point, bonus, fusion, rétroactif.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { annulerCompletion, completer, getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { enregistrerHumeur } from "../lib/db/esprit.ts";
import { addItem } from "../lib/db/items.ts";
import { entreesDu, noterEntree, getEntree } from "../lib/db/journee.ts";
import { ecrireLiens, fusionner, getLiens, masquerEntree, remplirDepuis, synchroniserJour, synchroniserJournal } from "../lib/db/journal-auto.ts";
import { enregistrerMeditation } from "../lib/db/meditations.ts";
import { cocherTacheMenage, decocherTacheMenage, getMenage } from "../lib/db/menage.ts";
import { enregistrerSeanceGuidee } from "../lib/db/seances-guidees.ts";
import { getStats } from "../lib/db/stats.ts";
import { autoRessemblante, difference, lireLiens, regrouperRoutines } from "../lib/journal-auto-regles.ts";

const auj = () => getAujourdhui();
const autos = async (jour = auj()) => (await entreesDu(jour)).filter((e) => e.origine === "auto");
const points = async () => (await getStats()).points;

// ─── Règles pures ───

test("routines : une entrée par moment (et par zone), seulement si au moins une est faite", () => {
  const liens = lireLiens(null);
  const r = regrouperRoutines(
    [
      { categorie: "mouvement", moment: "reveil", heure: 7, fait: true },
      { categorie: "mouvement", moment: "matin", heure: null, fait: false },
      { categorie: "mouvement", moment: "matin", heure: 9, fait: true },
      { categorie: "focus", moment: "matin", heure: 10, fait: true },
      { categorie: "sommeil", moment: "coucher", heure: null, fait: false },
      { categorie: null, moment: "matin", heure: 8, fait: true }, // sans domaine : aucune zone par défaut
    ],
    liens,
  );
  assert.deepEqual(
    r.map((x) => [x.source_id, x.zone, x.texte]).sort(),
    [
      ["matin:bras", "bras", "Routines du matin · 2/3"],
      ["matin:tete", "tete", "Routines du matin · 1/1"],
    ],
  );
  assert.deepEqual(regrouperRoutines([{ categorie: "focus", moment: "soir", heure: null, fait: false }], liens), []);
  assert.deepEqual(regrouperRoutines([{ categorie: "focus", moment: "soir", heure: 20, fait: true }], { ...liens, off: ["routine"] }), []);
});

test("différence : ajoute, met à jour (sans écraser mon texte ni mes détails), supprime", () => {
  const voulues = [
    { source: "sport", source_id: "a", zone: "bras", texte: "Séance", duree_min: 20 },
    { source: "routine", source_id: "matin:bras", zone: "bras", texte: "Routines du matin · 3/5" },
    { source: "humeur", source_id: "j", zone: "ventre", texte: "Humeur notée" },
  ];
  const existantes = [
    { id: 1, source: "routine", source_id: "matin:bras", texte: "Routines du matin · 2/5", duree_min: null, ressenti: 4, texte_perso: 0 },
    { id: 2, source: "humeur", source_id: "j", texte: "Ma journée était douce", duree_min: null, ressenti: null, texte_perso: 1 },
    { id: 3, source: "menage", source_id: "piece:1", texte: "Ménage", duree_min: null, ressenti: null, texte_perso: 0 },
  ];
  const d = difference(voulues, existantes);
  assert.deepEqual(d.ajouter.map((a) => a.source_id), ["a"]);
  assert.deepEqual(d.maj, [{ id: 1, texte: "Routines du matin · 3/5", duree_min: null, ressenti: 4 }]);
  assert.deepEqual(d.supprimer, [3]);
});

test("fusion : même zone et un mot commun avec le texte ou la source", () => {
  const a = [
    { id: 1, zone: "bras", texte: "Séance guidée · Haut du corps", source: "sport" },
    { id: 2, zone: "mains", texte: "Ménage · Cuisine", source: "menage" },
  ];
  assert.equal(autoRessemblante("Fait du sport ce matin", "bras", a)?.id, 1);
  assert.equal(autoRessemblante("ménage de la cuisine", "mains", a)?.id, 2);
  assert.equal(autoRessemblante("ménage de la cuisine", "bras", a), null);
  assert.equal(autoRessemblante("Appelé maman", "mains", a), null);
});

// ─── Avec la base ───

test("chaque source crée son entrée auto, 0 point ; annuler l'action la retire", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const depart = await points();

  const routine = await addItem({ nom: "Étirements", type: "routine", categorie: "mouvement", moment: "matin" });
  const routine2 = await addItem({ nom: "Gainage", type: "routine", categorie: "mouvement", moment: "matin" });
  await completer(routine);
  await enregistrerSeanceGuidee("haut-10", 600, ["pompe"], true);
  await enregistrerMeditation("pause", 90, true);
  await enregistrerHumeur(4);
  const { taches } = await getMenage();
  await cocherTacheMenage(taches[0].id);
  const liste = (await db.getFirstAsync("SELECT id FROM listes ORDER BY id")).id;
  const tache = await addItem({ nom: "Envoyer le dossier", type: "tache", liste_id: liste });
  await db.runAsync("UPDATE listes SET zone = 'tete' WHERE id = ?", liste);
  await completer(tache);
  await db.runAsync("INSERT INTO achats (recompense_id, nom, icone, prix, date, horodatage) VALUES (NULL, 'Ciné', 'ticket', 100, ?, ?)", auj(), new Date().toISOString());
  const pointsActions = (await points()) - depart;

  await synchroniserJour(auj());
  const a = await autos();
  const par = (s) => a.filter((e) => e.source === s);
  assert.deepEqual(par("routine").map((e) => [e.zone, e.texte, e.moment]), [["bras", "Routines du matin · 1/2", "matin"]]);
  assert.deepEqual(par("sport").map((e) => [e.zone, e.texte, e.duree_min]), [["bras", "Séance guidée · Haut du corps", 10]]);
  assert.deepEqual(par("meditation").map((e) => [e.zone, e.duree_min]), [["ventre", 2]]);
  assert.deepEqual(par("humeur").map((e) => [e.zone, e.ressenti]), [["ventre", 4]]);
  assert.equal(par("menage")[0].zone, "mains");
  assert.deepEqual(par("tache").map((e) => [e.zone, e.texte]), [["tete", "Envoyer le dossier"]]);
  assert.equal(par("recompense")[0].zone, "ventre"); // sans catégorie connue : Temps pour moi
  assert.ok(a.every((e) => e.points === 0));
  assert.equal((await points()) - depart, pointsActions, "les entrées auto ne rapportent rien");
  // L'achat garde le lien vers son entrée.
  assert.equal((await db.getFirstAsync("SELECT journal_id FROM achats WHERE nom = 'Ciné'")).journal_id, par("recompense")[0].id);

  // Mise à jour : une 2e routine du matin → la même entrée passe à 2/2 ; pas de doublon.
  await completer(routine2);
  await synchroniserJour(auj());
  assert.deepEqual((await autos()).filter((e) => e.source === "routine").map((e) => e.texte), ["Routines du matin · 2/2"]);

  // Annuler : décocher tout supprime l'entrée des routines ; décocher le ménage, la tâche aussi.
  await annulerCompletion(routine);
  await annulerCompletion(routine2);
  await decocherTacheMenage(taches[0].id);
  await annulerCompletion(tache);
  await synchroniserJour(auj());
  const reste = (await autos()).map((e) => e.source);
  assert.ok(!reste.includes("routine") && !reste.includes("menage") && !reste.includes("tache"));
  assert.ok(reste.includes("sport"));
});

test("interrupteur par source, zone réglable, masquer reste masqué", async () => {
  await initialiserBase();
  const liens = await getLiens();
  await ecrireLiens({ ...liens, off: ["sport"], zones: { ...liens.zones, meditation: "tete" } });
  const db = await getDatabase();
  await db.runAsync("DELETE FROM journal WHERE origine = 'auto'");
  await synchroniserJour(auj());
  let a = await autos();
  assert.ok(!a.some((e) => e.source === "sport"));
  assert.ok(a.filter((e) => e.source === "meditation").every((e) => e.zone === "tete"));
  await ecrireLiens(lireLiens(null));

  const medit = a.find((e) => e.source === "meditation");
  await masquerEntree(medit.id);
  await synchroniserJour(auj());
  a = await autos();
  assert.ok(!a.some((e) => e.id === medit.id), "masquée : plus affichée");
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM journal WHERE source = 'meditation' AND jour = ?", auj())).n, 1, "pas recréée");
});

test("bonus des 4 zones : les entrées auto comptent (aujourd'hui), une seule fois", async () => {
  await initialiserBase();
  const db = await getDatabase();
  await db.runAsync("DELETE FROM journal WHERE jour = ?", auj());
  await db.runAsync("DELETE FROM journal_bonus WHERE jour = ?", auj());
  // Ventre (méditation), bras (séance), et deux notes : tête, cœur.
  await noterEntree({ jour: auj(), moment: "matin", zone: "tete", texte: "Candidature" });
  await noterEntree({ jour: auj(), moment: "matin", zone: "coeur", texte: "Appel à Léa" });
  const avant = await points();
  assert.equal(await synchroniserJournal(), true);
  assert.equal((await points()) - avant, 10);
  assert.equal(await synchroniserJournal(), false);
  assert.equal((await points()) - avant, 10);
});

test("fusion d'une note avec l'entrée auto : une seule entrée, mon texte, mes points rendus", async () => {
  const jour = auj();
  const sport = (await autos(jour)).find((e) => e.source === "sport");
  const avant = await points();
  const { id } = await noterEntree({ jour, moment: "soir", zone: "bras", texte: "Sport : haut du corps, dur !" });
  assert.equal(autoRessemblante("Sport : haut du corps, dur !", "bras", await autos(jour))?.id, sport.id);
  await fusionner(id, sport.id);
  assert.equal(await getEntree(id), null);
  const f = await getEntree(sport.id);
  assert.equal(f.texte, "Sport : haut du corps, dur !");
  assert.equal(await points(), avant, "la note fusionnée rend ses points");
  // La synchronisation ne remet pas l'ancien texte.
  await synchroniserJour(jour);
  assert.equal((await getEntree(sport.id)).texte, "Sport : haut du corps, dur !");
});

test("remplissage rétroactif : entrées passées, sans points ni bonus, sans doublon", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const jour = decalerJours(auj(), -12);
  const r = await addItem({ nom: "Lecture", type: "routine", categorie: "competences", moment: "soir" });
  await db.runAsync("UPDATE items SET cree_le = ? WHERE id = ?", decalerJours(auj(), -40) + "T08:00:00.000Z", r);
  await completer(r, "complet", undefined, undefined, undefined, jour);
  await db.runAsync("INSERT INTO meditations (date, seance, duree_s, terminee, points_donnes, horodatage) VALUES (?, 'corps', 600, 1, 0, '')", jour);
  await db.runAsync("INSERT INTO humeurs (jour, heure, niveau) VALUES (?, '09:00', 2)", jour);
  await db.runAsync("INSERT INTO seances_guidees (date, seance, duree_s, exercices, terminee, points_donnes, horodatage) VALUES (?, 'reveil', 300, '', 1, 0, '')", jour);
  const avant = await points();
  const n = await remplirDepuis(30);
  assert.ok(n >= 4);
  assert.equal(await points(), avant);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM journal_bonus WHERE jour = ?", jour)).n, 0);
  const a = await autos(jour);
  assert.deepEqual(a.map((e) => e.zone).sort(), ["bras", "tete", "ventre", "ventre"]);
  assert.equal(await remplirDepuis(30), 0, "relancer n'ajoute rien");
});
