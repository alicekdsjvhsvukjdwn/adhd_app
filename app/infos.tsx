import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import type { Categorie } from "../lib/catalogue";
import { getAujourdhui } from "../lib/db/completions";
import {
    ASTUCES,
    SECTIONS,
    astuceDuJour,
    type Carte,
} from "../lib/infos/contenu";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import {
    ICONES_CATEGORIE,
    LIBELLES_CATEGORIE,
    ORDRE_CATEGORIES,
    useCouleurCategorie,
} from "../lib/theme-categories";

/** Domaines qui ont au moins une astuce, dans l'ordre habituel. */
const DOMAINES_ASTUCES = ORDRE_CATEGORIES.filter((c) =>
  ASTUCES.some((a) => a.categorie === c),
);

export default function Infos() {
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Categorie | null>(null);

  const astuce = astuceDuJour(getAujourdhui());

  const basculer = (id: string) =>
    setOuverte((actuelle) => (actuelle === id ? null : id));

  const CarteDepliable = ({ carte }: { carte: Carte }) => {
    const estOuverte = ouverte === carte.id;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => basculer(carte.id)}
        style={[
          styles.carte,
          {
            backgroundColor: t.bgCard,
            borderColor: carte.important ? t.accent : "transparent",
          },
        ]}
      >
        <View style={styles.carteEntete}>
          {carte.categorie && (
            <View
              style={[
                styles.pastille,
                { backgroundColor: couleurCat(carte.categorie) },
              ]}
            />
          )}
          <Text style={[styles.carteTitre, { color: t.textPrimary }]}>
            {carte.titre}
          </Text>
          <Text style={[styles.chevron, { color: t.textMuted }]}>
            {estOuverte ? "−" : "+"}
          </Text>
        </View>

        {estOuverte && (
          <View style={styles.carteCorps}>
            <Text style={[styles.carteTexte, { color: t.textSecondary }]}>
              {carte.texte}
            </Text>

            {carte.astuce && (
              <View
                style={[styles.aEssayer, { backgroundColor: t.bgHighlight }]}
              >
                <Text style={[styles.aEssayerTitre, { color: t.accentText }]}>
                  À essayer
                </Text>
                <Text style={[styles.aEssayerTexte, { color: t.textPrimary }]}>
                  {carte.astuce}
                </Text>
              </View>
            )}

            {carte.appel && (
              <TouchableOpacity
                style={[styles.boutonAppel, { backgroundColor: t.accent }]}
                onPress={() => Linking.openURL(`tel:${carte.appel!.numero}`)}
              >
                <Text
                  style={[styles.boutonAppelTexte, { color: t.textOnAccent }]}
                >
                  📞 {carte.appel.libelle}
                </Text>
              </TouchableOpacity>
            )}

            {carte.source && (
              <Text style={[styles.source, { color: t.textMuted }]}>
                Source : {carte.source}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.retour, { color: t.accentText }]}>← Retour</Text>
      </TouchableOpacity>
      <Text style={[styles.titre, { color: t.textPrimary }]}>
        Comprendre le TDAH
      </Text>

      {/* Astuce du jour */}
      <View style={[styles.astuceJour, { backgroundColor: t.bgHighlight }]}>
        <Text style={[styles.astuceJourLabel, { color: t.accentText }]}>
          💡 Astuce du jour
          {astuce.categorie
            ? ` · ${ICONES_CATEGORIE[astuce.categorie]} ${LIBELLES_CATEGORIE[astuce.categorie]}`
            : ""}
        </Text>
        <Text style={[styles.astuceJourTitre, { color: t.textPrimary }]}>
          {astuce.titre}
        </Text>
        {astuce.astuce && (
          <Text style={[styles.astuceJourTexte, { color: t.textSecondary }]}>
            {astuce.astuce}
          </Text>
        )}
      </View>

      {SECTIONS.map((section) => {
        const cartes =
          section.id === "astuces" && filtre
            ? section.cartes.filter((c) => c.categorie === filtre)
            : section.cartes;

        return (
          <View key={section.id}>
            <Text style={[styles.sectionTitre, { color: t.textPrimary }]}>
              {section.titre}
            </Text>
            {section.intro && (
              <Text style={[styles.sectionIntro, { color: t.textMuted }]}>
                {section.intro}
              </Text>
            )}

            {section.id === "astuces" && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtres}
              >
                <TouchableOpacity
                  onPress={() => setFiltre(null)}
                  style={[
                    styles.filtre,
                    {
                      backgroundColor: filtre === null ? t.accent : t.bgCard,
                      borderColor: filtre === null ? t.accent : t.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filtreTexte,
                      {
                        color:
                          filtre === null ? t.textOnAccent : t.textSecondary,
                      },
                    ]}
                  >
                    Tout
                  </Text>
                </TouchableOpacity>
                {DOMAINES_ASTUCES.map((c) => {
                  const actif = filtre === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setFiltre(actif ? null : c)}
                      style={[
                        styles.filtre,
                        {
                          backgroundColor: actif ? couleurCat(c) : t.bgCard,
                          borderColor: actif ? couleurCat(c) : t.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filtreTexte,
                          { color: actif ? t.textOnAccent : t.textSecondary },
                        ]}
                      >
                        {ICONES_CATEGORIE[c]} {LIBELLES_CATEGORIE[c]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {cartes.map((carte) => (
              <CarteDepliable key={carte.id} carte={carte} />
            ))}
          </View>
        );
      })}

      <Text style={[styles.avertissement, { color: t.textMuted }]}>
        Ces informations aident à comprendre. Elles ne remplacent pas l'avis
        d'un professionnel de santé.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  retour: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },

  astuceJour: { borderRadius: radius.lg, padding: spacing.lg },
  astuceJourLabel: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  astuceJourTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  astuceJourTexte: {
    fontSize: typography.bodySmall,
    marginTop: 6,
    lineHeight: 20,
  },

  sectionTitre: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  sectionIntro: { fontSize: typography.small, marginBottom: spacing.sm },

  filtres: { gap: spacing.sm, paddingBottom: spacing.md },
  filtre: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filtreTexte: { fontSize: typography.small, fontWeight: "500" },

  carte: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 2,
  },
  carteEntete: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  carteTitre: { flex: 1, fontSize: typography.body, fontWeight: "600" },
  chevron: { fontSize: 20, fontWeight: "400", width: 16, textAlign: "center" },
  carteCorps: { marginTop: spacing.md },
  carteTexte: { fontSize: typography.bodySmall, lineHeight: 21 },

  aEssayer: {
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  aEssayerTitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  aEssayerTexte: { fontSize: typography.bodySmall, lineHeight: 20 },

  boutonAppel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  boutonAppelTexte: { fontSize: typography.body, fontWeight: "600" },

  source: {
    fontSize: typography.tiny,
    fontStyle: "italic",
    marginTop: spacing.md,
    lineHeight: 16,
  },

  avertissement: {
    fontSize: typography.tiny,
    textAlign: "center",
    marginTop: spacing.xxl,
    lineHeight: 17,
  },
});
