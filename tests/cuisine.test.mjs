// Lancer : npm test
// Cuisine, commit A : catalogue, inventaire, comparaison recette ↔ inventaire, portions, recette collée, recettes de départ.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOGUE, CATEGORIES, EMPLACEMENTS, RAYONS } from "../lib/cuisine-catalogue.ts";
import { RECETTES_DEPART } from "../lib/cuisine-depart.ts";
import {
  alerteDate,
  baisser,
  decouperIngredient,
  decouperRecette,
  faisabilite,
  libelleQuantite,
  memeAliment,
  minuteurDeLEtape,
  normaliser,
  quantitePourPortions,
  rechercherCatalogue,
} from "../lib/cuisine-regles.ts";
import { getDatabase } from "../lib/db/client.ts";
import {
  ajouterAliment,
  basculerFavori,
  basculerToujoursLa,
  changerNiveau,
  dupliquerRecette,
  enregistrerRecette,
  lireRecette,
  listerAliments,
  listerRecettes,
  recettesAvecIngredients,
  retirerAliment,
  supprimerRecette,
} from "../lib/db/cuisine.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { construireSauvegarde, validerSauvegarde } from "../lib/sauvegarde-format.ts";

test("catalogue : plus de 150 aliments, sans doublon, catégories et rayons connus", () => {
  assert.ok(CATALOGUE.length >= 150, String(CATALOGUE.length));
  const noms = CATALOGUE.map((a) => normaliser(a.nom));
  assert.equal(new Set(noms).size, noms.length);
  for (const a of CATALOGUE) {
    assert.ok(CATEGORIES.some((c) => c.cle === a.categorie), a.nom);
    assert.ok(EMPLACEMENTS.some((e) => e.cle === a.emplacement), a.nom);
    assert.ok(RAYONS.some((r) => r.cle === a.rayon), a.nom);
  }
});

test("recherche : début de mot d'abord, sans accent, sans ce que j'ai déjà", () => {
  assert.equal(rechercherCatalogue("lentilles c")[0].nom, "Lentilles corail");
  assert.equal(rechercherCatalogue("epinard")[0].nom, "Épinards");
  assert.deepEqual(rechercherCatalogue("   "), []);
  assert.ok(!rechercherCatalogue("lentilles", ["Lentilles corail"]).some((a) => a.nom === "Lentilles corail"));
  assert.ok(rechercherCatalogue("coco").some((a) => a.nom === "Lait de coco")); // au milieu du nom
  assert.ok(rechercherCatalogue("a").length <= 8);
});

test("même aliment : égalité sans accent, mots en commun, jamais un seul mot vague", () => {
  assert.equal(memeAliment("Épinards", "epinards"), true);
  assert.equal(memeAliment("Lentilles corail", "lentilles corail sèches"), true);
  assert.equal(memeAliment("Pois chiches (boîte)", "pois chiches"), true);
  assert.equal(memeAliment("Pois chiches (boîte)", "Pois cassés"), false);
  assert.equal(memeAliment("Pois", "Pois chiches"), false);
  assert.equal(memeAliment("Carotte", "Carottes"), true);
  assert.equal(memeAliment("", "Sel"), false);
});

test("niveaux et dates : baisser, alerte douce à 2 jours", () => {
  assert.deepEqual(["plein", "peu", "presque_fini"].map(baisser), ["peu", "presque_fini", "presque_fini"]);
  assert.equal(alerteDate("", "2026-10-22"), null);
  assert.equal(alerteDate("2026-10-25", "2026-10-22"), null);
  assert.equal(alerteDate("2026-10-24", "2026-10-22"), "vite");
  assert.equal(alerteDate("2026-10-22", "2026-10-22"), "vite");
  assert.equal(alerteDate("2026-10-21", "2026-10-22"), "passee");
});

test("portions : quantités recalculées, fractions lisibles, « au goût » reste vide", () => {
  assert.equal(quantitePourPortions(250, 4, 2), 125);
  assert.equal(quantitePourPortions(250, 4, 6), 375);
  assert.equal(quantitePourPortions(1, 3, 1), 0.33);
  assert.equal(quantitePourPortions(null, 4, 8), null);
  assert.deepEqual([0.5, 1.5, 2, 0.25, 0.33, 125, null].map(libelleQuantite), ["½", "1 ½", "2", "¼", "0,33", "125", ""]);
});

test("faisable / presque / non selon l'inventaire, avec un aliment « toujours là »", () => {
  const ing = (nom, aliment = nom) => ({ nom, quantite: 1, unite: "", aliment });
  const recette = [ing("Lentilles corail"), ing("Lait de coco"), ing("Oignons"), ing("Sel")];
  const inv = (...noms) => noms.map((nom) => ({ nom, toujours_la: 0 }));
  assert.equal(faisabilite(recette, inv("Lentilles corail", "Lait de coco", "Oignons", "Sel")).niveau, "pret");
  const presque = faisabilite(recette, inv("Lentilles corail", "Lait de coco"));
  assert.equal(presque.niveau, "presque");
  assert.deepEqual(presque.manque.map((i) => i.nom), ["Oignons", "Sel"]);
  assert.equal(faisabilite(recette, inv("Lentilles corail")).niveau, "non");
  // un ingrédient sans lien au catalogue se compare par son nom
  assert.equal(faisabilite([ing("Lentilles corail", "")], inv("lentilles corail")).niveau, "pret");
  assert.equal(faisabilite([], []).niveau, "pret");
});

test("ingrédient collé : quantité, unité, aliment relié au catalogue", () => {
  assert.deepEqual(decouperIngredient("200 g de lentilles corail"), { nom: "Lentilles corail", quantite: 200, unite: "g", aliment: "Lentilles corail" });
  assert.deepEqual(decouperIngredient("- 2 gousses d'ail"), { nom: "Ail", quantite: 2, unite: "gousse", aliment: "Ail" });
  assert.deepEqual(decouperIngredient("1/2 chou rouge"), { nom: "Chou rouge", quantite: 0.5, unite: "", aliment: "Chou rouge" });
  assert.deepEqual(decouperIngredient("1,5 c. à s. de sauce soja"), { nom: "Sauce soja", quantite: 1.5, unite: "c. à s.", aliment: "Sauce soja" });
  assert.deepEqual(decouperIngredient("½ citron"), { nom: "Citron", quantite: 0.5, unite: "", aliment: "Citron" });
  assert.deepEqual(decouperIngredient("sel"), { nom: "Sel", quantite: null, unite: "", aliment: "Sel" });
  assert.equal(decouperIngredient("2 cuillères à soupe de sirop d'érable").unite, "c. à s.");
});

test("recette collée : titre, parties « Ingrédients » / « Préparation », étapes numérotées", () => {
  const r = decouperRecette(`Dahl express
Ingrédients :
- 250 g de lentilles corail
- 1 oignon
- sel
Préparation
1. Faire revenir l'oignon.
2) Ajouter les lentilles et cuire 20 minutes.
Servir chaud.`);
  assert.equal(r.titre, "Dahl express");
  assert.deepEqual(r.ingredients.map((i) => [i.nom, i.quantite, i.unite]), [["Lentilles corail", 250, "g"], ["Oignon", 1, ""], ["Sel", null, ""]]);
  assert.deepEqual(r.etapes, ["Faire revenir l'oignon.", "Ajouter les lentilles et cuire 20 minutes.", "Servir chaud."]);
});

test("recette collée sans titres de parties : les lignes à quantité sont des ingrédients, le reste des étapes", () => {
  const r = decouperRecette(`200 g de riz
2 c. à s. de sauce soja
Cuire le riz 10 minutes.
Arroser de sauce soja.`);
  assert.equal(r.titre, "");
  assert.equal(r.ingredients.length, 2);
  assert.deepEqual(r.etapes, ["Cuire le riz 10 minutes.", "Arroser de sauce soja."]);
  assert.deepEqual(decouperRecette(""), { titre: "", ingredients: [], etapes: [] });
});

test("minuteur deviné dans une étape", () => {
  assert.deepEqual(["Cuire 10 minutes", "Laisser mijoter 20 min", "Reposer 1 h", "Mélanger", "Cuire 8 à 10 minutes", "Ajouter 2 minestrone"].map(minuteurDeLEtape), [10, 20, 60, 0, 10, 0]);
});

// ─── Base en mémoire ───

await initialiserBase();
const db = await getDatabase();

test("recettes de départ : 16, une seule fois, ingrédients reliés au catalogue, étapes avec minuteur deviné", async () => {
  assert.equal(RECETTES_DEPART.length, 16);
  for (const r of RECETTES_DEPART) for (const [, , nom] of r.ingredients) if (nom !== "Eau") assert.ok(CATALOGUE.some((a) => normaliser(a.nom) === normaliser(nom)), `${r.titre} : ${nom}`);
  const toutes = await listerRecettes();
  assert.equal(toutes.filter((r) => r.depart === 1).length, 16);
  await initialiserBase();
  assert.equal((await listerRecettes()).length, toutes.length);
  const dahl = await lireRecette(toutes.find((r) => r.titre === "Dahl de lentilles corail").id);
  assert.equal(dahl.recette.portions, 4);
  assert.equal(dahl.ingredients[0].aliment, "Lentilles corail");
  assert.equal(dahl.ingredients.find((i) => i.nom === "Eau").aliment, "");
  assert.equal(dahl.etapes.find((e) => e.texte.startsWith("Laisser mijoter")).minuteur_min, 20);
});

test("inventaire : le catalogue donne l'emplacement et la catégorie, pas de doublon, niveaux, toujours là", async () => {
  const id = await ajouterAliment({ nom: "lentilles corail" });
  const a = (await listerAliments()).find((x) => x.id === id);
  assert.deepEqual([a.nom, a.emplacement, a.categorie, a.niveau], ["Lentilles corail", "placard", "legumineuses", "plein"]);
  await changerNiveau(id, "presque_fini");
  assert.equal(await ajouterAliment({ nom: "Lentilles corail" }), id); // pas de doublon, redevient plein
  assert.equal((await listerAliments()).find((x) => x.id === id).niveau, "plein");
  const libre = await ajouterAliment({ nom: "Kimchi maison", emplacement: "frigo", categorie: "conserves", peremption: "2026-11-01" });
  assert.equal((await listerAliments()).find((x) => x.id === libre).peremption, "2026-11-01");
  assert.equal(await ajouterAliment({ nom: "   " }), null);
  await basculerToujoursLa(id);
  assert.equal((await listerAliments()).find((x) => x.id === id).toujours_la, 1);
});

test("retirer : « jeté » et « fini » laissent une trace pour le suivi, « supprimer » aucune", async () => {
  const a = await ajouterAliment({ nom: "Tofu ferme" });
  const b = await ajouterAliment({ nom: "Épinards" });
  const c = await ajouterAliment({ nom: "Courgettes" });
  await retirerAliment(a, "jete");
  await retirerAliment(b, "fini");
  await retirerAliment(c, "supprime");
  const log = await db.getAllAsync("SELECT nom, raison FROM aliments_jetes ORDER BY id");
  assert.deepEqual(log.map((l) => [l.nom, l.raison]), [["Tofu ferme", "jete"], ["Épinards", "fini"]]);
  assert.equal((await listerAliments()).some((x) => [a, b, c].includes(x.id)), false);
});

test("recettes : créer à la main, modifier, dupliquer, favori, supprimer ; minuteur deviné", async () => {
  assert.equal(await enregistrerRecette({ titre: "  ", photo: "", portions: 2, prep_min: 0, cuisson_min: 0, tags: "", notes: "", ingredients: [], etapes: [] }), null);
  const id = await enregistrerRecette({
    titre: "Ma soupe",
    photo: "",
    portions: 0,
    prep_min: 10,
    cuisson_min: 20,
    tags: "batch, dîner",
    notes: "",
    ingredients: [{ nom: "Carottes", quantite: 3, unite: "", aliment: "Carottes" }, { nom: "  ", quantite: null, unite: "", aliment: "" }],
    etapes: [{ texte: "Couper." }, { texte: "Cuire 20 minutes." }, { texte: " " }],
  });
  let r = await lireRecette(id);
  assert.equal(r.recette.portions, 1); // jamais zéro
  assert.equal(r.ingredients.length, 1);
  assert.deepEqual(r.etapes.map((e) => [e.texte, e.minuteur_min]), [["Couper.", 0], ["Cuire 20 minutes.", 20]]);

  await enregistrerRecette({ id, titre: "Ma soupe 2", photo: "", portions: 4, prep_min: 5, cuisson_min: 0, tags: "", notes: "n", ingredients: [{ nom: "Poireaux", quantite: 2, unite: "", aliment: "Poireaux" }], etapes: [{ texte: "Tout cuire." }] });
  r = await lireRecette(id);
  assert.deepEqual([r.recette.titre, r.recette.portions, r.ingredients.map((i) => i.nom), r.etapes.length], ["Ma soupe 2", 4, ["Poireaux"], 1]);

  const copie = await dupliquerRecette(id);
  assert.equal((await lireRecette(copie)).recette.titre, "Ma soupe 2 (copie)");
  assert.equal((await lireRecette(copie)).ingredients.length, 1);
  await basculerFavori(copie);
  assert.equal((await listerRecettes())[0].id, copie); // les favoris d'abord
  const avec = (await recettesAvecIngredients()).find((x) => x.recette.id === id);
  assert.equal(avec.ingredients[0].nom, "Poireaux");

  await supprimerRecette(id);
  await supprimerRecette(copie);
  assert.equal(await lireRecette(id), null);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM recette_ingredients WHERE recette_id = ?", id)).n, 0);
});

test("sauvegarde : la photo d'une recette part dans le JSON", async () => {
  const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  const id = await enregistrerRecette({ titre: "Avec photo", photo, portions: 2, prep_min: 0, cuisson_min: 0, tags: "", notes: "", ingredients: [], etapes: [] });
  const lignes = await db.getAllAsync("SELECT * FROM recettes WHERE id = ?", id);
  const ok = validerSauvegarde(JSON.stringify(construireSauvegarde(38, { items: [], recettes: lignes })), 38);
  assert.equal(ok.ok, true);
  assert.equal(ok.sauvegarde.tables.recettes[0].photo, photo);
  await supprimerRecette(id);
});

test("les 11 tables de Cuisine existent", async () => {
  const noms = (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
  for (const t of ["aliments", "recettes", "recette_ingredients", "recette_etapes", "cuisines", "courses", "meal_prep", "meal_prep_semaines", "aliments_jetes", "cuisine_points_jours"]) assert.ok(noms.includes(t), t);
});
