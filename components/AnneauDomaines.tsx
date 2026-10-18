import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import {
  angleBille,
  bornesArc,
  cheminArc,
  DOMAINES,
  domaineAuPoint,
  point,
  type Domaine,
  type Vue,
} from "../lib/anneau";
import { NOMS_MOMENT } from "../lib/moments";
import { avecAlpha, useTheme } from "../lib/theme";
import { COULEURS_CATEGORIE } from "../lib/theme-categories";
import { IconeMoment } from "./IconeMoment";
import { Texte } from "./Texte";

/** Gris très foncé du cercle intérieur (le trajet de la journée). */
const CERCLE_JOURNEE = "#1A2629";

/**
 * L'anneau des domaines : 6 arcs (fond pâle, partie remplie au fil des
 * routines et étapes essentielles faites), un halo fin autour de chaque arc
 * pour les étapes bonus, le cercle de la journée avec sa bille-soleil, et au
 * centre le moment. Aucun chiffre. Toucher un arc sélectionne son domaine.
 */
export function AnneauDomaines({
  taille,
  remplissages,
  bonus,
  selection,
  heure,
  onSelection,
}: {
  taille: number;
  /** Par domaine, de 0 à 1 ; null = aucune routine aujourd'hui. */
  remplissages: Record<Domaine, number | null>;
  /** Halo des étapes bonus, par domaine (0 à 1) ; null = pas d'étape bonus. */
  bonus: Record<Domaine, number | null>;
  /** Vue « Tout » : aucun arc mis en avant. */
  selection: Vue;
  /** Heure locale décimale, pour la bille. */
  heure: number;
  onSelection: (d: Domaine) => void;
}) {
  const t = useTheme();
  const c = taille / 2;
  const epaisseur = taille * 0.055;
  const epaisseurChoisie = epaisseur * 1.7;
  // Le halo des bonus, fin, juste à l'extérieur des arcs.
  const epaisseurHalo = Math.max(2, taille * 0.012);
  const rayonHalo = c - epaisseurHalo / 2 - 1;
  const rayonArcs = rayonHalo - epaisseurHalo / 2 - taille * 0.012 - epaisseurChoisie / 2;
  const rayonJournee = rayonArcs - epaisseurChoisie - taille * 0.04;
  const angle = angleBille(heure);
  const bille = point(c, c, rayonJournee, angle);

  return (
    <Pressable
      onPress={(e) => {
        const d = domaineAuPoint(
          e.nativeEvent.locationX,
          e.nativeEvent.locationY,
          taille,
          rayonArcs,
          epaisseurChoisie,
        );
        if (d) onSelection(d);
      }}
      accessibilityRole="adjustable"
      accessibilityLabel="Anneau des domaines"
      style={{ width: taille, height: taille }}
    >
      <Svg width={taille} height={taille}>
        {DOMAINES.map((d, i) => {
          const { debut, fin } = bornesArc(i);
          const part = remplissages[d] ?? 0;
          const largeur = d === selection ? epaisseurChoisie : epaisseur;
          const halo = bonus[d];
          return [
            halo !== null ? (
              <Path
                key={`${d}-halo-fond`}
                d={cheminArc(c, c, rayonHalo, debut, fin)}
                stroke={avecAlpha(COULEURS_CATEGORIE[d], 0.15)}
                strokeWidth={epaisseurHalo}
                strokeLinecap="round"
                fill="none"
              />
            ) : null,
            halo ? (
              <Path
                key={`${d}-halo`}
                d={cheminArc(c, c, rayonHalo, debut, debut + (fin - debut) * Math.min(1, halo))}
                stroke={COULEURS_CATEGORIE[d]}
                strokeWidth={epaisseurHalo}
                strokeLinecap="round"
                fill="none"
              />
            ) : null,
            <Path
              key={`${d}-fond`}
              d={cheminArc(c, c, rayonArcs, debut, fin)}
              stroke={avecAlpha(COULEURS_CATEGORIE[d], 0.18)}
              strokeWidth={largeur}
              strokeLinecap="round"
              fill="none"
            />,
            part > 0 ? (
              <Path
                key={`${d}-plein`}
                d={cheminArc(c, c, rayonArcs, debut, debut + (fin - debut) * Math.min(1, part))}
                stroke={COULEURS_CATEGORIE[d]}
                strokeWidth={largeur}
                strokeLinecap="round"
                fill="none"
              />
            ) : null,
          ];
        })}

        {/* La journée : de 6 h (en haut) à minuit (tour complet) */}
        <Circle cx={c} cy={c} r={rayonJournee} stroke={CERCLE_JOURNEE} strokeWidth={2} fill="none" />
        {angle >= 360 ? (
          <Circle cx={c} cy={c} r={rayonJournee} stroke={t.accent} strokeWidth={2} fill="none" />
        ) : angle > 0 ? (
          <Path
            d={cheminArc(c, c, rayonJournee, 0, angle)}
            stroke={t.accent}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        <Circle cx={bille.x} cy={bille.y} r={taille * 0.022} fill={t.bille} />
      </Svg>

      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <IconeMoment moment={t.moment} couleur={t.accent} taille={taille * 0.15} />
        <Texte style={[styles.moment, { color: t.textPrimary, fontSize: taille * 0.075 }]}>
          {NOMS_MOMENT[t.moment]}
        </Texte>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
  moment: { fontWeight: "600", marginTop: 4 },
});
