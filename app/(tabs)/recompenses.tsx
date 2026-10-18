import { useFocusEffect } from "expo-router";
import { useJourCourant } from "../../hooks/useJourCourant";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte, ChampTexte } from "../../components/Texte";
import { Swipeable } from "react-native-gesture-handler";
import {
    IDEES_RECOMPENSES,
    REGLES_POINTS,
    acheter,
    ajouterRecompense,
    annulerAchat,
    derniersAchats,
    getRecompenses,
    modifierRecompense,
    pointsGagnes,
    soldePoints,
    supprimerRecompense,
    type Achat,
    type Recompense,
} from "../../lib/db/recompenses";
import { niveauDePoints, totalAffiche } from "../../lib/regles-taches";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

const ICONES = [
  "☕",
  "🎮",
  "📺",
  "🍰",
  "🛁",
  "📚",
  "🍿",
  "🎧",
  "🍕",
  "🛍️",
  "🌳",
  "🎨",
];
const PRIX = [25, 50, 100, 150, 300, 500];

const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function dateCourte(d: string, aujourdhui: string): string {
  if (d === aujourdhui) return "Aujourd'hui";
  const x = new Date(d + "T00:00:00Z");
  return `${x.getUTCDate()} ${MOIS_COURTS[x.getUTCMonth()]}`;
}

type Formulaire = { id?: number; nom: string; icone: string; prix: string };

export default function Recompenses() {
  const t = useTheme();
  const aujourdhui = useJourCourant();

  const [solde, setSolde] = useState(0);
  const [total, setTotal] = useState(0);
  const [liste, setListe] = useState<Recompense[]>([]);
  const [achats, setAchats] = useState<Achat[]>([]);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [voirRegles, setVoirRegles] = useState(false);
  const [bravo, setBravo] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  const charger = useCallback(async () => {
    const [s, g, l, a] = await Promise.all([
      soldePoints(),
      pointsGagnes(),
      getRecompenses(),
      derniersAchats(20),
    ]);
    setSolde(s);
    setTotal(g);
    setListe(l);
    setAchats(a);
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger, aujourdhui]),
  );

  const niveau = niveauDePoints(total);
  const nomsPris = new Set(liste.map((r) => r.nom));
  const idees = IDEES_RECOMPENSES.filter((i) => !nomsPris.has(i.nom));

  const onOffrir = (r: Recompense) => {
    if (solde < r.prix) {
      Alert.alert(
        "Pas encore",
        `Il te manque ${r.prix - solde} points pour « ${r.nom} ».`,
      );
      return;
    }
    Alert.alert(
      `${r.icone ?? "🎁"} ${r.nom}`,
      `Dépenser ${r.prix} points ? Il t'en restera ${solde - r.prix}.`,
      [
        { text: "Pas maintenant", style: "cancel" },
        {
          text: "Je me l'offre",
          onPress: async () => {
            if (await acheter(r)) {
              setBravo(
                `${r.icone ?? "🎉"} Profite bien : ${r.nom.toLowerCase()} !`,
              );
              if (minuteur.current) clearTimeout(minuteur.current);
              minuteur.current = setTimeout(() => setBravo(null), 4000);
            }
            await charger();
          },
        },
      ],
    );
  };

  const onAnnulerAchat = (a: Achat) => {
    if (a.date !== aujourdhui) return;
    Alert.alert(
      "Annuler cet achat ?",
      `Les ${a.prix} points de « ${a.nom} » te seront rendus.`,
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Annuler l'achat",
          onPress: async () => {
            await annulerAchat(a.id);
            await charger();
          },
        },
      ],
    );
  };

  const onSupprimer = (r: Recompense) => {
    Alert.alert("Supprimer cette récompense ?", r.nom, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimerRecompense(r.id);
          await charger();
        },
      },
    ]);
  };

  const prixSaisi = formulaire ? parseInt(formulaire.prix, 10) : NaN;
  const formulaireValide =
    !!formulaire && formulaire.nom.trim().length > 0 && prixSaisi > 0;

  const enregistrer = async () => {
    if (!formulaire || !formulaireValide) return;
    const r = { nom: formulaire.nom, icone: formulaire.icone, prix: prixSaisi };
    if (formulaire.id) await modifierRecompense({ id: formulaire.id, ...r });
    else await ajouterRecompense(r);
    setFormulaire(null);
    await charger();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}
      >
        <Texte style={[styles.titre, { color: t.textPrimary }]}>
          Récompenses
        </Texte>

        {/* Solde */}
        <View style={[styles.solde, { backgroundColor: t.bgHighlight }]}>
          <Texte style={[styles.soldeChiffre, { color: t.textPrimary }]}>
            {solde} pts
          </Texte>
          <Texte style={[styles.soldeTexte, { color: t.accentText }]}>
            à dépenser
          </Texte>
          <Texte style={[styles.soldeDetail, { color: t.textSecondary }]}>
            Niveau {niveau} · {totalAffiche(total)} points gagnés au total
          </Texte>
        </View>

        {/* Mes récompenses */}
        <View style={styles.titreLigne}>
          <Texte style={[styles.section, { color: t.textPrimary }]}>
            Mes récompenses
          </Texte>
          <TouchableOpacity
            style={[styles.plus, { backgroundColor: t.accent }]}
            onPress={() =>
              setFormulaire({ nom: "", icone: ICONES[0], prix: "50" })
            }
            accessibilityLabel="Créer une récompense"
          >
            <Texte style={[styles.plusTexte, { color: t.textOnAccent }]}>+</Texte>
          </TouchableOpacity>
        </View>

        {liste.length === 0 && (
          <Texte style={[styles.vide, { color: t.textMuted }]}>
            Choisis ce qui te fait vraiment plaisir : c'est ce qui rend les
            points utiles.
          </Texte>
        )}

        {liste.map((r) => {
          const pret = solde >= r.prix;
          const part = Math.min(1, solde / r.prix);
          return (
            <Swipeable
              key={r.id}
              renderRightActions={() => (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.action, { backgroundColor: t.accentText }]}
                    onPress={() =>
                      setFormulaire({
                        id: r.id,
                        nom: r.nom,
                        icone: r.icone ?? ICONES[0],
                        prix: String(r.prix),
                      })
                    }
                  >
                    <Texte
                      style={[styles.actionTexte, { color: t.textOnAccent }]}
                    >
                      Modifier
                    </Texte>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.action, { backgroundColor: t.danger }]}
                    onPress={() => onSupprimer(r)}
                  >
                    <Texte
                      style={[styles.actionTexte, { color: t.textOnAccent }]}
                    >
                      Supprimer
                    </Texte>
                  </TouchableOpacity>
                </View>
              )}
            >
              <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
                <View style={styles.carteHaut}>
                  <Texte style={styles.icone}>{r.icone ?? "🎁"}</Texte>
                  <View style={{ flex: 1 }}>
                    <Texte style={[styles.nom, { color: t.textPrimary }]}>
                      {r.nom}
                    </Texte>
                    <Texte style={[styles.prix, { color: t.textSecondary }]}>
                      {r.prix} pts
                    </Texte>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.offrir,
                      pret
                        ? { backgroundColor: t.accent, borderColor: t.accent }
                        : { borderColor: t.border },
                    ]}
                    onPress={() => onOffrir(r)}
                  >
                    <Texte
                      style={[
                        styles.offrirTexte,
                        { color: pret ? t.textOnAccent : t.textMuted },
                      ]}
                    >
                      {pret ? "Je me l'offre" : `Encore ${r.prix - solde}`}
                    </Texte>
                  </TouchableOpacity>
                </View>
                {!pret && (
                  <View style={[styles.barre, { backgroundColor: t.bgApp }]}>
                    <View
                      style={{
                        flex: part,
                        backgroundColor: t.success,
                        borderRadius: 4,
                      }}
                    />
                    <View style={{ flex: 1 - part }} />
                  </View>
                )}
              </View>
            </Swipeable>
          );
        })}

        {/* Idées à ajouter d'un tap */}
        {idees.length > 0 && (
          <>
            <Texte style={[styles.sousSection, { color: t.textSecondary }]}>
              {liste.length === 0
                ? "Des idées pour commencer"
                : "D'autres idées"}
            </Texte>
            <View style={styles.idees}>
              {idees.map((i) => (
                <TouchableOpacity
                  key={i.nom}
                  style={[
                    styles.idee,
                    { backgroundColor: t.bgCard, borderColor: t.border },
                  ]}
                  onPress={async () => {
                    await ajouterRecompense(i);
                    await charger();
                  }}
                >
                  <Texte style={[styles.ideeTexte, { color: t.textPrimary }]}>
                    {i.icone} {i.nom}
                  </Texte>
                  <Texte style={[styles.ideePrix, { color: t.textMuted }]}>
                    + {i.prix} pts
                  </Texte>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Comment gagner des points */}
        <TouchableOpacity
          style={[styles.regles, { backgroundColor: t.bgCard }]}
          onPress={() => setVoirRegles(!voirRegles)}
          activeOpacity={0.8}
        >
          <View style={styles.reglesEntete}>
            <Texte style={[styles.reglesTitre, { color: t.textPrimary }]}>
              Comment gagner des points
            </Texte>
            <Texte style={[styles.chevron, { color: t.textMuted }]}>
              {voirRegles ? "−" : "+"}
            </Texte>
          </View>
          {voirRegles && (
            <>
              {REGLES_POINTS.map((r) => (
                <View key={r.action} style={styles.regle}>
                  <Texte
                    style={[styles.regleAction, { color: t.textSecondary }]}
                  >
                    {r.action}
                  </Texte>
                  <Texte style={[styles.reglePoints, { color: t.accentText }]}>
                    {r.points}
                  </Texte>
                </View>
              ))}
              <Texte style={[styles.reglesNote, { color: t.textMuted }]}>
                Avec 3 routines et 3 tâches, on gagne environ 60
                points par jour : un café vaut une journée, un ciné une semaine.
                Ton niveau dépend du total gagné : dépenser ne le fait pas
                baisser, décocher reprend les points.
              </Texte>
            </>
          )}
        </TouchableOpacity>

        {/* Historique */}
        {achats.length > 0 && (
          <>
            <Texte
              style={[
                styles.section,
                { color: t.textPrimary, marginTop: spacing.xl },
              ]}
            >
              Dernières récompenses
            </Texte>
            {achats.some((a) => a.date === aujourdhui) && (
              <Texte
                style={[
                  styles.vide,
                  { color: t.textMuted, fontStyle: "normal" },
                ]}
              >
                Achat par erreur ? Touche-le pour l'annuler, le jour même.
              </Texte>
            )}
            {achats.map((a) => (
              <TouchableOpacity
                key={a.id}
                disabled={a.date !== aujourdhui}
                onPress={() => onAnnulerAchat(a)}
                style={[styles.achat, { borderBottomColor: t.border }]}
              >
                <Texte style={styles.achatIcone}>{a.icone ?? "🎁"}</Texte>
                <Texte style={[styles.achatNom, { color: t.textPrimary }]}>
                  {a.nom}
                </Texte>
                <Texte style={[styles.achatDate, { color: t.textMuted }]}>
                  {dateCourte(a.date, aujourdhui)}
                </Texte>
                <Texte style={[styles.achatPrix, { color: t.textSecondary }]}>
                  −{a.prix}
                </Texte>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {bravo && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Texte style={[styles.bandeauTexte, { color: t.bgApp }]}>{bravo}</Texte>
        </View>
      )}

      {/* Créer / modifier une récompense */}
      <Modal
        visible={formulaire !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFormulaire(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.fond} onPress={() => setFormulaire(null)}>
            <Pressable style={[styles.formCarte, { backgroundColor: t.bgCard, borderColor: t.border, borderWidth: 1 }]}>
              {formulaire && (
                <>
                  <Texte style={[styles.formTitre, { color: t.textPrimary }]}>
                    {formulaire.id
                      ? "Modifier la récompense"
                      : "Nouvelle récompense"}
                  </Texte>

                  <View style={styles.icones}>
                    {ICONES.map((i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() =>
                          setFormulaire({ ...formulaire, icone: i })
                        }
                        style={[
                          styles.iconeChoix,
                          {
                            backgroundColor:
                              formulaire.icone === i ? t.bgHighlight : t.bgCard,
                            borderColor:
                              formulaire.icone === i ? t.accent : "transparent",
                          },
                        ]}
                      >
                        <Texte style={{ fontSize: 20 }}>{i}</Texte>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ChampTexte
                    style={[
                      styles.champ,
                      {
                        backgroundColor: t.bgCard,
                        borderColor: t.border,
                        color: t.textPrimary,
                      },
                    ]}
                    placeholder="Ex : aller boire un café"
                    placeholderTextColor={t.textMuted}
                    value={formulaire.nom}
                    onChangeText={(nom) =>
                      setFormulaire({ ...formulaire, nom })
                    }
                    autoFocus={!formulaire.id}
                  />

                  <Texte style={[styles.formLabel, { color: t.textSecondary }]}>
                    Prix
                  </Texte>
                  <View style={styles.prixChoix}>
                    {PRIX.map((p) => {
                      const actif = formulaire.prix === String(p);
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() =>
                            setFormulaire({ ...formulaire, prix: String(p) })
                          }
                          style={[
                            styles.prixPastille,
                            {
                              backgroundColor: actif ? t.accent : t.bgCard,
                              borderColor: actif ? t.accent : t.border,
                            },
                          ]}
                        >
                          <Texte
                            style={{
                              color: actif ? t.textOnAccent : t.textSecondary,
                              fontSize: typography.small,
                              fontWeight: "600",
                            }}
                          >
                            {p}
                          </Texte>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <ChampTexte
                    style={[
                      styles.champ,
                      {
                        backgroundColor: t.bgCard,
                        borderColor: t.border,
                        color: t.textPrimary,
                      },
                    ]}
                    placeholder="Ou un autre prix"
                    placeholderTextColor={t.textMuted}
                    keyboardType="number-pad"
                    value={formulaire.prix}
                    onChangeText={(prix) =>
                      setFormulaire({
                        ...formulaire,
                        prix: prix.replace(/[^0-9]/g, ""),
                      })
                    }
                  />
                  <Texte style={[styles.formAide, { color: t.textMuted }]}>
                    Repère : environ 60 points gagnés par jour.
                  </Texte>

                  <TouchableOpacity
                    style={[
                      styles.enregistrer,
                      {
                        backgroundColor: formulaireValide ? t.accent : t.bgCard,
                      },
                    ]}
                    onPress={enregistrer}
                  >
                    <Texte
                      style={[
                        styles.enregistrerTexte,
                        {
                          color: formulaireValide
                            ? t.textOnAccent
                            : t.textMuted,
                        },
                      ]}
                    >
                      {formulaireValide ? "Enregistrer" : "Un nom et un prix"}
                    </Texte>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.annulerForm}
                    onPress={() => setFormulaire(null)}
                  >
                    <Texte
                      style={[styles.annulerFormTexte, { color: t.accentText }]}
                    >
                      Annuler
                    </Texte>
                  </TouchableOpacity>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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

  solde: { borderRadius: radius.lg, padding: spacing.lg, alignItems: "center" },
  soldeChiffre: { fontSize: 40, fontWeight: "300" },
  soldeTexte: {
    fontSize: typography.small,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  soldeDetail: { fontSize: typography.small, marginTop: spacing.sm },

  titreLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  section: { fontSize: typography.h2, fontWeight: "600" },
  sousSection: {
    fontSize: typography.small,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  plusTexte: { fontSize: 22, lineHeight: 24, fontWeight: "500" },
  vide: {
    fontSize: typography.small,
    fontStyle: "italic",
    marginBottom: spacing.sm,
    lineHeight: 18,
  },

  carte: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  carteHaut: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icone: { fontSize: 28 },
  nom: { fontSize: typography.body, fontWeight: "600" },
  prix: { fontSize: typography.small, marginTop: 2 },
  offrir: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  offrirTexte: { fontSize: typography.small, fontWeight: "600" },
  barre: {
    height: 6,
    borderRadius: 3,
    flexDirection: "row",
    overflow: "hidden",
    marginTop: spacing.sm,
  },

  idees: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  idee: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  ideeTexte: { fontSize: typography.small, fontWeight: "500" },
  ideePrix: { fontSize: typography.tiny, marginTop: 2 },

  regles: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  reglesEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reglesTitre: { fontSize: typography.body, fontWeight: "600" },
  chevron: { fontSize: 20 },
  regle: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 6,
    marginTop: 4,
  },
  regleAction: { flex: 1, fontSize: typography.small },
  reglePoints: { fontSize: typography.small, fontWeight: "700" },
  reglesNote: {
    fontSize: typography.tiny,
    marginTop: spacing.md,
    lineHeight: 17,
  },

  achat: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  achatIcone: { fontSize: 18 },
  achatNom: { flex: 1, fontSize: typography.bodySmall },
  achatDate: { fontSize: typography.tiny },
  achatPrix: {
    fontSize: typography.small,
    fontWeight: "600",
    width: 44,
    textAlign: "right",
  },

  actions: { flexDirection: "row" },
  action: {
    justifyContent: "center",
    alignItems: "center",
    width: 86,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  actionTexte: { fontWeight: "600", fontSize: typography.small },

  bandeau: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  bandeauTexte: { fontSize: typography.bodySmall, fontWeight: "600" },

  fond: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  formCarte: { borderRadius: radius.lg, padding: spacing.xl },
  formTitre: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  icones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.md,
  },
  iconeChoix: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  champ: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  formLabel: {
    fontSize: typography.small,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  prixChoix: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  prixPastille: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  formAide: { fontSize: typography.tiny, marginTop: 6 },
  enregistrer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  enregistrerTexte: { fontSize: typography.body, fontWeight: "600" },
  annulerForm: { alignItems: "center", paddingTop: spacing.md },
  annulerFormTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
});
