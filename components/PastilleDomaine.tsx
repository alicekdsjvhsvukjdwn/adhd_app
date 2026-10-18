import Svg, { Circle, Path } from "react-native-svg";
import { cheminArc } from "../lib/anneau";
import { avecAlpha } from "../lib/theme";

/**
 * Mini-pastille ronde d'un domaine : se remplit comme son arc ; pleine
 * avec une coche quand tout est fait. Aucun chiffre.
 */
export function PastilleDomaine({
  couleur,
  part,
  fond,
  taille = 22,
}: {
  couleur: string;
  /** 0 à 1, null = aucune routine aujourd'hui. */
  part: number | null;
  /** Couleur de la coche (le fond de l'écran). */
  fond: string;
  taille?: number;
}) {
  const c = taille / 2;
  const epaisseur = taille * 0.16;
  const r = c - epaisseur / 2;
  const p = part ?? 0;

  if (p >= 1) {
    return (
      <Svg width={taille} height={taille}>
        <Circle cx={c} cy={c} r={c} fill={couleur} />
        <Path
          d={`M ${taille * 0.3} ${taille * 0.52} L ${taille * 0.45} ${taille * 0.66} L ${taille * 0.72} ${taille * 0.36}`}
          stroke={fond}
          strokeWidth={taille * 0.12}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }
  return (
    <Svg width={taille} height={taille}>
      <Circle cx={c} cy={c} r={r} stroke={avecAlpha(couleur, 0.18)} strokeWidth={epaisseur} fill="none" />
      {p > 0 && (
        <Path
          d={cheminArc(c, c, r, 0, 360 * p)}
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </Svg>
  );
}
