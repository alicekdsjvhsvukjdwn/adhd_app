// Lancer : npm test
// Projets créatifs, commit A : avancement et jauge, prochaine étape, tri et filtres, temps, base, sauvegarde avec photos.
import assert from "node:assert/strict";
import { test } from "node:test";
import { COLONNES_IMAGES } from "../lib/csv.ts";
import { completer, getAujourdhui } from "../lib/db/completions.ts";
import { getDatabase } from "../lib/db/client.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import {
  ajouterEntree,
  ajouterEtape,
  ajouterLien,
  ajouterMateriel,
  ajouterPhotoFinale,
  ajouterType,
  basculerEtape,
  basculerMateriel,
  changerEtat,
  creerProjet,
  estPourAujourdhui,
  pourAujourdhui,
  rattraperProjets,
  suiviProjets,
  tacheDeLEtape,
  deplacerEtape,
  enregistrerNotes,
  listerEtapes,
  listerJournal,
  listerLiens,
  listerMateriel,
  listerProjets,
  listerTypes,
  photosDuJournal,
  photosFinales,
  supprimerEtape,
  supprimerProjet,
  supprimerType,
  tempsPasse,
} from "../lib/db/projets.ts";
import {
  avancement,
  avantMaintenant,
  filtrerProjets,
  libelleDuree,
  lignesDe,
  minutesParSemaine,
  projetsOublies,
  prochaineEtape,
  tempsTotal,
  toutEstFait,
  trierProjets,
  urlValide,
} from "../lib/projets-regles.ts";
import { construireSauvegarde, validerSauvegarde } from "../lib/sauvegarde-format.ts";

const e = (id, nom, faite, ordre = id, parent_id = null) => ({ id, nom, faite, ordre, parent_id });

test("avancement : seules les feuilles comptent, un projet sans étape est à 0", () => {
  assert.deepEqual(avancement([]), { faites: 0, total: 0, jauge: 0 });
  assert.equal(avancement([e(1, "a", 1), e(2, "b", 0), e(3, "c", 0), e(4, "d", 0)]).jauge, 0.25);
  // « b » découpée en 2 sous-étapes : b ne compte plus, ses 2 enfants oui
  const a = avancement([e(1, "a", 1), e(2, "b", 0), e(5, "b1", 1, 0, 2), e(6, "b2", 0, 1, 2)]);
  assert.deepEqual([a.faites, a.total], [2, 3]);
  assert.equal(toutEstFait([e(1, "a", 1)]), true);
  assert.equal(toutEstFait([]), false);
});

test("prochaine étape : la première à faire, au niveau des sous-étapes, dans l'ordre", () => {
  assert.equal(prochaineEtape([]), null);
  assert.equal(prochaineEtape([e(1, "a", 1)]), null);
  const etapes = [e(1, "a", 1, 0), e(2, "b", 0, 1), e(5, "b1", 1, 0, 2), e(6, "b2", 0, 1, 2), e(3, "c", 0, 2)];
  assert.equal(prochaineEtape(etapes).nom, "b2");
  assert.equal(prochaineEtape([e(1, "a", 0, 5), e(2, "b", 0, 1)]).nom, "b"); // l'ordre, pas l'id
});

test("galerie : en cours d'abord, finis cachés sauf filtre, filtre par type", () => {
  const p = (id, etat, type_id, maj_le) => ({ id, nom: `p${id}`, etat, type_id, maj_le });
  const tous = [p(1, "idee", 1, "2026-10-01"), p(2, "fini", 1, "2026-10-09"), p(3, "en_cours", 2, "2026-10-02"), p(4, "en_cours", 1, "2026-10-05"), p(5, "en_pause", 1, "2026-10-08")];
  assert.deepEqual(trierProjets(tous).map((x) => x.id), [4, 3, 1, 5, 2]);
  assert.deepEqual(filtrerProjets(tous, {}).map((x) => x.id), [4, 3, 1, 5]);
  assert.deepEqual(filtrerProjets(tous, { etat: "fini" }).map((x) => x.id), [2]);
  assert.deepEqual(filtrerProjets(tous, { type: 2 }).map((x) => x.id), [3]);
});

test("temps, durées, lignes, liens, avant → maintenant", () => {
  assert.equal(tempsTotal([{ minutes: 20 }, { minutes: 45 }, { minutes: -3 }]), 65);
  assert.deepEqual([0, 45, 120, 150].map(libelleDuree), ["0 min", "45 min", "2 h", "2 h 30"]);
  assert.deepEqual(lignesDe("- choisir\n\n  commander  \r\n• tester"), ["choisir", "commander", "tester"]);
  assert.equal(urlValide("youtube.com/watch?v=1"), "https://youtube.com/watch?v=1");
  assert.equal(urlValide("http://a.fr"), "http://a.fr");
  assert.equal(urlValide("pas un lien"), null);
  assert.equal(urlValide("localhost"), null);
  assert.equal(avantMaintenant(["a"]), null);
  assert.deepEqual(avantMaintenant(["a", "b", "c"]), { avant: "a", maintenant: "c" });
});

// ─── Base en mémoire ───

await initialiserBase();
const db = await getDatabase();
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

test("migration : les 7 tables existent et les 5 types de départ sont posés une seule fois", async () => {
  const noms = (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
  for (const t of ["projet_types", "projets", "projet_etapes", "projet_journal", "projet_photos", "projet_materiel", "projet_liens"]) assert.ok(noms.includes(t), t);
  const types = await listerTypes();
  assert.deepEqual(types.map((t) => t.nom), ["Électronique / Arduino", "Peinture & dessin", "Artisanat", "Musique", "Autre"]);
  await initialiserBase();
  assert.equal((await listerTypes()).length, 5);
});

test("types : ajout, repli vers « Autre » à la suppression, jamais le dernier", async () => {
  const perso = await ajouterType("  Couture ", "gem", "#FACC15");
  assert.equal(await ajouterType("   ", "gem", "#FACC15"), null);
  const t = (await listerTypes()).find((x) => x.id === perso);
  assert.deepEqual([t.nom, t.icone, t.couleur], ["Couture", "gem", "#FACC15"]);
  const id = await creerProjet({ nom: "Tote bag", type_id: perso });
  assert.equal(await supprimerType(perso), true);
  const autre = (await listerTypes()).find((x) => x.nom === "Autre");
  assert.equal((await listerProjets()).find((p) => p.id === id).type_id, autre.id);
  await supprimerProjet(id);
});

test("projet : création avec étapes, état, fini_le, jauge, suppression en cascade", async () => {
  const [elec] = await listerTypes();
  assert.equal(await creerProjet({ nom: "  ", type_id: elec.id }), null);
  const id = await creerProjet({ nom: "Réveil", type_id: elec.id, pourquoi: " mieux dormir ", etapes: ["choisir", "commander", "", "souder"] });
  let p = (await listerProjets()).find((x) => x.id === id);
  assert.deepEqual([p.etat, p.pourquoi, p.total, p.jauge], ["idee", "mieux dormir", 3, 0]);

  const etapes = await listerEtapes(id);
  assert.deepEqual(etapes.map((x) => x.nom), ["choisir", "commander", "souder"]);
  assert.equal(await basculerEtape(etapes[0].id), true);
  assert.equal(await basculerEtape(etapes[0].id, true), false); // déjà cochée : rien de nouveau
  p = (await listerProjets()).find((x) => x.id === id);
  assert.equal(Math.round(p.jauge * 100), 33);

  await changerEtat(id, "fini");
  p = (await listerProjets()).find((x) => x.id === id);
  assert.equal(p.etat, "fini");
  assert.match(p.fini_le, /^\d{4}-\d{2}-\d{2}$/);
  await changerEtat(id, "en_cours");
  assert.equal((await listerProjets()).find((x) => x.id === id).fini_le, "");

  await ajouterEntree(id, { minutes: 30, note: "souder" });
  await ajouterMateriel(id, "ESP32");
  await ajouterLien(id, "", "https://a.fr");
  await supprimerProjet(id);
  for (const t of ["projet_etapes", "projet_journal", "projet_materiel", "projet_liens", "projet_photos"]) {
    assert.equal((await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${t} WHERE projet_id = ?`, id)).n, 0, t);
  }
});

test("sous-étapes : le parent suit ses enfants, cocher le parent coche tout, supprimer le dernier enfant", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "P", type_id: elec.id, etapes: ["a", "b"] });
  const [a, b] = await listerEtapes(id);
  await basculerEtape(a.id);
  const b1 = await ajouterEtape(id, "b1", b.id);
  const b2 = await ajouterEtape(id, "b2", b.id);
  // b est découpée : 3 feuilles (a, b1, b2), une faite
  let p = (await listerProjets()).find((x) => x.id === id);
  assert.deepEqual([p.faites, p.total], [1, 3]);
  await basculerEtape(b1);
  await basculerEtape(b2);
  assert.equal((await listerEtapes(id)).find((x) => x.id === b.id).faite, 1); // parent coché automatiquement
  await basculerEtape(b2);
  assert.equal((await listerEtapes(id)).find((x) => x.id === b.id).faite, 0);
  await basculerEtape(b.id); // cocher le parent coche les enfants
  assert.deepEqual((await listerEtapes(id)).filter((x) => x.parent_id === b.id).map((x) => x.faite), [1, 1]);
  await supprimerEtape(b1);
  await supprimerEtape(b.id); // supprime aussi les sous-étapes restantes
  assert.deepEqual((await listerEtapes(id)).map((x) => x.nom), ["a"]);
  await supprimerProjet(id);
});

test("ordre des étapes : ↑ ↓ entre voisines, sans effet aux bords", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "P", type_id: elec.id, etapes: ["a", "b", "c"] });
  const noms = async () => (await listerEtapes(id)).map((x) => x.nom).join("");
  const [a, , c] = await listerEtapes(id);
  await deplacerEtape(c.id, -1);
  assert.equal(await noms(), "acb");
  await deplacerEtape(a.id, -1);
  assert.equal(await noms(), "acb");
  await deplacerEtape(a.id, 1);
  assert.equal(await noms(), "cab");
  await supprimerProjet(id);
});

test("journal, temps total, photos, matériel, notes, liens", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "P", type_id: elec.id });
  await ajouterEntree(id, { jour: "2026-10-10", minutes: 30, note: "début", photos: [PHOTO] });
  await ajouterEntree(id, { jour: "2026-10-12", minutes: 45, photos: [PHOTO + "2", PHOTO + "3"] });
  assert.equal(await tempsPasse(id), 75);
  const j = await listerJournal(id);
  assert.deepEqual(j.map((x) => x.jour), ["2026-10-12", "2026-10-10"]); // récent d'abord
  assert.equal(j[0].photos.length, 2);
  const photos = await photosDuJournal(id);
  assert.equal(photos.length, 3);
  assert.equal(photos[0].data, PHOTO); // la plus ancienne = « avant »
  await ajouterPhotoFinale(id, PHOTO + "F");
  assert.equal((await photosFinales(id)).length, 1);
  assert.equal((await photosDuJournal(id)).length, 3); // la finale n'est pas dans le journal

  await ajouterMateriel(id, "Fer à souder");
  await ajouterMateriel(id, "  ");
  const [m] = await listerMateriel(id);
  assert.equal(m.a_acheter, 1);
  await basculerMateriel(m.id);
  assert.equal((await listerMateriel(id))[0].a_acheter, 0);

  await enregistrerNotes(id, "idée : afficher l'heure");
  assert.equal((await listerProjets()).find((x) => x.id === id).notes, "idée : afficher l'heure");
  await ajouterLien(id, "", "https://a.fr");
  assert.equal((await listerLiens(id))[0].titre, "https://a.fr");
  await supprimerProjet(id);
});

test("sauvegarde : les photos des projets partent dans le JSON, mais pas dans le CSV", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "P", type_id: elec.id, couverture: PHOTO });
  await ajouterEntree(id, { photos: [PHOTO] });
  const projets = await db.getAllAsync("SELECT * FROM projets WHERE id = ?", id);
  const photos = await db.getAllAsync("SELECT * FROM projet_photos WHERE projet_id = ?", id);
  const ok = validerSauvegarde(JSON.stringify(construireSauvegarde(36, { items: [], projets, projet_photos: photos })), 36);
  assert.equal(ok.ok, true);
  assert.equal(ok.sauvegarde.tables.projets[0].couverture, PHOTO);
  assert.equal(ok.sauvegarde.tables.projet_photos[0].data, PHOTO);
  assert.deepEqual(COLONNES_IMAGES, { projets: ["couverture"], projet_photos: ["data"] });
  await supprimerProjet(id);
});

// ─── Commit B : ★ pour aujourd'hui, courses, points, suivi, exemple ───

const points = async () => (await db.getFirstAsync("SELECT points_total AS p FROM stats WHERE id = 1")).p;
const statutItem = async (id) => (await db.getFirstAsync("SELECT statut FROM items WHERE id = ?", id)).statut;
const AUJ = getAujourdhui();

test("projets oubliés : seulement « en cours », plus de 14 jours", () => {
  const p = (id, etat, derniere) => ({ id, etat, derniere });
  const o = projetsOublies([p(1, "en_cours", "2026-10-01"), p(2, "en_cours", "2026-10-20"), p(3, "idee", "2026-01-01"), p(4, "en_pause", "2026-01-01"), p(5, "en_cours", "2026-10-08")], "2026-10-22");
  assert.deepEqual(o.map((x) => [x.id, x.jours]), [[1, 21]]); // 5 : 14 jours pile, pas encore
});

test("temps par semaine : 8 semaines, la dernière est celle d'aujourd'hui, minutes par type", () => {
  const s = minutesParSemaine(
    [
      { jour: "2026-10-22", minutes: 30, type_id: 1 },
      { jour: "2026-10-19", minutes: 15, type_id: 2 }, // lundi : même semaine
      { jour: "2026-10-18", minutes: 40, type_id: 1 }, // dimanche : semaine d'avant
      { jour: "2026-01-01", minutes: 99, type_id: 1 }, // trop ancien
      { jour: "2026-10-22", minutes: 0, type_id: 1 },
    ],
    "2026-10-22",
  );
  assert.equal(s.length, 8);
  assert.equal(s[7].lundi, "2026-10-19");
  assert.deepEqual([s[7].total, s[7].parType], [45, { 1: 30, 2: 15 }]);
  assert.equal(s[6].total, 40);
  assert.equal(s.reduce((a, x) => a + x.total, 0), 85);
});

test("exemple : « Réveil lumineux ESP32 » est créé une seule fois, en Idée, avec ses 5 étapes, et se supprime", async () => {
  const exemples = (await listerProjets()).filter((p) => p.nom === "Réveil lumineux ESP32");
  assert.equal(exemples.length, 1);
  assert.deepEqual([exemples[0].etat, exemples[0].total], ["idee", 5]);
  assert.deepEqual((await listerEtapes(exemples[0].id)).map((x) => x.nom), ["Choisir les composants", "Commander", "Faire clignoter une LED", "Connecter au Wi-Fi", "Relier à l'appli"]);
  await initialiserBase();
  assert.equal((await listerProjets()).filter((p) => p.nom === "Réveil lumineux ESP32").length, 1);
  await supprimerProjet(exemples[0].id);
  assert.equal((await listerProjets()).filter((p) => p.nom === "Réveil lumineux ESP32").length, 0);
});

test("★ Pour aujourd'hui : l'étape devient une tâche de la liste Projets, placée dans Mes 3, sans doublon ; pleine, elle refuse", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "Lampe", type_id: elec.id, etapes: ["a", "b", "c", "d"] });
  const [a, b, c, d] = await listerEtapes(id);
  assert.equal(await estPourAujourdhui(a.id, AUJ), false);
  assert.equal(await pourAujourdhui(a.id, AUJ), true);
  assert.equal(await pourAujourdhui(a.id, AUJ), true); // déjà dedans : pas de doublon
  assert.equal(await estPourAujourdhui(a.id, AUJ), true);
  const item = (await listerEtapes(id))[0].item_id;
  const liste = await db.getFirstAsync("SELECT l.nom FROM items i JOIN listes l ON l.id = i.liste_id WHERE i.id = ?", item);
  assert.equal(liste.nom, "Projets");
  assert.equal((await db.getAllAsync("SELECT * FROM trois WHERE jour = ? AND item_id = ?", AUJ, item)).length, 1);
  assert.equal(await pourAujourdhui(b.id, AUJ), true);
  assert.equal(await pourAujourdhui(c.id, AUJ), true);
  assert.equal(await pourAujourdhui(d.id, AUJ), false); // les 3 sont pris
  assert.equal((await db.getAllAsync("SELECT id FROM listes WHERE nom = 'Projets'")).length, 1);
  await supprimerProjet(id);
  assert.equal(await db.getFirstAsync("SELECT id FROM items WHERE id = ?", item), null); // la tâche à faire part avec le projet
});

test("synchronisation : tâche faite → étape cochée ; étape cochée → tâche faite, une seule fois", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "Sync", type_id: elec.id, etapes: ["a", "b"] });
  const [a, b] = await listerEtapes(id);
  const itemA = await tacheDeLEtape(a.id);
  assert.equal(await tacheDeLEtape(a.id), itemA); // retrouvée, pas recréée
  await completer(itemA, "complet");
  await rattraperProjets();
  assert.equal((await listerEtapes(id))[0].faite, 1);
  await rattraperProjets(); // sans danger la seconde fois
  const itemB = await tacheDeLEtape(b.id);
  await basculerEtape(b.id);
  assert.equal(await statutItem(itemB), "termine");
  await basculerEtape(b.id); // décocher puis recocher : rien de plus
  await basculerEtape(b.id);
  assert.equal(await statutItem(itemB), "termine");
  await supprimerProjet(id);
});

test("courses : le matériel à acheter est une tâche de « Courses / achats » ; j'ai ↔ à acheter la coche ou la recrée", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "Achats", type_id: elec.id });
  await ajouterMateriel(id, "ESP32");
  await ajouterMateriel(id, "Câble", false); // je l'ai déjà : pas de tâche
  const [m1, m2] = await listerMateriel(id);
  assert.equal(m2.nom, "Câble");
  assert.equal(m2.item_id, null);
  const tache = await db.getFirstAsync("SELECT i.nom, l.nom AS liste FROM items i JOIN listes l ON l.id = i.liste_id WHERE i.id = ?", m1.item_id);
  assert.deepEqual([tache.nom, tache.liste], ["ESP32 (Achats)", "Courses / achats"]);
  await basculerMateriel(m1.id); // j'ai : la tâche est cochée
  assert.equal(await statutItem(m1.item_id), "termine");
  await basculerMateriel(m1.id); // à racheter : nouvelle tâche
  const apres = (await listerMateriel(id)).find((x) => x.id === m1.id);
  assert.equal(apres.a_acheter, 1);
  assert.notEqual(apres.item_id, m1.item_id);
  await completer(apres.item_id, "complet"); // je l'achète depuis Tâches
  await rattraperProjets();
  assert.equal((await listerMateriel(id)).find((x) => x.id === m1.id).a_acheter, 0);
  assert.equal((await db.getAllAsync("SELECT id FROM listes WHERE nom = 'Courses / achats'")).length, 1);
  await supprimerProjet(id);
});

test("points : +5 une seule fois par jour de projet (étape ou séance), +50 une seule fois à « Fini »", async () => {
  const [elec] = await listerTypes();
  await db.runAsync("DELETE FROM projets_points_jours");
  const id = await creerProjet({ nom: "Points", type_id: elec.id, etapes: ["a", "b", "c"] });
  const [a, b] = await listerEtapes(id);
  const avant = await points();
  await ajouterEntree(id, { note: "sans temps" }); // une note seule ne compte pas
  assert.equal(await points(), avant);
  await basculerEtape(a.id);
  assert.equal(await points(), avant + 5);
  await basculerEtape(b.id); // même jour : rien de plus
  await ajouterEntree(id, { minutes: 20 });
  assert.equal(await points(), avant + 5);
  await basculerEtape(a.id); // décocher puis recocher : toujours rien
  await basculerEtape(a.id);
  assert.equal(await points(), avant + 5);
  assert.equal((await db.getAllAsync("SELECT * FROM projets_points_jours")).length, 1);

  await changerEtat(id, "fini");
  assert.equal(await points(), avant + 55);
  await changerEtat(id, "en_cours");
  await changerEtat(id, "fini");
  assert.equal(await points(), avant + 55); // jamais deux fois pour le même projet
  const autre = await creerProjet({ nom: "Autre", type_id: elec.id });
  await changerEtat(autre, "fini");
  assert.equal(await points(), avant + 105);
  await supprimerProjet(id);
  await supprimerProjet(autre);
});

test("séance : le temps du journal s'additionne au temps total et compte dans le suivi par semaine", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "Suivi", type_id: elec.id });
  await ajouterEntree(id, { minutes: 25 });
  await ajouterEntree(id, { minutes: 35, jour: AUJ });
  assert.equal(await tempsPasse(id), 60);
  const s = await suiviProjets(AUJ);
  assert.equal(s.semaines.length, 8);
  assert.equal(s.semaines[7].parType[elec.id] >= 60, true);
  await supprimerProjet(id);
});

test("suivi : un projet en cours oublié depuis plus de 2 semaines est signalé, « en pause » le retire", async () => {
  const [elec] = await listerTypes();
  const id = await creerProjet({ nom: "Oublié", type_id: elec.id, etat: "en_cours" });
  await db.runAsync("UPDATE projets SET maj_le = ? WHERE id = ?", "2026-01-01T10:00:00.000Z", id);
  assert.equal((await suiviProjets(AUJ)).oublies.some((o) => o.id === id), true);
  await changerEtat(id, "en_pause");
  assert.equal((await suiviProjets(AUJ)).oublies.some((o) => o.id === id), false);
  await supprimerProjet(id);
});
