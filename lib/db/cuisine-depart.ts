import { RECETTES_DEPART } from "../cuisine-depart";
import { minuteurDeLEtape, nomDeCatalogue } from "../cuisine-regles";
import type { getDatabase } from "./client";

/** Copie les recettes de départ dans la base (migration 38, une seule fois : ensuite elles sont à moi). */
export async function semerRecettesDepart(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const t = new Date().toISOString();
  for (const r of RECETTES_DEPART) {
    const id = (
      await db.runAsync(
        "INSERT INTO recettes (titre, portions, prep_min, cuisson_min, tags, notes, depart, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        r.titre,
        r.portions,
        r.prep,
        r.cuisson,
        r.tags,
        r.notes,
        t,
        t,
      )
    ).lastInsertRowId;
    let ordre = 0;
    for (const [q, unite, nom] of r.ingredients) {
      await db.runAsync("INSERT INTO recette_ingredients (recette_id, ordre, nom, quantite, unite, aliment) VALUES (?, ?, ?, ?, ?, ?)", id, ordre++, nom, q, unite, nomDeCatalogue(nom)?.nom ?? "");
    }
    ordre = 0;
    for (const texte of r.etapes) {
      await db.runAsync("INSERT INTO recette_etapes (recette_id, ordre, texte, minuteur_min) VALUES (?, ?, ?, ?)", id, ordre++, texte, minuteurDeLEtape(texte));
    }
  }
}
