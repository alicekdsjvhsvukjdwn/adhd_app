// Lancer : npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  colonnesCommunes,
  construireSauvegarde,
  nomFichier,
  validerSauvegarde,
} from "../lib/sauvegarde-format.ts";

const tables = {
  items: [{ id: 1, nom: "Boire un verre d'eau", type: "routine", effort: null }],
  completions: [{ id: 3, item_id: 1, date: "2026-09-30", statut: "complet" }],
  stats: [{ id: 1, points_total: 120 }],
};

test("aller-retour : une sauvegarde exportée est acceptée telle quelle", () => {
  const s = construireSauvegarde(9, tables, new Date("2026-10-01T08:00:00Z"));
  const v = validerSauvegarde(JSON.stringify(s), 9);
  assert.equal(v.ok, true);
  assert.deepEqual(v.sauvegarde.tables, tables);
  assert.equal(v.sauvegarde.schema, 9);
});

test("une sauvegarde plus ancienne est acceptée, une plus récente refusée", () => {
  const s = JSON.stringify(construireSauvegarde(8, tables));
  assert.equal(validerSauvegarde(s, 9).ok, true);
  const v = validerSauvegarde(s, 7);
  assert.equal(v.ok, false);
  assert.match(v.erreur, /plus récente/);
});

test("un fichier qui n'est pas une sauvegarde est refusé", () => {
  for (const texte of ["", "pas du json", "[]", "{}", '{"app":"autre","tables":{}}']) {
    assert.equal(validerSauvegarde(texte, 9).ok, false, texte);
  }
  const sansItems = JSON.stringify(construireSauvegarde(9, { stats: [] }));
  assert.equal(validerSauvegarde(sansItems, 9).ok, false);
});

test("des noms interpolés dans le SQL sont refusés s'ils sortent de [A-Za-z0-9_]", () => {
  const tableAbimee = construireSauvegarde(9, { ...tables, 'x"; DROP TABLE items; --': [] });
  assert.equal(validerSauvegarde(JSON.stringify(tableAbimee), 9).ok, false);
  const colonneAbimee = construireSauvegarde(9, { items: [{ 'nom" = 1 --': "x" }] });
  assert.equal(validerSauvegarde(JSON.stringify(colonneAbimee), 9).ok, false);
});

test("seules les valeurs simples sont acceptées", () => {
  const objet = construireSauvegarde(9, { items: [{ id: 1, nom: { a: 1 } }] });
  assert.equal(validerSauvegarde(JSON.stringify(objet), 9).ok, false);
  const booleen = construireSauvegarde(9, { items: [{ id: 1, fait: true }] });
  assert.equal(validerSauvegarde(JSON.stringify(booleen), 9).ok, false);
});

test("restauration : seules les colonnes encore présentes sont reprises", () => {
  const ligne = { id: 1, nom: "x", colonne_disparue: 4 };
  assert.deepEqual(colonnesCommunes(ligne, ["id", "nom", "effort"]), ["id", "nom"]);
});

test("le fichier porte la date du jour", () => {
  assert.equal(nomFichier("2026-10-01"), "tdah-routines-sauvegarde-2026-10-01.json");
});
