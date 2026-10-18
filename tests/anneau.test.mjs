// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ORDRE_CATEGORIES } from "../lib/theme-categories.ts";
import {
  angleBille,
  DOMAINES,
  bornesArc,
  domaineAuPoint,
  domaineParDefaut,
  grouperParMoment,
  vueValide,
  PART_ESSENTIELLES,
  partRoutine,
  remplissage,
} from "../lib/anneau.ts";

const E = (essentielle, cochee) => ({ essentielle, cochee });
// Comme l'écran : moment (repère d'abord) déjà calculé.
const R = (categorie, { ancre_moment = null, moment = null, ...o } = {}) => ({
  categorie,
  faitAujourdhui: false,
  etapes: [],
  moment: ancre_moment || moment,
  ...o,
});

test("l'anneau suit l'ordre des domaines de l'appli", () => {
  assert.deepEqual(DOMAINES, ORDRE_CATEGORIES);
});

test("bille : en haut à 6 h, tour complet à minuit et jusqu'à 6 h", () => {
  assert.equal(angleBille(6), 0);
  assert.equal(angleBille(15), 180);
  assert.equal(angleBille(12), 120);
  assert.ok(Math.abs(angleBille(23.99) - 359.8) < 1e-9);
  assert.equal(angleBille(0), 360);
  assert.equal(angleBille(3), 360);
  assert.equal(angleBille(5.99), 360);
});

test("part d'une routine : simple, puis à étapes (2/3 aux essentielles, pleine au tout)", () => {
  assert.equal(partRoutine(R("focus"), false), 0);
  assert.equal(partRoutine(R("focus", { faitAujourdhui: true }), false), 1);
  const etapes = (e1, e2, b) => R("focus", { etapes: [E(true, e1), E(true, e2), E(false, b)] });
  // Une essentielle sur deux : à mi-chemin des 2/3 (un bonus seul n'avance pas avant).
  assert.ok(Math.abs(partRoutine(etapes(true, false, true), false) - PART_ESSENTIELLES / 2) < 1e-9);
  assert.equal(partRoutine(etapes(false, false, false), false), 0);
  assert.equal(partRoutine(etapes(true, true, false), false), PART_ESSENTIELLES);
  assert.equal(partRoutine(etapes(true, true, true), false), 1);
  // Jour difficile : les essentielles suffisent, comme pour les points.
  assert.equal(partRoutine(etapes(true, true, false), true), 1);
});

test("remplissage d'un domaine : vide, en cours, terminé ; sans domaine à part", () => {
  const routines = [
    R("sommeil", { faitAujourdhui: true }),
    R("sommeil"),
    R("focus", { faitAujourdhui: true }),
    R(null, { faitAujourdhui: true }),
    R("pas-un-domaine"),
  ];
  assert.equal(remplissage(routines, "sommeil", false), 0.5);
  assert.equal(remplissage(routines, "focus", false), 1);
  assert.equal(remplissage(routines, "emotions", false), null);
  assert.equal(remplissage(routines, "autres", false), 0.5);
  const aEtapes = [R("mouvement", { etapes: [E(true, true), E(false, false)] }), R("mouvement", { faitAujourdhui: true })];
  assert.equal(remplissage(aEtapes, "mouvement", false), (PART_ESSENTIELLES + 1) / 2);
});

test("domaine par défaut : la prochaine routine à faire selon le moment", () => {
  const routines = [
    R("sommeil", { moment: "coucher" }),
    R("focus", { moment: "matin", faitAujourdhui: true }),
    R("mouvement", { moment: "apres_midi" }),
    R("emotions", { moment: "matin" }),
  ];
  // Le matin : la routine du matin pas encore faite.
  assert.equal(domaineParDefaut(routines, "matin"), "emotions");
  // À midi : celle de l'après-midi vient avant le coucher, et avant celle du matin ratée.
  assert.equal(domaineParDefaut(routines, "midi"), "mouvement");
  // Le soir : le coucher, puis seulement ce qui est passé.
  assert.equal(domaineParDefaut(routines, "soir"), "sommeil");
  // Le moment repère prime sur le moment déclaré.
  assert.equal(
    domaineParDefaut([R("focus", { moment: "soir", ancre_moment: "matin" }), R("sommeil", { moment: "soir" })], "matin"),
    "focus",
  );
  // Sans moment : « à tout moment », juste après ce qui est prévu maintenant.
  assert.equal(domaineParDefaut([R("competences"), R("focus", { moment: "matin" })], "matin"), "focus");
  assert.equal(domaineParDefaut([R("competences"), R("focus", { moment: "soir" })], "matin"), "competences");
  // Tout est fait : le premier domaine de l'anneau qui a des routines.
  assert.equal(domaineParDefaut([R("focus", { faitAujourdhui: true }), R("organisation", { faitAujourdhui: true })], "matin"), "organisation");
  // Seulement des routines sans domaine, ou aucune routine.
  assert.equal(domaineParDefaut([R(null)], "matin"), "autres");
  assert.equal(domaineParDefaut([], "matin"), "emotions");
});

test("arcs : 6 parts égales séparées d'un écart ; toucher l'anneau choisit le bon domaine", () => {
  const a = bornesArc(0);
  const b = bornesArc(5);
  assert.ok(a.debut > 0 && a.fin < 60);
  assert.ok(b.fin < 360 && b.debut > 300);
  // Anneau de 260 px, arcs au rayon 110 : on touche le milieu de chaque arc.
  DOMAINES.forEach((d, i) => {
    const { debut, fin } = bornesArc(i);
    const angle = (((debut + fin) / 2 - 90) * Math.PI) / 180;
    const x = 130 + 110 * Math.cos(angle);
    const y = 130 + 110 * Math.sin(angle);
    assert.equal(domaineAuPoint(x, y, 260, 110, 18), d);
  });
  assert.equal(domaineAuPoint(130, 20, 260, 110, 18), "emotions"); // tout en haut
  assert.equal(domaineAuPoint(240, 130, 260, 110, 18), "mouvement"); // à droite (90°)
  assert.equal(domaineAuPoint(20, 130, 260, 110, 18), "focus"); // à gauche (270°)
  assert.equal(domaineAuPoint(130, 130, 260, 110, 18), null); // au centre
  assert.equal(domaineAuPoint(130, 60, 260, 110, 18), null); // dans le cercle intérieur
});

test("vue Tout : routines du jour par groupe de moments, puis sans moment", () => {
  const r = (nom, moment) => ({ nom, moment });
  const groupes = grouperParMoment([
    r("lire", "soir"),
    r("eau", null),
    r("café", "matin"),
    r("lever", "reveil"),
    r("dents", "coucher"),
    r("marche", "apres_midi"),
  ]);
  assert.deepEqual(
    groupes.map((g) => [g.groupe.titre, g.routines.map((x) => x.nom)]),
    [
      ["Réveil · Matin", ["lever", "café"]],
      ["Midi · Après-midi", ["marche"]],
      ["Soir · Coucher", ["lire", "dents"]],
      ["Sans moment", ["eau"]],
    ],
  );
  // Groupes vides omis ; l'ordre d'origine départage un même moment.
  assert.deepEqual(
    grouperParMoment([r("b", "midi"), r("a", "midi")]).map((g) => g.routines.map((x) => x.nom)),
    [["b", "a"]],
  );
  assert.deepEqual(grouperParMoment([]), []);
});

test("choix retenu du jour : seules les vues connues sont reprises", () => {
  assert.equal(vueValide("tout"), "tout");
  assert.equal(vueValide("autres"), "autres");
  assert.equal(vueValide("focus"), "focus");
  assert.equal(vueValide("inconnu"), null);
  assert.equal(vueValide(null), null);
});

test("chaque étape cochée remplit un peu : essentielles jusqu'à 2/3, bonus jusqu'au bout", () => {
  const part = (etapes, jd = false) => partRoutine(R("focus", { etapes }), jd);
  const proche = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
  // 3 essentielles, 2 bonus.
  const e = (n, b) => [
    ...[0, 1, 2].map((i) => E(true, i < n)),
    ...[0, 1].map((i) => E(false, i < b)),
  ];
  const suite = [part(e(0, 0)), part(e(1, 0)), part(e(2, 0)), part(e(3, 0)), part(e(3, 1)), part(e(3, 2))];
  proche(suite[0], 0);
  proche(suite[1], 2 / 9);
  proche(suite[2], 4 / 9);
  proche(suite[3], 2 / 3);
  proche(suite[4], 5 / 6);
  proche(suite[5], 1);
  for (let i = 1; i < suite.length; i++) assert.ok(suite[i] > suite[i - 1]);
  // Jour difficile : les essentielles mènent jusqu'au bout.
  proche(part(e(1, 0), true), 1 / 3);
  proche(part(e(3, 0), true), 1);
  // Sans étape essentielle : la première cochée vaut les essentielles.
  const sansEss = (n) => [0, 1, 2].map((i) => E(false, i < n));
  proche(part(sansEss(0)), 0);
  proche(part(sansEss(1)), 2 / 3);
  proche(part(sansEss(2)), 2 / 3 + 1 / 6);
  proche(part(sansEss(3)), 1);
});
