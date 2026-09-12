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
import { getPreferences } from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

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
    preferences,
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
  const t = useTheme();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const prefs = await getPreferences();
        if (!prefs.onboardingFait) {
          router.replace("/onboarding");
        }
      })();
    }, [router]),
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <Text style={[styles.titre, { color: t.textPrimary }]}>
        Mes routines du jour
      </Text>

      <TouchableOpacity
        style={styles.lien}
        onPress={() => router.push("/ancres")}
      >
        <Text style={[styles.lienTexte, { color: t.accent }]}>
          ⚓ Gérer mes moments repères
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.lien}
        onPress={() => router.push("/rappels")}
      >
        <Text style={[styles.lienTexte, { color: t.accent }]}>
          🔔 Rappels quotidiens
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.lien}
        onPress={() => router.push("/onboarding")}
      >
        <Text style={[styles.lienTexte, { color: t.accent }]}>
          🎯 Refaire l'onboarding
        </Text>
      </TouchableOpacity>

      {stats && preferences && preferences.gamification !== "aucune" && (
        <View style={[styles.bandeauStats, { backgroundColor: t.bgHighlight }]}>
          <Text style={[styles.statTexte, { color: t.accentText }]}>
            🔥 {stats.currentStreak} j
          </Text>
          {preferences.gamification === "complete" && (
            <>
              <Text style={[styles.statTexte, { color: t.accentText }]}>
                Niveau {stats.niveau}
              </Text>
              <Text style={[styles.statTexte, { color: t.accentText }]}>
                {stats.points} pts
              </Text>
            </>
          )}
        </View>
      )}

      <View style={styles.formulaire}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: t.border,
              color: t.textPrimary,
              backgroundColor: t.bgCard,
            },
          ]}
          placeholder="Nouvelle routine..."
          placeholderTextColor={t.textMuted}
          value={nouvelleRoutine}
          onChangeText={setNouvelleRoutine}
          onSubmitEditing={onAjouter}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.boutonAjouter, { backgroundColor: t.accent }]}
          onPress={onAjouter}
        >
          <Text style={[styles.texteBoutonAjouter, { color: t.textOnAccent }]}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      {ancresActives.length > 0 && nouvelleRoutine.length > 0 && (
        <View style={styles.selecteurAncres}>
          <Text style={[styles.selecteurTitre, { color: t.textSecondary }]}>
            Après quel moment ?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.pastilleAncre,
                {
                  backgroundColor:
                    ancreSelectionnee === null ? t.accent : t.bgCard,
                },
              ]}
              onPress={() => setAncreSelectionnee(null)}
            >
              <Text
                style={[
                  styles.pastilleTexte,
                  {
                    color:
                      ancreSelectionnee === null
                        ? t.textOnAccent
                        : t.textSecondary,
                  },
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
                  {
                    backgroundColor:
                      ancreSelectionnee === a.id ? t.accent : t.bgCard,
                  },
                ]}
                onPress={() => setAncreSelectionnee(a.id)}
              >
                <Text
                  style={[
                    styles.pastilleTexte,
                    {
                      color:
                        ancreSelectionnee === a.id
                          ? t.textOnAccent
                          : t.textSecondary,
                    },
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
            <Text style={[styles.sectionTitre, { color: t.accentText }]}>
              {LIBELLES_MOMENTS[moment]}
            </Text>
            {parMoment[moment].map((item) => (
              <Swipeable
                key={item.id}
                renderLeftActions={() => (
                  <View style={styles.actionsGauche}>
                    <TouchableOpacity
                      style={[
                        styles.actionBouton,
                        { backgroundColor: t.accentText },
                      ]}
                      onPress={() =>
                        setPopupAncre({ routineId: item.id, position: "avant" })
                      }
                    >
                      <Text
                        style={[styles.actionTexte, { color: t.textOnAccent }]}
                      >
                        Avant
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBouton,
                        { backgroundColor: t.accent },
                      ]}
                      onPress={() =>
                        setPopupAncre({ routineId: item.id, position: "apres" })
                      }
                    >
                      <Text
                        style={[styles.actionTexte, { color: t.textOnAccent }]}
                      >
                        Après
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={[
                      styles.boutonSupprimer,
                      { backgroundColor: t.danger },
                    ]}
                    onPress={() => supprimer(item.id)}
                  >
                    <Text
                      style={[styles.texteSupprimer, { color: t.textOnAccent }]}
                    >
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                )}
              >
                <TouchableOpacity
                  style={[
                    styles.item,
                    {
                      backgroundColor: item.faitAujourdhui
                        ? t.bgCardActive
                        : t.bgCard,
                    },
                  ]}
                  onPress={() => toggle(item.id, item.faitAujourdhui)}
                >
                  <Text style={[styles.texteItem, { color: t.textPrimary }]}>
                    {item.faitAujourdhui ? "✓ " : "○ "}
                    {item.ancre_nom ? (
                      <Text style={{ color: t.accentText, fontWeight: "600" }}>
                        {item.ancre_position === "avant" ? "Avant" : "Après"}{" "}
                        {item.ancre_nom.toLowerCase()} →{" "}
                      </Text>
                    ) : null}
                    {item.nom}
                  </Text>
                </TouchableOpacity>
              </Swipeable>
            ))}
            <TouchableOpacity
              style={styles.lien}
              onPress={() => router.push("/scene")}
            >
              <Text style={[styles.lienTexte, { color: t.accent }]}>
                🌳 Voir la scène (test)
              </Text>
            </TouchableOpacity>
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
          <Pressable
            style={[styles.modalContenu, { backgroundColor: t.bgApp }]}
          >
            <Text style={[styles.modalTitre, { color: t.textPrimary }]}>
              {popupAncre?.position === "avant"
                ? "Avant quel moment ?"
                : "Après quel moment ?"}
            </Text>
            {ancresActives.length === 0 ? (
              <Text style={[styles.modalVide, { color: t.textSecondary }]}>
                Aucun moment repère actif. Va dans "Gérer mes moments repères"
                pour en activer.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {ancresActives.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.modalItem, { borderBottomColor: t.border }]}
                    onPress={() => onChoisirAncrePourRoutine(a.id)}
                  >
                    <Text
                      style={[styles.modalItemTexte, { color: t.textPrimary }]}
                    >
                      {a.nom}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.modalAnnuler}
              onPress={() => setPopupAncre(null)}
            >
              <Text style={[styles.modalAnnulerTexte, { color: t.danger }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  lien: { paddingVertical: spacing.sm, marginBottom: spacing.md },
  lienTexte: { fontSize: typography.bodySmall, fontWeight: "500" },
  bandeauStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  formulaire: {
    flexDirection: "row",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  boutonAjouter: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  texteBoutonAjouter: { fontSize: 24, fontWeight: "400" },
  selecteurAncres: { marginBottom: spacing.lg },
  selecteurTitre: { fontSize: typography.small, marginBottom: spacing.sm },
  pastilleAncre: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  pastilleTexte: { fontSize: typography.small },
  section: { marginBottom: spacing.lg },
  sectionTitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  item: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  texteItem: { fontSize: typography.body },
  actionsGauche: { flexDirection: "row", marginBottom: spacing.sm },
  actionBouton: {
    justifyContent: "center",
    alignItems: "center",
    width: 65,
    borderRadius: radius.sm,
    marginRight: 4,
  },
  actionTexte: { fontWeight: "600", fontSize: typography.tiny },
  boutonSupprimer: {
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  texteSupprimer: { fontWeight: "600", fontSize: typography.small },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalContenu: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
  },
  modalTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  modalVide: {
    fontSize: typography.bodySmall,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalItemTexte: { fontSize: typography.body },
  modalAnnuler: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  modalAnnulerTexte: { fontSize: typography.body, fontWeight: "500" },
});
