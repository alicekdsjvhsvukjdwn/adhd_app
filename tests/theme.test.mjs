// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { COULEURS_CATEGORIE, ORDRE_CATEGORIES } from "../lib/theme-categories.ts";
import { COULEURS_LISTES, CLES_COULEURS } from "../lib/theme-listes.ts";
import {
  contraste,
  momentDeHeure,
  policeDe,
  TEINTES,
  THEMES,
} from "../lib/theme.ts";

test("moment selon l'heure : bornes fixes, après minuit = coucher", () => {
  const cas = [
    [5.99, "coucher"],
    [6, "reveil"],
    [7.99, "reveil"],
    [8, "matin"],
    [11.99, "matin"],
    [12, "midi"],
    [13.99, "midi"],
    [14, "apres_midi"],
    [17.99, "apres_midi"],
    [18, "soir"],
    [20.99, "soir"],
    [21, "coucher"],
    [23.99, "coucher"],
    [0, "coucher"],
    [2.5, "coucher"],
  ];
  for (const [h, m] of cas) assert.equal(momentDeHeure(h), m, `${h} h`);
});

test("contraste ≥ 4,5:1 pour chaque texte, sur chaque surface, à chaque moment", () => {
  for (const [moment, t] of Object.entries(THEMES)) {
    for (const surface of [t.bgApp, t.bgCard, t.bgCardActive, t.border]) {
      for (const texte of [t.textPrimary, t.textSecondary, t.textMuted, t.accent]) {
        assert.ok(contraste(texte, surface) >= 4.5, `${moment} : ${texte} sur ${surface}`);
      }
    }
    // Bouton principal (accent clair) et bouton sélectionné (accent foncé).
    assert.ok(contraste(t.textOnAccent, t.accent) >= 4.5, `${moment} : texte sur accent`);
    assert.ok(contraste(t.textOnAccentFonce, t.accentFonce) >= 4.5, `${moment} : texte sur accent foncé`);
  }
  assert.equal(THEMES.matin.bgApp, "#05080A");
  assert.equal(TEINTES.coucher.carte, "#0B0E1C");
});

test("domaines : arc-en-ciel dans l'ordre de l'anneau, texte foncé lisible sur pastille pleine", () => {
  assert.deepEqual(
    ORDRE_CATEGORIES.map((c) => COULEURS_CATEGORIE[c]),
    ["#F87171", "#FB923C", "#FACC15", "#4ADE80", "#60A5FA", "#A78BFA"],
  );
  for (const [moment, t] of Object.entries(THEMES)) {
    for (const c of Object.values(COULEURS_CATEGORIE)) {
      // Coche, étape cochée, puce du formulaire : texte = fond de l'appli.
      assert.ok(contraste(t.bgApp, c) >= 4.5, `${moment} : texte foncé sur ${c}`);
      assert.ok(contraste(t.textOnAccent, c) >= 4.5, `${moment} : textOnAccent sur ${c}`);
    }
  }
  // Six teintes bien distinctes.
  assert.equal(new Set(Object.values(COULEURS_CATEGORIE)).size, 6);
});

test("couleurs des listes visibles sur le fond noir", () => {
  for (const c of Object.values(COULEURS_LISTES)) {
    assert.ok(contraste(c, "#05080A") >= 4.5, c); // aussi : texte sombre posé dessus
  }
});

test("listes : 8 couleurs aux luminosités bien espacées", () => {
  assert.equal(CLES_COULEURS.length, 8);
  assert.equal(new Set(CLES_COULEURS).size, 8);
  const triees = Object.values(COULEURS_LISTES).sort((a, b) => contraste(a, "#000000") - contraste(b, "#000000"));
  for (let i = 1; i < triees.length; i++) {
    assert.ok(contraste(triees[i], triees[i - 1]) >= 1.15, `${triees[i - 1]} → ${triees[i]}`);
  }
});

test("police : une famille par graisse, Space Grotesk pour les titres", () => {
  assert.equal(policeDe(undefined, false), "Manrope_400Regular");
  assert.equal(policeDe("600", false), "Manrope_600SemiBold");
  assert.equal(policeDe("bold", true), "SpaceGrotesk_700Bold");
  assert.equal(policeDe("300", true), "SpaceGrotesk_400Regular");
  assert.equal(policeDe("800", false), "Manrope_700Bold");
});
