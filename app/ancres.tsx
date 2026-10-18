import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addAncre, getAncres, toggleAncre, type Ancre, type MomentJournee } from "../lib/db";
import { LIBELLES_MOMENT } from "../lib/moments";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const MOMENTS: MomentJournee[] = ["matin", "midi", "apres_midi", "soir"];

export default function AncresScreen() {
  const router = useRouter();
  const t = useTheme();
  const [ancres, setAncres] = useState<Ancre[]>([]);
  const [nom, setNom] = useState("");
  const [moment, setMoment] = useState<MomentJournee>("matin");

  const charger = useCallback(async () => {
    setAncres(await getAncres());
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

  /** Un moment repère ajouté à la main est actif tout de suite. */
  const onAjouter = async () => {
    const n = nom.trim();
    if (!n) return;
    await addAncre(n, moment);
    setNom("");
    Keyboard.dismiss();
    await charger();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.retour, { color: t.accentText }]}>← Retour</Text>
      </TouchableOpacity>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Mes moments repères</Text>

      <Text style={[styles.intro, { color: t.textSecondary }]}>
        Coche les moments de ta journée qui sont déjà bien ancrés dans tes
        habitudes. Tu pourras ensuite y accrocher tes routines pour que ton
        cerveau les associe naturellement.
      </Text>

      {MOMENTS.map((m) => {
        const dans = ancres.filter((a) => a.moment === m);
        if (dans.length === 0) return null;
        return (
          <View key={m} style={styles.section}>
            <Text style={[styles.sectionTitre, { color: t.accentText }]}>
              {LIBELLES_MOMENT[m]}
            </Text>
            {dans.map((ancre) => (
              <TouchableOpacity
                key={ancre.id}
                style={[
                  styles.item,
                  { backgroundColor: ancre.active ? t.bgCardActive : t.bgCard },
                ]}
                onPress={() => onToggle(ancre.id, ancre.active)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ancre.active === 1 }}
              >
                <Text style={[styles.texteItem, { color: t.textPrimary }]}>
                  {ancre.active ? "✓ " : "○ "}
                  {ancre.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}

      {/* Ajouter un moment repère */}
      <Text style={[styles.sectionTitre, { color: t.accentText }]}>Ajouter</Text>
      <TextInput
        style={[
          styles.champ,
          { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary },
        ]}
        placeholder="Ex : la fin du travail"
        placeholderTextColor={t.textMuted}
        value={nom}
        onChangeText={setNom}
        onSubmitEditing={onAjouter}
        returnKeyType="done"
      />
      <View style={styles.puces}>
        {MOMENTS.map((m) => {
          const actif = m === moment;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setMoment(m)}
              style={[
                styles.puce,
                {
                  backgroundColor: actif ? t.accent : t.bgCard,
                  borderColor: actif ? t.accent : t.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
            >
              <Text style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small }}>
                {LIBELLES_MOMENT[m]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.bouton, { backgroundColor: nom.trim() ? t.accent : t.bgCard }]}
        onPress={onAjouter}
        disabled={!nom.trim()}
      >
        <Text
          style={[styles.boutonTexte, { color: nom.trim() ? t.textOnAccent : t.textMuted }]}
        >
          Ajouter ce moment repère
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.md },
  intro: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionTitre: {
    fontSize: typography.small,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  item: { padding: 14, borderRadius: radius.md, marginBottom: spacing.sm },
  texteItem: { fontSize: typography.body },
  champ: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body,
  },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  puce: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  bouton: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
});
