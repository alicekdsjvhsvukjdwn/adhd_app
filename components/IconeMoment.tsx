import Svg, { Circle, Line, Path } from "react-native-svg";
import type { Moment } from "../lib/moments";

/**
 * Icônes au trait des moments de la journée (grille 24 × 24).
 * Réveil : soleil qui se lève · Matin : soleil et rayons · Midi : soleil haut
 * au-dessus de l'horizon · Après-midi : soleil bas sur deux lignes ·
 * Soir : soleil couchant à moitié · Coucher : croissant de lune.
 */
export function IconeMoment({
  moment,
  couleur,
  taille = 24,
  epaisseur = 1.8,
}: {
  moment: Moment;
  couleur: string;
  taille?: number;
  epaisseur?: number;
}) {
  const trait = {
    stroke: couleur,
    strokeWidth: epaisseur,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      {moment === "reveil" && (
        <>
          <Line x1={3} y1={18} x2={21} y2={18} {...trait} />
          <Path d="M7 18 A5 5 0 0 1 17 18" {...trait} />
          <Line x1={12} y1={8} x2={12} y2={10.5} {...trait} />
          <Line x1={5.6} y1={11.6} x2={7.3} y2={13.3} {...trait} />
          <Line x1={18.4} y1={11.6} x2={16.7} y2={13.3} {...trait} />
          <Path d="M10 5 L12 3 L14 5" {...trait} />
        </>
      )}
      {moment === "matin" && (
        <>
          <Circle cx={12} cy={12} r={4} {...trait} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return (
              <Line
                key={a}
                x1={12 + Math.cos(r) * 6.5}
                y1={12 + Math.sin(r) * 6.5}
                x2={12 + Math.cos(r) * 9}
                y2={12 + Math.sin(r) * 9}
                {...trait}
              />
            );
          })}
        </>
      )}
      {moment === "midi" && (
        <>
          <Circle cx={12} cy={8} r={3.5} {...trait} />
          <Line x1={12} y1={1.5} x2={12} y2={2.8} {...trait} />
          <Line x1={5.5} y1={8} x2={6.8} y2={8} {...trait} />
          <Line x1={17.2} y1={8} x2={18.5} y2={8} {...trait} />
          <Line x1={3} y1={19} x2={21} y2={19} {...trait} />
        </>
      )}
      {moment === "apres_midi" && (
        <>
          <Circle cx={12} cy={12} r={3.5} {...trait} />
          <Line x1={3} y1={18} x2={21} y2={18} {...trait} />
          <Line x1={7} y1={21.5} x2={17} y2={21.5} {...trait} />
        </>
      )}
      {moment === "soir" && (
        <>
          <Path d="M6.5 15 A5.5 5.5 0 0 1 17.5 15" {...trait} />
          <Line x1={2.5} y1={15} x2={21.5} y2={15} {...trait} />
          <Line x1={8} y1={18.5} x2={16} y2={18.5} {...trait} />
          <Line x1={10.5} y1={21.5} x2={13.5} y2={21.5} {...trait} />
        </>
      )}
      {moment === "coucher" && (
        <Path d="M19.5 14.5 A8 8 0 1 1 9.5 4.5 A6.3 6.3 0 0 0 19.5 14.5 Z" {...trait} />
      )}
    </Svg>
  );
}
