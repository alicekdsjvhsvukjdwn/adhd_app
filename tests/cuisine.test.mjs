// Lancer : npm test
// Cuisine, commit A : catalogue, inventaire, comparaison recette ↔ inventaire, portions, recette collée, recettes de départ.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOGUE, CATEGORIES, EMPLACEMENTS, RAYONS } from "../lib/cuisine-catalogue.ts";
import { RECETTES_DEPART } from "../lib/cuisine-depart.ts";
import {
  additionnerIngredients,
  alerteDate,
  baisser,
  baissesProposees,
  ingredientsManquants,
  libelleCourse,
  rayonDe,
  recettesLesPlusFaites,
  repasParSemaine,
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
import { completer } from "../lib/db/completions.ts";
import { getDatabase } from "../lib/db/client.ts";
import { addItem } from "../lib/db/items.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
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
import {
  acheterPourProjet,
  achatsDesProjets,
  ajouterAlimentAuxCourses,
  ajouterCourse,
  baissesDeLaRecette,
  calculerMealPrep,
  choisirPourMealPrep,
  cocherCourse,
  coursesFaites,
  definirBatch,
  jAiCuisine,
  listerCourses,
  lireMealPrep,
  mealPrepVersCourses,
  remettreEnInventaire,
  retirerCourse,
  retirerDuMealPrep,
  suiviCuisine,
} from "../lib/db/cuisine-courses.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { ajouterMateriel, creerProjet, listerMateriel, listerTypes, supprimerProjet } from "../lib/db/projets.ts";
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
  // l'eau n'est jamais à acheter
  assert.equal(faisabilite([ing("Eau", 500, "ml", "")], []).niveau, "pret");
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
const AUJ = getAujourdhui();
const points = async () => (await db.getFirstAsync("SELECT points_total AS p FROM stats WHERE id = 1")).p;

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

// ─── Commit B : courses, meal prep, j'ai cuisiné, suivi, points ───

const ing = (nom, quantite = null, unite = "", aliment = nom) => ({ nom, quantite, unite, aliment });
const inv = (...noms) => noms.map((nom) => ({ nom, toujours_la: 0 }));

test("additionner les ingrédients du meal prep : même aliment et même unité s'additionnent, portions comprises", () => {
  const dahl = { ingredients: [ing("Lentilles corail", 250, "g"), ing("Oignons", 1, "pièce"), ing("Sel")], portionsRecette: 4, portionsVoulues: 8 };
  const chili = { ingredients: [ing("Oignons", 1, "pièce"), ing("Haricots rouges (boîte)", 1, "boîte"), ing("Sel")], portionsRecette: 4, portionsVoulues: 4 };
  const total = additionnerIngredients([dahl, chili]);
  const q = (nom) => total.find((x) => x.nom === nom);
  assert.equal(q("Lentilles corail").quantite, 500); // 250 g pour 4 → 500 g pour 8
  assert.equal(q("Oignons").quantite, 3); // 2 + 1
  assert.equal(q("Sel").quantite, null); // au goût reste au goût
  assert.equal(total.filter((x) => x.nom === "Sel").length, 1);
  // une autre unité ne s'additionne pas
  const g = additionnerIngredients([{ ingredients: [ing("Riz basmati", 100, "g")], portionsRecette: 1, portionsVoulues: 1 }, { ingredients: [ing("Riz basmati", 1, "verre")], portionsRecette: 1, portionsVoulues: 1 }]);
  assert.equal(g.length, 2);
});

test("meal prep : on retire ce que j'ai déjà (« presque fini » compte comme là)", () => {
  const total = [{ nom: "Lentilles corail", aliment: "Lentilles corail", quantite: 500, unite: "g" }, { nom: "Oignons", aliment: "Oignons", quantite: 3, unite: "" }, { nom: "Ail", aliment: "Ail", quantite: 2, unite: "gousse" }];
  assert.deepEqual(ingredientsManquants(total, inv("Lentilles corail", "Ail")).map((x) => x.nom), ["Oignons"]);
  assert.deepEqual(ingredientsManquants(total, inv("Lentilles corail", "Oignons", "Ail")), []);
  assert.equal(libelleCourse(500, "g"), "500 g");
  assert.equal(libelleCourse(null, ""), "");
  assert.equal(rayonDe("Épinards"), "fruits_legumes");
  assert.equal(rayonDe("Tofu ferme"), "frais");
  assert.equal(rayonDe("Truc inconnu"), "autre");
});

test("j'ai cuisiné : un cran de moins pour ce qui est dans l'inventaire, jamais pour « toujours là » ni pour presque fini", () => {
  const inventaire = [
    { id: 1, nom: "Lentilles corail", niveau: "plein", toujours_la: 0 },
    { id: 2, nom: "Oignons", niveau: "peu", toujours_la: 0 },
    { id: 3, nom: "Huile d'olive", niveau: "plein", toujours_la: 1 },
    { id: 4, nom: "Ail", niveau: "presque_fini", toujours_la: 0 },
  ];
  const ings = [ing("Lentilles corail"), ing("Oignons"), ing("Huile d'olive"), ing("Ail"), ing("Curcuma")];
  assert.deepEqual(baissesProposees(ings, inventaire).map((b) => [b.nom, b.de, b.vers]), [["Lentilles corail", "plein", "peu"], ["Oignons", "peu", "presque_fini"]]);
});

test("repas par semaine et recettes les plus faites", () => {
  const s = repasParSemaine(["2026-10-22", "2026-10-19", "2026-10-18", "2026-01-01"], "2026-10-22", 8);
  assert.deepEqual([s.length, s[7].n, s[6].n], [8, 2, 1]);
  assert.deepEqual(recettesLesPlusFaites(["Dahl", "Chili", "Dahl", "Wraps", "Chili", "Dahl"], 2), [{ titre: "Dahl", n: 3 }, { titre: "Chili", n: 2 }]);
});

const MARDI = "2026-10-19";
const nomsCourses = async () => (await listerCourses()).map((c) => c.nom);

test("courses : ajout sans doublon, rayon du catalogue, cocher, « Courses faites » vide les cochés", async () => {
  await db.runAsync("DELETE FROM courses");
  const a = await ajouterCourse({ nom: "Épinards" });
  assert.equal(await ajouterCourse({ nom: "  épinards " }), a); // pas de doublon
  const b = await ajouterCourse({ nom: "Tofu ferme", quantite: "200 g" });
  await ajouterCourse({ nom: "Éponges", rayon: "maison" });
  assert.equal(await ajouterCourse({ nom: " " }), null);
  const lignes = await listerCourses();
  assert.deepEqual(lignes.map((c) => [c.nom, c.rayon]).sort(), [["Tofu ferme", "frais"], ["Épinards", "fruits_legumes"], ["Éponges", "maison"]]);
  await cocherCourse(a);
  await cocherCourse(b);
  await cocherCourse(b); // décocher
  assert.equal(await coursesFaites(), 1);
  assert.deepEqual((await nomsCourses()).sort(), ["Tofu ferme", "Éponges"]);
});

test("acheté → inventaire : un article acheté revient « plein », y compris un aliment « presque fini » déjà là", async () => {
  await db.runAsync("DELETE FROM courses");
  const id = await ajouterAliment({ nom: "Courgettes", niveau: "presque_fini" });
  const c = await ajouterAlimentAuxCourses(id);
  assert.equal((await listerCourses()).find((x) => x.id === c).source, "frigo");
  assert.equal(await ajouterAlimentAuxCourses(id), c); // pas de doublon
  await remettreEnInventaire(c);
  assert.equal((await listerAliments()).find((a) => a.id === id).niveau, "plein");
  assert.equal((await listerAliments()).filter((a) => a.nom === "Courgettes").length, 1);
  // un article neuf entre dans l'inventaire avec l'emplacement du catalogue
  const neuf = await ajouterCourse({ nom: "Tempeh" });
  await remettreEnInventaire(neuf);
  const tempeh = (await listerAliments()).find((a) => a.nom === "Tempeh");
  assert.deepEqual([tempeh.emplacement, tempeh.niveau], ["frigo", "plein"]);
  await retirerCourse(c);
  await retirerCourse(neuf);
});

test("courses des projets : la section « Projets » liste le matériel à acheter, l'acheter coche la tâche et le projet", async () => {
  const [elec] = await listerTypes();
  const projet = await creerProjet({ nom: "Lampe", type_id: elec.id });
  await ajouterMateriel(projet, "Ruban LED");
  const achats = await achatsDesProjets();
  const achat = achats.find((x) => x.nom === "Ruban LED (Lampe)");
  assert.ok(achat);
  await acheterPourProjet(achat.id);
  assert.equal((await achatsDesProjets()).some((x) => x.id === achat.id), false);
  assert.equal((await listerMateriel(projet))[0].a_acheter, 0);
  await supprimerProjet(projet);
});

test("meal prep : choisir des recettes et des portions, additionner, retirer l'inventaire, envoyer le reste aux courses", async () => {
  await db.runAsync("DELETE FROM courses");
  await db.runAsync("DELETE FROM aliments");
  const recettes = await listerRecettes();
  const dahl = recettes.find((r) => r.titre === "Dahl de lentilles corail");
  const chili = recettes.find((r) => r.titre === "Chili sin carne");
  await choisirPourMealPrep(MARDI, dahl.id, 8);
  await choisirPourMealPrep(MARDI, chili.id, 4);
  await choisirPourMealPrep(MARDI, dahl.id, 6); // déjà choisie : portions mises à jour
  let prep = await lireMealPrep(MARDI);
  assert.deepEqual(prep.lignes.map((l) => [l.titre, l.portions]), [["Dahl de lentilles corail", 6], ["Chili sin carne", 4]]);

  await ajouterAliment({ nom: "Lentilles corail" });
  await ajouterAliment({ nom: "Oignons" });
  const { total, manquants } = await calculerMealPrep(MARDI);
  const lent = total.find((x) => x.nom === "Lentilles corail");
  assert.equal(lent.quantite, 375); // 250 g pour 4 → 375 g pour 6
  assert.equal(total.find((x) => x.nom === "Oignons").quantite, 2.5); // 1,5 (6 portions) + 1
  assert.equal(manquants.some((x) => x.nom === "Lentilles corail" || x.nom === "Oignons"), false);
  assert.equal(manquants.some((x) => x.nom === "Lait de coco"), true);

  const n = await mealPrepVersCourses(MARDI);
  assert.equal(n, manquants.length);
  const courses = await listerCourses();
  assert.equal(courses.find((c) => c.nom === "Lait de coco").quantite, "600 ml"); // 400 ml pour 4 → 600 ml pour 6
  assert.equal(courses.every((c) => c.source === "meal_prep"), true);
  assert.equal(await mealPrepVersCourses(MARDI), 0); // sans doublon si on relance

  await retirerDuMealPrep(prep.lignes[1].id);
  prep = await lireMealPrep(MARDI);
  assert.equal(prep.lignes.length, 1);
  await db.runAsync("DELETE FROM courses");
});

test("jour de batch cooking : noté pour la semaine, avec une routine facultative", async () => {
  const routine = await addItem({ nom: "Batch du dimanche", type: "routine" });
  assert.deepEqual([(await lireMealPrep("2026-11-02")).jour_batch, (await lireMealPrep("2026-11-02")).routine_id], ["", null]);
  await definirBatch("2026-11-02", "2026-11-08", routine);
  const p = await lireMealPrep("2026-11-02");
  assert.deepEqual([p.jour_batch, p.routine_id], ["2026-11-08", routine]);
  await definirBatch("2026-11-02", "", null);
  assert.equal((await lireMealPrep("2026-11-02")).jour_batch, "");
});

test("j'ai cuisiné : le repas est gardé, l'inventaire baisse seulement de ce que je confirme, +5 points une seule fois par jour", async () => {
  await db.runAsync("DELETE FROM aliments");
  await db.runAsync("DELETE FROM cuisine_points_jours");
  await db.runAsync("DELETE FROM cuisines");
  const dahl = (await listerRecettes()).find((r) => r.titre === "Dahl de lentilles corail");
  const lent = await ajouterAliment({ nom: "Lentilles corail" });
  const lait = await ajouterAliment({ nom: "Lait de coco" });
  await ajouterAliment({ nom: "Sel", toujours_la: true });
  const baisses = await baissesDeLaRecette(dahl.id);
  assert.deepEqual(baisses.map((b) => b.nom).sort(), ["Lait de coco", "Lentilles corail"]);
  const avant = await points();
  // je ne confirme que les lentilles
  assert.equal(await jAiCuisine(dahl.id, 4, baisses.filter((b) => b.nom === "Lentilles corail")), 5);
  const niveau = async (id) => (await listerAliments()).find((a) => a.id === id).niveau;
  assert.deepEqual([await niveau(lent), await niveau(lait)], ["peu", "plein"]);
  assert.equal(await points(), avant + 5);
  assert.equal(await jAiCuisine(dahl.id, 4, []), 0); // un second repas le même jour : gardé, mais pas de points
  assert.equal(await points(), avant + 5);
  assert.equal((await db.getAllAsync("SELECT * FROM cuisines")).length, 2);
  assert.equal(await jAiCuisine(999999, 1, []), 0); // recette inconnue : rien
});

test("suivi Cuisine : repas par semaine, recettes les plus faites, aliments jetés et finis", async () => {
  await db.runAsync("DELETE FROM aliments_jetes");
  const a = await ajouterAliment({ nom: "Salade" });
  const b = await ajouterAliment({ nom: "Salade" });
  const c = await ajouterAliment({ nom: "Tofu ferme" });
  await retirerAliment(a, "jete");
  await retirerAliment(c, "fini");
  const s = await suiviCuisine(AUJ);
  assert.equal(s.semaines.length, 8);
  assert.equal(s.total, 2); // les deux repas du test précédent
  assert.deepEqual(s.top, [{ titre: "Dahl de lentilles corail", n: 2 }]);
  assert.deepEqual(s.jetes, [{ nom: "Salade", n: 1 }]);
  assert.equal(s.finis, 1);
  assert.equal(b > 0, true);
});

test("les courses et le meal prep sont documentés dans le CSV (aucune table sans explication)", async () => {
  const { lisezmoi } = await import("../lib/csv.ts");
  const txt = lisezmoi([{ nom: "courses", colonnes: ["id", "nom", "quantite"], lignes: 0 }], "2026-10-22T00:00:00.000Z");
  assert.match(txt, /quantité écrite/);
});
