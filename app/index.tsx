import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { getRoutines, Routine, toggleRoutine } from "../lib/db";

export default function Index() {
  const [routines, setRoutines] = useState<Routine[]>([]);

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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titre}>Mes routines du jour</Text>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.fait ? styles.itemFait : null]}
            onPress={() => onToggle(item.id, item.fait)}
          >
            <Text style={styles.texteItem}>
              {item.fait ? "✓ " : "○ "}
              {item.nom}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  titre: { fontSize: 22, fontWeight: "600", marginBottom: 20 },
  item: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginBottom: 10,
  },
  itemFait: { backgroundColor: "#d4f4dd" },
  texteItem: { fontSize: 16 },
});
