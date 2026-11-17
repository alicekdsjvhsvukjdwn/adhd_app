// Lancer : npm test
// « Ma journée » : le bonhomme, la saisie, les détails facultatifs, les 7 jours modifiables, les zones, la migration.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { addItem } from "../lib/db/items.ts";
import {
  ajouterEntree,
  entreesDu,
  getEntree,
  getZones,
  modifierEntree,
  modifierZone,
  restaurerEntree,
  supprimerEntree,
  textesPasses,
} from "../lib/db/journee.ts";
import { runMigrations } from "../lib/db/migrations.ts";
import { placerDansTrois } from "../lib/db/trois.ts";
import {
  compterParZone,
  couleurZone,
  GRIS_ZONE,
  intensite,
  modifiable,
  momentDeHeureJournee,
  nettoyerDetails,
  origineSaisie,
  suggestions,
  validerSaisie,
  ZONES_DEFAUT,
} from "../lib/journee-regles.ts";

// ─── Règles pures ───

test("saisie : zone obligatoire, texte vide refusé, message clair", () => {
  assert.match(validerSaisie(null, "Meal prep"), /zone/);
  assert.match(validerSaisie("mains", "   "), /Écris/);
  assert.equal(validerSaisie("mains", "Meal prep"), null);
});

test("couleur : grise sans entrée, de plus en plus vive à 1, 2, 3+ entrées", () => {
  const c = "#FB923C";
  assert.equal(couleurZone(c, 0), GRIS_ZONE);
  const n1 = couleurZone(c, 1);
  const n2 = couleurZone(c, 2);
  assert.notEqual(n1, GRIS_ZONE);
  assert.notEqual(n1, n2);
  assert.equal(couleurZone(c, 3).toUpperCase(), c);
  assert.equal(couleurZone(c, 12), couleurZone(c, 3));
  assert.deepEqual([0, 1, 2, 3, 9].map(intensite), [0, 1, 2, 3, 3]);
  // Plus vive = plus loin du gris : la distance croît avec le nombre d'entrées.
  const dist = (h) => Math.abs(parseInt(h.slice(1, 3), 16) - parseInt(GRIS_ZONE.slice(1, 3), 16));
  assert.ok(dist(n1) < dist(n2) && dist(n2) < dist(c));
});

test("jours modifiables : 7 jours en arrière, puis lecture seule ; pas les jours à venir", () => {
  const a = "2026-11-17";
  assert.equal(modifiable(a, a), true);
  assert.equal(modifiable("2026-11-10", a), true);
  assert.equal(modifiable("2026-11-09", a), false);
  assert.equal(modifiable("2026-11-18", a), false);
  // Changement de mois et d'année.
  assert.equal(modifiable("2026-12-27", "2027-01-03"), true);
  assert.equal(modifiable("2026-12-26", "2027-01-03"), false);
});

test("moment par défaut d'après l'heure, origine 'recopie' quand on note après coup", () => {
  assert.deepEqual([7, 12, 15, 19, 2].map(momentDeHeureJournee), ["matin", "midi", "apres_midi", "soir", "soir"]);
  assert.equal(origineSaisie("2026-11-17", "apres_midi", "2026-11-17", 15), "saisie");
  assert.equal(origineSaisie("2026-11-17", "matin", "2026-11-17", 20), "recopie");
  assert.equal(origineSaisie("2026-11-16", "soir", "2026-11-17", 8), "recopie");
});

test("détails facultatifs : null efface, valeurs hors bornes ignorées", () => {
  assert.deepEqual(nettoyerDetails({ duree_min: 30, ressenti: 4 }), { duree_min: 30, ressenti: 4 });
  assert.deepEqual(nettoyerDetails({ duree_min: null, ressenti: null }), { duree_min: null, ressenti: null });
  assert.deepEqual(nettoyerDetails({ duree_min: 0, ressenti: 7 }), { duree_min: null, ressenti: null });
  assert.deepEqual(nettoyerDetails({}), { duree_min: null, ressenti: null });
});

test("suggestions : même zone d'abord, puis les plus fréquentes, sans accents ni doublons", () => {
  const passees = [
    { texte: "Ménage salle de bain", zone: "mains", n: 1 },
    { texte: "Menage cuisine", zone: "mains", n: 5 },
    { texte: "Méditation", zone: "ventre", n: 9 },
    { texte: "menage cuisine", zone: "ventre", n: 2 },
  ];
  assert.deepEqual(suggestions("men", "mains", passees), ["Menage cuisine", "Ménage salle de bain"]);
  assert.deepEqual(suggestions("me", "ventre", passees), ["Méditation", "menage cuisine", "Ménage salle de bain"]);
  assert.deepEqual(suggestions("m", "mains", passees), []);
  // Texte déjà complet : rien à proposer de plus.
  assert.deepEqual(suggestions("Méditation", "ventre", passees), []);
});

// ─── Base en mémoire ───

test("zones : 7 par défaut ; renommer, recolorer, désactiver ; recrées si la table est vidée", async () => {
  await initialiserBase();
  const db = await getDatabase();
  let z = await getZones();
  assert.deepEqual(z.map((x) => x.cle), ZONES_DEFAUT.map((x) => x.cle));
  await modifierZone("pieds", { libelle: "  Musique  ", couleur: "#F472B6", active: 0 });
  await modifierZone("tete", { libelle: "   " }); // libellé vide : ignoré
  z = await getZones();
  const pieds = z.find((x) => x.cle === "pieds");
  assert.deepEqual([pieds.libelle, pieds.couleur, pieds.active], ["Musique", "#F472B6", 0]);
  assert.equal(z.find((x) => x.cle === "tete").libelle, ZONES_DEFAUT[0].libelle);
  // Les réglages restent, rien n'est réécrit par-dessus.
  assert.equal((await getZones()).find((x) => x.cle === "pieds").libelle, "Musique");
  await modifierZone("pieds", { libelle: ZONES_DEFAUT[6].libelle, couleur: ZONES_DEFAUT[6].couleur, active: 1 });
  await db.runAsync("DELETE FROM zones");
  assert.equal((await getZones()).length, 7);
});

test("journal : saisir, détails facultatifs, modifier, changer de zone, supprimer puis annuler", async () => {
  await initialiserBase();
  const jour = getAujourdhui();
  const id = await ajouterEntree({ jour, moment: "matin", zone: "mains", texte: "  Meal prep  " });
  let e = await getEntree(id);
  assert.equal(e.texte, "Meal prep");
  assert.equal(e.duree_min, null);
  assert.equal(e.ressenti, null);
  assert.equal(e.tache_id, null);
  assert.ok(["saisie", "recopie"].includes(e.origine));

  await modifierEntree(id, { duree_min: 30 });
  await modifierEntree(id, { ressenti: 4 });
  e = await getEntree(id);
  assert.deepEqual([e.duree_min, e.ressenti], [30, 4]);
  await modifierEntree(id, { duree_min: null });
  e = await getEntree(id);
  assert.deepEqual([e.duree_min, e.ressenti], [null, 4]);

  await modifierEntree(id, { zone: "ventre", texte: "Repas préparé", moment: "midi" });
  e = await getEntree(id);
  assert.deepEqual([e.zone, e.texte, e.moment], ["ventre", "Repas préparé", "midi"]);

  const hier = decalerJours(jour, -1);
  const idHier = await ajouterEntree({ jour: hier, moment: "soir", zone: "jambes", texte: "Balade à la mer" });
  assert.equal((await getEntree(idHier)).origine, "recopie");

  const supprimee = await supprimerEntree(id);
  assert.equal(await getEntree(id), null);
  await restaurerEntree(supprimee);
  assert.deepEqual(await getEntree(id), supprimee);

  const duJour = await entreesDu(jour);
  assert.deepEqual(compterParZone(duJour), { ventre: 1 });
  assert.ok((await textesPasses()).some((p) => p.texte === "Balade à la mer"));
});

test("migration 41 en ajout seulement : tâches et « 3 » intactes", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const jour = getAujourdhui();
  const tache = await addItem({ nom: "Appeler la CAF", type: "tache" });
  await placerDansTrois(jour, 0, tache);
  const compter = async () => ({
    items: (await db.getFirstAsync("SELECT COUNT(*) AS n FROM items")).n,
    trois: (await db.getFirstAsync("SELECT COUNT(*) AS n FROM trois")).n,
    listes: (await db.getFirstAsync("SELECT COUNT(*) AS n FROM listes")).n,
  });
  const avant = await compter();
  // La base telle qu'elle était sur le téléphone avant Ma journée.
  await db.execAsync("DROP TABLE journal; DROP TABLE zones; PRAGMA user_version = 40");
  await runMigrations();
  assert.deepEqual(await compter(), avant);
  assert.equal((await getZones()).length, 7);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM journal")).n, 0);
});
