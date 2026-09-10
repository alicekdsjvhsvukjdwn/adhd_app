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
  getRoutinesAvecStatutDuJour,
  getStats,
  RoutineAvecStatut,
  Stats,
  toggleCompletionAujourdhui,
} from "../lib/db";

export default function Index() {
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [nouvelleRoutine, setNouvelleRoutine] = useState("");

  const charger = useCallback(async () => {
    const data = await getRoutinesAvecStatutDuJour();
    setRoutines(data);
    const statsData = await getStats();
    setStats(statsData);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const onToggle = async (id: number, faitActuel: boolean) => {
    await toggleCompletionAujourdhui(id, faitActuel);
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, faitAujourdhui: !faitActuel } : r,
      ),
    );
    const statsData = await getStats();
    setStats(statsData);
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

      {stats && (
        <View style={styles.bandeauStats}>
          <Text style={styles.statTexte}>🔥 {stats.currentStreak} j</Text>
          <Text style={styles.statTexte}>Niveau {stats.niveau}</Text>
          <Text style={styles.statTexte}>{stats.points} pts</Text>
        </View>
      )}

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
              style={[
                styles.item,
                item.faitAujourdhui ? styles.itemFait : null,
              ]}
              onPress={() => onToggle(item.id, item.faitAujourdhui)}
            >
              <Text style={styles.texteItem}>
                {item.faitAujourdhui ? "✓ " : "○ "}
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
  titre: { fontSize: 22, fontWeight: "600", marginBottom: 12 },
  bandeauStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fef3e0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statTexte: { fontSize: 14, fontWeight: "600", color: "#8a5a1a" },
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
