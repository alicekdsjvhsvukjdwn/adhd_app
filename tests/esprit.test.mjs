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
  penseesMarquees,
} from "../lib/db/esprit.ts";
import { addItem } from "../lib/db/items.ts";
import { getStats } from "../lib/db/stats.ts";
import {
  ajouterADire,
  ajouterExerciceTcc,
  ajouterSeanceTcc,
  basculerExerciceTcc,
  cocherADire,
  exercicesTcc,
  listerADire,
  prochaineSeanceTcc,
  resumeAvantSeance,
} from "../lib/db/tcc.ts";
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
  bandeauSeance,
  couleurHumeur,
  derniereSeance,
  emotionsDe,
  emotionsFrequentes,
  liensHumeur,
  moyenne,
  moyennesParJour,
  prochaineSeance,
  progressionExercice,
  rappelDeSeance,
} from "../lib/esprit-regles.ts";
import { construireSauvegarde, validerSauvegarde } from "../lib/sauvegarde-format.ts";
import { semaineDe } from "../lib/regles-taches.ts";
import { construireResume, periodeResume, texteResume } from "../lib/tcc-resume.ts";
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

test("rappel de séance : la veille à 18 h, rien si c'est déjà passé ; bandeau la veille et le jour même", () => {
  const seance = { id: 1, date: "2026-10-23", heure: "14:30" };
  const r = rappelDeSeance(seance, new Date(2026, 9, 20, 9, 0));
  assert.deepEqual([r.getFullYear(), r.getMonth(), r.getDate(), r.getHours(), r.getMinutes()], [2026, 9, 22, 18, 0]);
  assert.equal(rappelDeSeance(seance, new Date(2026, 9, 22, 18, 0)), null); // à l'instant même : trop tard
  assert.equal(rappelDeSeance(seance, new Date(2026, 9, 23, 8, 0)), null);
  assert.equal(bandeauSeance(seance, "2026-10-22"), "Séance de TCC demain à 14:30");
  assert.equal(bandeauSeance(seance, "2026-10-23"), "Séance de TCC aujourd'hui à 14:30");
  assert.equal(bandeauSeance(seance, "2026-10-21"), null);
  assert.equal(bandeauSeance(null, "2026-10-21"), null);
  const s = [{ date: "2026-10-10" }, { date: "2026-10-23" }, { date: "2026-11-06" }];
  assert.equal(prochaineSeance(s, "2026-10-23").date, "2026-10-23"); // le jour même, c'est encore la prochaine
  assert.equal(prochaineSeance(s, "2026-11-07"), null);
  assert.equal(derniereSeance(s, "2026-10-23").date, "2026-10-10");
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

test("exercices : pastilles de la semaine sans chiffres à l'écran (cible / faits)", () => {
  const semaine = semaineDe("2026-10-21");
  assert.deepEqual(progressionExercice({ freq_type: "jour", freq_n: 1 }, [semaine[0], semaine[2], "2026-10-01"], semaine), { cible: 7, faits: 2 });
  assert.deepEqual(progressionExercice({ freq_type: "semaine", freq_n: 3 }, [semaine[0], semaine[0], semaine[1]], semaine), { cible: 3, faits: 2 });
  assert.deepEqual(progressionExercice({ freq_type: "semaine", freq_n: 12 }, [], semaine), { cible: 7, faits: 0 });
});

test("résumé avant séance : bornes de la période, filtrage, texte partageable", () => {
  // Séance précédente le 10 : la période commence le 11 et finit aujourd'hui (le 21), bornes comprises.
  assert.deepEqual(periodeResume(["2026-10-10", "2026-10-23"], "2026-10-23", "2026-10-21"), { debut: "2026-10-11", fin: "2026-10-21" });
  // Séance le jour même : la période va jusqu'à elle.
  assert.deepEqual(periodeResume(["2026-10-10", "2026-10-21"], "2026-10-21", "2026-10-21"), { debut: "2026-10-11", fin: "2026-10-21" });
  // Séance passée depuis longtemps ou première séance : 30 jours en arrière, aujourd'hui compris.
  assert.deepEqual(periodeResume([], "2026-10-23", "2026-10-21"), { debut: "2026-09-22", fin: "2026-10-21" });
  const r = construireResume({
    debut: "2026-10-11",
    fin: "2026-10-21",
    humeurs: [
      { jour: "2026-10-10", niveau: 1, emotions: "colère" }, // la veille de la période : exclue
      { jour: "2026-10-11", niveau: 2, emotions: "fatigue,calme" }, // premier jour : incluse
      { jour: "2026-10-21", niveau: 4, emotions: "calme" }, // dernier jour : incluse
      { jour: "2026-10-22", niveau: 5, emotions: "joie" }, // lendemain : exclue
    ],
    pensees: [
      { jour: "2026-10-12", pensee: "Je n'y arriverai pas", emotions: "anxiété", intensite_avant: 80, intensite_apres: 50 },
      { jour: "2026-10-30", pensee: "Hors période", emotions: "", intensite_avant: null, intensite_apres: null },
    ],
    exercices: [{ nom: "Respiration", faits: 4 }],
    sommeil: { nuits: 9, moyenneMin: 450 },
    sport: { jours: 3 },
    aDire: ["Parler du travail"],
  });
  assert.equal(r.humeurs.length, 2);
  assert.equal(r.moyenneHumeur, 3);
  assert.equal(r.courbe.length, 11);
  assert.equal(r.courbe[0].moy, 2);
  assert.equal(r.courbe[10].moy, 4);
  assert.deepEqual(r.emotions[0], ["calme", 2]);
  assert.equal(r.pensees.length, 1);
  const texte = texteResume(r);
  assert.match(texte, /Humeur : 3\/5 en moyenne \(2 notes/);
  assert.match(texte, /Je n'y arriverai pas.*80 → 50\/100/);
  assert.match(texte, /Respiration \(4 fois\)/);
  assert.match(texte, /9 nuits, 7 h 30 en moyenne/);
  assert.match(texte, /Parler du travail/);
  assert.match(texteResume(construireResume({ ...r, humeurs: [], pensees: [], exercices: [], aDire: [], sommeil: { nuits: 0, moyenneMin: null } })), /Humeur : rien de noté/);
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

test("journal : étapes facultatives, filtre par émotion, marqué « à en parler » ; aucun point", async () => {
  const points = (await getStats()).points;
  const a = await ajouterPensee({ situation: "Réunion", pensee: "Je suis nulle", emotions: "honte,anxiété", intensite_avant: 85, pieges: "Étiquetage", autre_vision: "J'ai fait de mon mieux", intensite_apres: 40 });
  await ajouterPensee({ pensee: "Il va m'en vouloir", emotions: "anxiété", intensite_avant: 150 }); // plafonné à 100
  await ajouterPensee({}); // tout est facultatif : une entrée vide est possible
  assert.equal((await listerPensees()).length, 3);
  assert.deepEqual((await listerPensees("honte")).map((p) => p.id), [a]);
  assert.equal((await listerPensees("anxiété")).length, 2);
  const e = (await listerPensees("anxiété")).find((p) => p.intensite_avant === 100);
  assert.ok(e);
  await majPensee(a, { a_dire: 1 });
  assert.deepEqual((await penseesMarquees(AUJ, AUJ)).map((p) => p.id), [a]);
  assert.equal((await penseesMarquees(J(1), J(5))).length, 0);
  assert.equal((await getStats()).points, points);
});

test("Ma semaine : bilan du dimanche enregistré puis relu", async () => {
  const lundi = semaineDe(AUJ)[0];
  assert.equal(await lireBilan(lundi), null);
  await ecrireBilan({ semaine: lundi, aide: " Marcher ", garder: "Dormir tôt" });
  assert.deepEqual({ ...(await lireBilan(lundi)) }, { semaine: lundi, aide: "Marcher", garder: "Dormir tôt" });
});

test("TCC : prochaine séance, exercices (+5 pts une fois par jour), à dire en séance", async () => {
  await ajouterSeanceTcc(J(-14), "10:00");
  const prochaine = await ajouterSeanceTcc(J(3), "14:30");
  assert.equal((await prochaineSeanceTcc()).id, prochaine);

  await ajouterExerciceTcc({ nom: "Respiration", consigne: "3 fois par jour", freq_type: "jour", freq_n: 1, lien: "respiration" });
  await ajouterExerciceTcc({ nom: "Journal", consigne: "", freq_type: "semaine", freq_n: 3, lien: "journal" });
  const [resp, jour] = await exercicesTcc();
  const avant = (await getStats()).points;
  assert.equal(await basculerExerciceTcc(resp.id), 5);
  assert.equal(await basculerExerciceTcc(jour.id), 0); // deuxième exercice du jour : rien de plus
  assert.equal((await getStats()).points, avant + 5);
  assert.equal(await basculerExerciceTcc(resp.id), 0); // décoché, mais l'autre reste coché : points gardés
  assert.equal((await getStats()).points, avant + 5);
  assert.equal(await basculerExerciceTcc(jour.id), -5); // le dernier décoché : points repris
  assert.equal((await getStats()).points, avant);
  await basculerExerciceTcc(resp.id, J(-2)); // un autre jour, une seule fois aussi
  assert.equal((await getStats()).points, avant + 5);

  await ajouterADire("  Parler du sommeil ", "note");
  await ajouterADire("   ", "note"); // vide : ignorée
  await ajouterADire("Humeur 2/5 : longue journée", "humeur");
  let l = await listerADire();
  assert.equal(l.length, 2);
  await cocherADire(l.find((x) => x.texte === "Parler du sommeil").id, true);
  l = await listerADire();
  assert.equal(l.at(-1).fait, 1); // les abordées passent en bas
});

test("résumé avant séance : depuis la séance d'avant, bornes comprises", async () => {
  const db = await getDatabase();
  // Séance précédente il y a 14 jours : la période commence 13 jours en arrière.
  await db.runAsync("DELETE FROM humeurs");
  for (const [jour, niveau] of [[J(-14), 1], [J(-13), 2], [J(0), 4], [J(1), 5]]) {
    await db.runAsync("INSERT INTO humeurs (jour, heure, niveau, emotions, note) VALUES (?, '12:00', ?, 'calme', '')", jour, niveau);
  }
  const { seance, resume } = await resumeAvantSeance();
  assert.equal(seance.date, J(3));
  assert.equal(resume.debut, J(-13));
  assert.equal(resume.fin, AUJ);
  assert.equal(resume.humeurs.length, 2);
  assert.equal(resume.moyenneHumeur, 3);
  assert.deepEqual(resume.pensees.map((p) => p.pensee), ["Je suis nulle"]);
  assert.deepEqual(resume.exercices.map((x) => ({ ...x })), [{ nom: "Respiration", faits: 1 }]); // fait il y a 2 jours, dans la période
  assert.deepEqual(resume.aDire, ["Humeur 2/5 : longue journée"]);
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
  for (const t of ["humeurs", "pensees", "tcc_seances", "tcc_exercices", "tcc_exercices_faits", "a_dire", "bilan_semaine", "vision_domaines", "vision_photos", "vision_phrases"]) {
    assert.ok(noms.includes(t), t);
  }
});

async function db_tout(table) {
  return (await getDatabase()).getAllAsync(`SELECT * FROM ${table}`);
}
