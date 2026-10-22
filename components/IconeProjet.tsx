import { Brush, Camera, Cpu, Gem, Hammer, Leaf, Lightbulb, Music, Palette, PenTool, Scissors, Sparkles } from "lucide-react-native";
import type { ComponentType } from "react";
import { iconeValide } from "../lib/projets-regles";

const ICONES: Record<string, ComponentType<{ color?: string; size?: number }>> = {
  cpu: Cpu,
  palette: Palette,
  scissors: Scissors,
  music: Music,
  sparkles: Sparkles,
  hammer: Hammer,
  brush: Brush,
  camera: Camera,
  pen: PenTool,
  gem: Gem,
  lightbulb: Lightbulb,
  leaf: Leaf,
};

/** Icône au trait d'un type de projet (clé de CLES_ICONES_TYPES). */
export function IconeProjet({ nom, couleur, taille = 24 }: { nom: string; couleur: string; taille?: number }) {
  const Icone = ICONES[iconeValide(nom)];
  return <Icone color={couleur} size={taille} />;
}
