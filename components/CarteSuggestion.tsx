import { useRouter } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "./Texte";
import { deciderSuggestion, type Suggestion } from "../lib/db/suggestions";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Une suggestion d'ajustement, ouverte depuis la pastille de l'onglet
 * Routines (sauf un jour difficile). La personne décide : l'appli
 * n'applique jamais un changement visible seule.
 */
export function CarteSuggestion({
  suggestion,
  onDecision,
}: {
  suggestion: Suggestion;
  onDecision?: () => void;
}) {
  const router = useRouter();
  const t = useTheme();
  const [enCours, setEnCours] = useState(false);

  const decider = async (acceptee: boolean) => {
    if (enCours) return;
    setEnCours(true);
    const s = suggestion;
    try {
      await deciderSuggestion(s, acceptee);
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
      <Texte style={[styles.label, { color: t.accentText }]}>💬 Suggestion</Texte>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>
        {suggestion.titre}
      </Texte>
      <Texte style={[styles.explication, { color: t.textMuted }]}>
        {suggestion.explication}
      </Texte>

      <View style={styles.boutons}>
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: t.accent }]}
          onPress={() => decider(true)}
          disabled={enCours}
        >
          <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>
            {suggestion.accepter}
          </Texte>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bouton, { borderColor: t.border, borderWidth: 1 }]}
          onPress={() => decider(false)}
          disabled={enCours}
        >
          <Texte style={[styles.boutonTexte, { color: t.textSecondary }]}>
            Pas maintenant
          </Texte>
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
