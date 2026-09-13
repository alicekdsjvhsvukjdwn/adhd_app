import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  LIBELLES_CATEGORIES,
  famillesPourProbleme,
  problemesParCategorie,
  rechercher,
  type FamilleTemplate,
} from "../lib/catalogue";
import { addItem, getItems } from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Au-delà, on prévient : trop de routines actives d'un coup, c'est l'abandon à J+4. */
const PLAFOND_ROUTINES = 5;

const LIBELLES_INTENSITE = ["Doux", "Moyen", "Soutenu", "Complet"];

// Mémoire de navigation : survit à un aller-retour, pas à un redémarrage.
let selectionMemorisee: string[] = [];
let ouvertesMemorisees: string[] = [];

export default function Problemes() {
  const router = useRouter();
  const t = useTheme();

  const [selection, setSelection] = useState<string[]>(selectionMemorisee);
  const [ouvertes, setOuvertes] = useState<string[]>(ouvertesMemorisees);
  const [recherche, setRecherche] = useState("");
  const [dejaAjoutes, setDejaAjoutes] = useState<string[]>([]);
  const [nbActives, setNbActives] = useState(0);
  const [variantes, setVariantes] = useState<Record<string, number>>({});

  const rafraichir = useCallback(async () => {
    const items = await getItems("tous");
    setDejaAjoutes(
      items
        .filter((i) => i.template_id && i.statut !== "archive")
        .map((i) => i.template_id as string),
    );
    setNbActives(
      items.filter((i) => i.type === "routine" && i.statut === "actif").length,
    );
  }, []);

  useEffect(() => {
    rafraichir();
  }, [rafraichir]);

  useEffect(() => {
    selectionMemorisee = selection;
  }, [selection]);

  useEffect(() => {
    ouvertesMemorisees = ouvertes;
  }, [ouvertes]);

  const groupes = useMemo(() => problemesParCategorie(), []);
  const enRecherche = recherche.trim().length >= 2;
  const resultatsRecherche = useMemo(
    () => (enRecherche ? rechercher(recherche) : []),
    [enRecherche, recherche],
  );

  const basculerProbleme = (p: string) => {
    setSelection((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const basculerCategorie = (c: string) => {
    setOuvertes((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const ajouterFamille = async (famille: FamilleTemplate, rang: number) => {
    const variante =
      famille.variantes.find((v) => v.rang === rang) ?? famille.variantes[0];

    const faire = async () => {
      await addItem({
        nom: variante.libelle,
        type: "routine",
        recurrence: "quotidien",
        template_id: famille.id,
        variante_rang: variante.rang,
        categorie: famille.categorie,
        moment: famille.moment,
        effort: variante.effort,
        duree_min: variante.duree_min,
        premiere_action: variante.premiere_action,
      });
      await rafraichir();
    };

    if (nbActives >= PLAFOND_ROUTINES) {
      Alert.alert(
        `Tu as déjà ${nbActives} routines actives`,
        "En ajouter une maintenant réduit les chances que les autres tiennent. Tu peux quand même le faire.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ajouter quand même", onPress: faire },
        ],
      );
      return;
    }

    await faire();
  };

  /** Carte d'une routine du catalogue, réutilisée sous un problème et en recherche. */
  const CarteFamille = ({ f }: { f: FamilleTemplate }) => {
    const deja = dejaAjoutes.includes(f.id);
    const rang = variantes[f.id] ?? f.variantes[0].rang;
    const variante = f.variantes.find((v) => v.rang === rang) ?? f.variantes[0];

    return (
      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        <Text style={[styles.carteTitre, { color: t.textPrimary }]}>
          {f.nom}
        </Text>

        <Text style={[styles.justification, { color: t.textSecondary }]}>
          {f.justification}
        </Text>

        <Text style={[styles.label, { color: t.textMuted }]}>
          À quelle intensité ?
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {f.variantes.map((v) => {
            const choisi = v.rang === rang;
            return (
              <TouchableOpacity
                key={v.rang}
                style={[
                  styles.pastille,
                  {
                    backgroundColor: choisi ? t.accent : t.bgApp,
                    borderColor: t.border,
                  },
                ]}
                onPress={() => setVariantes((p) => ({ ...p, [f.id]: v.rang }))}
              >
                <Text
                  style={[
                    styles.pastilleTexte,
                    { color: choisi ? t.textOnAccent : t.textSecondary },
                  ]}
                >
                  {LIBELLES_INTENSITE[v.rang - 1] ?? `Niveau ${v.rang}`} ·{" "}
                  {v.duree_min} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.variante, { color: t.textPrimary }]}>
          {variante.libelle}
        </Text>
        <Text style={[styles.premiereAction, { color: t.accentText }]}>
          Première action : {variante.premiere_action.toLowerCase()}
        </Text>

        {f.ancre_suggeree && (
          <Text style={[styles.ancre, { color: t.textMuted }]}>
            Moment repère suggéré : {f.ancre_suggeree}
          </Text>
        )}

        {deja ? (
          <View style={[styles.dejaAjoute, { backgroundColor: t.bgApp }]}>
            <Text style={[styles.dejaTexte, { color: t.textMuted }]}>
              Déjà dans tes routines
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.bouton, { backgroundColor: t.accent }]}
            onPress={() => ajouterFamille(f, rang)}
          >
            <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
              Ajouter à mes routines
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retour}>
          <Text style={[styles.retourTexte, { color: t.accent }]}>
            ← Retour
          </Text>
        </TouchableOpacity>

        <Text style={[styles.titre, { color: t.textPrimary }]}>
          Qu'est-ce qui coince ?
        </Text>

        <Text style={[styles.sousTitre, { color: t.textSecondary }]}>
          Choisis ce qui te pose problème, les routines correspondantes
          s'affichent dessous.
        </Text>

        <TextInput
          style={[
            styles.recherche,
            {
              borderColor: t.border,
              color: t.textPrimary,
              backgroundColor: t.bgCard,
            },
          ]}
          placeholder="Ou cherche directement..."
          placeholderTextColor={t.textMuted}
          value={recherche}
          onChangeText={setRecherche}
          returnKeyType="search"
        />

        {enRecherche ? (
          <>
            {resultatsRecherche.length === 0 ? (
              <Text style={[styles.vide, { color: t.textSecondary }]}>
                Rien trouvé. Tu peux créer ta propre routine depuis l'écran du
                jour.
              </Text>
            ) : (
              resultatsRecherche.map((f) => <CarteFamille key={f.id} f={f} />)
            )}
          </>
        ) : (
          groupes.map((g) => {
            const ouvert = ouvertes.includes(g.categorie);
            const nbChoisis = g.problemes.filter((p) =>
              selection.includes(p),
            ).length;

            return (
              <View key={g.categorie} style={styles.groupe}>
                <TouchableOpacity
                  style={[styles.groupeEntete, { borderBottomColor: t.border }]}
                  onPress={() => basculerCategorie(g.categorie)}
                >
                  <Text style={[styles.groupeTitre, { color: t.accentText }]}>
                    {ouvert ? "▾" : "▸"} {LIBELLES_CATEGORIES[g.categorie]}
                    {nbChoisis > 0 ? ` · ${nbChoisis}` : ""}
                  </Text>
                </TouchableOpacity>

                {ouvert &&
                  g.problemes.map((p) => {
                    const actif = selection.includes(p);
                    const familles = actif ? famillesPourProbleme(p) : [];

                    return (
                      <View key={p}>
                        <TouchableOpacity
                          style={[
                            styles.boutonProbleme,
                            {
                              backgroundColor: actif ? t.accent : t.bgCard,
                              borderColor: t.border,
                            },
                          ]}
                          onPress={() => basculerProbleme(p)}
                        >
                          <Text
                            style={[
                              styles.texteProbleme,
                              { color: actif ? t.textOnAccent : t.textPrimary },
                            ]}
                          >
                            {actif ? "▾ " : ""}
                            {p}
                          </Text>
                        </TouchableOpacity>

                        {actif && (
                          <View style={styles.solutions}>
                            <Text
                              style={[styles.compteur, { color: t.textMuted }]}
                            >
                              {familles.length} routine
                              {familles.length > 1 ? "s" : ""} pour ça
                            </Text>
                            {familles.map((f) => (
                              <CarteFamille key={f.id} f={f} />
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            );
          })
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  retour: { paddingVertical: spacing.sm },
  retourTexte: { fontSize: typography.bodySmall, fontWeight: "500" },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  sousTitre: {
    fontSize: typography.small,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  recherche: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.body,
    marginBottom: spacing.md,
  },
  groupe: { marginBottom: spacing.md },
  groupeEntete: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  groupeTitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  boutonProbleme: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  texteProbleme: { fontSize: typography.body },
  solutions: {
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  vide: {
    fontSize: typography.bodySmall,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  compteur: {
    fontSize: typography.tiny,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  carte: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  carteTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  justification: {
    fontSize: typography.small,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.tiny,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 6,
  },
  pastille: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  pastilleTexte: { fontSize: typography.small },
  variante: {
    fontSize: typography.body,
    fontWeight: "500",
    marginTop: spacing.md,
  },
  premiereAction: { fontSize: typography.small, marginTop: 4 },
  ancre: { fontSize: typography.tiny, marginTop: spacing.sm },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  boutonTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  dejaAjoute: {
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  dejaTexte: { fontSize: typography.bodySmall },
});
