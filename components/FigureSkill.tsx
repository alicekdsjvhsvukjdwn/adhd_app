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
  // Bibliothèque d'exercices (lib/exercices.ts)
  pompe_mur: { d: "M54 6v52 M16 57L44 27 M44 27L53 31", tete: [48, 21] },
  pompe_decline: { d: "M6 58h50 M6 44h12 M6 44v14 M14 44L46 50 M46 50L50 58", tete: [52, 46] },
  pompe_parallettes: { d: "M8 56h48 M14 49h10 M16 49v7 M22 49v7 M19 33V49 M19 33L52 44l3 4", tete: [14, 31] },
  pseudo: { d: "M8 56h48 M24 55L30 36 M30 36L54 46l2 3", tete: [36, 31] },
  presse_halteres: { d: "M32 28v18 M32 46l-4 12 M32 46l4 12 M32 30l-9-6v-10 M32 30l9-6v-10 M19 14h8 M37 14h8", tete: [32, 22] },
  developpe: { d: "M6 58h52 M16 55h24 M40 55l6-10l6 10 M20 55V34 M15 34h10", tete: [11, 52] },
  elev_lat: { d: "M32 28v18 M32 46l-4 12 M32 46l4 12 M32 32L16 34 M32 32L48 34 M12 34h5 M47 34h5", tete: [32, 22] },
  triceps_ext: { d: "M32 28v18 M32 46l-4 12 M32 46l4 12 M32 30l-8-6l4-12 M32 30l8-6l-4-12 M24 10h16", tete: [32, 22] },
  rowing: { d: "M8 58h48 M42 34l-4 24 M42 34l6 24 M42 34L22 26 M22 26l1 14 M19 42h8", tete: [16, 23] },
  rowing_table: { d: "M6 28h52 M10 28v30 M54 28v30 M46 57L21 41 M21 41L19 30", tete: [15, 44] },
  superman: { d: "M6 58h52 M14 52Q32 58 52 50 M14 52L6 46", tete: [19, 49] },
  curl: { d: "M32 28v18 M32 46l-4 12 M32 46l4 12 M32 30l-4 14 M32 30l4 12l6-10 M40 32h6", tete: [32, 22] },
  fente: { d: "M8 58h48 M30 36L44 41V58 M30 36L20 52L10 58 M30 36V19 M30 24l8 8", tete: [30, 14] },
  stepup: { d: "M8 58h50 M40 46h14 M40 46v12 M30 36L42 46 M30 36L28 58 M30 36V20", tete: [30, 14] },
  rdl: { d: "M8 58h48 M36 34L34 58 M36 34L16 32 M16 32V46 M12 46h8", tete: [10, 31] },
  mollets: { d: "M8 58h48 M32 28V52 M32 52L30 58 M32 52L36 58 M32 32l-8 12 M32 32l8 12", tete: [32, 22] },
  hip_thrust: { d: "M8 58h48 M6 42h14 M6 42v16 M14 40L34 38 M34 38L44 44V58", tete: [10, 36] },
  releve: { d: "M6 58h52 M10 55h22 M32 55V28 M10 55l12 3", tete: [8, 53] },
  crunch: { d: "M6 58h52 M30 54L40 40L48 58 M30 54L16 43", tete: [12, 39] },
  bird_dog: { d: "M8 58h48 M20 38L44 38 M20 38V58 M44 38V58 M20 38L7 36 M44 38L58 38", tete: [15, 34] },
  twist: { d: "M8 58h48 M28 54L46 42 M28 54L20 34 M21 40L33 42", tete: [18, 29] },
  lsit_tuck: { d: "M8 58h48 M26 27v18 M26 45L40 41L35 51 M26 31l-4 21 M17 52h10", tete: [26, 21] },
  bear: { d: "M8 58h48 M18 36L44 40 M18 36V56 M44 40L50 48L44 55", tete: [13, 33] },
  cercles_bras: { d: "M32 28v18 M32 46l-4 12 M32 46l4 12 M32 32L14 28 M32 32L50 28 M8 26Q6 32 12 38 M56 26Q58 32 52 38", tete: [32, 22] },
  etir_pecs: { d: "M52 6v52 M30 28v18 M30 46l-4 12 M30 46l4 12 M30 31L44 31L44 18 M52 18h-8", tete: [24, 22] },
  rot_thoracique: { d: "M8 58h48 M18 42L44 44 M44 44V58 M18 42V58 M18 42L10 26", tete: [13, 38] },
  chien: { d: "M8 58h48 M14 56L34 24 M34 24L54 56", tete: [21, 44] },
  enfant: { d: "M8 58h48 M46 56L40 50 M40 50L18 52 M18 52L6 56", tete: [13, 54] },
  hanches_90: { d: "M8 58h48 M30 54V34 M30 54L46 48L38 58 M30 54L16 58", tete: [30, 28] },
  ischios: { d: "M8 58h48 M18 54H52 M18 54L36 38 M36 38L50 52", tete: [38, 33] },
  quad: { d: "M32 28v18 M32 46L32 58 M32 46L36 56L44 44 M32 32L42 44", tete: [32, 22] },
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
