import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { CalendrierMois } from "../../components/CalendrierMois";
import { deviner } from "../../lib/catalogue";
import {
    addItem,
    annulerCompletion,
    completer,
    deleteItem,
} from "../../lib/db";
import { energieDuJour } from "../../lib/db/energie";
import {
    BONUS_FIN,
    POINTS_ETAPE,
    cocherEtape,
    decocherEtape,
    getEtapesPour,
    type Etape,
} from "../../lib/db/etapes";
import { genererPropositions, type Proposition } from "../../lib/db/moteur";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

type Annulable =
  | { type: "tache"; id: number; texte: string }
  | { type: "etape"; etapeId: number; texte: string };

export default function Taches() {
  const router = useRouter();
  const t = useTheme();

  const [classement, setClassement] = useState<Proposition[]>([]);
  const [etapes, setEtapes] = useState<Record<number, Etape[]>>({});
  const [voirPlusTard, setVoirPlusTard] = useState(false);
  const [energie, setEnergie] = useState<1 | 2 | 3 | null>(null);

  const [nouvelleTache, setNouvelleTache] = useState("");
  const [tacheNotee, setTacheNotee] = useState<string | null>(null);
  const [annulable, setAnnulable] = useState<Annulable | null>(null);
  const minuteurNotee = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteurAnnuler = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (minuteurNotee.current) clearTimeout(minuteurNotee.current);
      if (minuteurAnnuler.current) clearTimeout(minuteurAnnuler.current);
    },
    [],
  );

  const charger = useCallback(async () => {
    const toutes = await genererPropositions();
    setClassement(toutes);
    setEtapes(await getEtapesPour(toutes.map((p) => p.itemId)));
    setEnergie((await energieDuJour()).niveau);
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const proposerAnnulation = (a: Annulable) => {
    if (minuteurAnnuler.current) clearTimeout(minuteurAnnuler.current);
    setAnnulable(a);
    minuteurAnnuler.current = setTimeout(() => setAnnulable(null), 6000);
  };

  const onNoter = async () => {
    const nom = nouvelleTache.trim();
    if (!nom) return;
    await addItem({
      nom,
      type: "tache",
      categorie: deviner(nom)?.categorie ?? null,
    });
    setNouvelleTache("");
    Keyboard.dismiss();
    setTacheNotee(nom);
    if (minuteurNotee.current) clearTimeout(minuteurNotee.current);
    minuteurNotee.current = setTimeout(() => setTacheNotee(null), 4000);
    await charger();
  };

  const onTerminer = async (p: Proposition) => {
    await completer(p.itemId, "complet");
    proposerAnnulation({ type: "tache", id: p.itemId, texte: `✓ ${p.nom}` });
    await charger();
  };

  const onEtape = async (p: Proposition, e: Etape) => {
    if (e.faite === 1) {
      await decocherEtape(e.id);
    } else {
      const derniere = await cocherEtape(e.id);
      proposerAnnulation({
        type: "etape",
        etapeId: e.id,
        texte: derniere
          ? `✓ « ${p.nom} » terminée · +${POINTS_ETAPE + BONUS_FIN} pts`
          : `✓ ${e.nom} · +${POINTS_ETAPE} pts`,
      });
    }
    await charger();
  };

  const onAnnuler = async () => {
    if (!annulable) return;
    if (minuteurAnnuler.current) clearTimeout(minuteurAnnuler.current);
    const a = annulable;
    setAnnulable(null);
    if (a.type === "tache") await annulerCompletion(a.id);
    else await decocherEtape(a.etapeId);
    await charger();
  };

  const onSupprimer = (p: Proposition) => {
    Alert.alert("Supprimer cette tâche ?", p.nom, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteItem(p.itemId);
          await charger();
        },
      },
    ]);
  };

  const actions = (p: Proposition) => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.accentText }]}
        onPress={() => router.push(`/nouvelle-tache?id=${p.itemId}`)}
      >
        <Text style={[styles.actionTexte, { color: t.textOnAccent }]}>
          Modifier
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.danger }]}
        onPress={() => onSupprimer(p)}
      >
        <Text style={[styles.actionTexte, { color: t.textOnAccent }]}>
          Supprimer
        </Text>
      </TouchableOpacity>
    </View>
  );

  const maintenant = classement.filter((p) => p.propose);
  const plusTard = classement.filter((p) => !p.propose);

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}
      >
        <Text style={[styles.titre, { color: t.textPrimary }]}>Tâches</Text>

        {/* L'énergie choisie sur Routines oriente aussi le tri des tâches */}
        <TouchableOpacity
          style={[styles.energie, { backgroundColor: t.bgCard }]}
          onPress={() => router.push("/")}
        >
          <Text style={[styles.energieTexte, { color: t.textSecondary }]}>
            {energie === 1
              ? "🪫 Énergie basse : les tâches exigeantes sont écartées en priorité."
              : energie === 3
                ? "⚡ Énergie haute : les tâches exigeantes ne sont plus écartées."
                : energie === 2
                  ? "🔋 Énergie normale."
                  : "Indique ton énergie sur l'onglet Routines pour adapter les tâches."}
          </Text>
          <Text style={[styles.energieLien, { color: t.accentText }]}>
            Changer
          </Text>
        </TouchableOpacity>

        {/* Noter en une ligne : l'appli devine le domaine et trie */}
        <View style={styles.ajout}>
          <TextInput
            style={[
              styles.champ,
              {
                backgroundColor: t.bgCard,
                borderColor: t.border,
                color: t.textPrimary,
              },
            ]}
            placeholder="Une tâche à noter"
            placeholderTextColor={t.textMuted}
            value={nouvelleTache}
            onChangeText={setNouvelleTache}
            onSubmitEditing={onNoter}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.boutonNoter, { backgroundColor: t.accent }]}
            onPress={onNoter}
          >
            <Text style={[styles.boutonNoterTexte, { color: t.textOnAccent }]}>
              Noter
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ajoutPied}>
          {tacheNotee ? (
            <Text style={[styles.confirmation, { color: t.textSecondary }]}>
              ✓ « {tacheNotee} » est notée.
            </Text>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={() => {
              const n = nouvelleTache.trim();
              setNouvelleTache("");
              router.push(
                n
                  ? `/nouvelle-tache?nom=${encodeURIComponent(n)}`
                  : "/nouvelle-tache",
              );
            }}
            hitSlop={8}
          >
            <Text style={[styles.lien, { color: t.accentText }]}>
              Plus d'options
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.section, { color: t.textPrimary }]}>
          À faire maintenant
        </Text>
        {maintenant.length === 0 && (
          <Text style={[styles.vide, { color: t.textMuted }]}>
            Aucune tâche en cours.
          </Text>
        )}

        {maintenant.map((p) => {
          const liste = etapes[p.itemId] ?? [];
          const faites = liste.filter((e) => e.faite === 1).length;
          const suivante = liste.find((e) => e.faite === 0);
          return (
            <Swipeable key={p.itemId} renderRightActions={() => actions(p)}>
              <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
                <View style={styles.carteEntete}>
                  <View
                    style={[styles.raison, { backgroundColor: t.bgHighlight }]}
                  >
                    <Text style={[styles.raisonTexte, { color: t.accentText }]}>
                      {p.exploration ? "🔄 " : ""}
                      {p.raison}
                    </Text>
                  </View>
                  {p.duree_min ? (
                    <Text style={[styles.duree, { color: t.textMuted }]}>
                      {p.duree_min} min
                    </Text>
                  ) : null}
                </View>

                {liste.length === 0 ? (
                  <>
                    <TouchableOpacity onPress={() => onTerminer(p)}>
                      <Text style={[styles.nom, { color: t.textPrimary }]}>
                        ○ {p.nom}
                      </Text>
                      {p.premiere_action ? (
                        <Text
                          style={[styles.premiere, { color: t.textSecondary }]}
                        >
                          Commencer par : {p.premiere_action}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/nouvelle-tache?id=${p.itemId}`)
                      }
                      hitSlop={8}
                    >
                      <Text style={[styles.decouper, { color: t.accentText }]}>
                        Découper en étapes
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.nom, { color: t.textPrimary }]}>
                      {p.nom}
                    </Text>
                    <View style={styles.progressionLigne}>
                      <View
                        style={[styles.barre, { backgroundColor: t.bgApp }]}
                      >
                        <View
                          style={{
                            flex: faites,
                            backgroundColor: t.success,
                            borderRadius: 4,
                          }}
                        />
                        <View style={{ flex: liste.length - faites }} />
                      </View>
                      <Text
                        style={[
                          styles.progressionTexte,
                          { color: t.textMuted },
                        ]}
                      >
                        {faites}/{liste.length}
                      </Text>
                    </View>
                    {liste.map((e) => {
                      const estSuivante = suivante?.id === e.id;
                      return (
                        <TouchableOpacity
                          key={e.id}
                          style={styles.etape}
                          onPress={() => onEtape(p, e)}
                        >
                          <Text
                            style={[
                              styles.etapeCase,
                              { color: e.faite ? t.success : t.textMuted },
                            ]}
                          >
                            {e.faite ? "✓" : "○"}
                          </Text>
                          <Text
                            style={[
                              styles.etapeNom,
                              {
                                color: e.faite
                                  ? t.textMuted
                                  : estSuivante
                                    ? t.textPrimary
                                    : t.textSecondary,
                                fontWeight: estSuivante ? "600" : "400",
                                textDecorationLine: e.faite
                                  ? "line-through"
                                  : "none",
                              },
                            ]}
                          >
                            {e.nom}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={[styles.bonus, { color: t.textMuted }]}>
                      +{POINTS_ETAPE} pts par étape, +{BONUS_FIN} en bonus quand
                      tout est fait
                    </Text>
                  </>
                )}
              </View>
            </Swipeable>
          );
        })}

        {plusTard.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.plusTardEntete}
              onPress={() => setVoirPlusTard(!voirPlusTard)}
            >
              <Text
                style={[styles.section, { color: t.textPrimary, marginTop: 0 }]}
              >
                Plus tard · {plusTard.length}
              </Text>
              <Text style={[styles.chevron, { color: t.textMuted }]}>
                {voirPlusTard ? "−" : "+"}
              </Text>
            </TouchableOpacity>
            {!voirPlusTard && (
              <Text style={[styles.vide, { color: t.textMuted }]}>
                L'appli les proposera au bon moment.
              </Text>
            )}
            {voirPlusTard &&
              plusTard.map((p) => {
                const liste = etapes[p.itemId] ?? [];
                const faites = liste.filter((e) => e.faite === 1).length;
                return (
                  <Swipeable
                    key={p.itemId}
                    renderRightActions={() => actions(p)}
                  >
                    <TouchableOpacity
                      style={[styles.ligne, { backgroundColor: t.bgCard }]}
                      onPress={() =>
                        liste.length > 0
                          ? router.push(`/nouvelle-tache?id=${p.itemId}`)
                          : onTerminer(p)
                      }
                    >
                      <Text style={[styles.ligneNom, { color: t.textPrimary }]}>
                        ○ {p.nom}
                      </Text>
                      {liste.length > 0 && (
                        <Text
                          style={[
                            styles.progressionTexte,
                            { color: t.textMuted },
                          ]}
                        >
                          {faites}/{liste.length}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </Swipeable>
                );
              })}
          </>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <CalendrierMois type="tache" titre="Tâches" />
        </View>
      </ScrollView>

      {annulable && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Text
            style={[styles.bandeauTexte, { color: t.bgApp }]}
            numberOfLines={1}
          >
            {annulable.texte}
          </Text>
          <TouchableOpacity onPress={onAnnuler} hitSlop={10}>
            <Text style={[styles.bandeauAction, { color: t.bgApp }]}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },

  energie: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  energieTexte: { flex: 1, fontSize: typography.small, lineHeight: 18 },
  energieLien: { fontSize: typography.small, fontWeight: "600" },
  ajout: { flexDirection: "row", gap: spacing.sm },
  champ: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  boutonNoter: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  boutonNoterTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  ajoutPied: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    minHeight: 18,
  },
  confirmation: {
    flex: 1,
    fontSize: typography.small,
    marginRight: spacing.md,
  },
  lien: { fontSize: typography.small, fontWeight: "600" },

  section: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  vide: {
    fontSize: typography.small,
    fontStyle: "italic",
    marginBottom: spacing.sm,
  },

  carte: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  carteEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  raison: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  raisonTexte: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  duree: { fontSize: typography.small },
  nom: { fontSize: typography.h3, fontWeight: "600" },
  premiere: { fontSize: typography.small, marginTop: 6, lineHeight: 19 },
  decouper: {
    fontSize: typography.small,
    fontWeight: "600",
    marginTop: spacing.sm,
  },

  progressionLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  barre: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "hidden",
  },
  progressionTexte: { fontSize: typography.small, fontWeight: "600" },
  etape: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 8,
  },
  etapeCase: { fontSize: 18, width: 20, textAlign: "center" },
  etapeNom: { flex: 1, fontSize: typography.bodySmall },
  bonus: { fontSize: typography.tiny, marginTop: 4 },

  plusTardEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  chevron: { fontSize: 22 },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  ligneNom: { flex: 1, fontSize: typography.body },

  actions: { flexDirection: "row" },
  action: {
    justifyContent: "center",
    alignItems: "center",
    width: 86,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    marginLeft: 4,
  },
  actionTexte: { fontWeight: "600", fontSize: typography.small },

  bandeau: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bandeauTexte: { flex: 1, fontSize: typography.bodySmall },
  bandeauAction: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
