import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  addRoutine,
  deleteRoutine,
  getRoutines,
  Routine,
  toggleRoutine,
} from "../lib/db";

export default function Index() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [nouvelleRoutine, setNouvelleRoutine] = useState("");

  const charger = useCallback(async () => {
    const data = await getRoutines();
    setRoutines(data);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const onToggle = async (id: number, faitActuel: number) => {
    const nouveauStatut = faitActuel ? 0 : 1;
    await toggleRoutine(id, nouveauStatut);
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, fait: nouveauStatut } : r)),
    );
  };

  const onAjouter = async () => {
    const nomNettoye = nouvelleRoutine.trim();
    if (nomNettoye.length === 0) return;
    await addRoutine(nomNettoye);
    setNouvelleRoutine("");
    await charger();
  };

  const onSupprimer = async (id: number) => {
    await deleteRoutine(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titre}>Mes routines du jour</Text>

      <View style={styles.formulaire}>
        <TextInput
          style={styles.input}
          placeholder="Nouvelle routine..."
          value={nouvelleRoutine}
          onChangeText={setNouvelleRoutine}
          onSubmitEditing={onAjouter}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.boutonAjouter} onPress={onAjouter}>
          <Text style={styles.texteBoutonAjouter}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => (
              <TouchableOpacity
                style={styles.boutonSupprimer}
                onPress={() => onSupprimer(item.id)}
              >
                <Text style={styles.texteSupprimer}>Supprimer</Text>
              </TouchableOpacity>
            )}
          >
            <TouchableOpacity
              style={[styles.item, item.fait ? styles.itemFait : null]}
              onPress={() => onToggle(item.id, item.fait)}
            >
              <Text style={styles.texteItem}>
                {item.fait ? "✓ " : "○ "}
                {item.nom}
              </Text>
            </TouchableOpacity>
          </Swipeable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  titre: { fontSize: 22, fontWeight: "600", marginBottom: 16 },
  formulaire: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  boutonAjouter: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#4a90d9",
    justifyContent: "center",
    alignItems: "center",
  },
  texteBoutonAjouter: { color: "#fff", fontSize: 24, fontWeight: "400" },
  item: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginBottom: 10,
  },
  itemFait: { backgroundColor: "#d4f4dd" },
  texteItem: { fontSize: 16 },
  boutonSupprimer: {
    backgroundColor: "#e05c5c",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 10,
    marginBottom: 10,
  },
  texteSupprimer: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
