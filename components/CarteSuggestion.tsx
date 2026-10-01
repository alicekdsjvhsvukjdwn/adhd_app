import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
    deciderSuggestion,
    suggestionDuJour,
    type Suggestion,
} from "../lib/db/suggestions";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Une suggestion d'ajustement à la fois, dans « Mes routines »
 * (l'écran Routines n'en montre qu'un repère neutre sur le lien).
 * La personne décide : l'appli n'applique jamais un changement visible seule.
 */
export function CarteSuggestion({ onDecision }: { onDecision?: () => void }) {
  const router = useRouter();
  const t = useTheme();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [enCours, setEnCours] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      suggestionDuJour()
        .then((s) => {
          if (actif) setSuggestion(s);
        })
        .catch(() => {
          // Une suggestion ratée ne doit jamais bloquer l'accueil.
        });
      return () => {
        actif = false;
      };
    }, []),
  );

  if (!suggestion) return null;

  const decider = async (acceptee: boolean) => {
    if (enCours) return;
    setEnCours(true);
    const s = suggestion;
    try {
      await deciderSuggestion(s, acceptee);
      setSuggestion(null);
      onDecision?.();
      if (acceptee && s.route) router.push(s.route as never);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View
      style={[
        styles.carte,
        { backgroundColor: t.bgCard, borderLeftColor: t.accent },
      ]}
    >
      <Text style={[styles.label, { color: t.accentText }]}>💬 Suggestion</Text>
      <Text style={[styles.titre, { color: t.textPrimary }]}>
        {suggestion.titre}
      </Text>
      <Text style={[styles.explication, { color: t.textMuted }]}>
        {suggestion.explication}
      </Text>

      <View style={styles.boutons}>
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: t.accent }]}
          onPress={() => decider(true)}
          disabled={enCours}
        >
          <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
            {suggestion.accepter}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bouton, { borderColor: t.border, borderWidth: 1 }]}
          onPress={() => decider(false)}
          disabled={enCours}
        >
          <Text style={[styles.boutonTexte, { color: t.textSecondary }]}>
            Pas maintenant
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  titre: { fontSize: typography.body, fontWeight: "600", lineHeight: 21 },
  explication: {
    fontSize: typography.small,
    marginTop: 6,
    lineHeight: 18,
  },
  boutons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  bouton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: "center",
  },
  boutonTexte: { fontSize: typography.small, fontWeight: "600" },
});
