/**
 * Idées de récompenses prêtes à ajouter en un tap (feuille « + Ajouter » des récompenses).
 * Pour en ajouter : une ligne dans la bonne catégorie. Le prix est un point de départ,
 * modifiable une fois la récompense ajoutée.
 * Repères : on gagne environ 60 points par jour. Petit 20–60, moyen 100–250, gros 300–1000.
 */
import type { CategorieRecompense, IconeRecompense } from "./recompenses-regles";

export type IdeeRecompense = { nom: string; prix: number; icone: IconeRecompense };

export const IDEES_RECOMPENSES: Record<CategorieRecompense, IdeeRecompense[]> = {
  mer: [
    { nom: "Coucher de soleil sur la Corniche", prix: 20, icone: "soleil" },
    { nom: "Baignade", prix: 30, icone: "vague" },
    { nom: "Café face à la mer", prix: 40, icone: "cafe" },
    { nom: "Pique-nique dehors", prix: 50, icone: "sandwich" },
    { nom: "Navette pour le Frioul", prix: 120, icone: "bateau" },
    { nom: "Rando dans les calanques", prix: 150, icone: "montagne" },
    { nom: "Location de paddle ou kayak", prix: 250, icone: "vague" },
    { nom: "Sortie en bateau", prix: 600, icone: "bateau" },
  ],
  bouffe: [
    { nom: "Glace", prix: 30, icone: "glace" },
    { nom: "Pâtisserie", prix: 40, icone: "gateau" },
    { nom: "Street food", prix: 60, icone: "sandwich" },
    { nom: "Verre en terrasse", prix: 80, icone: "cafe" },
    { nom: "Brunch", prix: 150, icone: "couverts" },
    { nom: "Resto", prix: 250, icone: "couverts" },
    { nom: "Soirée en ville", prix: 300, icone: "lune" },
  ],
  temps: [
    { nom: "Un épisode", prix: 30, icone: "ecran" },
    { nom: "Bain / soin", prix: 50, icone: "bain" },
    { nom: "Jeu vidéo 1 h", prix: 50, icone: "manette" },
    { nom: "Grasse mat'", prix: 60, icone: "lit" },
    { nom: "Soirée film", prix: 60, icone: "film" },
    { nom: "Après-midi lecture", prix: 70, icone: "livre" },
    { nom: "Journée off sans obligation", prix: 400, icone: "etoile" },
  ],
  decouvertes: [
    { nom: "Découvrir un quartier inconnu", prix: 60, icone: "carte" },
    { nom: "Expo ou musée", prix: 100, icone: "musee" },
    { nom: "Ciné", prix: 100, icone: "ticket" },
    { nom: "Visite d'une ville proche (Cassis, La Ciotat, Aix…)", prix: 250, icone: "ville" },
    { nom: "Atelier / cours découverte", prix: 300, icone: "palette" },
    { nom: "Week-end ailleurs", prix: 1000, icone: "avion" },
  ],
  // Les gros objectifs se créent soi-même (« + Créer un gros objectif »).
  gros: [],
};

/** Les idées d'une étagère qui ne sont pas déjà dans les récompenses (même nom, sans tenir compte de la casse). */
export function ideesRestantes(cle: CategorieRecompense, dejaLa: string[]): IdeeRecompense[] {
  const pris = new Set(dejaLa.map((n) => n.trim().toLowerCase()));
  return IDEES_RECOMPENSES[cle].filter((i) => !pris.has(i.nom.toLowerCase()));
}
