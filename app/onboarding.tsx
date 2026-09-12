import { useRouter } from "expo-router";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { setProfil, setProfilPersonnalise, skipOnboarding } from "../lib/db";

type ProfilCard = {
  id: "semeur" | "sprinter" | "apaise";
  emoji: string;
  nom: string;
  description: string;
  couleur: string;
};

const PROFILS: ProfilCard[] = [
  {
    id: "semeur",
    emoji: "🌱",
    nom: "Le semeur",
    description:
      "J'ai plein d'idées et d'envies, mais démarrer est difficile. Une fois lancé·e, ça va — c'est le premier pas qui coince.",
    couleur: "#d4e8d4",
  },
  {
    id: "sprinter",
    emoji: "⚡",
    nom: "Le sprinter",
    description:
      "Je fonce avec énergie, mais j'oublie en cours ou je saute d'une chose à l'autre. J'ai besoin d'un cadre pour tenir dans la durée.",
    couleur: "#fef3d4",
  },
  {
    id: "apaise",
    emoji: "🌊",
    nom: "L'apaisé",
    description:
      "Ce qui me pèse le plus, c'est la surcharge et la pression. J'ai besoin d'une aide douce, sans que l'appli en rajoute.",
    couleur: "#d4e8f4",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  const onChoisirProfil = async (id: "semeur" | "sprinter" | "apaise") => {
    await setProfil(id);
    router.replace("/");
  };

  const onPersonnaliser = async () => {
    await setProfilPersonnalise();
    router.replace("/");
    // Plus tard, on renverra vers un écran de réglages fins
  };

  const onSkip = async () => {
    await skipOnboarding();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titre}>Comment ça marche pour toi ?</Text>
        <Text style={styles.intro}>
          Choisis le profil qui te ressemble le plus. L'appli va préconfigurer
          ses réglages en fonction. Rien n'est figé — tu pourras tout ajuster
          après.
        </Text>

        {PROFILS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.carte, { backgroundColor: p.couleur }]}
            onPress={() => onChoisirProfil(p.id)}
            activeOpacity={0.7}
          >
            <View style={styles.carteHeader}>
              <Text style={styles.carteEmoji}>{p.emoji}</Text>
              <Text style={styles.carteNom}>{p.nom}</Text>
            </View>
            <Text style={styles.carteDescription}>{p.description}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.carteNeutre}
          onPress={onPersonnaliser}
          activeOpacity={0.7}
        >
          <Text style={styles.carteNomNeutre}>
            ⚙️ Je préfère configurer moi-même
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipTexte}>Plus tard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  titre: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  intro: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 24,
  },
  carte: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
  },
  carteHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  carteEmoji: { fontSize: 28, marginRight: 10 },
  carteNom: { fontSize: 18, fontWeight: "600" },
  carteDescription: {
    fontSize: 14,
    color: "#3d3d3a",
    lineHeight: 20,
  },
  carteNeutre: {
    borderRadius: 14,
    padding: 18,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  carteNomNeutre: { fontSize: 15, fontWeight: "500", color: "#555" },
  skip: {
    padding: 12,
    alignItems: "center",
  },
  skipTexte: { fontSize: 14, color: "#999" },
});
