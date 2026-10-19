import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Skill, Statut } from "../lib/skills";

/** Bonhommes au trait (viewBox 64 × 64) : chemin, puis centre de la tête. */
const FIGURES: Record<string, { d: string; tete: [number, number] }> = {
  pompe: { d: "M8 52h48 M18 35l1 15 M18 35L52 46l3 4", tete: [13, 33] },
  traction: { d: "M10 8h44 M26 8l3 13 M38 8l-3 13 M32 26v17 M32 43l-4 14 M32 43l4 14", tete: [32, 21] },
  dips: { d: "M14 32v26 M50 32v26 M10 32h8 M46 32h8 M18 32l9-7 M46 32l-9-7 M32 22v18 M32 40l-3 10l7 4", tete: [32, 16] },
  pistol: { d: "M8 58h48 M30 36l6 11l-4 10 M30 36l22 2 M30 36l-4-13 M27 26l17 2", tete: [25, 18] },
  gainage: { d: "M8 54h48 M18 46l-2 7h8 M18 46L54 52", tete: [13, 44] },
  lsit: { d: "M8 58h48 M26 27v18 M26 45h28 M26 31l-4 26", tete: [26, 21] },
  poirier: { d: "M8 58h48 M27 57l3-12 M37 57l-3-12 M32 42V22 M32 22l-3-14 M32 22l3-14", tete: [32, 49] },
  archer: { d: "M8 52h48 M20 35l-1 15 M20 35l-14 15 M20 35L52 46l3 4", tete: [15, 33] },
  muscleup: { d: "M8 30h48 M24 30l4-7 M40 30l-4-7 M32 19v20 M32 39l-2 16", tete: [32, 13] },
  frontlever: { d: "M10 8h44 M28 8v19 M28 27h28", tete: [22, 27] },
  planche: { d: "M8 56h48 M24 56V41 M24 41h30", tete: [18, 41] },
  // Exercices des séances guidées (lib/exercices.ts)
  pike_taps: { d: "M8 58h48 M16 57l8-13 M24 44l8-14 M32 30l16 27", tete: [19, 48] },
  snow_angels: { d: "M8 58h48 M18 52h32l6 3 M18 52L8 42 M18 52l-8 2", tete: [13, 50] },
  pont: { d: "M8 58h48 M16 55L32 40 M32 40l10 2l4 13", tete: [11, 54] },
  planche_laterale: { d: "M8 58h48 M18 57l1-13 M19 44L54 55 M19 44l-1-18", tete: [24, 40] },
  hollow: { d: "M8 60h48 M18 47Q34 58 54 44 M18 47L6 40", tete: [21, 41] },
  squat: { d: "M8 58h48 M28 36l12 6l-2 15 M28 36l-2-14 M27 26l16 1", tete: [25, 17] },
  chat_vache: { d: "M8 58h48 M20 57V44 M20 44Q32 38 44 44 M44 44v13", tete: [14, 42] },
};

export function FigureSkill({ skill, couleur, taille }: { skill: string; couleur: string; taille: number }) {
  const f = FIGURES[skill];
  if (!f) return null;
  return (
    <Svg width={taille} height={taille} viewBox="0 0 64 64">
      <Path
        d={f.d}
        stroke={couleur}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={f.tete[0]} cy={f.tete[1]} r={4.5} fill={couleur} />
    </Svg>
  );
}

/** Couleurs de l'arbre de skills : maîtrisé, verrouillé, segments à venir. */
export const VERT = "#4ADE80";
export const GRIS = "#3A4A4D";
const GRIS_FONCE = "#1C2628";

/** Un segment par étape : validées, en cours, à venir. */
export function Segments({
  skill,
  etape,
  st,
  accent,
  accentFonce,
}: {
  skill: Skill;
  etape: number;
  st: Statut;
  accent: string;
  accentFonce: string;
}) {
  return (
    <View style={styles.segments}>
      {skill.etapes.map((_, i) => {
        const n = i + 1;
        const couleur =
          st === "maitrise"
            ? VERT
            : st === "verrouille"
              ? GRIS_FONCE
              : n < etape
                ? accent
                : n === etape
                  ? accentFonce
                  : GRIS_FONCE;
        return <View key={i} style={[styles.segment, { backgroundColor: couleur }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: "row", gap: 2, alignSelf: "stretch" },
  segment: { flex: 1, height: 4, borderRadius: 2 },
});
