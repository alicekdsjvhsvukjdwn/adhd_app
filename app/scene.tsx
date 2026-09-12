import { useRouter } from "expo-router";
import {
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../lib/theme";

// Taille d'une tuile à l'écran (les tuiles sont 16x16 en pixel art,
// on les affiche 4x plus grand pour la lisibilité)
const TILE_SIZE = 32;

// Petite scène simple : 8 colonnes x 6 lignes
// Chaque nombre correspond à un fichier tile_XXXX.png dans assets/pixel/town/
// Regarde le Preview.png pour comprendre quelle tuile a quel numéro
const SCENE: number[][] = [
  [0, 0, 1, 0, 0, 0, 5, 5], // ligne 1 (haut)
  [0, 5, 0, 0, 1, 0, 0, 0],
  [4, 4, 4, 4, 4, 4, 4, 4], // chemin
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 5, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 1, 0, 0], // ligne 6 (bas)
];

// Map des tuiles utilisées vers leur require
// (on doit les déclarer statiquement, React Native n'accepte pas les chemins dynamiques)
const TILES: Record<number, any> = {
  0: require("../assets/pixel/town/tile_0000.png"),
  1: require("../assets/pixel/town/tile_0001.png"),
  4: require("../assets/pixel/town/tile_0004.png"),
  5: require("../assets/pixel/town/tile_0005.png"),
};

export default function SceneScreen() {
  const router = useRouter();
  const t = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <TouchableOpacity style={styles.retour} onPress={() => router.back()}>
        <Text style={styles.retourTexte}>← Retour</Text>
      </TouchableOpacity>

      <Text style={[styles.titre, { color: t.textPrimary }]}>
        Scène de test
      </Text>

      <View style={styles.scene}>
        {SCENE.map((ligne, y) => (
          <View key={y} style={styles.ligne}>
            {ligne.map((tuileId, x) => (
              <Image key={x} source={TILES[tuileId]} style={styles.tuile} />
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  retour: { paddingVertical: 8, marginBottom: 8 },
  retourTexte: { fontSize: 15, color: "#c07050" },
  titre: { fontSize: 22, fontWeight: "600", marginBottom: 20 },
  scene: {
    alignSelf: "center",
    padding: 0,
  },
  ligne: { flexDirection: "row" },
  tuile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: "transparent",
  },
});
