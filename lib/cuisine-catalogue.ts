/**
 * Catalogue d'aliments vegan courants : nom, catégorie, emplacement par défaut et rayon des courses.
 * Écrit en lignes « catégorie | emplacement | rayon : aliment, aliment… » pour rester lisible.
 */

export type Emplacement = "frigo" | "congelateur" | "placard" | "epices";
export type Categorie = "legumes" | "fruits" | "legumineuses" | "cereales" | "proteines" | "laits" | "noix" | "conserves" | "condiments" | "surgeles" | "pain" | "epices";
export type Rayon = "fruits_legumes" | "vrac" | "frais" | "epicerie" | "surgeles" | "maison" | "autre";

export const EMPLACEMENTS: { cle: Emplacement; nom: string }[] = [
  { cle: "frigo", nom: "Frigo" },
  { cle: "congelateur", nom: "Congélateur" },
  { cle: "placard", nom: "Placard" },
  { cle: "epices", nom: "Épices" },
];

export const CATEGORIES: { cle: Categorie; nom: string }[] = [
  { cle: "legumes", nom: "Légumes" },
  { cle: "fruits", nom: "Fruits" },
  { cle: "legumineuses", nom: "Légumineuses" },
  { cle: "cereales", nom: "Céréales & féculents" },
  { cle: "proteines", nom: "Tofu, tempeh, seitan" },
  { cle: "laits", nom: "Laits & yaourts végétaux" },
  { cle: "noix", nom: "Noix & graines" },
  { cle: "conserves", nom: "Conserves" },
  { cle: "condiments", nom: "Condiments & sauces" },
  { cle: "surgeles", nom: "Surgelés" },
  { cle: "pain", nom: "Pain & petit-déj" },
  { cle: "epices", nom: "Épices & aromates" },
];

export const RAYONS: { cle: Rayon; nom: string }[] = [
  { cle: "fruits_legumes", nom: "Fruits & légumes" },
  { cle: "vrac", nom: "Vrac & légumineuses" },
  { cle: "frais", nom: "Frais végétal" },
  { cle: "epicerie", nom: "Épicerie" },
  { cle: "surgeles", nom: "Surgelés" },
  { cle: "maison", nom: "Hygiène & maison" },
  { cle: "autre", nom: "Autre" },
];

export type AlimentCatalogue = { nom: string; categorie: Categorie; emplacement: Emplacement; rayon: Rayon };

const LIGNES = `
legumes|frigo|fruits_legumes: Carottes, Courgettes, Épinards, Poivrons, Brocoli, Chou-fleur, Chou kale, Salade, Concombre, Champignons, Aubergine, Poireaux, Betterave, Céleri, Fenouil, Radis, Chou rouge, Haricots verts, Avocat, Gingembre, Coriandre fraîche, Persil, Basilic, Menthe, Ciboulette, Citron, Citron vert
legumes|placard|fruits_legumes: Oignons, Ail, Échalotes, Pommes de terre, Patates douces, Courge butternut, Potimarron, Tomates
fruits|placard|fruits_legumes: Bananes, Pommes, Oranges, Clémentines, Poires, Kiwis, Ananas, Mangue, Raisins
fruits|frigo|fruits_legumes: Fraises, Framboises, Myrtilles, Pastèque, Melon
fruits|placard|vrac: Dattes, Raisins secs, Abricots secs, Pruneaux, Figues sèches
legumineuses|placard|vrac: Lentilles corail, Lentilles vertes, Lentilles brunes, Pois chiches secs, Haricots rouges secs, Haricots noirs secs, Haricots blancs secs, Pois cassés, Fèves, Edamame
cereales|placard|vrac: Riz basmati, Riz complet, Quinoa, Boulgour, Semoule, Flocons d'avoine, Millet, Sarrasin, Polenta, Couscous, Orge perlé
cereales|placard|epicerie: Pâtes, Spaghetti, Pâtes complètes, Nouilles de riz, Nouilles soba, Lasagnes, Farine de blé, Farine de pois chiche, Maïzena, Galettes de riz, Tortillas, Wraps
proteines|frigo|frais: Tofu ferme, Tofu soyeux, Tofu fumé, Tempeh, Seitan, Falafels, Steak végétal, Saucisses végétales
laits|frigo|frais: Lait d'avoine, Lait de soja, Lait d'amande, Yaourt de soja, Yaourt de coco, Crème de soja, Crème d'avoine, Fromage végétal, Margarine végétale, Houmous
laits|placard|epicerie: Lait de coco, Crème de coco
noix|placard|vrac: Amandes, Noix, Noix de cajou, Noisettes, Pistaches, Cacahuètes, Graines de courge, Graines de tournesol, Graines de sésame, Graines de chia, Graines de lin, Noix de coco râpée, Levure maltée
noix|placard|epicerie: Purée d'amande, Beurre de cacahuète, Tahini
conserves|placard|epicerie: Tomates concassées, Coulis de tomate, Concentré de tomate, Pois chiches (boîte), Haricots rouges (boîte), Haricots noirs (boîte), Lentilles (boîte), Maïs, Champignons en conserve, Cœurs de palmier, Olives, Câpres, Cornichons, Artichauts, Haricots blancs (boîte)
condiments|placard|epicerie: Huile d'olive, Huile de tournesol, Huile de sésame, Vinaigre balsamique, Vinaigre de cidre, Sauce soja, Tamari, Moutarde, Ketchup, Sirop d'érable, Sirop d'agave, Sucre, Sucre de coco, Sel, Poivre, Bouillon cube, Pesto vegan, Sauce tomate, Harissa, Pâte de curry, Sriracha, Miso, Levure chimique, Cacao en poudre, Chocolat noir
epices|epices|epicerie: Cumin, Curcuma, Paprika, Paprika fumé, Coriandre moulue, Cannelle, Piment de Cayenne, Piment d'Espelette, Garam masala, Curry en poudre, Herbes de Provence, Thym, Origan, Laurier, Muscade, Gingembre moulu, Ail en poudre, Oignon en poudre, Fenugrec, Graines de moutarde, Cardamome, Sumac, Ras el hanout, Baies roses
surgeles|congelateur|surgeles: Épinards surgelés, Petits pois surgelés, Légumes pour wok, Poêlée de légumes, Brocoli surgelé, Maïs surgelé, Fruits rouges surgelés, Mangue surgelée, Edamame surgelés, Frites de patate douce, Pain surgelé, Plats préparés maison
pain|placard|epicerie: Pain complet, Pain de mie, Céréales, Muesli, Granola, Confiture, Pâte à tartiner, Biscottes, Thé, Café, Tisane
pain|frigo|frais: Pain pita, Galettes
`;

function lire(): AlimentCatalogue[] {
  const sortie: AlimentCatalogue[] = [];
  for (const l of LIGNES.split("\n").map((x) => x.trim()).filter(Boolean)) {
    const [tete, noms] = l.split(": ");
    const [categorie, emplacement, rayon] = tete.split("|") as [Categorie, Emplacement, Rayon];
    for (const nom of noms.split(", ")) sortie.push({ nom: nom.trim(), categorie, emplacement, rayon });
  }
  return sortie;
}

export const CATALOGUE: AlimentCatalogue[] = lire();
