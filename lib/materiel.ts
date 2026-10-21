/**
 * Mon matériel de sport, sans accès à la base : testable seul (tests/exercices.test.mjs).
 * Tout ce qui suit (exercices, skills, séances proposées) se filtre selon ce qu'on a vraiment.
 */

export type MaterielCle = "sol" | "mobilier" | "halteres" | "parallettes" | "elastiques" | "barre" | "anneaux";

export const MATERIELS: { cle: MaterielCle; nom: string; aide: string; fixe?: boolean }[] = [
  { cle: "sol", nom: "Sol", aide: "Un coin au sol, un mur.", fixe: true },
  { cle: "mobilier", nom: "Table, chaise, canapé", aide: "Quelque chose de solide pour s'appuyer, monter, se suspendre sous une table." },
  { cle: "halteres", nom: "Haltères", aide: "Tu saisis les poids que tu as." },
  { cle: "parallettes", nom: "Parallettes", aide: "Moyennes, pour les appuis." },
  { cle: "elastiques", nom: "Élastiques", aide: "Bandes de résistance." },
  { cle: "barre", nom: "Barre de traction", aide: "Fixée ou de porte." },
  { cle: "anneaux", nom: "Anneaux", aide: "De gymnastique, suspendus." },
];

export type Materiel = {
  dispo: Record<MaterielCle, boolean>;
  /** Poids des haltères, en kg, du plus léger au plus lourd. */
  poids: number[];
};

export const MATERIEL_DEFAUT: Materiel = {
  dispo: { sol: true, mobilier: true, halteres: true, parallettes: true, elastiques: false, barre: false, anneaux: false },
  poids: [],
};

/** Valeurs lues en base : tout ce qui manque ou déraille retombe sur le défaut ; le sol est toujours là. */
export function materielValide(brut: unknown): Materiel {
  const b = (brut && typeof brut === "object" ? brut : {}) as Partial<Materiel>;
  const dispo = { ...MATERIEL_DEFAUT.dispo };
  for (const { cle } of MATERIELS) if (typeof b.dispo?.[cle] === "boolean") dispo[cle] = b.dispo[cle];
  dispo.sol = true;
  const poids = (Array.isArray(b.poids) ? b.poids : [])
    .map(Number)
    .filter((p) => Number.isFinite(p) && p > 0 && p <= 100)
    .map((p) => Math.round(p * 2) / 2);
  return { dispo, poids: [...new Set(poids)].sort((a, c) => a - c) };
}

/** Ce qui manque parmi le matériel demandé. */
export const manquants = (requis: MaterielCle[], m: Materiel): MaterielCle[] => requis.filter((c) => !m.dispo[c]);

export const nomMateriel = (cle: MaterielCle): string => MATERIELS.find((x) => x.cle === cle)?.nom ?? cle;

/** « 2,5 kg » */
export const libellePoids = (kg: number): string => `${String(kg).replace(".", ",")} kg`;
