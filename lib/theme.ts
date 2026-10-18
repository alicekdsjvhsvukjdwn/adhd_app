import { createContext, useContext } from "react";
import type { Moment } from "./moments";

/**
 * Thème de l'appli : toujours sombre, accent selon le moment de la journée.
 * Un seul module : couleurs, polices, tailles. Les couleurs du moment sont
 * fournies par components/FournisseurTheme (mise à jour au retour au
 * premier plan et toutes les 5 minutes) ; les écrans les lisent avec useTheme().
 * Sans accès au téléphone : testable seul (tests/theme.test.mjs).
 */

// ─── Moment de la journée (horaires fixes) ──────────────────────────────

/** Réveil 6–8 h · Matin 8–12 h · Midi 12–14 h · Après-midi 14–18 h · Soir 18–21 h · Coucher après 21 h et avant 6 h. */
export function momentDeHeure(heure: number): Moment {
  if (heure >= 6 && heure < 8) return "reveil";
  if (heure >= 8 && heure < 12) return "matin";
  if (heure >= 12 && heure < 14) return "midi";
  if (heure >= 14 && heure < 18) return "apres_midi";
  if (heure >= 18 && heure < 21) return "soir";
  return "coucher";
}

/** Heure locale décimale (14.5 = 14 h 30). */
export const heureDecimale = (d = new Date()) => d.getHours() + d.getMinutes() / 60;

// ─── Couleurs ───────────────────────────────────────────────────────────

const FOND = "#05080A";
const TEXTE = "#E6F4F1";
/** ≥ 6:1 sur toutes les surfaces. */
const TEXTE_SECONDAIRE = "#8FA8A6";
/** ≥ 5:1 sur toutes les surfaces. */
const TEXTE_ATTENUE = "#7E9794";

type Teinte = {
  /** Onglet actif, boutons principaux, liens. */
  accent: string;
  /** Fond d'un bouton sélectionné (texte clair dessus, ≥ 4,5:1). */
  accentFonce: string;
  carte: string;
  bordure: string;
};

export const TEINTES: Record<Moment, Teinte> = {
  reveil: { accent: "#93C5FD", accentFonce: "#1D4ED8", carte: "#0B111A", bordure: "#172338" },
  matin: { accent: "#5EEAD4", accentFonce: "#0F766E", carte: "#0B1316", bordure: "#16262A" },
  midi: { accent: "#6EE7B7", accentFonce: "#047857", carte: "#0B1513", bordure: "#162A24" },
  apres_midi: { accent: "#86EFAC", accentFonce: "#166534", carte: "#0C1512", bordure: "#182A20" },
  soir: { accent: "#67E8F9", accentFonce: "#0E7490", carte: "#0A1418", bordure: "#152A31" },
  coucher: { accent: "#818CF8", accentFonce: "#3730A3", carte: "#0B0E1C", bordure: "#1E2340" },
};

/** La bille-soleil de l'anneau : jaune le jour, lavande le soir. */
export const COULEURS_BILLE = { jour: "#FDE68A", soir: "#C7D2FE" } as const;

/** Mélange deux couleurs #RRGGBB (part de b entre 0 et 1). */
export function melanger(a: string, b: string, part: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) => Math.round(c(a, i) * (1 - part) + c(b, i) * part).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Couleur avec transparence (#RRGGBB + alpha 0–1) → rgba(). */
export function avecAlpha(hex: string, alpha: number): string {
  const c = (i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `rgba(${c(0)}, ${c(1)}, ${c(2)}, ${alpha})`;
}

/** Rapport de contraste WCAG entre deux couleurs #RRGGBB. */
export function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const v = [0, 1, 2].map((i) => {
      const x = parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export type ThemeTokens = {
  moment: Moment;
  bgApp: string;
  bgCard: string;
  /** Carte cochée ou sélectionnée : teinte de l'accent foncé. */
  bgCardActive: string;
  bgHighlight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Texte sur un fond d'accent clair. */
  textOnAccent: string;
  accent: string;
  accentFonce: string;
  /** Texte posé sur accentFonce. */
  textOnAccentFonce: string;
  accentSubtle: string;
  accentText: string;
  success: string;
  successSubtle: string;
  danger: string;
  border: string;
  bille: string;
};

export function themeDuMoment(moment: Moment): ThemeTokens {
  const t = TEINTES[moment];
  // Teinte légère : le texte atténué y reste ≥ 4,5:1 (vérifié par les tests).
  const active = melanger(t.carte, t.accentFonce, 0.22);
  return {
    moment,
    bgApp: FOND,
    bgCard: t.carte,
    bgCardActive: active,
    bgHighlight: active,
    textPrimary: TEXTE,
    textSecondary: TEXTE_SECONDAIRE,
    textMuted: TEXTE_ATTENUE,
    textOnAccent: FOND,
    accent: t.accent,
    accentFonce: t.accentFonce,
    textOnAccentFonce: TEXTE,
    accentSubtle: active,
    accentText: t.accent,
    success: "#4ADE80",
    successSubtle: melanger(t.carte, "#166534", 0.22),
    danger: "#F87171",
    border: t.bordure,
    bille: moment === "soir" || moment === "coucher" ? COULEURS_BILLE.soir : COULEURS_BILLE.jour,
  };
}

/** Les 6 thèmes, calculés une fois : un même objet par moment. */
export const THEMES = Object.fromEntries(
  (Object.keys(TEINTES) as Moment[]).map((m) => [m, themeDuMoment(m)]),
) as Record<Moment, ThemeTokens>;

// ─── Polices ────────────────────────────────────────────────────────────

/**
 * Une police chargée = une graisse : le composant Texte choisit la famille
 * selon fontWeight. Space Grotesk pour les titres, Manrope pour le texte.
 */
export const POLICES = {
  titre: {
    400: "SpaceGrotesk_400Regular",
    500: "SpaceGrotesk_500Medium",
    600: "SpaceGrotesk_600SemiBold",
    700: "SpaceGrotesk_700Bold",
  },
  texte: {
    400: "Manrope_400Regular",
    500: "Manrope_500Medium",
    600: "Manrope_600SemiBold",
    700: "Manrope_700Bold",
  },
} as const;

/** Famille à utiliser pour une graisse donnée (« 600 », "bold"…). */
export function policeDe(fontWeight: string | number | undefined, titre: boolean): string {
  const w = fontWeight === "bold" ? 700 : Number(fontWeight ?? 400) || 400;
  const g = w >= 700 ? 700 : w >= 600 ? 600 : w >= 500 ? 500 : 400;
  return (titre ? POLICES.titre : POLICES.texte)[g];
}

// ─── Espacements, rayons, tailles ───────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 20,
};

export const typography = {
  h1: 24,
  h2: 20,
  h3: 17,
  body: 15,
  bodySmall: 14,
  small: 13,
  tiny: 12,
};

/** Taille au-dessus de laquelle Texte prend la police des titres. */
export const TAILLE_TITRE = typography.h3;

// ─── Hook ───────────────────────────────────────────────────────────────

export const ContexteTheme = createContext<ThemeTokens>(
  THEMES[momentDeHeure(heureDecimale())],
);

/** Couleurs du moment, fournies par components/FournisseurTheme. */
export function useTheme(): ThemeTokens {
  return useContext(ContexteTheme);
}
