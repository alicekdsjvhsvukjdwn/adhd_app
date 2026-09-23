import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import type { Categorie } from "../lib/catalogue";
import { addItem } from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import {
    ICONES_CATEGORIE,
    LIBELLES_CATEGORIE,
    ORDRE_CATEGORIES,
    useCouleurCategorie,
} from "../lib/theme-categories";

/**
 * Saisie d'une tâche ponctuelle. Seul le nom est obligatoire :
 * noter doit prendre quelques secondes, le tri est fait par le moteur.
 */

type Importance = 1 | 2 | 3;

const IMPORTANCES: { valeur: Importance; libelle: string }[] = [
  { valeur: 3, libelle: "Essentiel" },
  { valeur: 2, libelle: "Utile" },
  { valeur: 1, libelle: "Bonus" },
];

const ECHEANCES: { jours: number | null; libelle: string }[] = [
  { jours: null, libelle: "Aucune" },
  { jours: 0, libelle: "Aujourd'hui" },
  { jours: 1, libelle: "Demain" },
  { jours: 3, libelle: "Dans 3 jours" },
  { jours: 7, libelle: "Dans 1 semaine" },
  { jours: 14, libelle: "Dans 2 semaines" },
];

const DUREES = [5, 15, 30, 60];

/** Même convention de date que getAujourdhui() dans completions.ts. */
function dateDansJours(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().split("T")[0];
}

export default function NouvelleTache() {
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();

  const [nom, setNom] = useState("");
  const [importance, setImportance] = useState<Importance>(2);
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [echeanceJours, setEcheanceJours] = useState<number | null>(null);
  const [duree, setDuree] = useState<number | null>(null);
  const [premiereAction, setPremiereAction] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const valide = nom.trim().length > 0;

  const onAjouter = async () => {
    if (!valide || enregistrement) return;
    setEnregistrement(true);
    try {
      await addItem({
        nom: nom.trim(),
        type: "tache",
        importance,
        categorie,
        echeance: echeanceJours === null ? null : dateDansJours(echeanceJours),
        duree_min: duree,
        premiere_action: premiereAction.trim() || null,
      });
      router.back();
    } finally {
      setEnregistrement(false);
    }
  };

  const Choix = ({
    actif,
    libelle,
    onPress,
    couleurActive,
  }: {
    actif: boolean;
    libelle: string;
    onPress: () => void;
    couleurActive?: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.choix,
        {
          backgroundColor: actif ? (couleurActive ?? t.accent) : t.bgCard,
          borderColor: actif ? (couleurActive ?? t.accent) : t.border,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.choixTexte,
          { color: actif ? t.textOnAccent : t.textSecondary },
        ]}
      >
        {libelle}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.annuler, { color: t.accentText }]}>
            ← Annuler
          </Text>
        </TouchableOpacity>

        <Text style={[styles.titre, { color: t.textPrimary }]}>
          Nouvelle tâche
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              borderColor: t.border,
              color: t.textPrimary,
              backgroundColor: t.bgCard,
            },
          ]}
          placeholder="Ex : appeler la mutuelle"
          placeholderTextColor={t.textMuted}
          value={nom}
          onChangeText={setNom}
          autoFocus
          returnKeyType="done"
        />

        <Text style={[styles.label, { color: t.textSecondary }]}>
          Importance
        </Text>
        <View style={styles.ligneChoix}>
          {IMPORTANCES.map((i) => (
            <Choix
              key={i.valeur}
              actif={importance === i.valeur}
              libelle={i.libelle}
              onPress={() => setImportance(i.valeur)}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: t.textSecondary }]}>
          Pour quand ?
        </Text>
        <View style={styles.ligneChoix}>
          {ECHEANCES.map((e) => (
            <Choix
              key={e.libelle}
              actif={echeanceJours === e.jours}
              libelle={e.libelle}
              onPress={() => setEcheanceJours(e.jours)}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: t.textSecondary }]}>
          Domaine (facultatif)
        </Text>
        <View style={styles.ligneChoix}>
          {ORDRE_CATEGORIES.map((c) => (
            <Choix
              key={c}
              actif={categorie === c}
              libelle={`${ICONES_CATEGORIE[c]} ${LIBELLES_CATEGORIE[c]}`}
              couleurActive={couleurCat(c)}
              onPress={() => setCategorie(categorie === c ? null : c)}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: t.textSecondary }]}>
          Durée estimée (facultatif)
        </Text>
        <View style={styles.ligneChoix}>
          {DUREES.map((d) => (
            <Choix
              key={d}
              actif={duree === d}
              libelle={d === 60 ? "1 h ou +" : `${d} min`}
              onPress={() => setDuree(duree === d ? null : d)}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: t.textSecondary }]}>
          Première petite action (facultatif)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: t.border,
              color: t.textPrimary,
              backgroundColor: t.bgCard,
            },
          ]}
          placeholder="Ex : chercher le numéro"
          placeholderTextColor={t.textMuted}
          value={premiereAction}
          onChangeText={setPremiereAction}
          returnKeyType="done"
        />
        <Text style={[styles.aide, { color: t.textMuted }]}>
          Le plus dur, c'est de commencer. Une action de deux minutes suffit.
        </Text>

        <TouchableOpacity
          style={[
            styles.bouton,
            {
              backgroundColor: valide ? t.accent : t.bgCard,
            },
          ]}
          onPress={onAjouter}
          disabled={!valide || enregistrement}
        >
          <Text
            style={[
              styles.boutonTexte,
              { color: valide ? t.textOnAccent : t.textMuted },
            ]}
          >
            Ajouter
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  annuler: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.body,
  },
  label: {
    fontSize: typography.small,
    fontWeight: "600",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  ligneChoix: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choix: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  choixTexte: { fontSize: typography.small, fontWeight: "500" },
  aide: { fontSize: typography.tiny, marginTop: 6, lineHeight: 17 },
  bouton: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
});
