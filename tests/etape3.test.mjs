// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ordreJourDifficile } from "../lib/moteur-regles.ts";
import { organiserRoutines, trancheDeHeure } from "../lib/routines-maintenant.ts";

const r = (nom, o = {}) => ({
  nom,
  faitAujourdhui: false,
  effort: null,
  moment: null,
  ancre_moment: null,
  ...o,
});
const cles = (sections) => sections.map((s) => s.cle);
const noms = (section) => section.routines.map((x) => x.nom);

test("bornes des moments : 12 h et 18 h", () => {
  assert.equal(trancheDeHeure(11.99), "matin");
  assert.equal(trancheDeHeure(12), "apres_midi");
  assert.equal(trancheDeHeure(17.99), "apres_midi");
  assert.equal(trancheDeHeure(18), "soir");
});

test("réveil, midi et coucher rangés dans le bon moment ; sans moment : À tout moment", () => {
  const s = organiserRoutines(
    [
      r("a", { moment: "reveil" }),
      r("b", { moment: "midi" }),
      r("c", { moment: "coucher" }),
      r("d", { moment: "apres-midi" }),
      r("e"),
    ],
    9,
    false,
  );
  assert.deepEqual(cles(s), ["matin", "apres_midi", "soir", "a_tout_moment"]);
  assert.deepEqual(noms(s[1]), ["b", "d"]);
  assert.deepEqual(noms(s[3]), ["e"]);
});

test("le moment repère prime sur le moment déclaré", () => {
  const s = organiserRoutines([r("a", { moment: "matin", ancre_moment: "coucher" })], 9, false);
  assert.deepEqual(cles(s), ["soir"]);
});

test("seuls le moment en cours et « À tout moment » sont dépliés", () => {
  const routines = [r("m", { moment: "matin" }), r("s", { moment: "soir" }), r("t")];
  const matin = organiserRoutines(routines, 8, false);
  assert.deepEqual(matin.map((x) => [x.cle, x.depliee]), [
    ["matin", true],
    ["soir", false],
    ["a_tout_moment", true],
  ]);
  const soir = organiserRoutines(routines, 21, false);
  assert.equal(soir.find((x) => x.cle === "matin").depliee, false);
  assert.equal(soir.find((x) => x.cle === "soir").depliee, true);
});

test("ce qui est fait descend, l'ordre d'origine est gardé", () => {
  const s = organiserRoutines(
    [r("1", { faitAujourdhui: true }), r("2"), r("3", { faitAujourdhui: true }), r("4")],
    9,
    false,
  );
  assert.deepEqual(noms(s[0]), ["2", "4", "1", "3"]);
});

test("jour difficile : les exigeantes non faites passent dans « Si l'énergie revient », repliée", () => {
  const routines = [
    r("dure", { effort: 3, moment: "matin" }),
    r("dure faite", { effort: 3, moment: "matin", faitAujourdhui: true }),
    r("facile", { effort: 1, moment: "matin" }),
  ];
  assert.deepEqual(cles(organiserRoutines(routines, 9, false)), ["matin"]);
  const s = organiserRoutines(routines, 9, true);
  assert.deepEqual(cles(s), ["matin", "si_energie"]);
  assert.deepEqual(noms(s[0]), ["facile", "dure faite"]);
  assert.deepEqual(noms(s[1]), ["dure"]);
  assert.equal(s[1].depliee, false);
});

test("tâche unique : la prochaine étape d'une tâche découpée passe d'abord", () => {
  const classement = [
    { itemId: 1, duree_min: 10 },
    { itemId: 2, duree_min: null },
    { itemId: 3, duree_min: 60 },
  ];
  const ordre = ordreJourDifficile(classement, (id) => id === 3);
  assert.deepEqual(ordre.map((t) => t.itemId), [3, 1, 2]);
});

test("tâche unique : sinon la plus petite (≤ 15 min) la mieux classée, sans priorité aux échéances", () => {
  const classement = [
    { itemId: 1, duree_min: 60 },
    { itemId: 2, duree_min: null },
    { itemId: 3, duree_min: 15 },
    { itemId: 4, duree_min: 5 },
  ];
  const ordre = ordreJourDifficile(classement, () => false);
  assert.deepEqual(ordre.map((t) => t.itemId), [3, 1, 2, 4]);
});

test("tâche unique : sinon la première du classement ; liste vide sans tâche", () => {
  const classement = [{ itemId: 7, duree_min: null }, { itemId: 8, duree_min: 30 }];
  assert.deepEqual(ordreJourDifficile(classement, () => false).map((t) => t.itemId), [7, 8]);
  assert.deepEqual(ordreJourDifficile([], () => false), []);
});
