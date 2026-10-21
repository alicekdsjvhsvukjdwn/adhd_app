import {
  Bath,
  Bed,
  BookOpen,
  Building2,
  CakeSlice,
  Clapperboard,
  Coffee,
  Disc3,
  Gamepad2,
  Gift,
  Headphones,
  IceCreamCone,
  KeyboardMusic,
  Landmark,
  Map,
  Moon,
  Mountain,
  Music,
  Palette,
  Plane,
  Sandwich,
  Ship,
  Star,
  Sunset,
  Ticket,
  Tv,
  Utensils,
  Waves,
} from "lucide-react-native";
import { Texte } from "./Texte";
import type { IconeRecompense as Cle } from "../lib/recompenses-regles";

const ICONES: Record<Cle, typeof Coffee> = {
  cafe: Coffee,
  ecran: Tv,
  gateau: CakeSlice,
  ticket: Ticket,
  musique: Music,
  montagne: Mountain,
  casque: Headphones,
  vinyle: Disc3,
  clavier: KeyboardMusic,
  lit: Bed,
  livre: BookOpen,
  cadeau: Gift,
  etoile: Star,
  avion: Plane,
  manette: Gamepad2,
  vague: Waves,
  soleil: Sunset,
  glace: IceCreamCone,
  couverts: Utensils,
  lune: Moon,
  musee: Landmark,
  carte: Map,
  bateau: Ship,
  film: Clapperboard,
  bain: Bath,
  sandwich: Sandwich,
  palette: Palette,
  ville: Building2,
};

/** Icône au trait d'une récompense ; un ancien emoji s'affiche tel quel, rien = cadeau. */
export function IconeRecompense({
  icone,
  couleur,
  taille,
}: {
  icone: string | null;
  couleur: string;
  taille: number;
}) {
  const Icone = ICONES[(icone ?? "cadeau") as Cle];
  if (Icone) return <Icone color={couleur} size={taille} strokeWidth={1.8} />;
  return <Texte style={{ fontSize: taille * 0.9, lineHeight: taille * 1.1 }}>{icone}</Texte>;
}
