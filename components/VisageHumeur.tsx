import Svg, { Circle, Path } from "react-native-svg";
import { couleurHumeur } from "../lib/esprit-regles";

/** Bouche de chaque niveau, du très bas (moue) au très bien (grand sourire). */
const BOUCHES: Record<number, string> = {
  1: "M13 30 Q20 21 27 30",
  2: "M14 29 Q20 25 26 29",
  3: "M14 28 L26 28",
  4: "M14 26 Q20 31 26 26",
  5: "M12 25 Q20 35 28 25",
};

/** Petit visage dessiné sur une pastille de couleur (niveau 1 à 5). */
export function VisageHumeur({ niveau, taille = 48, contour }: { niveau: number; taille?: number; contour?: string }) {
  const n = Math.min(5, Math.max(1, Math.round(niveau)));
  const trait = "#05080A";
  return (
    <Svg width={taille} height={taille} viewBox="0 0 40 40" accessible={false}>
      <Circle cx={20} cy={20} r={18} fill={couleurHumeur(n)} stroke={contour ?? "none"} strokeWidth={contour ? 2 : 0} />
      <Circle cx={14} cy={16} r={1.9} fill={trait} />
      <Circle cx={26} cy={16} r={1.9} fill={trait} />
      <Path d={BOUCHES[n]} stroke={trait} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
