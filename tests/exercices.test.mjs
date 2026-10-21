// Lancer : npm test
// Sport, lot 1 : bibliothèque d'exercices, matériel (filtre et alternatives), historique d'un exercice.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getDatabase } from "../lib/db/client.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { historiqueExercice } from "../lib/db/exercices-historique.ts";
import { configurerSport, getReglages, noterEssai } from "../lib/db/sport.ts";
import { ecrireMateriel, getMateriel, materielConfigure } from "../lib/db/sport-materiel.ts";
import { alternativeA, EXERCICES, exercice, faisable, filtrer, uniteDe } from "../lib/exercices.ts";
import { manquants, MATERIEL_DEFAUT, MATERIELS, materielValide } from "../lib/materiel.ts";
import { seanceExercice, ZONES } from "../lib/seances.ts";

// FigureSkill.tsx dépend de react-native : on lit le source.
const figures = readFileSync(new URL("../components/FigureSkill.tsx", import.meta.url), "utf8");
const cles = MATERIELS.map((m) => m.cle);
const avec = (...dispo) => materielValide({ dispo: Object.fromEntries(cles.map((c) => [c, dispo.includes(c)])), poids: [] });

// ─── Bibliothèque ───

test("bibliothèque : au moins 60 exercices, ids uniques, chacun avec son bonhomme, ses consignes et son niveau", () => {
  assert.ok(EXERCICES.length >= 60, String(EXERCICES.length));
  const ids = EXERCICES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of EXERCICES) {
    assert.match(figures, new RegExp(`\n  ${e.figure}: \\{ d:`), `${e.id} → ${e.figure}`);
    assert.ok(e.zones.length > 0 && e.zones.every((z) => ZONES.some((y) => y.cle === z)), e.id);
    assert.ok(e.muscles.length > 0, e.id);
    assert.ok(e.consignes.length >= 2 && e.consignes.length <= 3, `${e.id} : ${e.consignes.length} consignes`);
    assert.equal(e.consigne, e.consignes[0]);
    assert.ok([1, 2, 3, 4, 5].includes(e.niveau), e.id);
    assert.ok(["reps", "s", "reps_poids"].includes(e.mode), e.id);
    assert.ok(e.materiel.every((m) => cles.includes(m)), e.id);
    assert.ok(!e.lien, `${e.id} : les liens vidéo restent vides`);
  }
});

test("variantes et alternatives : elles existent, ne se pointent pas elles-mêmes, la plus facile ne l'est pas moins", () => {
  for (const e of EXERCICES) {
    for (const cle of ["plus_facile", "plus_dur", "alternative"]) {
      if (!e[cle]) continue;
      assert.ok(exercice(e[cle]), `${e.id}.${cle} → ${e[cle]}`);
      assert.notEqual(e[cle], e.id, `${e.id}.${cle}`);
    }
    if (e.plus_facile) assert.ok(exercice(e.plus_facile).niveau <= e.niveau, `${e.id} → ${e.plus_facile}`);
    if (e.plus_dur) assert.ok(exercice(e.plus_dur).niveau >= e.niveau, `${e.id} → ${e.plus_dur}`);
  }
});

test("de quoi faire un programme complet : les mouvements demandés sont là, du sol aux parallettes et haltères", () => {
  const noms = EXERCICES.map((e) => e.nom);
  for (const n of [
    "Pompes", "Pompes inclinées", "Pompes sur les genoux", "Pike push-ups", "Pike shoulder taps", "Dips aux parallettes", "L-sit aux parallettes",
    "Tuck L-sit aux parallettes", "Tuck planche aux parallettes", "Rowing haltère", "Rowing sous une table", "Curl aux haltères", "Presse d'épaules aux haltères",
    "Squat", "Fente", "Squat bulgare", "Pistol squat assisté", "Hip thrust", "Pont fessier", "Montées sur pointes", "Hollow body hold", "Planche",
    "Dead bug", "Superman", "Reverse snow angels", "Planche latérale avec rotation", "Poirier contre le mur", "Pistol squat",
  ]) assert.ok(noms.includes(n), n);
  assert.ok(EXERCICES.some((e) => e.zones.includes("mobilite") && /épaules/.test(e.muscles.join(" "))), "mobilité épaules");
  assert.ok(EXERCICES.some((e) => e.zones.includes("mobilite") && /hanches/.test(e.muscles.join(" "))), "mobilité hanches");
  for (const z of ["haut", "bas", "abdos", "mobilite"]) assert.ok(EXERCICES.filter((e) => e.zones.includes(z)).length >= 8, z);
  for (const m of ["sol", "mobilier", "halteres", "parallettes"]) assert.ok(EXERCICES.some((e) => e.materiel.includes(m)) || m === "sol", m);
  assert.ok(EXERCICES.filter((e) => e.materiel.includes("barre")).length >= 2); // tractions : visibles, grisées sans barre
  assert.equal(uniteDe(exercice("planche")), "s");
  assert.equal(uniteDe(exercice("curl_halteres")), "reps");
});

// ─── Matériel ───

test("matériel : valeurs par défaut, sol toujours là, poids arrondis au demi-kilo, triés, sans doublon", () => {
  assert.deepEqual(
    Object.entries(MATERIEL_DEFAUT.dispo).filter(([, v]) => v).map(([k]) => k),
    ["sol", "mobilier", "halteres", "parallettes"],
  );
  assert.equal(materielValide(null).dispo.barre, false);
  assert.equal(materielValide({ dispo: { sol: false } }).dispo.sol, true);
  assert.deepEqual(materielValide({ poids: [8, "2,5", 2.5, 10, -3, 0, "x", 250, 7.8] }).poids, [2.5, 8, 10]);
  assert.equal(materielValide({ dispo: { barre: "oui" } }).dispo.barre, false); // pas un booléen : défaut
  assert.deepEqual(manquants(["barre", "halteres"], avec("halteres")), ["barre"]);
});

test("exercice dont il manque le matériel : grisé, avec une alternative faisable", () => {
  const sansBarre = MATERIEL_DEFAUT;
  assert.equal(faisable(exercice("tractions"), sansBarre), false);
  assert.equal(faisable(exercice("pompes"), sansBarre), true);
  assert.equal(alternativeA(exercice("pompes"), sansBarre), null); // rien à remplacer
  assert.equal(alternativeA(exercice("tractions"), sansBarre).id, "rowing_table"); // sous une table
  assert.equal(alternativeA(exercice("tractions"), avec("halteres")).id !== "tractions", true);
  assert.ok(faisable(alternativeA(exercice("tractions"), avec("halteres")), avec("halteres")));
  // Sans parallettes : les dips et le L-sit se remplacent.
  const sansParallettes = avec("mobilier", "halteres");
  assert.equal(alternativeA(exercice("dips_parallettes"), sansParallettes).id, "dips_banc");
  assert.ok(faisable(alternativeA(exercice("lsit_parallettes"), sansParallettes), sansParallettes));
  // Sans rien d'autre que le sol : toujours une alternative, toujours faisable.
  const solSeul = avec();
  for (const e of EXERCICES.filter((x) => !faisable(x, solSeul))) {
    const a = alternativeA(e, solSeul);
    assert.ok(a && faisable(a, solSeul) && a.id !== e.id, e.id);
  }
});

test("recherche et filtres : sans accents, par zone, par niveau, matériel dispo seulement", () => {
  const m = MATERIEL_DEFAUT;
  assert.ok(filtrer({ texte: "epaules" }, m).some((e) => e.id === "presse_epaules")); // « épaules » sans accent
  assert.ok(filtrer({ texte: "  PIKE " }, m).length >= 3);
  assert.ok(filtrer({ texte: "dos" }, m).some((e) => e.id === "rowing_halteres")); // un muscle
  assert.ok(filtrer({ zone: "mobilite" }, m).every((e) => e.zones.includes("mobilite")));
  assert.ok(filtrer({ niveau: 1 }, m).every((e) => e.niveau === 1) && filtrer({ niveau: 1 }, m).length > 5);
  const tout = filtrer({}, m).length;
  assert.equal(tout, EXERCICES.length);
  const dispo = filtrer({ materielDispo: true }, m);
  assert.ok(dispo.length < tout && dispo.every((e) => faisable(e, m)));
  assert.ok(!dispo.some((e) => e.id === "tractions"));
  assert.ok(filtrer({ materielDispo: true }, avec("barre", "mobilier")).some((e) => e.id === "tractions"));
  assert.equal(filtrer({ texte: "zzz" }, m).length, 0);
});

test("« Faire maintenant » : une séance guidée d'un seul exercice, 3 tours", () => {
  const s = seanceExercice("ex-pompes");
  assert.deepEqual([s.nom, s.exercices, s.tours, s.effort_s, s.repos_s], ["Pompes", ["pompes"], 3, 40, 20]);
  assert.equal(seanceExercice("ex-nimporte"), null);
  assert.equal(seanceExercice("haut-10"), null);
});

// ─── Base en mémoire ───

await initialiserBase();

test("matériel enregistré : relu, poids gardés, la barre reste d'accord avec l'arbre de skills", async () => {
  assert.equal(await materielConfigure(), false);
  assert.equal((await getMateriel()).dispo.barre, false);
  await configurerSport(true, {}); // l'ancien réglage : j'ai une barre
  assert.equal((await getReglages()).barre, true);
  assert.equal((await getMateriel()).dispo.barre, true); // repris tel quel tant que rien n'est réglé
  assert.equal(await materielConfigure(), false);

  await ecrireMateriel(materielValide({ dispo: { barre: false, parallettes: false }, poids: [10, 5, 5] }));
  assert.equal(await materielConfigure(), true);
  const m = await getMateriel();
  assert.deepEqual([m.dispo.barre, m.dispo.parallettes, m.dispo.sol, m.poids], [false, false, true, [5, 10]]);
  assert.equal((await getReglages()).barre, false); // synchronisé
  await ecrireMateriel({ ...m, dispo: { ...m.dispo, barre: true } });
  assert.equal((await getReglages()).barre, true);
});

test("historique d'un exercice : meilleur résultat, dernières séances, courbe ; vide quand rien n'est noté", async () => {
  const vide = await historiqueExercice(exercice("superman"));
  assert.deepEqual([vide.record, vide.dernieres.length, vide.courbe.length, vide.guidees.fois], [null, 0, 0, 0]);

  // Les séries d'un skill portent le nom de l'exercice : « Pompes au mur » est l'étape 1 du skill pompe.
  await noterEssai("pompe", 3, 12, "2026-10-01");
  await noterEssai("pompe", 2, 15, "2026-10-08");
  const h = await historiqueExercice(exercice("pompes_mur"));
  assert.deepEqual(h.record, { valeur: 15, date: "2026-10-08" });
  assert.deepEqual(h.dernieres.map((s) => [s.date, s.series, s.meilleure]), [["2026-10-08", 2, 15], ["2026-10-01", 3, 12]]);
  assert.deepEqual(h.courbe.map((c) => c.valeur), [12, 15]); // de la plus ancienne à la plus récente
  assert.equal(h.unite, "reps");

  // Séances guidées : l'exercice doit être cité en entier (« pont » n'est pas « pont_unijambiste »).
  const db = await getDatabase();
  const ligne = (date, ex) =>
    db.runAsync("INSERT INTO seances_guidees (date, seance, duree_s, exercices, terminee, points_donnes, horodatage) VALUES (?, 'x', 60, ?, 1, 0, '')", date, ex);
  await ligne("2026-10-02", "squat,pont_unijambiste");
  await ligne("2026-10-05", "pont,squat");
  const p = await historiqueExercice(exercice("pont"));
  assert.deepEqual([p.guidees.fois, p.guidees.derniere], [1, "2026-10-05"]);
  assert.equal((await historiqueExercice(exercice("squat"))).guidees.fois, 2);
});
