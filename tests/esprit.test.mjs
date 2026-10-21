// Lancer : npm test
// Esprit : humeur, journal de pensées, TCC (séances, exercices, résumé), vision, rappels.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import {
  ajouterPensee,
  ecrireBilan,
  enregistrerHumeur,
  humeursEntre,
  lireBilan,
  listerPensees,
  majHumeur,
  majPensee,
} from "../lib/db/esprit.ts";
import { addItem } from "../lib/db/items.ts";
import { getStats } from "../lib/db/stats.ts";
import {
  ajouterDomaineVision,
  ajouterPhotosVision,
  ajouterPhraseVision,
  definirRoutineVision,
  ecransDeLecture,
  getVision,
  lectureTerminee,
  nombrePhotos,
  supprimerDomaineVision,
} from "../lib/db/vision.ts";
import {
  couleurHumeur,
  emotionsDe,
  emotionsFrequentes,
  liensHumeur,
  moyenne,
  moyennesParJour,
} from "../lib/esprit-regles.ts";
import { construireSauvegarde, validerSauvegarde } from "../lib/sauvegarde-format.ts";
import { semaineDe } from "../lib/regles-taches.ts";
import { MAX_PHOTOS, placesPhotos, sequenceVision } from "../lib/vision-regles.ts";
import { rappelsDus, TEXTES } from "../push-worker/src/rappels.ts";

// ─── Règles pures ───

test("humeur : moyennes, mini-barres de la semaine, émotions les plus citées", () => {
  assert.equal(moyenne([]), null);
  assert.equal(moyenne([2, 3, 5]), 3.3);
  const h = [{ jour: "2026-10-19", niveau: 2 }, { jour: "2026-10-19", niveau: 4 }, { jour: "2026-10-21", niveau: 5 }];
  assert.deepEqual(moyennesParJour(h, semaineDe("2026-10-21")).map((x) => x.moy), [3, null, 5, null, null, null, null]);
  assert.deepEqual(emotionsFrequentes(["calme,joie", "calme", "fatigue,calme", "joie"]), [["calme", 3], ["joie", 2], ["fatigue", 1]]);
  assert.deepEqual(emotionsDe(" a, b ,,"), ["a", "b"]);
  assert.equal(couleurHumeur(1), "#F87171");
  assert.equal(couleurHumeur(9), "#22D3EE");
});

test("liens avec le sommeil, le sport, les jours difficiles : prudence sous 7 jours par groupe", () => {
  const jours = Array.from({ length: 16 }, (_, i) => decalerJours("2026-10-01", i));
  const humeurParJour = Object.fromEntries(jours.map((j, i) => [j, i < 8 ? 4 : 2]));
  const sommeilMinParJour = Object.fromEntries(jours.map((j, i) => [j, i < 8 ? 480 : 360]));
  const joursSport = new Set(jours.slice(0, 3));
  const [sommeil, sport, difficile] = liensHumeur({ humeurParJour, sommeilMinParJour, joursSport, joursDifficiles: new Set() });
  assert.equal(sommeil.resultat.ok, true);
  assert.equal(sommeil.resultat.moyA, 4);
  assert.equal(sommeil.resultat.moyB, 2);
  assert.deepEqual(sport.resultat, { ok: false, avancement: 3 }); // 3 jours de sport seulement
  assert.deepEqual(difficile.resultat, { ok: false, avancement: 0 });
});

test("rappel du soir côté serveur : seule l'heure compte, texte neutre", () => {
  const reglages = {
    quotidien: { actif: false, heure: "20:00" },
    soir: { actif: false, heure: "22:30" },
    esprit: { actif: true, heure: "21:30" },
  };
  const a = new Date("2026-10-21T19:40:00Z"); // 21:40 à Paris
  assert.deepEqual(rappelsDus(a, "Europe/Paris", reglages, {}), ["esprit"]);
  assert.deepEqual(rappelsDus(a, "Europe/Paris", reglages, { esprit: "2026-10-21" }), []);
  assert.deepEqual(rappelsDus(a, "Europe/Paris", { quotidien: reglages.quotidien, soir: reglages.soir }, {}), []); // abonnement d'avant
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(TEXTES.esprit)));
});

test("vision : la lecture alterne phrase et photo, domaine par domaine ; 40 photos au plus", () => {
  const d = [{ id: 1, nom: "Moi" }, { id: 2, nom: "Vide" }, { id: 3, nom: "Mer" }];
  const suite = sequenceVision(
    d,
    [{ domaine_id: 1, data: "p1" }, { domaine_id: 3, data: "p3" }, { domaine_id: 3, data: "p4" }],
    [{ domaine_id: 1, texte: "Je suis calme" }, { domaine_id: 1, texte: "Je me repose" }, { domaine_id: 3, texte: "Je vis près de la mer" }],
  );
  assert.deepEqual(suite.map((e) => (e.type === "phrase" ? e.texte : e.data)), ["Je suis calme", "p1", "Je me repose", "Je vis près de la mer", "p3", "p4"]);
  assert.equal(placesPhotos(0), MAX_PHOTOS);
  assert.equal(placesPhotos(38), 2);
  assert.equal(placesPhotos(60), 0);
});

// ─── Base en mémoire ───

await initialiserBase();
const AUJ = getAujourdhui();
const J = (n) => decalerJours(AUJ, n);

test("humeur : un tap, puis émotions (3 au plus) et note ; aucun point", async () => {
  const points = (await getStats()).points;
  const id = await enregistrerHumeur(2);
  await majHumeur(id, { emotions: ["fatigue", "anxiété", "ennui", "colère"], note: "  Longue journée  " });
  const [h] = await humeursEntre(AUJ, AUJ);
  assert.equal(h.niveau, 2);
  assert.deepEqual(emotionsDe(h.emotions), ["fatigue", "anxiété", "ennui"]);
  assert.equal(h.note, "Longue journée");
  assert.match(h.heure, /^\d\d:\d\d$/);
  await enregistrerHumeur(9); // hors bornes : ramené à 5
  assert.equal((await humeursEntre(AUJ, AUJ)).at(-1).niveau, 5);
  assert.equal((await getStats()).points, points);
});

test("journal : étapes facultatives, filtre par émotion ; aucun point", async () => {
  const points = (await getStats()).points;
  const a = await ajouterPensee({ situation: "Réunion", pensee: "Je suis nulle", emotions: "honte,anxiété", intensite_avant: 85, pieges: "Étiquetage", autre_vision: "J'ai fait de mon mieux", intensite_apres: 40 });
  await ajouterPensee({ pensee: "Il va m'en vouloir", emotions: "anxiété", intensite_avant: 150 }); // plafonné à 100
  await ajouterPensee({}); // tout est facultatif : une entrée vide est possible
  assert.equal((await listerPensees()).length, 3);
  assert.deepEqual((await listerPensees("honte")).map((p) => p.id), [a]);
  assert.equal((await listerPensees("anxiété")).length, 2);
  const e = (await listerPensees("anxiété")).find((p) => p.intensite_avant === 100);
  assert.ok(e);
  assert.equal((await getStats()).points, points);
});

test("Ma semaine : bilan du dimanche enregistré puis relu", async () => {
  const lundi = semaineDe(AUJ)[0];
  assert.equal(await lireBilan(lundi), null);
  await ecrireBilan({ semaine: lundi, aide: " Marcher ", garder: "Dormir tôt" });
  assert.deepEqual({ ...(await lireBilan(lundi)) }, { semaine: lundi, aide: "Marcher", garder: "Dormir tôt" });
});

test("vision : domaines de départ, photos plafonnées à 40, lecture, routine liée cochée après 20 s", async () => {
  const v = await getVision();
  assert.deepEqual(v.domaines.map((d) => d.nom), ["Moi", "Travail", "Mer & nature", "Relations", "Créativité", "Corps", "Maison"]);
  const mer = v.domaines[2].id;
  await ajouterPhraseVision(mer, "Je travaille sur l'eau");
  await ajouterPhraseVision(mer, "   ");
  const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  assert.equal(await ajouterPhotosVision(mer, Array.from({ length: 38 }, () => photo)), 38);
  assert.equal(await ajouterPhotosVision(mer, [photo, photo, photo, photo]), 2); // 2 places restantes
  assert.equal(await nombrePhotos(), MAX_PHOTOS);
  assert.equal(await ajouterPhotosVision(mer, [photo]), 0);
  const suite = await ecransDeLecture();
  assert.equal(suite[0].type, "phrase");
  assert.equal(suite[0].domaine, "Mer & nature");
  assert.equal(suite.filter((e) => e.type === "photo").length, MAX_PHOTOS);

  // Les photos sont dans la table lue par la sauvegarde, et le format les accepte telles quelles.
  const lignes = await db_tout("vision_photos");
  assert.equal(lignes.length, MAX_PHOTOS);
  const s = construireSauvegarde(30, { items: [], vision_photos: lignes.slice(0, 3) });
  const ok = validerSauvegarde(JSON.stringify(s), 30);
  assert.equal(ok.ok, true);
  assert.equal(ok.sauvegarde.tables.vision_photos[0].data, photo);

  const routine = await addItem({ nom: "Lire ma vision", type: "routine" });
  await definirRoutineVision(routine);
  assert.equal(await lectureTerminee(19), false);
  assert.equal(await lectureTerminee(25), true);
  const fait = await (await getDatabase()).getFirstAsync("SELECT statut FROM completions WHERE item_id = ? AND date = ?", routine, AUJ);
  assert.equal(fait.statut, "complet");

  await supprimerDomaineVision(mer);
  assert.equal(await nombrePhotos(), 0);
  await ajouterDomaineVision("Voyages");
  assert.equal((await getVision()).domaines.at(-1).nom, "Voyages");
});

test("sauvegarde : toutes les tables d'Esprit existent, donc partent dans la sauvegarde et le CSV", async () => {
  const noms = (await (await getDatabase()).getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
  for (const t of ["humeurs", "pensees", "tcc_seances", "tcc_exercices", "tcc_exercices_faits", "a_dire", "tcc_echelle", "tcc_expositions", "tcc_confiance", "tcc_objectifs", "tcc_seances_moi", "tcc_points_jours", "bilan_semaine", "vision_domaines", "vision_photos", "vision_phrases"]) {
    assert.ok(noms.includes(t), t);
  }
});

async function db_tout(table) {
  return (await getDatabase()).getAllAsync(`SELECT * FROM ${table}`);
}
