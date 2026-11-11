import { useCleReset } from "../../lib/reset-onglet";
import { BoutonOptions } from "../../components/Options";
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
import { IconeRecompense } from "../../components/IconeRecompense";
import {
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
import {
  ICONES_RECOMPENSES,
  categorieRecompense,
  etatRecompense,
  parPrix,
  type CategorieRecompense,
} from "../../lib/recompenses-regles";
import { niveauDePoints, totalAffiche } from "../../lib/regles-taches";
import { FeuilleAjoutRecompense } from "../../components/FeuilleAjoutRecompense";
import { avecAlpha, radius, spacing, typography, useTheme } from "../../lib/theme";

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

type Formulaire = {
  id?: number;
  nom: string;
  icone: string;
  prix: string;
  categorie: CategorieRecompense;
};

function RecompensesContenu() {
  const t = useTheme();
  const aujourdhui = useJourCourant();

  const [solde, setSolde] = useState(0);
  const [total, setTotal] = useState(0);
  const [liste, setListe] = useState<Recompense[]>([]);
  const [achats, setAchats] = useState<Achat[]>([]);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [voirRegles, setVoirRegles] = useState(false);
  const [voirAchats, setVoirAchats] = useState(false);
  const [bravo, setBravo] = useState<string | null>(null);
  /** Feuille « + Ajouter » ouverte (la catégorie donnée ne sert qu'à l'ordre des idées dans la feuille). */
  const [ajoutDe, setAjoutDe] = useState<CategorieRecompense | null>(null);
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

  const onOffrir = (r: Recompense) => {
    if (solde < r.prix) {
      Alert.alert(
        "Pas encore",
        `Il te manque ${r.prix - solde} points pour « ${r.nom} ».`,
      );
      return;
    }
    Alert.alert(
      r.nom,
      `Dépenser ${r.prix} points ? Il t'en restera ${solde - r.prix}.`,
      [
        { text: "Pas maintenant", style: "cancel" },
        {
          text: "Je me l'offre",
          onPress: async () => {
            if (await acheter(r)) {
              setBravo(`🎉 Profite bien : ${r.nom.toLowerCase()} !`);
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

  const modifier = (r: Recompense) =>
    setFormulaire({
      id: r.id,
      nom: r.nom,
      icone: r.icone ?? "cadeau",
      prix: String(r.prix),
      categorie: categorieRecompense(r.categorie).cle,
    });

  /** Appui long sur une ligne : modifier ou supprimer. */
  const onOptions = (r: Recompense) => {
    Alert.alert(r.nom, undefined, [
      { text: "Modifier", onPress: () => modifier(r) },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimerRecompense(r.id);
          await charger();
        },
      },
      { text: "Fermer", style: "cancel" },
    ]);
  };

  const prixSaisi = formulaire ? parseInt(formulaire.prix, 10) : NaN;
  const formulaireValide =
    !!formulaire && formulaire.nom.trim().length > 0 && prixSaisi > 0;

  const enregistrer = async () => {
    if (!formulaire || !formulaireValide) return;
    const r = {
      nom: formulaire.nom,
      icone: formulaire.icone,
      prix: prixSaisi,
      categorie: formulaire.categorie,
    };
    if (formulaire.id) await modifierRecompense({ id: formulaire.id, ...r });
    else await ajouterRecompense(r);
    setFormulaire(null);
    await charger();
  };

  // La catégorie n'est plus affichée ni choisie : elle reste en base, gardée telle quelle à la modification.
  const couleurFormulaire = t.accent;

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: spacing.xxxl * 2 }}>
        {/* En-tête : le solde en pastille, et « ⓘ » pour le barème */}
        <View style={styles.entete}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Récompenses</Texte>
          <View style={styles.enteteDroite}>
            <View style={[styles.solde, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Texte style={[styles.soldeChiffre, { color: t.accent }]}>{solde}</Texte>
              <Texte style={[styles.soldeTexte, { color: t.textSecondary }]}>
                pts à dépenser
              </Texte>
            </View>
            <TouchableOpacity
              onPress={() => setVoirRegles(!voirRegles)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ expanded: voirRegles }}
              accessibilityLabel="Comment gagner des points"
            >
              <Texte style={[styles.info, { color: voirRegles ? t.accent : t.textMuted }]}>ⓘ</Texte>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl }}>
          {/* Le barème, ouvert par « ⓘ » */}
          {voirRegles && (
            <View style={[styles.repliable, { backgroundColor: t.bgCard, marginTop: 0, marginBottom: spacing.md }]}>
              <Texte style={[styles.repliableTitre, { color: t.textPrimary }]}>Comment gagner des points</Texte>
              <Texte style={[styles.note, { color: t.textSecondary }]}>
                Niveau {niveau} · {totalAffiche(total)} points gagnés au total
              </Texte>
              {REGLES_POINTS.map((r) => (
                <View key={r.action} style={styles.regle}>
                  <Texte style={[styles.regleAction, { color: t.textSecondary }]}>
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
            </View>
          )}

          <TouchableOpacity
            onPress={() => setAjoutDe("mer")}
            style={[styles.ajoutHaut, { borderColor: t.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une récompense"
          >
            <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>+ Ajouter</Texte>
          </TouchableOpacity>

          {/* Une seule liste, de la moins chère à la plus chère. La catégorie reste en base, sans être affichée. */}
          {liste.length === 0 && (
            <Texte style={[styles.note, { color: t.textMuted }]}>
              Pas encore de récompense. « + Ajouter » propose des idées toutes prêtes, ou crée la tienne.
            </Texte>
          )}
          {parPrix(liste).map((r) => {
            const { accessible, part } = etatRecompense(r.prix, solde);
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => onOffrir(r)}
                onLongPress={Platform.OS === "web" ? undefined : () => onOptions(r)}
                accessibilityHint="Appui long : modifier ou supprimer"
                accessibilityLabel={`${r.nom}, ${r.prix} points${accessible ? "" : ", pas encore"}`}
                style={[
                  styles.ligne,
                  accessible
                    ? { backgroundColor: avecAlpha(t.accent, 0.1), borderColor: t.accent }
                    : { backgroundColor: t.bgCard, borderColor: t.border, opacity: 0.7 },
                ]}
              >
                <IconeRecompense icone={r.icone} couleur={accessible ? t.accent : t.textSecondary} taille={24} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={2}>
                    {r.nom}
                  </Texte>
                  {!accessible && (
                    <View style={[styles.barre, { backgroundColor: t.bgApp }]}>
                      <View style={{ flex: part, backgroundColor: t.accent, borderRadius: 2 }} />
                      <View style={{ flex: 1 - part }} />
                    </View>
                  )}
                </View>
                <Texte style={[styles.prix, { color: accessible ? t.accent : t.textMuted }]}>{r.prix} pts</Texte>
                <BoutonOptions
                  titre={r.nom}
                  options={[
                    { libelle: "Modifier", onPress: () => modifier(r) },
                    {
                      libelle: "Supprimer",
                      danger: true,
                      onPress: async () => {
                        await supprimerRecompense(r.id);
                        await charger();
                      },
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}

          {/* Dernières récompenses */}
          {achats.length > 0 && (
            <TouchableOpacity
              style={[styles.repliable, { backgroundColor: t.bgCard }]}
              onPress={() => setVoirAchats(!voirAchats)}
              activeOpacity={0.8}
            >
              <View style={styles.repliableEntete}>
                <Texte style={[styles.repliableTitre, { color: t.textPrimary }]}>
                  Dernières récompenses
                </Texte>
                <Texte style={[styles.chevron, { color: t.textMuted }]}>
                  {voirAchats ? "−" : "+"}
                </Texte>
              </View>
              {voirAchats && (
                <>
                  {achats.some((a) => a.date === aujourdhui) && (
                    <Texte style={[styles.note, { color: t.textMuted }]}>
                      Achat par erreur ? Touche-le pour l&apos;annuler, le jour même.
                    </Texte>
                  )}
                  {achats.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      disabled={a.date !== aujourdhui}
                      onPress={() => onAnnulerAchat(a)}
                      style={[styles.achat, { borderBottomColor: t.border }]}
                    >
                      <IconeRecompense icone={a.icone} couleur={t.textSecondary} taille={18} />
                      <Texte style={[styles.achatNom, { color: t.textPrimary }]}>{a.nom}</Texte>
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
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>

      {bravo && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Texte style={[styles.bandeauTexte, { color: t.bgApp }]}>{bravo}</Texte>
        </View>
      )}

      {/* Créer / modifier une récompense */}
      <FeuilleAjoutRecompense
        categorie={ajoutDe}
        existantes={liste.map((r) => r.nom)}
        onCreer={(cat) => {
          setAjoutDe(null);
          // iOS n'ouvre pas une modale pendant qu'une autre se ferme.
          setTimeout(() => setFormulaire({ nom: "", icone: "cadeau", prix: "50", categorie: cat }), 350);
        }}
        onAjouter={async (i, cat) => {
          await ajouterRecompense({ nom: i.nom, icone: i.icone, prix: i.prix, categorie: cat });
          await charger();
        }}
        onFermer={() => setAjoutDe(null)}
      />

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
                    {ICONES_RECOMPENSES.map((i) => {
                      const actif = formulaire.icone === i;
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setFormulaire({ ...formulaire, icone: i })}
                          style={[
                            styles.iconeChoix,
                            {
                              backgroundColor: actif ? avecAlpha(couleurFormulaire, 0.15) : t.bgCard,
                              borderColor: actif ? couleurFormulaire : "transparent",
                            },
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: actif }}
                          accessibilityLabel={`Icône ${i}`}
                        >
                          <IconeRecompense
                            icone={i}
                            couleur={actif ? couleurFormulaire : t.textSecondary}
                            taille={20}
                          />
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
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  enteteDroite: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  info: { fontSize: 20, lineHeight: 24 },
  solde: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  soldeChiffre: { fontSize: 22, fontWeight: "700" },
  soldeTexte: { fontSize: typography.small, fontWeight: "600" },

  ajoutHaut: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nom: { fontSize: typography.bodySmall, fontWeight: "600" },
  prix: { fontSize: typography.small, fontWeight: "700" },
  barre: { height: 4, borderRadius: 2, flexDirection: "row", overflow: "hidden" },

  repliable: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  repliableEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  repliableTitre: { fontSize: typography.body, fontWeight: "600" },
  chevron: { fontSize: 20 },
  note: { fontSize: typography.small, marginTop: spacing.sm, lineHeight: 18 },
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
  achatNom: { flex: 1, fontSize: typography.bodySmall },
  achatDate: { fontSize: typography.tiny },
  achatPrix: {
    fontSize: typography.small,
    fontWeight: "600",
    width: 44,
    textAlign: "right",
  },

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

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à son accueil (voir lib/reset-onglet.ts). */
export default function Recompenses() {
  return <RecompensesContenu key={useCleReset("recompenses")} />;
}
