export type Categorie = "sommeil" | "mouvement" | "organisation" | "focus";

export type Moment =
  | "reveil"
  | "matin"
  | "midi"
  | "apres-midi"
  | "soir"
  | "coucher"
  | "indifferent";

/** 1 = facile, 3 = coûteux. Sert à l'adéquation à l'état déclaré. */
export type Effort = 1 | 2 | 3;

export type VarianteTemplate = {
  /** 1 = variante la plus accessible. Le moteur descend d'un cran après des échecs. */
  rang: number;
  libelle: string;
  duree_min: number;
  /** Petite, physique, immédiate. Le blocage est l'initiation, pas l'exécution. */
  premiere_action: string;
  effort: Effort;
};

export type FamilleTemplate = {
  id: string;
  nom: string;
  categorie: Categorie;
  /** Formulations de l'entrée "par le problème" — pas des catégories. */
  problemes: string[];
  /** Synonymes pour la recherche. */
  mots_cles: string[];
  moment: Moment;
  ancre_suggeree: string | null;
  variantes: VarianteTemplate[];
  contre_indication: string | null;
  /** 1-2 phrases, réutilisées par la carte de psychoéducation liée. */
  justification: string;
  source: string;
  icone: string;
  /** 0 = proposable à l'onboarding, 1 = courant, 2 = structuration profonde. */
  palier_devoilement: 0 | 1 | 2;
  /** Ids de familles qui doivent tenir avant de proposer celle-ci. */
  prerequis: string[];
};
