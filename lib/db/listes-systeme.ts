import { getDatabase } from "./client";
import { ajouterListe } from "./listes";
import { ecrireMeta, lireMeta } from "./meta";

/**
 * Listes créées par l'appli pour une fonction (« Projets », « Courses / achats »…), retrouvées par une clé.
 * Une seule liste par clé : la future partie Cuisine pourra rattacher ses courses à « courses » (même clé)
 * sans rien dupliquer. Si la liste a été supprimée, elle est recréée à la demande.
 */
export const LISTE_PROJETS = { cle: "projets", nom: "Projets", icone: "🛠️" } as const;
export const LISTE_COURSES = { cle: "courses", nom: "Courses / achats", icone: "🛒" } as const;

export async function listeSysteme(l: { cle: string; nom: string; icone: string }): Promise<number> {
  const db = await getDatabase();
  const meta = `liste_systeme:${l.cle}`;
  const connue = Number(await lireMeta(meta));
  if (connue > 0 && (await db.getFirstAsync("SELECT id FROM listes WHERE id = ?", connue))) return connue;
  // Une liste du même nom existe déjà (créée à la main) : on la reprend.
  const meme = await db.getFirstAsync<{ id: number }>("SELECT id FROM listes WHERE nom = ? ORDER BY id LIMIT 1", l.nom);
  const id = meme?.id ?? (await ajouterListe(l.nom, l.icone));
  await ecrireMeta(meta, String(id));
  return id;
}
