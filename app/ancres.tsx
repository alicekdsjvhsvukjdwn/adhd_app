import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ancre, getAncres, MomentJournee, toggleAncre } from "../lib/db";

const LIBELLES_MOMENTS: Record<MomentJournee, string> = {
  matin: "Matin",
  midi: "Midi",
  apres_midi: "Après-midi",
  soir: "Soir",
};

export default function AncresScreen() {
  const [ancres, setAncres] = useState<Ancre[]>([]);
  const router = useRouter();

  const charger = useCallback(async () => {
    const data = await getAncres();
    setAncres(data);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const onToggle = async (id: number, actifActuel: number) => {
    const nouveau = actifActuel ? 0 : 1;
    await toggleAncre(id, nouveau);
    setAncres((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: nouveau } : a)),
    );
  };

  // Groupement par moment de la journée
  const parMoment = ancres.reduce<Record<string, Ancre[]>>((acc, ancre) => {
    if (!acc[ancre.moment]) acc[ancre.moment] = [];
    acc[ancre.moment].push(ancre);
    return acc;
  }, {});

  const moments: MomentJournee[] = ["matin", "midi", "apres_midi", "soir"];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.retour}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>Mes moments repères</Text>
      </View>

      <Text style={styles.intro}>
        Coche les moments de ta journée qui sont déjà bien ancrés dans tes
        habitudes. Tu pourras ensuite y accrocher tes routines pour que ton
        cerveau les associe naturellement.
      </Text>

      <FlatList
        data={moments}
        keyExtractor={(m) => m}
        renderItem={({ item: moment }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>{LIBELLES_MOMENTS[moment]}</Text>
            {(parMoment[moment] || []).map((ancre) => (
              <TouchableOpacity
                key={ancre.id}
                style={[styles.item, ancre.active ? styles.itemActif : null]}
                onPress={() => onToggle(ancre.id, ancre.active)}
              >
                <Text style={styles.texteItem}>
                  {ancre.active ? "✓ " : "○ "}
                  {ancre.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  retour: { fontSize: 15, color: "#4a90d9", marginBottom: 8 },
  titre: { fontSize: 22, fontWeight: "600" },
  intro: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 20,
  },
  section: { marginBottom: 20 },
  sectionTitre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8a5a1a",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  item: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginBottom: 8,
  },
  itemActif: { backgroundColor: "#d4e8f4" },
  texteItem: { fontSize: 15 },
});
