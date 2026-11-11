// Lancer : npm test
// Énergie du jour à 2 niveaux : un jour noté « En forme » se lit Normal, sans rien réécrire en base.
import assert from "node:assert/strict";
import { test } from "node:test";
import { initialiserBase } from "../lib/db/demarrage.ts";
import { energieDuJour, niveauAffiche } from "../lib/db/energie.ts";
import { cleEnergie } from "../lib/db/jour-difficile.ts";
import { ecrireMeta, lireMeta } from "../lib/db/meta.ts";
import { MODULES } from "../lib/modules-visibles.ts";

await initialiserBase();

test("énergie : « En forme » masqué, un jour noté 3 s'affiche Normal et la base garde 3 ; visible, il reste 3", async () => {
  await ecrireMeta(cleEnergie(), "3");
  MODULES.energieEnForme = false;
  assert.equal(niveauAffiche((await energieDuJour()).niveau), 2);
  assert.equal(await lireMeta(cleEnergie()), "3");
  assert.deepEqual([1, 2, null].map(niveauAffiche), [1, 2, null]);
  MODULES.energieEnForme = true;
  assert.equal(niveauAffiche(3), 3);
});
