import { Fragment } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";
import { contourZone, couleurZone, GRIS_ZONE, PARTIES, type CleZone, type Zone } from "../lib/journee-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

/**
 * Le bonhomme de « Ma journée » : 7 zones (tête, cœur, bras, ventre, mains, jambes, pieds).
 * Le dessin est fixe (viewBox 100 × 175) ; seuls la couleur et le sens des zones changent (table zones).
 * Le toucher passe par des rectangles transparents posés dessus : assez grands (≥ 44 px à la taille normale,
 * mains et pieds compris) et lisibles par VoiceOver.
 */
const VB_L = 100;
const VB_H = 175;
/** Largeur normale : × 1,6 → chaque zone de toucher fait au moins 44 px. */
export const LARGEUR_BONHOMME = 160;
const CONTOUR = "#E6F4F1";
const BUSTE = "#141C1B";

/** Zones de toucher, en unités du viewBox. Bras et mains : un rectangle de chaque côté. */
const TOUCHER: Record<CleZone, { x: number; y: number; l: number; h: number }[]> = {
  tete: [{ x: 30, y: 2, l: 40, h: 36 }],
  coeur: [{ x: 30, y: 38, l: 40, h: 32 }],
  ventre: [{ x: 30, y: 70, l: 40, h: 32 }],
  bras: [
    { x: 2, y: 40, l: 28, h: 46 },
    { x: 70, y: 40, l: 28, h: 46 },
  ],
  mains: [
    { x: 0, y: 86, l: 30, h: 30 },
    { x: 70, y: 86, l: 30, h: 30 },
  ],
  jambes: [{ x: 28, y: 102, l: 44, h: 42 }],
  pieds: [{ x: 18, y: 144, l: 64, h: 30 }],
};

type Props = {
  zones: Zone[];
  /** Nombre d'entrées par clé de zone. */
  comptes: Record<string, number>;
  /** Largeur en px ; mini ≈ 26. */
  largeur?: number;
  choisie?: CleZone | null;
  /** Absent : bonhomme en lecture (mini, carte de chaleur). */
  onChoisir?: (cle: CleZone) => void;
  /** Mini : une zone avec au moins une entrée prend sa couleur pleine (pas de nuances). */
  plein?: boolean;
  /** Couleur imposée par zone (carte de chaleur du récap). */
  teintes?: Partial<Record<CleZone, string>>;
};

export function Bonhomme({ zones, comptes, largeur = LARGEUR_BONHOMME, choisie, onChoisir, plein, teintes }: Props) {
  const par = Object.fromEntries(zones.map((z) => [z.cle, z])) as Partial<Record<CleZone, Zone>>;
  const couleur = (cle: CleZone) => {
    const z = par[cle];
    if (!z || !z.active) return GRIS_ZONE;
    if (teintes?.[cle]) return teintes[cle]!;
    const n = comptes[cle] ?? 0;
    return couleurZone(z.couleur, plein && n > 0 ? 3 : n);
  };
  /** Zone active sans entrée : contour de sa couleur à 50 %, le bonhomme sert de légende. */
  const vide = (cle: CleZone) => !!par[cle]?.active && !teintes?.[cle] && !(comptes[cle] ?? 0);
  const sel = (cle: CleZone) => choisie === cle;
  const echelle = largeur / VB_L;
  const hauteur = Math.round(VB_H * echelle);
  const mini = largeur < 60;

  /** Trait épais (bras, jambes) : sélectionné, un trait clair plus large dessous fait le contour. */
  const membre = (cle: CleZone, x1: number, y1: number, x2: number, y2: number, epaisseur: number) => (
    <Fragment key={`${cle}${x1}`}>
      {(sel(cle) || vide(cle)) && (
        <Line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={sel(cle) ? CONTOUR : contourZone(par[cle]!.couleur)}
          strokeWidth={epaisseur + (sel(cle) ? 4 : 2)}
          strokeLinecap="round"
        />
      )}
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={couleur(cle)} strokeWidth={epaisseur} strokeLinecap="round" />
    </Fragment>
  );
  const bord = (cle: CleZone) =>
    sel(cle) ? { stroke: CONTOUR, strokeWidth: 2.5 } : vide(cle) ? { stroke: contourZone(par[cle]!.couleur), strokeWidth: mini ? 2 : 1.2 } : {};

  return (
    <View style={{ width: largeur, height: hauteur }}>
      <Svg width={largeur} height={hauteur} viewBox={`0 0 ${VB_L} ${VB_H}`} accessible={false}>
        {membre("bras", 27, 45, 16, 90, 10)}
        {membre("bras", 73, 45, 84, 90, 10)}
        {membre("jambes", 42, 100, 39, 148, 12)}
        {membre("jambes", 58, 100, 61, 148, 12)}
        <Circle cx={50} cy={20} r={15} fill={couleur("tete")} {...bord("tete")} />
        {/* Le buste : neutre, il porte le cœur. */}
        <Rect x={29} y={37} width={42} height={34} rx={13} fill={BUSTE} stroke={sel("coeur") ? CONTOUR : "none"} strokeWidth={2.5} />
        <Path
          d="M58 62 C46 54 50 45 55 46 C57 46.5 58 48 58 49.5 C58 48 59 46.5 61 46 C66 45 70 54 58 62 Z"
          fill={couleur("coeur")}
          {...bord("coeur")}
        />
        <Rect x={31} y={73} width={38} height={28} rx={12} fill={couleur("ventre")} {...bord("ventre")} />
        <Circle cx={15} cy={99} r={7.5} fill={couleur("mains")} {...bord("mains")} />
        <Circle cx={85} cy={99} r={7.5} fill={couleur("mains")} {...bord("mains")} />
        <Ellipse cx={37} cy={158} rx={10} ry={6} fill={couleur("pieds")} {...bord("pieds")} />
        <Ellipse cx={63} cy={158} rx={10} ry={6} fill={couleur("pieds")} {...bord("pieds")} />
      </Svg>
      {onChoisir &&
        !mini &&
        (Object.keys(TOUCHER) as CleZone[]).flatMap((cle) => {
          const z = par[cle];
          if (!z || !z.active) return [];
          const n = comptes[cle] ?? 0;
          return TOUCHER[cle].map((r, i) => (
            <Pressable
              key={`${cle}${i}`}
              onPress={() => onChoisir(cle)}
              style={{ position: "absolute", left: r.x * echelle, top: r.y * echelle, width: r.l * echelle, height: r.h * echelle }}
              accessibilityRole="button"
              accessibilityState={{ selected: sel(cle) }}
              accessibilityLabel={`${PARTIES[cle]} : ${z.libelle}, ${n} entrée${n > 1 ? "s" : ""}`}
            />
          ));
        })}
    </View>
  );
}

/** Le bonhomme en feuille : un tap choisit la zone (changer la zone d'une entrée, zone d'une liste). */
export function FeuilleZone({
  visible,
  titre,
  sousTitre,
  zones,
  choisie,
  onChoisir,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  sousTitre?: string;
  zones: Zone[];
  choisie: CleZone | null;
  onChoisir: (cle: CleZone) => void;
  onFermer: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
          {sousTitre ? <Texte style={[styles.sousTitre, { color: t.textSecondary }]}>{sousTitre}</Texte> : null}
          <Bonhomme zones={zones} comptes={{}} choisie={choisie} onChoisir={onChoisir} />
          <TouchableOpacity onPress={onFermer} hitSlop={8} style={{ marginTop: spacing.md }}>
            <Texte style={{ color: t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>Fermer</Texte>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl },
  feuille: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, alignItems: "center", alignSelf: "center", maxWidth: 360, width: "100%" },
  titre: { fontSize: typography.h3, fontWeight: "600", marginBottom: spacing.sm, textAlign: "center" },
  sousTitre: { fontSize: typography.small, textAlign: "center", marginBottom: spacing.md },
});
