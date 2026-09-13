import type { FamilleTemplate } from "../types";

export const LEVER_CONSTANT: FamilleTemplate = {
  id: "lever-constant",
  nom: "Heure de lever stable",
  categorie: "sommeil",
  problemes: [
    "je n'arrive pas à me lever",
    "mes journées commencent n'importe quand",
  ],
  mots_cles: ["lever", "reveil", "matin", "snooze", "debout", "horaire", "rythme"],
  moment: "reveil",
  ancre_suggeree: "sonnerie du réveil",
  variantes: [
    {
      rang: 1,
      libelle: "Poser les pieds au sol à la sonnerie",
      duree_min: 1,
      premiere_action: "Sortir un pied de la couette",
      effort: 2,
    },
    {
      rang: 2,
      libelle: "Se lever et ouvrir les rideaux",
      duree_min: 2,
      premiere_action: "Poser les pieds au sol",
      effort: 2,
    },
    {
      rang: 3,
      libelle: "Se lever et sortir de la chambre",
      duree_min: 5,
      premiere_action: "Poser les pieds au sol",
      effort: 3,
    },
    {
      rang: 4,
      libelle: "Se lever, sortir, boire un verre d'eau à la lumière",
      duree_min: 10,
      premiere_action: "Poser les pieds au sol",
      effort: 3,
    },
  ],
  contre_indication:
    "Ne pas proposer si l'heure de lever visée est avancée de plus d'une heure par rapport à l'heure habituelle : le décalage se fait par paliers de 15 minutes.",
  justification:
    "Le retard de phase est fréquent dans le TDAH adulte. C'est la régularité de l'heure de lever, pas celle du coucher, qui réancre le rythme circadien, et la lumière du matin en est le signal principal.",
  source: "Kooij & Bijlenga, 2013",
  icone: "lever",
  palier_devoilement: 0,
  prerequis: [],
};

export const FAMILLES_SOMMEIL: FamilleTemplate[] = [LEVER_CONSTANT];
