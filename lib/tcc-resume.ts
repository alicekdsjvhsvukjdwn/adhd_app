/**
 * Résumé avant une séance de TCC, sans accès à la base : testable seul (tests/esprit.test.mjs).
 * Il reprend ce qui a été noté depuis la séance d'avant, sans interpréter.
 */
import { decalerJours } from "./dates";
import { emotionsFrequentes, moyenne, moyennesParJour } from "./esprit-regles";

/** Sans séance précédente, on remonte d'autant de jours. */
export const JOURS_PAR_DEFAUT = 30;

/**
 * Période du résumé : du lendemain de la séance précédente à aujourd'hui, bornes comprises.
 * `reference` : la séance pour laquelle on prépare (la prochaine, sinon aujourd'hui).
 */
export function periodeResume(datesSeances: string[], reference: string, aujourdhui: string): { debut: string; fin: string } {
  const avant = datesSeances.filter((d) => d < reference).sort().at(-1);
  const fin = aujourdhui < reference ? aujourdhui : reference;
  return { debut: avant ? decalerJours(avant, 1) : decalerJours(fin, -(JOURS_PAR_DEFAUT - 1)), fin };
}

export type EntreesResume = {
  debut: string;
  fin: string;
  humeurs: { jour: string; niveau: number; emotions: string }[];
  /** Entrées du journal marquées « à en parler » dans la période. */
  pensees: { jour: string; pensee: string; emotions: string; intensite_avant: number | null; intensite_apres: number | null }[];
  exercices: { nom: string; faits: number }[];
  sommeil: { nuits: number; moyenneMin: number | null };
  sport: { jours: number };
  aDire: string[];
};

export type Resume = EntreesResume & {
  moyenneHumeur: number | null;
  courbe: { jour: string; moy: number | null }[];
  emotions: [string, number][];
};

export function construireResume(e: EntreesResume): Resume {
  const dansPeriode = (j: string) => j >= e.debut && j <= e.fin;
  const humeurs = e.humeurs.filter((h) => dansPeriode(h.jour));
  const jours: string[] = [];
  for (let j = e.debut; j <= e.fin && jours.length < 120; j = decalerJours(j, 1)) jours.push(j);
  return {
    ...e,
    humeurs,
    pensees: e.pensees.filter((p) => dansPeriode(p.jour)),
    moyenneHumeur: moyenne(humeurs.map((h) => h.niveau)),
    courbe: moyennesParJour(humeurs, jours),
    emotions: emotionsFrequentes(humeurs.map((h) => h.emotions)),
  };
}

const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const dateCourte = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${JOURS_COURTS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]}`;
};

const dureeLisible = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`;

/** Le résumé en texte, à partager tel quel. */
export function texteResume(r: Resume): string {
  const l: string[] = [`Depuis ma dernière séance : du ${dateCourte(r.debut)} au ${dateCourte(r.fin)}`, ""];
  l.push(
    r.moyenneHumeur === null
      ? "Humeur : rien de noté."
      : `Humeur : ${r.moyenneHumeur}/5 en moyenne (${r.humeurs.length} notes, 1 = très bas, 5 = très bien).`,
  );
  const points = r.courbe.filter((c) => c.moy !== null);
  if (points.length > 0) l.push("Jour par jour : " + points.map((c) => `${dateCourte(c.jour).split(" ").slice(0, 2).join(" ")} ${c.moy}`).join(" · "));
  if (r.emotions.length > 0) l.push("Émotions les plus fréquentes : " + r.emotions.map(([e, n]) => `${e} (${n})`).join(", ") + ".");
  l.push("");
  if (r.pensees.length > 0) {
    l.push("Entrées du journal à voir ensemble :");
    for (const p of r.pensees) {
      const fleche = p.intensite_avant !== null ? ` (${p.intensite_avant}${p.intensite_apres !== null ? ` → ${p.intensite_apres}` : ""}/100)` : "";
      l.push(`- ${dateCourte(p.jour)} : ${p.pensee || "(sans pensée notée)"}${p.emotions ? ` · ${p.emotions.split(",").join(", ")}` : ""}${fleche}`);
    }
    l.push("");
  }
  if (r.exercices.length > 0) {
    l.push("Exercices : " + r.exercices.map((x) => `${x.nom} (${x.faits} fois)`).join(", ") + ".");
  }
  l.push(
    `Sommeil : ${r.sommeil.nuits === 0 ? "rien de noté" : `${r.sommeil.nuits} nuits, ${dureeLisible(r.sommeil.moyenneMin ?? 0)} en moyenne`}. Sport : ${r.sport.jours} jour${r.sport.jours > 1 ? "s" : ""}.`,
  );
  if (r.aDire.length > 0) {
    l.push("", "À dire en séance :");
    for (const a of r.aDire) l.push(`- ${a}`);
  }
  return l.join("\n");
}
