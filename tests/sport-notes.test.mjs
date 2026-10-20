// Lancer : npm test
// Séances notées, essais et validation manuelle des skills : le vrai code de lib/db/ sur node:sqlite
// (voir tests/support/).
import assert from "node:assert/strict";
import { test } from "node:test";
import { decalerJours } from "../lib/dates.ts";
import { getDatabase, supprimerBase } from "../lib/db/client.ts";
import { getAujourdhui } from "../lib/db/completions.ts";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { basculerEtapeRoutine, enregistrerEtapes, getEtapesRoutines } from "../lib/db/etapes.ts";
import { addItem } from "../lib/db/items.ts";
import { definirRoutineLiee, getRoutineLiee, routineProposee } from "../lib/db/routine-liee.ts";
import {
  enregistrerSeanceGuidee,
  enregistrerSeanceNotee,
  seancesRecentes,
} from "../lib/db/seances-guidees.ts";
import {
  configurerSport,
  ficheSkill,
  getEtats,
  mettreAJourNiveau,
  noterEssai,
  redescendre,
  validerEtape,
  validerManuellement,
} from "../lib/db/sport.ts";
import { skill } from "../lib/skills.ts";

const AUJOURDHUI = () => getAujourdhui();
const HIER = () => decalerJours(getAujourdhui(), -1);
const notee = (extra = {}) => ({
  zones: ["haut"],
  duree_min: 20,
  source: "youtube",
  lien: "",
  ressenti: "",
  note: "",
  ...extra,
});

async function repartir() {
  await supprimerBase();
  await initialiserBase();
  return getDatabase();
}
const points = async (db) => (await db.getFirstAsync("SELECT points_total AS p FROM stats WHERE id = 1")).p;
const completion = (db, item, date) =>
  db.getFirstAsync("SELECT * FROM completions WHERE item_id = ? AND date = ?", item, date);

test("séance notée : +10 une seule fois par jour, sans cumul avec une séance guidée", async () => {
  const db = await repartir();
  assert.equal(await enregistrerSeanceNotee(notee()), 10);
  assert.equal(await enregistrerSeanceNotee(notee({ duree_min: 30 })), 0);
  assert.equal(await enregistrerSeanceGuidee("haut-10", 600, ["squat"], true), 0);
  assert.equal(await points(db), 10);

  // Dans l'autre sens : une guidée d'abord, la notée ne paie plus.
  const db2 = await repartir();
  assert.equal(await enregistrerSeanceGuidee("bas-5", 300, ["squat"], true), 10);
  assert.equal(await enregistrerSeanceNotee(notee()), 0);
  assert.equal(await points(db2), 10);
});

test("séance notée : zones, source, lien, ressenti et note sont gardés dans la même table", async () => {
  const db = await repartir();
  await enregistrerSeanceNotee(
    notee({ zones: ["haut", "abdos"], source: "youtube", lien: " https://youtu.be/x ", ressenti: "dur", note: "bien" }),
  );
  const r = await db.getFirstAsync("SELECT * FROM seances_guidees");
  assert.equal(r.origine, "notee");
  assert.equal(r.zones, "haut,abdos");
  assert.equal(r.lien, "https://youtu.be/x");
  assert.equal(r.duree_s, 1200);
  assert.equal(r.ressenti, "dur");
  assert.equal(r.points_donnes, 10);
});

test("« Hier » : +10 pour hier même si aujourd'hui est déjà payé", async () => {
  const db = await repartir();
  await enregistrerSeanceNotee(notee());
  assert.equal(await enregistrerSeanceNotee(notee(), HIER()), 10);
  assert.equal(await enregistrerSeanceNotee(notee({ duree_min: 10 }), HIER()), 0);
  assert.equal(await points(db), 20);
  const jours = (await db.getAllAsync("SELECT date FROM seances_guidees WHERE points_donnes > 0"))
    .map((x) => x.date)
    .sort();
  assert.deepEqual(jours, [HIER(), AUJOURDHUI()].sort());
});

test("routine liée : aucune par défaut, « Callisthenie » proposée mais jamais choisie d'office", async () => {
  const db = await repartir();
  const id = await addItem({ nom: "Callisthénie", type: "routine" });
  assert.equal(await getRoutineLiee(), null);
  assert.equal((await routineProposee())?.id, id);
  await enregistrerSeanceNotee(notee());
  assert.equal(await completion(db, id, AUJOURDHUI()), null);
});

test("routine liée : cochée pour le jour de la séance (aujourd'hui, hier), points sans double", async () => {
  const db = await repartir();
  const id = await addItem({ nom: "Sport", type: "routine" });
  await definirRoutineLiee(id);
  await enregistrerSeanceNotee(notee());
  assert.ok(await completion(db, id, AUJOURDHUI()));
  assert.equal(await completion(db, id, HIER()), null);
  const apres = await points(db); // séance 10 + routine 10
  assert.equal(apres, 20);

  // Une seconde séance le même jour ne redonne rien.
  await enregistrerSeanceNotee(notee({ duree_min: 45 }));
  assert.equal(await points(db), apres);

  // Pour hier : la routine est cochée hier.
  await enregistrerSeanceNotee(notee(), HIER());
  assert.ok(await completion(db, id, HIER()));
  assert.equal(await points(db), apres + 20);
});

test("routine liée à étapes : toutes les étapes cochées (palier complet), sans double comptage", async () => {
  const db = await repartir();
  const id = await addItem({ nom: "Callisthénie", type: "routine" });
  await enregistrerEtapes(id, [
    { nom: "Pousser", essentielle: 1 },
    { nom: "Tirer", essentielle: 1 },
    { nom: "Gainage", essentielle: 0 },
  ]);
  await definirRoutineLiee(id);
  await enregistrerSeanceGuidee("haut-5", 300, ["pompes"], true);

  const cochees = await db.getAllAsync("SELECT * FROM etapes_cochees WHERE item_id = ? AND date = ?", id, AUJOURDHUI());
  assert.equal(cochees.length, 3);
  const c = await completion(db, id, AUJOURDHUI());
  assert.equal(c.version, "toutes");
  assert.equal(c.points, 15);
  const total = await points(db); // séance 10 + routine complète 15
  assert.equal(total, 25);

  await enregistrerSeanceNotee(notee());
  assert.equal((await db.getAllAsync("SELECT * FROM etapes_cochees WHERE item_id = ?", id)).length, 3);
  assert.equal(await points(db), total);
});

test("routine à étapes déjà à moitié cochée : seule la différence est versée", async () => {
  const db = await repartir();
  const id = await addItem({ nom: "Matin", type: "routine" });
  await enregistrerEtapes(id, [
    { nom: "a", essentielle: 1 },
    { nom: "b", essentielle: 1 },
    { nom: "c", essentielle: 0 },
  ]);
  const etapes = (await getEtapesRoutines([id]))[id];
  await basculerEtapeRoutine(etapes[0].id);
  await basculerEtapeRoutine(etapes[1].id); // essentielles faites : 10 pts
  assert.equal(await points(db), 10);
  await definirRoutineLiee(id);
  await enregistrerSeanceNotee(notee()); // +10 séance, routine 10 → 15 : +5
  assert.equal(await points(db), 25);
});

test("essai noté : le 2ᵉ essai réussi propose de valider l'étape, la validation donne +20", async () => {
  const db = await repartir();
  await configurerSport(false, {});
  const e = skill("pompe").etapes[0];
  let r = await noterEssai("pompe", e.series, e.objectif, HIER());
  assert.equal(r.proposition, false);
  assert.equal((await ficheSkill("pompe")).seances.length, 1);
  r = await noterEssai("pompe", e.series, e.objectif);
  assert.equal(r.proposition, true);
  assert.equal((await ficheSkill("pompe")).seances.length, 2);

  const avant = await points(db); // 10 (hier) + 10 (aujourd'hui)
  assert.equal(avant, 20);
  const v = await validerEtape("pompe");
  assert.equal(v.points, 20);
  assert.equal((await getEtats()).pompe.etape, 2);
  assert.equal(await points(db), avant + 20);
});

test("essai noté sous l'objectif : pas de proposition ; un même jour ne repaie pas la séance", async () => {
  const db = await repartir();
  await configurerSport(false, {});
  const e = skill("pompe").etapes[0];
  await noterEssai("pompe", e.series, e.objectif - 3);
  const r = await noterEssai("pompe", e.series, e.objectif);
  assert.equal(r.proposition, false); // un seul essai réussi sur les deux derniers
  assert.equal(r.points, 0);
  assert.equal(await points(db), 10);
});

test("« C'est acquis » : +20 une fois, origine manuel avec la date, jamais de double après un retour", async () => {
  const db = await repartir();
  await configurerSport(false, {});
  const v1 = await validerManuellement("pompe", HIER());
  assert.equal(v1.points, 20);
  assert.equal((await getEtats()).pompe.etape, 2);
  const h = await db.getFirstAsync("SELECT * FROM skills_historique WHERE skill = 'pompe' AND origine = 'manuel'");
  assert.equal(h.date, HIER());
  assert.deepEqual([h.de, h.vers, h.points], [1, 2, 20]);
  assert.equal((await ficheSkill("pompe")).validees[1], HIER());
  assert.equal(await points(db), 20);

  // Revenir à l'étape précédente : les points restent, revalider ne redonne rien.
  await redescendre("pompe");
  assert.equal((await getEtats()).pompe.etape, 1);
  assert.equal(await points(db), 20);
  const v2 = await validerManuellement("pompe");
  assert.equal(v2.points, 0);
  assert.equal(await points(db), 20);
  // Même chose par la proposition de l'appli.
  await redescendre("pompe");
  assert.equal((await validerEtape("pompe")).points, 0);
  assert.equal(await points(db), 20);
});

test("validation manuelle jusqu'au bout : +20 par étape et +50 une seule fois pour la maîtrise", async () => {
  const db = await repartir();
  await configurerSport(false, {});
  const n = skill("pompe").etapes.length;
  for (let i = 0; i < n; i++) await validerManuellement("pompe");
  assert.equal(await points(db), n * 20 + 50);
  assert.equal((await getEtats()).pompe.etape, n + 1);
  await redescendre("pompe");
  const r = await validerManuellement("pompe");
  assert.equal(r.points, 0);
  assert.equal(await points(db), n * 20 + 50);
});

test("un essai noté coche la routine liée du jour de l'essai", async () => {
  const db = await repartir();
  await configurerSport(false, {});
  const id = await addItem({ nom: "Sport", type: "routine" });
  await definirRoutineLiee(id);
  const e = skill("pompe").etapes[0];
  await noterEssai("pompe", e.series, e.objectif, HIER());
  assert.ok(await completion(db, id, HIER()));
  assert.equal(await completion(db, id, AUJOURDHUI()), null);
});

test("mettre à jour mon niveau : règle plusieurs skills, sans points, et garde un journal", async () => {
  const db = await repartir();
  await configurerSport(false, {});
  await mettreAJourNiveau({ pompe: 3, gainage: 2 });
  const etats = await getEtats();
  assert.equal(etats.pompe.etape, 3);
  assert.equal(etats.gainage.etape, 2);
  assert.equal(await points(db), 0);
  const h = await db.getAllAsync("SELECT de, vers, origine FROM skills_historique WHERE skill = 'pompe' ORDER BY id");
  const dernier = h[h.length - 1];
  assert.deepEqual([dernier.de, dernier.vers, dernier.origine], [1, 3, "depart"]);
});

test("récentes : une pastille par vidéo (lien) ou par séance, la plus récente d'abord", async () => {
  await repartir();
  await enregistrerSeanceNotee(notee({ lien: "https://youtu.be/a" }), HIER());
  await enregistrerSeanceNotee(notee({ lien: "https://youtu.be/a", duree_min: 25 }));
  await enregistrerSeanceNotee(notee({ zones: ["bas"], duree_min: 10, source: "salle" }));
  await enregistrerSeanceNotee(notee({ zones: ["bas"], duree_min: 10, source: "salle" }));
  const r = await seancesRecentes();
  assert.equal(r.length, 2);
  assert.equal(r[0].etiquette, "Salle · 10 min · Bas du corps");
  assert.equal(r[1].lien, "https://youtu.be/a");
  assert.equal(r[1].duree_min, 25); // la dernière fois
});
