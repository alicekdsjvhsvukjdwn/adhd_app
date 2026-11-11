// Lancer : npm test
// Sport : mes exercices libres (absents de la bibliothèque), dans Mes séances et dans l'historique.
import assert from "node:assert/strict";
import { test } from "node:test";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { chargerExercicesPerso, creerExercicePerso } from "../lib/db/exercices-perso.ts";
import { historiqueExercice } from "../lib/db/exercices-historique.ts";
import { enregistrerMaSeance, lireMaSeance, noterSeanceCommePrevu } from "../lib/db/seances-sport.ts";
import { definirExercicesPerso, estPerso, exercice, EXERCICES, filtrer, tousLesExercices } from "../lib/exercices.ts";
import { MATERIEL_DEFAUT } from "../lib/materiel.ts";

await initialiserBase();

test("exercice libre : créé une seule fois, jamais en double d'un exercice de la bibliothèque, retrouvé au redémarrage", async () => {
  assert.equal(await creerExercicePerso("   ", "reps"), null);
  const id = await creerExercicePerso("  Dragon flag  négatif ", "reps");
  assert.ok(estPerso(id));
  assert.deepEqual([exercice(id).nom, exercice(id).mode], ["Dragon flag négatif", "reps"]);
  assert.equal(await creerExercicePerso("dragon flag négatif", "s"), id); // même nom : pas de doublon
  assert.equal(await creerExercicePerso("pompes", "reps"), "pompes"); // déjà dans la bibliothèque
  const autre = await creerExercicePerso("Tenue en L aux anneaux", "s");
  assert.notEqual(autre, id);

  // La bibliothèque elle-même ne change pas : les séances proposées et le plan n'y piochent que là.
  assert.equal(EXERCICES.some((e) => estPerso(e.id)), false);
  assert.equal(tousLesExercices().length, EXERCICES.length + 2);
  assert.deepEqual(filtrer({ texte: "dragon" }, MATERIEL_DEFAUT).map((e) => e.id), [id]);

  // Redémarrage : la liste revient de la base.
  definirExercicesPerso([]);
  assert.equal(exercice(id), undefined);
  await chargerExercicesPerso();
  assert.equal(exercice(id).nom, "Dragon flag négatif");
});

test("exercice libre dans Mes séances : la ligne est gardée, les séries comptent dans son historique", async () => {
  const id = await creerExercicePerso("Dragon flag négatif", "reps");
  const seance = await enregistrerMaSeance({ nom: "Vidéo abdos", lignes: [{ exercice: id, series: 2, cible: 8, poids: null, repos_s: 30 }] });
  assert.deepEqual((await lireMaSeance(seance)).lignes.map((l) => [l.exercice, l.series, l.cible]), [[id, 2, 8]]);

  await noterSeanceCommePrevu("Vidéo abdos", "perso", (await lireMaSeance(seance)).lignes);
  const h = await historiqueExercice(exercice(id));
  assert.deepEqual([h.record.valeur, h.dernieres[0].series, h.unite], [8, 2, "reps"]);
});
