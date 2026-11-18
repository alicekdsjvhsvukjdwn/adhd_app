// Lancer : npm test
// Récap du dimanche : bornes de la semaine, carte de chaleur, moments forts, premières fois, piste, récap court, rappel.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { ajouterEntree, getZones } from "../lib/db/journee.ts";
import { ajouterIdee, donneesRecap, ecrireFierte, lireLigneRecap, marquerVu, pointsEntre, semainesPassees } from "../lib/db/recap.ts";
import { couleurChaleur, ZONES_DEFAUT } from "../lib/journee-regles.ts";
import {
  carteChaleur,
  ecart,
  ideePour,
  journeeEnAvant,
  momentsForts,
  phrasePiste,
  semaineDuRecap,
  tuiles,
  zonePiste,
  zonesRetrouvees,
} from "../lib/recap-regles.ts";
import { rappelsDus } from "../push-worker/src/rappels.ts";

test("semaine du récap : le dimanche à partir de 18 h (et après minuit), sinon la semaine d'avant", () => {
  // 2026-11-22 est un dimanche ; lundi 16.
  assert.equal(semaineDuRecap("2026-11-22", "17:59", "18:00", 6), "2026-11-09");
  assert.equal(semaineDuRecap("2026-11-22", "18:00", "18:00", 6), "2026-11-16");
  assert.equal(semaineDuRecap("2026-11-22", "01:30", "18:00", 6), "2026-11-16", "après minuit, encore dimanche (jour logique)");
  assert.equal(semaineDuRecap("2026-11-23", "09:00", "18:00", 6), "2026-11-16", "lundi : le récap de la semaine finie");
  assert.equal(semaineDuRecap("2026-11-19", "20:00", "18:00", 6), "2026-11-09");
  assert.equal(semaineDuRecap("2026-11-22", "20:00", "21:00", 6), "2026-11-09", "heure réglable");
});

test("carte de chaleur : normalisée sur la zone la plus remplie, zone vide à 18 %", () => {
  const c = carteChaleur(ZONES_DEFAUT, { mains: 8, bras: 4 });
  const mains = ZONES_DEFAUT.find((z) => z.cle === "mains").couleur;
  const bras = ZONES_DEFAUT.find((z) => z.cle === "bras").couleur;
  const tete = ZONES_DEFAUT.find((z) => z.cle === "tete").couleur;
  assert.equal(c.mains.toUpperCase(), mains);
  assert.equal(c.bras, couleurChaleur(bras, 4, 8));
  assert.equal(c.tete, couleurChaleur(tete, 0, 8));
});

const e = (id, jour, zone, ressenti = null, duree_min = null, origine = "saisie") => ({ id, jour, zone, texte: `E${id}`, ressenti, duree_min, origine });

test("moments forts : meilleur ressenti, puis les plus longues ; jour le plus rempli et ses 5 entrées", () => {
  const entrees = [e(1, "a", "bras", 4, 10), e(2, "a", "mains", 5, 5), e(3, "b", "tete", 4, 60), e(4, "b", "coeur"), e(5, "b", "pieds", 3)];
  assert.deepEqual(momentsForts(entrees).map((x) => x.id), [2, 3, 1]);
  const j = journeeEnAvant(entrees, ["a", "b", "c"]);
  assert.equal(j.jour, "b");
  assert.deepEqual(j.entrees.map((x) => x.id), [3, 5, 4]);
  assert.equal(journeeEnAvant([], ["a"]), null);
});

test("premières fois : une zone déjà remplie qui revient après 14 jours (pas une zone jamais remplie)", () => {
  const lundi = "2026-11-16";
  const entrees = [e(1, lundi, "bras"), e(2, lundi, "coeur"), e(3, lundi, "mains")];
  const r = zonesRetrouvees(entrees, { bras: "2026-11-10", coeur: "2026-10-30", mains: null }, lundi);
  assert.deepEqual(r, ["coeur"]);
});

test("piste : une seule zone, la moins remplie, phrase douce, idée stable", () => {
  assert.equal(zonePiste(ZONES_DEFAUT, { tete: 3, coeur: 0, bras: 2, ventre: 5, mains: 9, jambes: 1, pieds: 0 }), "coeur");
  assert.equal(phrasePiste("coeur"), "Le cœur a été plus calme cette semaine.");
  assert.equal(phrasePiste("bras"), "Les bras ont été plus calmes cette semaine.");
  assert.ok(!/pas assez|manqu|dommage|oubli/i.test(phrasePiste("tete")));
  assert.equal(ideePour("coeur", "2026-11-16", {}), ideePour("coeur", "2026-11-16", {}));
  assert.equal(ideePour("coeur", "2026-11-16", { coeur: ["Écrire à Léa"] }), "Écrire à Léa");
});

test("en chiffres : 4 tuiles, une donnée manquante remplacée, écarts sans reproche", () => {
  const cette = [
    { cle: "sport", titre: "Sport", valeur: 3 },
    { cle: "cuisine", titre: "Repas", valeur: 0 },
    { cle: "routines", titre: "Routines", valeur: 80, unite: "%" },
    { cle: "sommeil", titre: "Sommeil", valeur: 440, unite: "min" },
    { cle: "tcc", titre: "TCC", valeur: 2 },
    { cle: "menage", titre: "Ménage", valeur: 4 },
  ];
  const avant = [
    { cle: "sport", valeur: 2 },
    { cle: "routines", valeur: 60 },
    { cle: "sommeil", valeur: 420 },
    { cle: "tcc", valeur: null },
  ];
  const t = tuiles(cette, avant);
  assert.deepEqual(t.map((x) => x.cle), ["sport", "routines", "sommeil", "tcc"]);
  assert.deepEqual(t.map((x) => x.ecart), ["+1", "+20 pts", "+20 min", null]);
  assert.equal(t[2].valeur, "7 h 20");
  assert.equal(ecart({ cle: "s", valeur: 1 }, 3), "−2");
  assert.equal(ecart({ cle: "s", valeur: 3 }, 3), "=");
});

test("rappel du récap : seulement le dimanche, à l'heure choisie", () => {
  const r = { quotidien: { actif: false, heure: "08:00" }, soir: { actif: false, heure: "22:00" }, esprit: { actif: false, heure: "21:30" }, recap: { actif: true, heure: "18:00" } };
  assert.deepEqual(rappelsDus(new Date("2026-11-22T17:05:00Z"), "Europe/Paris", r, {}), ["recap"]); // dimanche 18:05
  assert.deepEqual(rappelsDus(new Date("2026-11-21T17:05:00Z"), "Europe/Paris", r, {}), []); // samedi
  const { recap, ...ancien } = r;
  assert.deepEqual(rappelsDus(new Date("2026-11-22T17:05:00Z"), "Europe/Paris", ancien, {}), [], "abonnement d'avant sans récap");
});

test("avec la base : récap court, piste et fierté enregistrées, archive, points de la semaine", async () => {
  await initialiserBase();
  const db = await getDatabase();
  const lundi = decalerJours(getAujourdhui(), -((new Date(getAujourdhui() + "T00:00:00Z").getUTCDay() + 6) % 7) - 7);
  for (const [i, z] of ["bras", "mains", "mains"].entries()) {
    await ajouterEntree({ jour: decalerJours(lundi, i), moment: "matin", zone: z, texte: `Chose ${i}` });
  }
  let d = await donneesRecap(lundi);
  assert.equal(d.court, true, "moins de 5 entrées : récap court");
  for (const [i, z] of ["tete", "ventre", "mains"].entries()) await ajouterEntree({ jour: decalerJours(lundi, 3 + i), moment: "soir", zone: z, texte: `Autre ${i}` });
  d = await donneesRecap(lundi);
  assert.equal(d.court, false);
  assert.equal(d.piste.zone, "coeur", "la zone la plus calme (aucune entrée)");
  await marquerVu(lundi, d.piste);
  await marquerVu(lundi, { zone: "pieds", texte: "autre" });
  const l = await lireLigneRecap(lundi);
  assert.deepEqual([l.piste_zone, l.piste_texte], ["coeur", d.piste.texte], "la piste choisie reste la même");
  assert.ok(l.vu_le);
  await ecrireFierte(lundi, "  J'ai tenu mes routines  ");
  assert.equal((await lireLigneRecap(lundi)).fierte, "J'ai tenu mes routines");
  await ajouterIdee(lundi, d.piste.texte);
  await ajouterIdee(lundi, d.piste.texte);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS n FROM items WHERE nom = ? AND type = 'tache'", d.piste.texte)).n, 1, "ajoutée une seule fois");
  assert.ok((await semainesPassees()).some((s) => s.lundi === lundi && s.total === 6));
  assert.equal((await getZones()).length, 7);

  // Points de la semaine : différence des relevés ; rien sans relevé avant le lundi.
  assert.equal(await pointsEntre(lundi, decalerJours(lundi, 6)), null);
  await db.runAsync("INSERT OR REPLACE INTO points_jours (jour, total) VALUES (?, 100), (?, 180)", decalerJours(lundi, -1), decalerJours(lundi, 5));
  assert.equal(await pointsEntre(lundi, decalerJours(lundi, 6)), 80);
});
