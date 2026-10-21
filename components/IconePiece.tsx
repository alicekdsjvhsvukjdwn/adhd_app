import { Bath, BedDouble, CookingPot, DoorOpen, House, Shirt, ShoppingBasket, Sofa } from "lucide-react-native";

const ICONES = {
  cuisine: CookingPot,
  bain: Bath,
  chambre: BedDouble,
  salon: Sofa,
  entree: DoorOpen,
  linge: Shirt,
  courses: ShoppingBasket,
  maison: House,
};

/** Icône au trait d'une pièce ; une clé inconnue (pièce ajoutée à la main) = maison. */
export function IconePiece({ icone, couleur, taille }: { icone: string; couleur: string; taille: number }) {
  const Icone = ICONES[icone as keyof typeof ICONES] ?? House;
  return <Icone color={couleur} size={taille} strokeWidth={1.8} />;
}
