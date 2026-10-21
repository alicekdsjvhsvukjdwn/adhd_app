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
import { MenuOptions } from "../../components/MenuOptions";
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
  CATEGORIES_RECOMPENSES,
  ICONES_RECOMPENSES,
  categorieRecompense,
  etageres,
  etatRecompense,
  type CategorieRecompense,
} from "../../lib/recompenses-regles";
import { niveauDePoints, totalAffiche } from "../../lib/regles-taches";
import { ideesRestantes } from "../../lib/catalogue-recompenses";
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

export default function Recompenses() {
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
  /** Étagère dont le menu « Idées » est ouvert. */
  const [ideesDe, setIdeesDe] = useState<CategorieRecompense | null>(null);
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

  /** Appui long sur une carte : modifier ou supprimer (les étagères défilent, pas de glisser). */
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

  const couleurFormulaire = formulaire
    ? categorieRecompense(formulaire.categorie).couleur
    : t.accent;

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: spacing.xxxl * 2 }}>
        {/* En-tête : le solde en pastille */}
        <View style={styles.entete}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Récompenses</Texte>
          <View style={[styles.solde, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={[styles.soldeChiffre, { color: t.accent }]}>{solde}</Texte>
            <Texte style={[styles.soldeTexte, { color: t.textSecondary }]}>
              pts à dépenser
            </Texte>
          </View>
        </View>

        {/* Une étagère par catégorie */}
        {etageres().map((cle) => {
          const cat = categorieRecompense(cle);
          const dedans = liste.filter((r) => categorieRecompense(r.categorie).cle === cle);
          return (
            <View key={cle} style={styles.etagere}>
              <View style={styles.etagereTitre}>
                <View style={[styles.point, { backgroundColor: cat.couleur }]} />
                <Texte style={[styles.section, { color: t.textPrimary, flex: 1 }]}>{cat.nom}</Texte>
                {ideesRestantes(cle, dedans.map((r) => r.nom)).length > 0 && (
                  <TouchableOpacity
                    onPress={() => setIdeesDe(cle)}
                    hitSlop={8}
                    style={[styles.idees, { borderColor: cat.couleur }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Idées de récompenses : ${cat.nom}`}
                  >
                    <Texte style={{ color: cat.couleur, fontSize: typography.small, fontWeight: "600" }}>Idées</Texte>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rangee}
              >
                {dedans.map((r) => {
                  const { accessible, part } = etatRecompense(r.prix, solde);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => onOffrir(r)}
                      onLongPress={Platform.OS === "web" ? undefined : () => onOptions(r)}
                      accessibilityHint="Appui long : modifier ou supprimer"
                      accessibilityLabel={`${r.nom}, ${r.prix} points${accessible ? "" : ", pas encore"}`}
                      style={[
                        styles.carte,
                        accessible
                          ? { backgroundColor: avecAlpha(cat.couleur, 0.12), borderColor: cat.couleur }
                          : { backgroundColor: t.bgCard, borderColor: t.border, opacity: 0.7 },
                      ]}
                    >
                      <BoutonOptions
                        titre={r.nom}
                        style={styles.options}
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
                      <IconeRecompense icone={r.icone} couleur={cat.couleur} taille={26} />
                      <Texte
                        style={[styles.nom, { color: t.textPrimary }]}
                        numberOfLines={2}
                      >
                        {r.nom}
                      </Texte>
                      {accessible ? (
                        <Texte style={[styles.prix, { color: cat.couleur }]}>{r.prix} pts</Texte>
                      ) : (
                        <View style={[styles.barre, { backgroundColor: t.bgApp }]}>
                          <View style={{ flex: part, backgroundColor: cat.couleur, borderRadius: 2 }} />
                          <View style={{ flex: 1 - part }} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() =>
                    setFormulaire({ nom: "", icone: "cadeau", prix: "50", categorie: cle })
                  }
                  style={[styles.carte, styles.ajouter, { borderColor: t.border }]}
                  accessibilityLabel={`Ajouter une récompense dans ${cat.nom}`}
                >
                  <Texte style={[styles.ajouterTexte, { color: t.textMuted }]}>+ Ajouter</Texte>
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })}

        <View style={{ paddingHorizontal: spacing.xl }}>
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

          {/* Comment gagner des points */}
          <TouchableOpacity
            style={[styles.repliable, { backgroundColor: t.bgCard }]}
            onPress={() => setVoirRegles(!voirRegles)}
            activeOpacity={0.8}
          >
            <View style={styles.repliableEntete}>
              <Texte style={[styles.repliableTitre, { color: t.textPrimary }]}>
                Comment gagner des points
              </Texte>
              <Texte style={[styles.chevron, { color: t.textMuted }]}>
                {voirRegles ? "−" : "+"}
              </Texte>
            </View>
            {voirRegles && (
              <>
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
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {bravo && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Texte style={[styles.bandeauTexte, { color: t.bgApp }]}>{bravo}</Texte>
        </View>
      )}

      {/* Créer / modifier une récompense */}
      <MenuOptions
        titre={ideesDe ? `Idées · ${categorieRecompense(ideesDe).nom}` : ""}
        options={
          ideesDe
            ? ideesRestantes(ideesDe, liste.map((r) => r.nom)).map((i) => ({
                libelle: `${i.nom} · ${i.prix} pts`,
                onPress: async () => {
                  await ajouterRecompense({ nom: i.nom, icone: i.icone, prix: i.prix, categorie: ideesDe });
                  await charger();
                },
              }))
            : []
        }
        onFermer={() => setIdeesDe(null)}
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

                  <View style={styles.categories}>
                    {CATEGORIES_RECOMPENSES.map((c) => {
                      const actif = formulaire.categorie === c.cle;
                      return (
                        <TouchableOpacity
                          key={c.cle}
                          onPress={() => setFormulaire({ ...formulaire, categorie: c.cle })}
                          style={[
                            styles.prixPastille,
                            {
                              backgroundColor: actif ? avecAlpha(c.couleur, 0.15) : t.bgCard,
                              borderColor: actif ? c.couleur : t.border,
                            },
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: actif }}
                        >
                          <Texte
                            style={{
                              color: actif ? c.couleur : t.textSecondary,
                              fontSize: typography.small,
                              fontWeight: "600",
                            }}
                          >
                            {c.nom}
                          </Texte>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

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
  options: { position: "absolute", top: 0, right: 0, zIndex: 1 },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  titre: { fontSize: typography.h1, fontWeight: "600" },
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

  etagere: { marginBottom: spacing.lg },
  idees: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  etagereTitre: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  point: { width: 8, height: 8, borderRadius: 4 },
  section: { fontSize: typography.body, fontWeight: "600" },
  rangee: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  carte: {
    width: 118,
    height: 104,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  nom: { fontSize: typography.small, fontWeight: "600", lineHeight: 16 },
  prix: { fontSize: typography.small, fontWeight: "700" },
  barre: { height: 4, borderRadius: 2, flexDirection: "row", overflow: "hidden" },
  ajouter: { borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  ajouterTexte: { fontSize: typography.small, fontWeight: "600" },

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
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
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
