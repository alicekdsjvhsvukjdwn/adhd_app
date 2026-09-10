import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRoutines } from "../hooks/useRoutines";

const LIBELLES_MOMENTS: Record<string, string> = {
  matin: "Matin",
  midi: "Midi",
  apres_midi: "Après-midi",
  soir: "Soir",
  sans_ancre: "Sans moment repère",
};

export default function Index() {
  const {
    routines,
    ancresActives,
    stats,
    toggle,
    ajouter,
    supprimer,
    changerAncre,
    recharger,
  } = useRoutines();
  const [nouvelleRoutine, setNouvelleRoutine] = useState("");
  const [ancreSelectionnee, setAncreSelectionnee] = useState<number | null>(
    null,
  );
  const [popupAncre, setPopupAncre] = useState<{
    routineId: number;
    position: "avant" | "apres";
  } | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger]),
  );

  const onAjouter = async () => {
    if (nouvelleRoutine.trim().length === 0) return;
    await ajouter(nouvelleRoutine, ancreSelectionnee);
    setNouvelleRoutine("");
    setAncreSelectionnee(null);
  };

  const parMoment = routines.reduce<Record<string, typeof routines>>(
    (acc, r) => {
      const cle = r.ancre_moment || "sans_ancre";
      if (!acc[cle]) acc[cle] = [];
      acc[cle].push(r);
      return acc;
    },
    {},
  );

  const ordreMoments = ["matin", "midi", "apres_midi", "soir", "sans_ancre"];
  const momentsAvecRoutines = ordreMoments.filter(
    (m) => parMoment[m]?.length > 0,
  );

  const onChoisirAncrePourRoutine = async (ancreId: number) => {
    if (!popupAncre) return;
    await changerAncre(popupAncre.routineId, ancreId, popupAncre.position);
    setPopupAncre(null);
  };

  console.log("DEBUG:", {
    ancresActives: ancresActives.length,
    nouvelleRoutine,
  });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titre}>Mes routines du jour</Text>

      <TouchableOpacity
        style={styles.lienAncres}
        onPress={() => router.push("/ancres")}
      >
        <Text style={styles.lienAncresTexte}>⚓ Gérer mes moments repères</Text>
      </TouchableOpacity>

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

      {ancresActives.length > 0 && nouvelleRoutine.length > 0 && (
        <View style={styles.selecteurAncres}>
          <Text style={styles.selecteurTitre}>Après quel moment ?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.pastilleAncre,
                ancreSelectionnee === null ? styles.pastilleActive : null,
              ]}
              onPress={() => setAncreSelectionnee(null)}
            >
              <Text
                style={[
                  styles.pastilleTexte,
                  ancreSelectionnee === null ? styles.pastilleTexteActif : null,
                ]}
              >
                Aucun
              </Text>
            </TouchableOpacity>
            {ancresActives.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.pastilleAncre,
                  ancreSelectionnee === a.id ? styles.pastilleActive : null,
                ]}
                onPress={() => setAncreSelectionnee(a.id)}
              >
                <Text
                  style={[
                    styles.pastilleTexte,
                    ancreSelectionnee === a.id
                      ? styles.pastilleTexteActif
                      : null,
                  ]}
                >
                  {a.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={momentsAvecRoutines}
        keyExtractor={(m) => m}
        renderItem={({ item: moment }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>{LIBELLES_MOMENTS[moment]}</Text>
            {parMoment[moment].map((item) => (
              <Swipeable
                key={item.id}
                renderLeftActions={() => (
                  <View style={styles.actionsGauche}>
                    <TouchableOpacity
                      style={[
                        styles.actionBouton,
                        { backgroundColor: "#8a5a1a" },
                      ]}
                      onPress={() =>
                        setPopupAncre({ routineId: item.id, position: "avant" })
                      }
                    >
                      <Text style={styles.actionTexte}>Avant</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBouton,
                        { backgroundColor: "#4a90d9" },
                      ]}
                      onPress={() =>
                        setPopupAncre({ routineId: item.id, position: "apres" })
                      }
                    >
                      <Text style={styles.actionTexte}>Après</Text>
                    </TouchableOpacity>
                  </View>
                )}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.boutonSupprimer}
                    onPress={() => supprimer(item.id)}
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
                  onPress={() => toggle(item.id, item.faitAujourdhui)}
                >
                  <Text style={styles.texteItem}>
                    {item.faitAujourdhui ? "✓ " : "○ "}
                    {item.ancre_nom ? (
                      <Text style={styles.ancreInline}>
                        {item.ancre_position === "avant" ? "Avant" : "Après"}{" "}
                        {item.ancre_nom.toLowerCase()} →{" "}
                      </Text>
                    ) : null}
                    {item.nom}
                  </Text>
                </TouchableOpacity>
              </Swipeable>
            ))}
          </View>
        )}
      />

      <Modal
        visible={popupAncre !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupAncre(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPopupAncre(null)}
        >
          <Pressable style={styles.modalContenu}>
            <Text style={styles.modalTitre}>
              {popupAncre?.position === "avant"
                ? "Avant quel moment ?"
                : "Après quel moment ?"}
            </Text>
            {ancresActives.length === 0 ? (
              <Text style={styles.modalVide}>
                Aucun moment repère actif. Va dans "Gérer mes moments repères"
                pour en activer.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {ancresActives.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.modalItem}
                    onPress={() => onChoisirAncrePourRoutine(a.id)}
                  >
                    <Text style={styles.modalItemTexte}>{a.nom}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.modalAnnuler}
              onPress={() => setPopupAncre(null)}
            >
              <Text style={styles.modalAnnulerTexte}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  titre: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  lienAncres: { paddingVertical: 8, marginBottom: 12 },
  lienAncresTexte: { fontSize: 14, color: "#4a90d9", fontWeight: "500" },
  bandeauStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fef3e0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statTexte: { fontSize: 14, fontWeight: "600", color: "#8a5a1a" },
  formulaire: { flexDirection: "row", marginBottom: 12, gap: 8 },
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
  selecteurAncres: { marginBottom: 16 },
  selecteurTitre: { fontSize: 13, color: "#666", marginBottom: 8 },
  pastilleAncre: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  pastilleActive: { backgroundColor: "#4a90d9" },
  pastilleTexte: { fontSize: 13, color: "#555" },
  pastilleTexteActif: { color: "#fff", fontWeight: "600" },
  section: { marginBottom: 16 },
  sectionTitre: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a5a1a",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  item: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginBottom: 8,
  },
  itemFait: { backgroundColor: "#d4f4dd" },
  texteItem: { fontSize: 15 },
  ancreInline: { color: "#8a5a1a", fontWeight: "600" },
  actionsGauche: { flexDirection: "row", marginBottom: 8 },
  actionBouton: {
    justifyContent: "center",
    alignItems: "center",
    width: 65,
    borderRadius: 8,
    marginRight: 4,
  },
  actionTexte: { color: "#fff", fontWeight: "600", fontSize: 12 },
  boutonSupprimer: {
    backgroundColor: "#e05c5c",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 10,
    marginBottom: 8,
    marginLeft: 4,
  },
  texteSupprimer: { color: "#fff", fontWeight: "600", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalContenu: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitre: { fontSize: 17, fontWeight: "600", marginBottom: 16 },
  modalVide: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 12 },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalItemTexte: { fontSize: 15 },
  modalAnnuler: {
    marginTop: 16,
    padding: 12,
    alignItems: "center",
  },
  modalAnnulerTexte: { fontSize: 15, color: "#e05c5c", fontWeight: "500" },
});
