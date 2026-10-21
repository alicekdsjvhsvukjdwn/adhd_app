// Lancer : npm test
// TCC en autonomie : échelle d'exposition, marches franchies, objectifs de la semaine, journal de confiance,
// séance avec moi-même, points sans double (règles pures, puis base en mémoire).
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { ajouterPensee } from "../lib/db/esprit.ts";
import { getStats } from "../lib/db/stats.ts";
import {
  ajouterConfiance,
  ajouterSituation,
  archiverSituation,
  commencerExposition,
  definirObjectifs,
  echelle,
  enregistrerSeanceMoi,
  expositionEnCours,
  listerConfiance,
  objectifsDe,
  ouJenSuis,
  progresConfiance,
  recapAutomatique,
  situationDepuisPensee,
  supprimerExposition,
  terminerExposition,
} from "../lib/db/tcc.ts";
import { FICHES } from "../lib/tcc-fiches.ts";
import {
  anxieteParSemaine,
  compteursSemaine,
  expositionReussie,
  IDEES_ECHELLE,
  joursDeFranchissement,
  liensAnxiete,
  libelleObjectif,
  lundiDe,
  marcheFranchie,
  marches,
  marchesParSemaine,
  objectifsDeSemaine,
  objectifsValides,
  progressionObjectifs,
  ranger,
  recapSemaine,
  semainesDepuis,
  tirer,
} from "../lib/tcc-regles.ts";

const expo = (id, situation_id, jour, anx_prevue, anx_reelle) => ({ id, situation_id, jour, anx_prevue, anx_reelle });

// ─── Règles pures ───

test("échelle : rangée de la plus facile à la plus dure, à égalité la plus ancienne d'abord", () => {
  const l = [
    { id: 3, nom: "C", anxiete: 70 },
    { id: 1, nom: "A", anxiete: 40 },
    { id: 4, nom: "D", anxiete: 40 },
    { id: 2, nom: "B", anxiete: 10 },
  ];
  assert.deepEqual(ranger(l).map((x) => x.nom), ["B", "A", "D", "C"]);
  assert.equal(l[0].nom, "C"); // la liste d'origine n'est pas modifiée
});

test("exposition réussie : au moins 20 points sous le prévu, ou réelle ≤ 30", () => {
  assert.equal(expositionReussie({ anx_prevue: 70, anx_reelle: 50 }), true); // exactement 20
  assert.equal(expositionReussie({ anx_prevue: 70, anx_reelle: 51 }), false);
  assert.equal(expositionReussie({ anx_prevue: 35, anx_reelle: 30 }), true); // presque facile : ≤ 30
  assert.equal(expositionReussie({ anx_prevue: 40, anx_reelle: 31 }), false);
  assert.equal(expositionReussie({ anx_prevue: 20, anx_reelle: 10 }), true);
  assert.equal(expositionReussie({ anx_prevue: 70, anx_reelle: 90 }), false); // plus dur que prévu
  assert.equal(expositionReussie({ anx_prevue: 70, anx_reelle: null }), false); // pas terminée
  assert.equal(expositionReussie({ anx_prevue: null, anx_reelle: 10 }), false);
});

test("marche franchie : 2 réussites (pas forcément de suite), pas 1", () => {
  assert.equal(marcheFranchie([expo(1, 1, "2026-10-01", 60, 30)]), false);
  assert.equal(marcheFranchie([expo(1, 1, "2026-10-01", 60, 30), expo(2, 1, "2026-10-02", 60, 80)]), false);
  assert.equal(marcheFranchie([expo(1, 1, "2026-10-01", 60, 30), expo(2, 1, "2026-10-02", 60, 80), expo(3, 1, "2026-10-09", 60, 35)]), true);
});

test("marches : la prochaine est la première, en montant, qui n'est pas franchie", () => {
  const s = [
    { id: 1, nom: "facile", anxiete: 20 },
    { id: 2, nom: "moyen", anxiete: 50 },
    { id: 3, nom: "dur", anxiete: 80 },
  ];
  const faites = [expo(1, 1, "2026-10-01", 40, 10), expo(2, 1, "2026-10-02", 40, 10), expo(3, 2, "2026-10-03", 60, 30)];
  const m = marches(s, faites);
  assert.deepEqual(m.map((x) => [x.situation.nom, x.franchie, x.prochaine, x.reussites]), [
    ["facile", true, false, 2],
    ["moyen", false, true, 1],
    ["dur", false, false, 0],
  ]);
  // Tout franchi : plus de prochaine.
  const tout = marches(s, [1, 2, 3].flatMap((id) => [expo(id * 10, id, "2026-10-01", 60, 10), expo(id * 10 + 1, id, "2026-10-02", 60, 10)]));
  assert.ok(tout.every((x) => x.franchie && !x.prochaine));
  // Une exposition pas terminée ne compte pas.
  assert.equal(marches(s, [expo(9, 1, "2026-10-01", 40, null)])[0].faites, 0);
});

test("jour de franchissement : celui de la deuxième réussite", () => {
  const l = [expo(1, 1, "2026-10-01", 60, 20), expo(2, 1, "2026-10-05", 60, 90), expo(3, 1, "2026-10-12", 60, 20), expo(4, 2, "2026-10-13", 60, 20)];
  assert.deepEqual([...joursDeFranchissement(l)], [[1, "2026-10-12"]]);
});

test("objectifs : valeurs hors limites corrigées, 3 au plus, reconduits si je ne change rien", () => {
  assert.deepEqual(objectifsValides([{ genre: "expositions", cible: 99 }, { genre: "nimporte", cible: 2 }, { genre: "seance", cible: 5 }, { genre: "expositions", cible: 1 }]), [
    { genre: "expositions", cible: 7 },
    { genre: "seance", cible: 1 },
  ]);
  assert.equal(objectifsValides(["expositions", "confiance", "experiences", "seance"].map((genre) => ({ genre, cible: 1 }))).length, 3);
  const lignes = [
    { semaine: "2026-10-05", genre: "expositions", cible: 2 },
    { semaine: "2026-10-12", genre: "confiance", cible: 3 },
  ];
  assert.deepEqual(objectifsDeSemaine(lignes, "2026-10-12"), [{ genre: "confiance", cible: 3 }]);
  assert.deepEqual(objectifsDeSemaine(lignes, "2026-10-19"), [{ genre: "confiance", cible: 3 }]); // reconduit
  assert.deepEqual(objectifsDeSemaine(lignes, "2026-10-06"), [{ genre: "expositions", cible: 2 }]);
  assert.deepEqual(objectifsDeSemaine(lignes, "2026-09-28"), []); // rien avant
  assert.equal(libelleObjectif("expositions", 2), "2 expositions");
  assert.equal(libelleObjectif("seance", 1), "1 séance avec moi-même");
});

test("objectif de la semaine : les pastilles se remplissent (lundi → dimanche)", () => {
  const semaine = Array.from({ length: 7 }, (_, i) => decalerJours("2026-10-19", i)); // lundi 19 → dimanche 25
  const c = compteursSemaine(semaine, {
    expositions: [
      { jour: "2026-10-18", experience: false }, // dimanche d'avant : exclue
      { jour: "2026-10-19", experience: false }, // lundi : incluse
      { jour: "2026-10-25", experience: true }, // dimanche : incluse
      { jour: "2026-10-26", experience: true }, // lundi suivant : exclue
    ],
    confiance: [{ jour: "2026-10-20" }, { jour: "2026-10-20" }, { jour: "2026-10-21" }],
    seances: [],
  });
  assert.deepEqual(c, { expositions: 2, experiences: 1, confiance: 3, seance: 0 });
  const p = progressionObjectifs([{ genre: "expositions", cible: 3 }, { genre: "confiance", cible: 2 }, { genre: "seance", cible: 1 }], c);
  assert.deepEqual(p.map((o) => [o.genre, o.fait, o.atteint]), [["expositions", 2, false], ["confiance", 2, true], ["seance", 0, false]]);
});

test("semaines : lundi, 8 semaines jusqu'à la semaine en cours ; anxiété prévue / réelle et marches par semaine", () => {
  assert.equal(lundiDe("2026-10-25"), "2026-10-19"); // dimanche
  assert.equal(lundiDe("2026-10-19"), "2026-10-19"); // lundi
  const s = semainesDepuis("2026-10-21", 8);
  assert.equal(s.length, 8);
  assert.equal(s.at(-1), "2026-10-19");
  assert.equal(s[0], "2026-08-31");
  const l = [expo(1, 1, "2026-10-20", 60, 20), expo(2, 1, "2026-10-21", 80, 40), expo(3, 1, "2026-10-12", 50, 50), expo(4, 1, "2026-08-01", 50, 50)];
  const a = anxieteParSemaine(l, "2026-10-21", 8);
  assert.deepEqual([a.at(-1).prevue, a.at(-1).reelle], [70, 30]);
  assert.deepEqual([a.at(-2).prevue, a.at(-2).reelle], [50, 50]);
  assert.equal(a[0].prevue, null);
  const m = marchesParSemaine([expo(1, 1, "2026-10-12", 60, 20), expo(2, 1, "2026-10-20", 60, 20)], "2026-10-21", 8);
  assert.equal(m.at(-1).n, 1); // franchie le 20, deuxième réussite
  assert.equal(m.at(-2).n, 0);
});

test("récap de la séance : bornes de semaine, anxiété moyenne, objectifs", () => {
  const r = recapSemaine("2026-10-19", {
    humeurs: [
      { jour: "2026-10-18", niveau: 1 },
      { jour: "2026-10-19", niveau: 2 },
      { jour: "2026-10-25", niveau: 4 },
      { jour: "2026-10-26", niveau: 5 },
    ],
    expositions: [
      { ...expo(1, 1, "2026-10-19", 60, 30), experience: false },
      { ...expo(2, 1, "2026-10-25", 80, 50), experience: false },
      { ...expo(3, 1, "2026-10-26", 90, 90), experience: false },
      { ...expo(4, 1, "2026-10-20", 50, null), experience: false },
    ],
    confiance: [{ jour: "2026-10-19" }, { jour: "2026-10-27" }],
    seances: [],
    objectifs: [{ genre: "expositions", cible: 2 }],
  });
  assert.equal(r.humeur, 3);
  assert.equal(r.expositions, 2);
  assert.deepEqual([r.anxietePrevue, r.anxieteReelle], [70, 40]);
  assert.equal(r.confiance, 1);
  assert.equal(r.objectifs[0].atteint, true);
  const vide = recapSemaine("2026-10-19", { humeurs: [], expositions: [], confiance: [], seances: [], objectifs: [] });
  assert.deepEqual([vide.humeur, vide.anxietePrevue, vide.anxieteReelle], [null, null, null]);
});

test("« Encore une » : une autre que celle qu'on vient de voir ; liste vide ou d'une seule entrée", () => {
  assert.equal(tirer([], null), null);
  assert.equal(tirer(["a"], "a"), "a");
  assert.equal(tirer(["a", "b"], "a", () => 0), "b");
  assert.equal(tirer(["a", "b", "c"], "b", () => 0.99), "c");
  assert.equal(tirer(["a", "b", "c"], null, () => 0), "a");
});

test("liens avec le sommeil et le sport : rien sous 7 jours par groupe", () => {
  const jours = Array.from({ length: 20 }, (_, i) => decalerJours("2026-09-01", i));
  const anxieteParJour = Object.fromEntries(jours.map((j, i) => [j, i < 10 ? 30 : 60]));
  const sommeilMinParJour = Object.fromEntries(jours.map((j, i) => [j, i < 10 ? 450 : 360]));
  const l = liensAnxiete({ anxieteParJour, sommeilMinParJour, joursSport: new Set(jours.slice(0, 3)) });
  assert.equal(l.find((x) => x.cle === "sommeil").resultat.ok, true);
  assert.equal(l.find((x) => x.cle === "sport").resultat.ok, false); // 3 jours de sport seulement
  assert.equal(liensAnxiete({ anxieteParJour: {}, sommeilMinParJour: {}, joursSport: new Set() }).every((x) => !x.resultat.ok), true);
});

test("idées d'échelle et fiches : de quoi démarrer, sans doublon, chaque fiche renvoie vers un outil", () => {
  const noms = IDEES_ECHELLE.map((i) => i.nom.toLowerCase());
  assert.equal(new Set(noms).size, noms.length);
  assert.ok(IDEES_ECHELLE.every((i) => i.anxiete >= 0 && i.anxiete <= 100));
  assert.ok(IDEES_ECHELLE.length >= 9);
  assert.equal(new Set(FICHES.map((f) => f.id)).size, FICHES.length);
  for (const f of FICHES) {
    assert.ok(f.texte.length >= 2 && f.titre && f.resume, f.id);
    assert.match(f.outil.route, /^\/(echelle|confiance|pensee)$/);
  }
  for (const id of ["cercle", "exposition", "securite", "lecture", "projection", "personnalisation", "attention", "compassion"]) {
    assert.ok(FICHES.some((f) => f.id === id), id);
  }
});

// ─── Base en mémoire ───

await initialiserBase();
const AUJ = getAujourdhui();
const J = (n) => decalerJours(AUJ, n);
const points = async () => (await getStats()).points;

test("échelle : ajouter, ranger, retirer (l'historique reste)", async () => {
  const dur = await ajouterSituation("Donner mon avis dans un groupe", 65);
  const facile = await ajouterSituation("  Dire bonjour  ", 20);
  await ajouterSituation("Trop haut", 250); // plafonné à 100
  let l = await echelle();
  assert.deepEqual(l.map((m) => m.situation.nom), ["Dire bonjour", "Donner mon avis dans un groupe", "Trop haut"]);
  assert.equal(l.at(-1).situation.anxiete, 100);
  assert.equal(l[0].prochaine, true);
  const e = await commencerExposition(facile, 40, "Je vais bafouiller", J(-1));
  await terminerExposition(e, { anxReelle: 10, vecu: "Ça s'est bien passé", retenu: "ok", securite: ["Le téléphone"] });
  await archiverSituation(facile);
  l = await echelle();
  assert.ok(!l.some((m) => m.situation.id === facile));
  const db = await getDatabase();
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM tcc_expositions WHERE situation_id = ?", facile)).n, 1);
  assert.equal(l[0].situation.id, dur);
  await db.runAsync("DELETE FROM tcc_echelle");
  await db.runAsync("DELETE FROM tcc_expositions");
  await db.runAsync("DELETE FROM tcc_points_jours");
});

test("exposition : avant, reprise si l'appli se ferme, après, marche franchie à la 2ᵉ réussite, +5 pts une fois par jour", async () => {
  const sit = await ajouterSituation("Appeler pour un rendez-vous", 55);
  const avant = await points();

  const e1 = await commencerExposition(sit, 70, "Je vais me tromper");
  assert.equal((await expositionEnCours(sit)).id, e1); // reprise possible
  assert.equal((await echelle())[0].faites, 0); // pas terminée : ne compte pas encore
  assert.equal(await points(), avant);
  const r1 = await terminerExposition(e1, { anxReelle: 35, vecu: "Ça va", retenu: "Moins pire", securite: ["Préparer mes phrases", "Éviter le regard"] });
  assert.deepEqual([r1.points, r1.reussie, r1.marcheFranchie], [5, true, false]);
  assert.equal(await expositionEnCours(sit), null);
  assert.equal(await points(), avant + 5);

  // Deuxième exposition le même jour : aucun point de plus.
  const e2 = await commencerExposition(sit, 60, "");
  const r2 = await terminerExposition(e2, { anxReelle: 25, vecu: "", retenu: "", securite: [] });
  assert.deepEqual([r2.points, r2.reussie, r2.marcheFranchie], [0, true, true]);
  assert.equal(await points(), avant + 5);
  assert.equal((await echelle())[0].franchie, true);

  // Supprimer l'une : le jour garde ses points ; supprimer les deux : repris.
  await supprimerExposition(e1);
  assert.equal(await points(), avant + 5);
  await supprimerExposition(e2);
  assert.equal(await points(), avant);

  // Un autre jour : +5 de nouveau, une fois.
  const e3 = await commencerExposition(sit, 50, "", J(-3));
  assert.equal((await terminerExposition(e3, { anxReelle: 60, vecu: "", retenu: "", securite: [] })).points, 5); // plus dur que prévu : ça compte pour le jour
  assert.equal((await terminerExposition(e3, { anxReelle: 60, vecu: "", retenu: "", securite: [] })).points, 0); // rejouée : pas de double
  assert.equal(await points(), avant + 5);
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_expositions");
  await db.runAsync("DELETE FROM tcc_echelle");
  await db.runAsync("DELETE FROM tcc_points_jours");
  await db.runAsync("UPDATE stats SET points_total = ? WHERE id = 1", avant);
});

test("journal de confiance : 3 lignes par jour au plus, ligne vide ignorée", async () => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_confiance");
  assert.equal(await ajouterConfiance("   "), false);
  assert.equal(await ajouterConfiance("J'ai dit bonjour", AUJ), true);
  assert.equal(await ajouterConfiance("J'ai posé une question", AUJ), true);
  assert.equal(await ajouterConfiance("Je suis restée calme", AUJ), true);
  assert.equal(await ajouterConfiance("Une quatrième", AUJ), false);
  assert.equal(await ajouterConfiance("Hier", J(-1)), true); // un autre jour a sa place
  const l = await listerConfiance();
  assert.equal(l.length, 4);
  assert.equal(l[0].jour, AUJ);
  assert.ok(!l.some((x) => x.texte === "Une quatrième"));
});

test("objectifs de la semaine : choisis, reconduits, remplacés", async () => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_objectifs");
  const lundi = lundiDe(AUJ);
  assert.deepEqual(await objectifsDe(lundi), []);
  await definirObjectifs(lundi, [{ genre: "expositions", cible: 2 }, { genre: "confiance", cible: 3 }]);
  assert.equal((await objectifsDe(lundi)).length, 2);
  assert.deepEqual(await objectifsDe(decalerJours(lundi, 7)), await objectifsDe(lundi)); // reconduits
  await definirObjectifs(lundi, [{ genre: "seance", cible: 1 }]);
  assert.deepEqual(await objectifsDe(lundi), [{ genre: "seance", cible: 1 }]);
  await db.runAsync("DELETE FROM tcc_objectifs");
});

test("séance avec moi-même : récap automatique, prochain pas, objectifs de la semaine d'après, +5 pts sans double avec une exposition", async () => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_confiance");
  await db.runAsync("DELETE FROM tcc_points_jours");
  const lundi = lundiDe(AUJ);
  const avant = await points();
  const facile = await ajouterSituation("Dire bonjour", 20);
  const dur = await ajouterSituation("Dire non", 70);
  await definirObjectifs(lundi, [{ genre: "expositions", cible: 1 }, { genre: "confiance", cible: 1 }]);
  await ajouterConfiance("Une bonne chose", AUJ);
  const e = await commencerExposition(facile, 50, "");
  await terminerExposition(e, { anxReelle: 20, vecu: "", retenu: "", securite: [] }); // +5 (exposition)
  assert.equal(await points(), avant + 5);

  const recap = await recapAutomatique(lundi);
  assert.equal(recap.expositions, 1);
  assert.equal(recap.confiance, 1);
  assert.deepEqual([recap.anxietePrevue, recap.anxieteReelle], [50, 20]);
  assert.deepEqual(recap.objectifs.map((o) => o.atteint), [true, true]);

  const r = await enregistrerSeanceMoi({ retenu: "Ça passe mieux sans préparer", situationId: dur, objectifsSuivants: [{ genre: "experiences", cible: 1 }], motGentil: "Bravo" });
  assert.equal(r.points, 0); // exposition le même jour : déjà payé
  assert.equal(await points(), avant + 5);
  assert.deepEqual(await objectifsDe(decalerJours(lundi, 7)), [{ genre: "experiences", cible: 1 }]);

  const o = await ouJenSuis(AUJ);
  assert.equal(o.derniereSeance.prochaine, "Dire non");
  assert.equal(o.derniereSeance.retenu, "Ça passe mieux sans préparer");
  assert.deepEqual(o.marches, { franchies: 0, total: 2 });
  assert.equal(o.courbe.length, 8);
  assert.equal(o.objectifs.length, 2);
  const ligne = await db.getFirstAsync("SELECT * FROM tcc_seances_moi ORDER BY id DESC");
  assert.equal(ligne.semaine, lundi);
  assert.equal(ligne.expositions, 1);

  // Sans objectif choisi, ceux de cette semaine se reconduisent pour la suivante.
  await db.runAsync("DELETE FROM tcc_objectifs WHERE semaine = ?", decalerJours(lundi, 7));
  await enregistrerSeanceMoi({ retenu: "", situationId: null, objectifsSuivants: [], motGentil: "" });
  assert.deepEqual((await objectifsDe(decalerJours(lundi, 7))).map((x) => x.genre).sort(), ["confiance", "expositions"]);

  // Séance seule, un jour sans exposition : +5 une fois.
  await db.runAsync("DELETE FROM tcc_expositions");
  await db.runAsync("DELETE FROM tcc_points_jours");
  await db.runAsync("UPDATE stats SET points_total = ? WHERE id = 1", avant);
  await db.runAsync("DELETE FROM tcc_seances_moi");
  const seule = await enregistrerSeanceMoi({ retenu: "", situationId: null, objectifsSuivants: [], motGentil: "" });
  assert.equal(seule.points, 5);
  assert.equal((await enregistrerSeanceMoi({ retenu: "", situationId: null, objectifsSuivants: [], motGentil: "" })).points, 0);
  assert.equal(await points(), avant + 5);
  await db.runAsync("DELETE FROM tcc_seances_moi");
  await db.runAsync("DELETE FROM tcc_points_jours");
  await db.runAsync("DELETE FROM tcc_echelle");
  await db.runAsync("DELETE FROM tcc_objectifs");
  await db.runAsync("UPDATE stats SET points_total = ? WHERE id = 1", avant);
});

test("tester une pensée : une marche liée à la pensée (une seule), comptée comme expérience", async () => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tcc_echelle");
  await db.runAsync("DELETE FROM tcc_expositions");
  await db.runAsync("DELETE FROM tcc_points_jours");
  const p = await ajouterPensee({ situation: "Au travail", pensee: "Tout le monde va me trouver nulle", intensite_avant: 75 });
  const s1 = await situationDepuisPensee(p);
  const s2 = await situationDepuisPensee(p);
  assert.equal(s1, s2);
  const marche = (await echelle()).find((m) => m.situation.id === s1);
  assert.equal(marche.situation.anxiete, 75);
  assert.match(marche.situation.nom, /Tout le monde va me trouver nulle/);
  const e = await commencerExposition(s1, 75, "Tout le monde va me trouver nulle");
  await terminerExposition(e, { anxReelle: 40, vecu: "", retenu: "", securite: [] });
  const lundi = lundiDe(AUJ);
  await definirObjectifs(lundi, [{ genre: "experiences", cible: 1 }]);
  assert.equal((await ouJenSuis(AUJ)).objectifs[0].atteint, true);
  const pr = await progresConfiance(AUJ);
  assert.equal(pr.vide, false);
  assert.equal(pr.anxiete.at(-1).reelle, 40);
  assert.equal(pr.marches.length, 8);
  await db.runAsync("DELETE FROM tcc_objectifs");
  await db.runAsync("DELETE FROM tcc_echelle");
  await db.runAsync("DELETE FROM tcc_expositions");
  await db.runAsync("DELETE FROM tcc_points_jours");
});
