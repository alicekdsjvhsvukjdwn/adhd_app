import { definirExercicesPerso, EXERCICES, type ExercicePerso, type ModeExercice } from "../exercices";
import { ecrireMeta, lireMeta } from "./meta";

/**
 * Mes exercices libres : ceux que j'ajoute moi-même à une séance parce qu'ils ne sont pas dans la bibliothèque.
 * Les séries faites vont dans la table `series` comme les autres (exercice_id = « perso:3 », nom recopié).
 *
 * ponytail: la liste est un JSON dans meta (clé sport_exercices_perso), sans table ni migration : revenir à une
 * version précédente de l'appli reste sans risque. Passer à une table si la liste dépasse quelques dizaines
 * d'exercices ou s'il faut les interroger en SQL.
 */
const CLE = "sport_exercices_perso";
const MODES: ModeExercice[] = ["reps", "s", "reps_poids"];

async function lire(): Promise<ExercicePerso[]> {
  try {
    const brut: unknown = JSON.parse((await lireMeta(CLE)) ?? "[]");
    if (!Array.isArray(brut)) return [];
    return brut.filter(
      (p): p is ExercicePerso =>
        !!p && typeof p.id === "string" && /^perso:\d+$/.test(p.id) && typeof p.nom === "string" && p.nom.trim() !== "" && MODES.includes(p.mode),
    );
  } catch {
    return [];
  }
}

/** Au démarrage (et après une restauration) : la liste de la base devient celle que lit `exercice(id)`. */
export async function chargerExercicesPerso(): Promise<void> {
  definirExercicesPerso(await lire());
}

const pareil = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Ajoute un exercice libre et renvoie son identifiant. Un nom déjà connu (dans la bibliothèque ou dans mes
 * exercices) n'est pas doublé : on renvoie celui qui existe. Nom vide : null.
 */
export async function creerExercicePerso(nom: string, mode: ModeExercice): Promise<string | null> {
  const propre = nom.trim().replace(/\s+/g, " ");
  if (!propre) return null;
  const connu = EXERCICES.find((e) => pareil(e.nom, propre));
  if (connu) return connu.id;
  const liste = await lire();
  const deja = liste.find((p) => pareil(p.nom, propre));
  if (deja) return deja.id;
  const id = `perso:${Math.max(0, ...liste.map((p) => Number(p.id.slice(6)))) + 1}`;
  const suite = [...liste, { id, nom: propre, mode: MODES.includes(mode) ? mode : "reps" }];
  await ecrireMeta(CLE, JSON.stringify(suite));
  definirExercicesPerso(suite);
  return id;
}
