import { useColorScheme } from "react-native";

// Palette de base — les valeurs "brutes" (jamais utilisées directement dans les composants)
const palette = {
  // Terracotta (accent principal, actions, points d'attention)
  terracotta50: "#fbeee6",
  terracotta200: "#e8b89b",
  terracotta500: "#c07050",
  terracotta700: "#8a4a30",

  // Vert olive (succès, complétion, état sain)
  olive50: "#f0f2e6",
  olive200: "#c7cd9c",
  olive500: "#7a8a4a",
  olive700: "#556130",

  // Crème (fond neutre, cartes)
  cream50: "#fbf7f0",
  cream100: "#f4ede0",
  cream200: "#e8dcc4",

  // Neutres (texte, séparateurs)
  ink900: "#3a2f22",
  ink700: "#5a4a38",
  ink500: "#8a7660",
  ink300: "#c4b8a4",

  // Alertes / suppression (utilisé avec parcimonie)
  clay500: "#c25850",
  clay700: "#8a3d38",

  // Fonds sombres (mode sombre)
  dark900: "#1f1a14",
  dark800: "#2a2318",
  dark700: "#3a3122",
  dark500: "#5a4d3a",
};

// Tokens sémantiques — c'est ce qu'utilisent les composants
type ThemeTokens = {
  // Fonds
  bgApp: string; // fond de l'écran
  bgCard: string; // fond des cartes/items neutres
  bgCardActive: string; // carte "complétée" (verte)
  bgHighlight: string; // bandeau stats

  // Texte
  textPrimary: string; // texte principal
  textSecondary: string; // texte secondaire, descriptions
  textMuted: string; // texte peu contrasté (placeholders, hints)
  textOnAccent: string; // texte sur fond accent (blanc en général)

  // Accents
  accent: string; // couleur principale (boutons, liens)
  accentSubtle: string; // version pale de l'accent (pastilles inactives)
  accentText: string; // texte "accent" (bandeau stats)

  // Sémantiques
  success: string; // vert olive pour complétion
  successSubtle: string;
  danger: string; // rouge pour suppression
  border: string; // séparateurs, contours d'input
};

const themeLight: ThemeTokens = {
  bgApp: palette.cream50,
  bgCard: palette.cream100,
  bgCardActive: palette.olive50,
  bgHighlight: palette.terracotta50,

  textPrimary: palette.ink900,
  textSecondary: palette.ink700,
  textMuted: palette.ink500,
  textOnAccent: "#ffffff",

  accent: palette.terracotta500,
  accentSubtle: palette.terracotta50,
  accentText: palette.terracotta700,

  success: palette.olive500,
  successSubtle: palette.olive50,
  danger: palette.clay500,
  border: palette.cream200,
};

const themeDark: ThemeTokens = {
  bgApp: palette.dark900,
  bgCard: palette.dark800,
  bgCardActive: palette.dark700,
  bgHighlight: palette.dark800,

  textPrimary: palette.cream50,
  textSecondary: palette.cream200,
  textMuted: palette.ink300,
  textOnAccent: "#ffffff",

  accent: palette.terracotta200,
  accentSubtle: palette.dark700,
  accentText: palette.terracotta200,

  success: palette.olive200,
  successSubtle: palette.dark700,
  danger: palette.clay500,
  border: palette.dark500,
};

// Espacements
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

// Rayons de bordure
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 20,
};

// Typographie (tailles)
export const typography = {
  h1: 24,
  h2: 20,
  h3: 17,
  body: 15,
  bodySmall: 14,
  small: 13,
  tiny: 12,
};

// Hook principal — retourne les bons tokens selon le thème système
export function useTheme(): ThemeTokens {
  const scheme = useColorScheme();
  return scheme === "dark" ? themeDark : themeLight;
}
