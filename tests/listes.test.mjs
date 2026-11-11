// Lancer : npm test
// Mes listes : « Déplacer ses tâches vers… » vide une liste dans une autre, sans la supprimer.
import assert from "node:assert/strict";
import { test } from "node:test";
import { completer } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { addItem, getItem } from "../lib/db/items.ts";
import { ajouterListe, compterTaches, deplacerTaches, getListes } from "../lib/db/listes.ts";

await initialiserBase();

test("déplacer les tâches d'une liste : en cours et déjà faites suivent, la liste d'origine reste, vide", async () => {
  const de = await ajouterListe("Ancienne", "📁");
  const vers = await ajouterListe("Nouvelle", "📁");
  const ailleurs = await ajouterListe("Ailleurs", "📁");
  const enCours = await addItem({ nom: "En cours", type: "tache", liste_id: de });
  const faite = await addItem({ nom: "Faite", type: "tache", liste_id: de });
  const autre = await addItem({ nom: "Pas concernée", type: "tache", liste_id: ailleurs });
  await completer(faite, "complet");

  assert.equal(await deplacerTaches(de, vers), 2);
  assert.deepEqual([(await getItem(enCours)).liste_id, (await getItem(faite)).liste_id, (await getItem(autre)).liste_id], [vers, vers, ailleurs]);
  assert.equal(await compterTaches(de), 0);
  assert.ok((await getListes()).some((l) => l.id === de)); // la liste d'origine n'est pas supprimée

  assert.equal(await deplacerTaches(vers, vers), 0); // vers elle-même : rien
  assert.equal(await deplacerTaches(vers, 999999), 0); // liste inconnue : rien ne bouge
  assert.equal((await getItem(enCours)).liste_id, vers);
});
