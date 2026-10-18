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
  bonusDomaine,
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

test("arc : routine faite, ou part de ses étapes essentielles cochées", () => {
  assert.equal(partRoutine(R("focus")), 0);
  assert.equal(partRoutine(R("focus", { faitAujourdhui: true })), 1);
  const etapes = (e1, e2, b) => R("focus", { etapes: [E(true, e1), E(true, e2), E(false, b)] });
  assert.equal(partRoutine(etapes(false, false, true)), 0); // un bonus seul n'avance pas l'arc
  assert.equal(partRoutine(etapes(true, false, false)), 0.5);
  assert.equal(partRoutine(etapes(true, true, false)), 1); // essentielles faites = part pleine
  assert.equal(partRoutine(etapes(true, true, true)), 1);
  // Sans essentielle : la première étape cochée tient lieu d'essentielle.
  const sansEss = (n) => R("focus", { etapes: [0, 1, 2].map((i) => E(false, i < n)) });
  assert.equal(partRoutine(sansEss(0)), 0);
  assert.equal(partRoutine(sansEss(1)), 1);
});

test("remplissage d'un domaine : vide, en cours, terminé ; sans domaine à part", () => {
  const routines = [
    R("sommeil", { faitAujourdhui: true }),
    R("sommeil"),
    R("focus", { faitAujourdhui: true }),
    R(null, { faitAujourdhui: true }),
    R("pas-un-domaine"),
  ];
  assert.equal(remplissage(routines, "sommeil"), 0.5);
  assert.equal(remplissage(routines, "focus"), 1);
  assert.equal(remplissage(routines, "emotions"), null);
  assert.equal(remplissage(routines, "autres"), 0.5);
  const aEtapes = [R("mouvement", { etapes: [E(true, true), E(true, false)] }), R("mouvement", { faitAujourdhui: true })];
  assert.equal(remplissage(aEtapes, "mouvement"), 0.75);
});

test("halo : étapes bonus cochées du domaine, même avant les essentielles", () => {
  const routines = [
    R("focus", { etapes: [E(true, false), E(false, true), E(false, false)] }),
    R("focus", { etapes: [E(true, true), E(false, true)] }),
    R("focus", { faitAujourdhui: true }),
    R("sommeil", { etapes: [E(true, true)] }),
  ];
  // 2 bonus cochés sur 3, l'un avant toute essentielle.
  assert.ok(Math.abs(bonusDomaine(routines, "focus") - 2 / 3) < 1e-9);
  // Aucune étape bonus : pas de halo.
  assert.equal(bonusDomaine(routines, "sommeil"), null);
  assert.equal(bonusDomaine(routines, "emotions"), null);
  // Sans essentielle : la première tient lieu d'essentielle, les autres sont des bonus.
  const sansEss = [R("organisation", { etapes: [E(false, false), E(false, true), E(false, true)] })];
  assert.equal(partRoutine(sansEss[0]), 1);
  assert.equal(bonusDomaine(sansEss, "organisation"), 0.5);
  assert.equal(bonusDomaine([R("organisation", { etapes: [E(false, false), E(false, false)] })], "organisation"), 0);
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
