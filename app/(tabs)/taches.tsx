import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
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
import { BarresObjectif } from "../../components/BarresObjectif";
import { JOURS_LONGS, MOIS } from "../../components/CalendrierMois";
import { PlusMoins } from "../../components/PlusMoins";
import { ZoneNote } from "../../components/ZoneNote";
import { useJourCourant } from "../../hooks/useJourCourant";
import { deviner } from "../../lib/catalogue";
import {
  addItem,
  annulerCompletion,
  completer,
  confirmationSuppression,
  deleteItem,
} from "../../lib/db";
import {
  cocherEtape,
  decocherEtape,
  getEtapesPour,
  type Etape,
} from "../../lib/db/etapes";
import { estJourDifficile } from "../../lib/db/jour-difficile";
import {
  ajouterListe,
  compterTaches,
  getListes,
  listeDeRepli,
  modifierListe,
  supprimerListe,
  type Liste,
  definirObjectif,
  suiviObjectif,
  type SuiviObjectif,
} from "../../lib/db/listes";
import { getAujourdhui } from "../../lib/db/completions";
import {
  libelleCompte,
  libelleEcheance,
  pointsEcheance,
  POINTS_DERNIERE_ETAPE,
  POINTS_ETAPE,
  semaineDe,
  type Periode,
} from "../../lib/regles-taches";
import { genererPropositions, type Proposition } from "../../lib/db/moteur";
import { ordreJourDifficile } from "../../lib/moteur-regles";
import { avecAlpha, melanger, radius, spacing, typography, useTheme } from "../../lib/theme";
import { CLES_COULEURS, useCouleurListe } from "../../lib/theme-listes";

type Annulable =
  | { type: "tache"; id: number; texte: string }
  | { type: "etape"; etapeId: number; texte: string };

export default function Taches() {
  const router = useRouter();
  const t = useTheme();
  // Passage de minuit appli ouverte : le classement se refait pour le nouveau jour.
  const jour = useJourCourant();

  const [classement, setClassement] = useState<Proposition[]>([]);
  const [etapes, setEtapes] = useState<Record<number, Etape[]>>({});
  const [jourDifficile, setJourDifficile] = useState(false);
  // « Une autre » : rang dans l'ordre du jour difficile. Rien n'est enregistré.
  const [rangUneAutre, setRangUneAutre] = useState(0);
  const [listes, setListes] = useState<Liste[]>([]);
  /** null = toutes les listes */
  const [filtre, setFiltre] = useState<number | null>(null);
  const [gestion, setGestion] = useState(false);
  const [noms, setNoms] = useState<Record<number, string>>({});
  const [icones, setIcones] = useState<Record<number, string>>({});
  const [nouvelleListe, setNouvelleListe] = useState("");
  // Carnet : zone de note ouverte après avoir coché une tâche.
  const [noteOuverte, setNoteOuverte] = useState<{
    itemId: number;
    nom: string;
    date: string;
  } | null>(null);
  // Objectif de la liste affichée
  const [suivi, setSuivi] = useState<SuiviObjectif | null>(null);
  const [editionObjectif, setEditionObjectif] = useState<{
    cible: number;
    periode: Periode;
  } | null>(null);

  const [nouvelleTache, setNouvelleTache] = useState("");
  const [tacheNotee, setTacheNotee] = useState<string | null>(null);
  const [annulable, setAnnulable] = useState<Annulable | null>(null);
  /** Jour de la bande de la semaine choisi ; null = aujourd'hui (« Mes 3 »). */
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  /** Feuille du bouton « + ». */
  const [feuille, setFeuille] = useState(false);
  // iOS n'ouvre pas une modale pendant qu'une autre se ferme : la gestion des listes attend.
  const gestionApres = useRef(false);
  /** Objectif de chaque liste qui en a un : où en est la période en cours. */
  const [objectifs, setObjectifs] = useState<Record<number, { fait: number; cible: number }>>({});
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
    // Le mode du jour d'abord : il est lu en une requête, alors que le
    // classement (négligence, score, journal) prend du temps. En revenant
    // sur l'onglet après avoir changé l'énergie, la bonne vue s'applique tout de suite.
    setJourDifficile(await estJourDifficile());
    setRangUneAutre(0);
    const toutes = await genererPropositions();
    setClassement(toutes);
    setEtapes(await getEtapesPour(toutes.map((p) => p.itemId)));
    const l = await getListes();
    setListes(l);
    setNoms(Object.fromEntries(l.map((x) => [x.id, x.nom])));
    setIcones(Object.fromEntries(l.map((x) => [x.id, x.icone ?? ""])));
    setFiltre((f) => (f !== null && !l.some((x) => x.id === f) ? null : f));
    const suivis = await Promise.all(l.map((x) => suiviObjectif(x)));
    setObjectifs(
      Object.fromEntries(
        l.flatMap((x, i) => {
          const s = suivis[i];
          return s ? [[x.id, { fait: s.periodes[s.periodes.length - 1].fait, cible: s.cible }]] : [];
        }),
      ),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger, jour]),
  );

  const proposerAnnulation = (a: Annulable) => {
    if (minuteurAnnuler.current) clearTimeout(minuteurAnnuler.current);
    setAnnulable(a);
    minuteurAnnuler.current = setTimeout(() => setAnnulable(null), 6000);
  };

  const onNoter = async () => {
    const nom = nouvelleTache.trim();
    if (!nom) return;
    setNoteOuverte(null);
    await addItem({
      nom,
      type: "tache",
      categorie: deviner(nom)?.categorie ?? null,
      liste_id: filtre ?? listes[0]?.id ?? null,
    });
    setNouvelleTache("");
    Keyboard.dismiss();
    setFeuille(false);
    setTacheNotee(nom);
    if (minuteurNotee.current) clearTimeout(minuteurNotee.current);
    minuteurNotee.current = setTimeout(() => setTacheNotee(null), 4000);
    await charger();
  };

  const onTerminer = async (p: Proposition) => {
    await completer(p.itemId, "complet");
    proposerAnnulation({ type: "tache", id: p.itemId, texte: `✓ ${p.nom}` });
    setNoteOuverte({ itemId: p.itemId, nom: p.nom, date: getAujourdhui() });
    await charger();
  };

  const onEtape = async (p: Proposition, e: Etape) => {
    setNoteOuverte(null);
    if (e.faite === 1) {
      await decocherEtape(e.id);
    } else {
      const derniere = await cocherEtape(e.id);
      if (derniere) setNoteOuverte({ itemId: p.itemId, nom: p.nom, date: getAujourdhui() });
      proposerAnnulation({
        type: "etape",
        etapeId: e.id,
        texte: derniere
          ? `✓ « ${p.nom} » terminée · +${POINTS_DERNIERE_ETAPE} pts`
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
    setNoteOuverte(null);
    if (a.type === "tache") await annulerCompletion(a.id);
    else await decocherEtape(a.etapeId);
    await charger();
  };

  const onSupprimer = (p: Proposition) => {
    const { titre, message } = confirmationSuppression("tache", p.nom);
    Alert.alert(titre, message, [
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

  const historique = (p: Proposition) => router.push(`/historique?id=${p.itemId}`);

  const actions = (p: Proposition) => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.textMuted }]}
        onPress={() => historique(p)}
      >
        <Texte style={[styles.actionTexte, { color: t.textOnAccent }]}>Historique</Texte>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.accentText }]}
        onPress={() => router.push(`/nouvelle-tache?id=${p.itemId}`)}
      >
        <Texte style={[styles.actionTexte, { color: t.textOnAccent }]}>Modifier</Texte>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.danger }]}
        onPress={() => onSupprimer(p)}
      >
        <Texte style={[styles.actionTexte, { color: t.textOnAccent }]}>Supprimer</Texte>
      </TouchableOpacity>
    </View>
  );

  const couleurListe = useCouleurListe();
  const listeActive = listes.find((l) => l.id === filtre) ?? null;
  /** Liseré de la carte : la couleur de sa liste. */
  const bordure = (p: Proposition) =>
    couleurListe(listes.find((l) => l.id === p.liste_id)?.couleur ?? null).fond;
  /** Icône de la liste devant le titre, en vue « Toutes » (dans une liste, elle est déjà en titre). */
  const icone = (p: Proposition) => {
    const l = listes.find((x) => x.id === p.liste_id);
    return filtre === null && l?.icone ? `${l.icone} ` : "";
  };
  const nomListe = (id: number | null) => listes.find((l) => l.id === id);

  // Objectif de la liste affichée, recalculé quand on coche.
  useEffect(() => {
    let actif = true;
    setEditionObjectif(null);
    if (!listeActive) {
      setSuivi(null);
      return;
    }
    suiviObjectif(listeActive).then((s) => {
      if (actif) setSuivi(s);
    });
    return () => {
      actif = false;
    };
  }, [listeActive, classement]);

  const zoneNote = noteOuverte && (
    <ZoneNote
      key={`${noteOuverte.itemId}-${noteOuverte.date}`}
      itemId={noteOuverte.itemId}
      date={noteOuverte.date}
      titre={`✓ ${noteOuverte.nom} · une note ? (facultatif)`}
      onFerme={() => setNoteOuverte(null)}
    />
  );

  const enregistrerObjectif = async (cible: number | null, periode: Periode) => {
    if (!listeActive) return;
    await definirObjectif(listeActive.id, cible, periode);
    await charger();
  };

  /** Bouton discret : sur la première carte, ou la carte unique d'un jour difficile. */
  const boutonJeCommence = (p: Proposition) => {
    const prochaine = (etapes[p.itemId] ?? []).find((e) => e.faite === 0);
    return (
      <TouchableOpacity
        style={[styles.jeCommence, { borderColor: t.border }]}
        onPress={() =>
          router.push(
            prochaine
              ? `/je-commence?id=${p.itemId}&etape=${prochaine.id}`
              : `/je-commence?id=${p.itemId}`,
          )
        }
        hitSlop={6}
      >
        <Texte style={[styles.jeCommenceTexte, { color: t.accentText }]}>
          ▶ Je commence
        </Texte>
      </TouchableOpacity>
    );
  };

  const carte = (p: Proposition, rang: number) => {
          const liste = etapes[p.itemId] ?? [];
          const faites = liste.filter((e) => e.faite === 1).length;
          const suivante = liste.find((e) => e.faite === 0);
          return (
            <Swipeable key={p.itemId} renderRightActions={() => actions(p)}>
              <View
                style={[
                  styles.carte,
                  styles.carteListe,
                  { backgroundColor: t.bgCard, borderLeftColor: bordure(p) },
                ]}
              >
                <View style={styles.carteEntete}>
                  <View style={[styles.raison, { backgroundColor: t.bgHighlight }]}>
                    <Texte style={[styles.raisonTexte, { color: t.accentText }]}>
                      {p.exploration ? "🔄 " : ""}
                      {p.raison}
                    </Texte>
                  </View>
                  <Texte style={[styles.duree, { color: t.textMuted }]}>
                    {filtre === null && nomListe(p.liste_id)
                      ? `${nomListe(p.liste_id)!.icone ?? ""} ${nomListe(p.liste_id)!.nom}`
                      : ""}
                    {p.duree_min ? `${filtre === null && nomListe(p.liste_id) ? " · " : ""}${p.duree_min} min` : ""}
                  </Texte>
                </View>
                {p.compte && (
                  <Texte style={[styles.compte, { color: t.accentText }]}>
                    {libelleCompte(p.compte.fait, p.compte.cible, p.compte.periode)}
                  </Texte>
                )}

                {liste.length === 0 ? (
                  <>
                    <TouchableOpacity
                      onPress={() => onTerminer(p)}
                      onLongPress={() => historique(p)}
                      accessibilityHint="Appui long : historique"
                    >
                      <Texte style={[styles.nom, { color: t.textPrimary }]}>○ {icone(p)}{p.nom}</Texte>
                      {p.premiere_action ? (
                        <Texte style={[styles.premiere, { color: t.textSecondary }]}>
                          Commencer par : {p.premiere_action}
                        </Texte>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push(`/nouvelle-tache?id=${p.itemId}`)}
                      hitSlop={8}
                    >
                      <Texte style={[styles.decouper, { color: t.accentText }]}>
                        Découper en étapes
                      </Texte>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onLongPress={() => historique(p)}
                      accessibilityHint="Appui long : historique"
                    >
                      <Texte style={[styles.nom, { color: t.textPrimary }]}>{icone(p)}{p.nom}</Texte>
                    </TouchableOpacity>
                    <View style={styles.progressionLigne}>
                      <View style={[styles.barre, { backgroundColor: t.bgApp }]}>
                        <View
                          style={{
                            flex: faites,
                            backgroundColor: t.success,
                            borderRadius: 4,
                          }}
                        />
                        <View style={{ flex: liste.length - faites }} />
                      </View>
                      <Texte style={[styles.progressionTexte, { color: t.textMuted }]}>
                        {faites}/{liste.length}
                      </Texte>
                    </View>
                    {liste.map((e) => {
                      const estSuivante = suivante?.id === e.id;
                      return (
                        <TouchableOpacity
                          key={e.id}
                          style={styles.etape}
                          onPress={() => onEtape(p, e)}
                        >
                          <Texte
                            style={[
                              styles.etapeCase,
                              { color: e.faite ? t.success : t.textMuted },
                            ]}
                          >
                            {e.faite ? "✓" : "○"}
                          </Texte>
                          <Texte
                            style={[
                              styles.etapeNom,
                              {
                                color: e.faite
                                  ? t.textMuted
                                  : estSuivante
                                    ? t.textPrimary
                                    : t.textSecondary,
                                fontWeight: estSuivante ? "600" : "400",
                                textDecorationLine: e.faite ? "line-through" : "none",
                              },
                            ]}
                          >
                            {e.nom}
                          </Texte>
                        </TouchableOpacity>
                      );
                    })}
                    <Texte style={[styles.bonus, { color: t.textMuted }]}>
                      +{POINTS_ETAPE} pts par étape, +{POINTS_DERNIERE_ETAPE} pour la dernière
                      {p.compte ? " · remises à zéro après chaque fois" : ""}
                    </Texte>
                  </>
                )}
                {rang === 0 && boutonJeCommence(p)}
              </View>
            </Swipeable>
          );
          };

  const couleurDe = (id: number | null) =>
    couleurListe(listes.find((l) => l.id === id)?.couleur ?? null).fond;

  /**
   * « Mes 3 » : grande carte, numéro et cercle de la couleur de la liste.
   * Tâche à étapes : barre segmentée, le cercle coche la prochaine étape.
   * rang null : sans numéro (tâches d'un autre jour de la semaine).
   */
  const carteGrande = (p: Proposition, rang: number | null) => {
    const liste = etapes[p.itemId] ?? [];
    const suivante = liste.find((e) => e.faite === 0);
    const couleur = couleurDe(p.liste_id);
    const raison =
      p.raison === "Échéance proche" && p.echeance
        ? libelleEcheance(p.echeance, jour)
        : p.raison.charAt(0).toLowerCase() + p.raison.slice(1);
    const ligne = [
      nomListe(p.liste_id)?.nom,
      raison,
      p.compte ? libelleCompte(p.compte.fait, p.compte.cible, p.compte.periode) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <Swipeable key={p.itemId} renderRightActions={() => actions(p)}>
        <View style={[styles.grande, { backgroundColor: t.bgCard }]}>
          <View style={styles.grandeLigne}>
            {rang !== null && (
              <Texte style={[styles.numero, { color: couleur }]}>{rang + 1}</Texte>
            )}
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => router.push(`/nouvelle-tache?id=${p.itemId}`)}
              onLongPress={() => historique(p)}
              accessibilityHint="Toucher : modifier · appui long : historique"
            >
              <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={2}>
                {p.nom}
              </Texte>
              {liste.length > 0 && (
                <>
                  <View style={styles.segments}>
                    {liste.map((e) => (
                      <View
                        key={e.id}
                        style={[
                          styles.segment,
                          { backgroundColor: e.faite ? couleur : avecAlpha(couleur, 0.2) },
                        ]}
                      />
                    ))}
                  </View>
                  {suivante && (
                    <Texte style={[styles.raisonLigne, { color: t.textSecondary }]} numberOfLines={1}>
                      Ensuite : {suivante.nom}
                    </Texte>
                  )}
                </>
              )}
              <Texte style={[styles.raisonLigne, { color: t.textMuted }]} numberOfLines={1}>
                {p.exploration ? "🔄 " : ""}
                {ligne}
              </Texte>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => (suivante ? onEtape(p, suivante) : onTerminer(p))}
              hitSlop={10}
              style={[styles.cercle, { borderColor: couleur }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel={suivante ? `Cocher l'étape ${suivante.nom}` : `Cocher ${p.nom}`}
            />
          </View>
          {rang === 0 && boutonJeCommence(p)}
        </View>
      </Swipeable>
    );
  };

  // Jour difficile : une seule tâche (voir ordreJourDifficile), le reste attend.
  const ordre = jourDifficile
    ? ordreJourDifficile(classement, (id) =>
        (etapes[id] ?? []).some((e) => e.faite === 0),
      )
    : [];
  const unique = ordre.length > 0 ? ordre[rangUneAutre % ordre.length] : null;
  const maintenant = jourDifficile ? [] : classement.filter((p) => p.propose);
  const dansListe = filtre === null ? [] : classement.filter((p) => p.liste_id === filtre);

  const semaine = semaineDe(jour);
  const points = pointsEcheance(
    classement.map((p) => ({ echeance: p.echeance, couleur: couleurDe(p.liste_id) })),
    semaine,
  );
  const duJour = jourChoisi ? classement.filter((p) => p.echeance === jourChoisi) : [];
  const dateDe = (iso: string) => new Date(iso + "T00:00:00Z");
  const aujourdhuiDate = dateDe(jour);

  const boutonPlus = (
    <TouchableOpacity
      onPress={() => setFeuille(true)}
      style={[styles.plus, { backgroundColor: t.accent }]}
      accessibilityLabel="Ajouter une tâche"
    >
      <Texte style={[styles.plusTexte, { color: t.textOnAccent }]}>+</Texte>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}
      >
        {filtre !== null ? (
          <>
            <View style={styles.entete}>
              <TouchableOpacity
                onPress={() => {
                  setNoteOuverte(null);
                  setFiltre(null);
                }}
                hitSlop={12}
              >
                <Texte style={[styles.lien, { color: t.accentText }]}>‹ Tâches</Texte>
              </TouchableOpacity>
              {boutonPlus}
            </View>
            <Texte style={[styles.section, { color: t.textPrimary }]}>
              {listeActive?.icone ? `${listeActive.icone} ` : ""}
              {listeActive?.nom}
            </Texte>
            {suivi && (
              <BarresObjectif suivi={suivi} couleur={couleurListe(listeActive?.couleur ?? null).fond} />
            )}
            <View style={styles.liensListe}>
              <TouchableOpacity
                onPress={() =>
                  setEditionObjectif(
                    editionObjectif
                      ? null
                      : {
                          cible: listeActive?.objectif ?? 3,
                          periode: listeActive?.objectif_periode ?? "semaine",
                        },
                  )
                }
                hitSlop={8}
              >
                <Texte style={[styles.lien, { color: t.accentText }]}>
                  🎯 {listeActive?.objectif ? "Changer l'objectif" : "Fixer un objectif"}
                </Texte>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => listeActive && router.push(`/historique?liste=${listeActive.id}`)}
                hitSlop={8}
              >
                <Texte style={[styles.lien, { color: t.accentText }]}>📓 Carnet</Texte>
              </TouchableOpacity>
            </View>
            {editionObjectif && (
              <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
                <Texte style={[styles.premiere, { color: t.textSecondary, marginTop: 0 }]}>
                  Tâches à faire dans cette liste
                </Texte>
                <View style={styles.objectifLigne}>
                  <PlusMoins
                    valeur={String(editionObjectif.cible)}
                    libelle="Objectif"
                    onPas={(sens) =>
                      setEditionObjectif((o) => o && { ...o, cible: Math.max(1, o.cible + sens) })
                    }
                  />
                  {(["semaine", "mois"] as Periode[]).map((per) => (
                    <TouchableOpacity
                      key={per}
                      onPress={() => setEditionObjectif({ ...editionObjectif, periode: per })}
                      style={[
                        styles.filtre,
                        {
                          backgroundColor: editionObjectif.periode === per ? t.accent : t.bgApp,
                          borderColor: editionObjectif.periode === per ? t.accent : t.border,
                        },
                      ]}
                    >
                      <Texte
                        style={[
                          styles.filtreTexte,
                          { color: editionObjectif.periode === per ? t.textOnAccent : t.textSecondary },
                        ]}
                      >
                        par {per}
                      </Texte>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.liensListe}>
                  {listeActive?.objectif ? (
                    <TouchableOpacity onPress={() => enregistrerObjectif(null, "semaine")} hitSlop={8}>
                      <Texte style={[styles.lien, { color: t.danger }]}>Retirer l&apos;objectif</Texte>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}
                  <TouchableOpacity
                    onPress={() => enregistrerObjectif(editionObjectif.cible, editionObjectif.periode)}
                    hitSlop={8}
                  >
                    <Texte style={[styles.lien, { color: t.accentText }]}>Enregistrer</Texte>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {zoneNote}
            {dansListe.length === 0 ? (
              <Texte style={[styles.vide, { color: t.textMuted }]}>
                Rien dans cette liste pour l&apos;instant.
              </Texte>
            ) : (
              <Texte style={[styles.vide, { color: t.textMuted, fontStyle: "normal" }]}>
                Dans l&apos;ordre où l&apos;appli te les conseille.
              </Texte>
            )}
            {dansListe.map(carte)}
          </>
        ) : (
          <>
            {/* En-tête : le jour, la date, « + » */}
            <View style={styles.entete}>
              <View>
                <Texte style={[styles.jourSemaine, { color: t.accent }]}>
                  {JOURS_LONGS[aujourdhuiDate.getUTCDay()].toUpperCase()}
                </Texte>
                <Texte style={[styles.date, { color: t.textPrimary }]}>
                  {aujourdhuiDate.getUTCDate()} {MOIS[aujourdhuiDate.getUTCMonth()]}
                </Texte>
              </View>
              {boutonPlus}
            </View>
            {tacheNotee && (
              <Texte style={[styles.confirmation, { color: t.textSecondary }]}>
                ✓ « {tacheNotee} » est notée{listes[0] ? ` dans ${listes[0].nom}` : ""}.
              </Texte>
            )}

            {/* La semaine : points des échéances */}
            <View style={styles.semaine}>
              {semaine.map((d) => {
                const estAujourdhui = d === jour;
                const choisi = d === jourChoisi;
                const date = dateDe(d);
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setJourChoisi(estAujourdhui || choisi ? null : d)}
                    style={[
                      styles.jour,
                      estAujourdhui
                        ? { backgroundColor: t.accent, borderColor: t.accent }
                        : { backgroundColor: t.bgCard, borderColor: choisi ? t.accent : t.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: choisi || (estAujourdhui && !jourChoisi) }}
                    accessibilityLabel={`${JOURS_LONGS[date.getUTCDay()]} ${date.getUTCDate()}, ${points[d].length} échéance${points[d].length > 1 ? "s" : ""}`}
                  >
                    <Texte
                      style={[
                        styles.jourNom,
                        { color: estAujourdhui ? t.textOnAccent : t.textMuted },
                      ]}
                    >
                      {JOURS_LONGS[date.getUTCDay()].slice(0, 3)}
                    </Texte>
                    <Texte
                      style={[
                        styles.jourNumero,
                        { color: estAujourdhui ? t.textOnAccent : t.textPrimary },
                      ]}
                    >
                      {date.getUTCDate()}
                    </Texte>
                    <View style={styles.jourPoints}>
                      {points[d].slice(0, 4).map((c, i) => (
                        <View
                          key={i}
                          style={[
                            styles.jourPoint,
                            { backgroundColor: c, borderColor: estAujourdhui ? t.textOnAccent : c },
                          ]}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {zoneNote}

            {jourChoisi ? (
              <>
                <Texte style={[styles.surtitre, { color: t.textMuted }]}>
                  ÉCHÉANCE {JOURS_LONGS[dateDe(jourChoisi).getUTCDay()].toUpperCase()}{" "}
                  {dateDe(jourChoisi).getUTCDate()}
                </Texte>
                {duJour.length === 0 && (
                  <Texte style={[styles.vide, { color: t.textMuted }]}>
                    Aucune tâche à rendre ce jour-là.
                  </Texte>
                )}
                {duJour.map((p) => carteGrande(p, null))}
              </>
            ) : (
              <>
                <Texte style={[styles.surtitre, { color: t.textMuted }]}>
                  {jourDifficile ? "UNE SEULE CHOSE" : "MES 3 POUR AUJOURD'HUI"}
                </Texte>
                {jourDifficile && unique && (
                  <>
                    <Texte style={[styles.vide, { color: t.textMuted }]}>
                      Jour difficile : le reste attend.
                    </Texte>
                    {carteGrande(unique, 0)}
                    {ordre.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setRangUneAutre(rangUneAutre + 1)}
                        hitSlop={8}
                        style={styles.uneAutre}
                      >
                        <Texte style={[styles.lien, { color: t.accentText }]}>Une autre</Texte>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {(jourDifficile ? !unique : maintenant.length === 0) && (
                  <Texte style={[styles.vide, { color: t.textMuted }]}>
                    Aucune tâche en cours.
                  </Texte>
                )}
                {maintenant.map((p, i) => carteGrande(p, i))}
              </>
            )}

            {/* Par liste */}
            <Texte style={[styles.surtitre, { color: t.textMuted }]}>PAR LISTE</Texte>
            <View style={styles.grille}>
              {listes.map((l) => {
                const c = couleurListe(l.couleur).fond;
                const actives = classement.filter((p) => p.liste_id === l.id);
                const objectif = objectifs[l.id];
                return (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => {
                      setNoteOuverte(null);
                      setFiltre(l.id);
                    }}
                    style={[
                      styles.tuile,
                      { backgroundColor: avecAlpha(c, 0.08), borderColor: melanger(c, "#000000", 0.55) },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.nom}, ${actives.length} tâche${actives.length > 1 ? "s" : ""}`}
                  >
                    <Texte style={[styles.tuileNom, { color: c }]} numberOfLines={1}>
                      {l.nom}
                    </Texte>
                    <View style={styles.tuilePoints}>
                      {actives.slice(0, 5).map((p) => (
                        <View key={p.itemId} style={[styles.tuilePoint, { backgroundColor: c }]} />
                      ))}
                    </View>
                    <Texte style={[styles.tuileEnsuite, { color: t.textSecondary }]} numberOfLines={2}>
                      {actives[0] ? `Ensuite : ${actives[0].nom}` : "Rien à faire"}
                    </Texte>
                    {objectif && (
                      <View style={[styles.tuileBarre, { backgroundColor: avecAlpha(c, 0.2) }]}>
                        <View
                          style={{
                            width: `${Math.min(100, (objectif.fait / objectif.cible) * 100)}%`,
                            height: "100%",
                            backgroundColor: c,
                          }}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => setGestion(true)}
                style={[styles.tuile, styles.tuileNouvelle, { borderColor: t.border }]}
                accessibilityRole="button"
              >
                <Texte style={[styles.lien, { color: t.textMuted }]}>+ Nouvelle liste</Texte>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bouton « + » : noter vite, tâche complète, listes */}
      <Modal
        visible={feuille}
        transparent
        animationType="slide"
        onRequestClose={() => setFeuille(false)}
        onDismiss={() => {
          if (!gestionApres.current) return;
          gestionApres.current = false;
          setGestion(true);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.fondBas} onPress={() => setFeuille(false)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Texte style={[styles.gestionTitre, { color: t.textPrimary }]}>
                {listeActive ? `Ajouter dans ${listeActive.nom}` : "Ajouter"}
              </Texte>
              <View style={styles.ajout}>
                <ChampTexte
                  style={[
                    styles.champ,
                    { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary },
                  ]}
                  placeholder={listeActive ? `Une tâche pour ${listeActive.nom}` : "Une tâche à noter"}
                  placeholderTextColor={t.textMuted}
                  value={nouvelleTache}
                  onChangeText={setNouvelleTache}
                  onSubmitEditing={onNoter}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.boutonNoter, { backgroundColor: t.accent }]}
                  onPress={onNoter}
                >
                  <Texte style={[styles.boutonNoterTexte, { color: t.textOnAccent }]}>Noter</Texte>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.feuilleLigne, { borderTopColor: t.border }]}
                onPress={() => {
                  const n = nouvelleTache.trim();
                  setNouvelleTache("");
                  setFeuille(false);
                  const params = [
                    n ? `nom=${encodeURIComponent(n)}` : null,
                    filtre !== null ? `liste=${filtre}` : null,
                  ].filter(Boolean);
                  router.push(
                    params.length ? `/nouvelle-tache?${params.join("&")}` : "/nouvelle-tache",
                  );
                }}
              >
                <Texte style={[styles.feuilleTexte, { color: t.textPrimary }]}>
                  Nouvelle tâche complète
                </Texte>
                <Texte style={[styles.feuilleAide, { color: t.textMuted }]}>
                  étapes, échéance, moment…
                </Texte>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feuilleLigne, { borderTopColor: t.border }]}
                onPress={() => {
                  setFeuille(false);
                  if (Platform.OS === "ios") gestionApres.current = true;
                  else setGestion(true);
                }}
              >
                <Texte style={[styles.feuilleTexte, { color: t.textPrimary }]}>Gérer mes listes</Texte>
                <Texte style={[styles.feuilleAide, { color: t.textMuted }]}>
                  noms, icônes, couleurs
                </Texte>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={gestion}
        transparent
        animationType="fade"
        onRequestClose={() => setGestion(false)}
      >
        <Pressable style={styles.fond} onPress={() => setGestion(false)}>
          <Pressable style={[styles.gestion, { backgroundColor: t.bgCard, borderColor: t.border, borderWidth: 1 }]}>
            <Texte style={[styles.gestionTitre, { color: t.textPrimary }]}>Mes listes</Texte>
            {listes.map((l) => (
              <View key={l.id} style={styles.gestionBloc}>
              <View style={styles.gestionLigne}>
                <ChampTexte
                  style={[
                    styles.gestionIcone,
                    { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary },
                  ]}
                  value={icones[l.id] ?? ""}
                  onChangeText={(v) => setIcones({ ...icones, [l.id]: v })}
                  onEndEditing={async () => {
                    const v = (icones[l.id] ?? "").trim();
                    if (v !== (l.icone ?? "")) await modifierListe(l.id, l.nom, v || null, l.couleur);
                    await charger();
                  }}
                  placeholder="•"
                  placeholderTextColor={t.textMuted}
                  maxLength={8}
                  accessibilityLabel={`Icône de ${l.nom}`}
                />
                <ChampTexte
                  style={[
                    styles.gestionChamp,
                    { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary },
                  ]}
                  value={noms[l.id] ?? l.nom}
                  onChangeText={(v) => setNoms({ ...noms, [l.id]: v })}
                  onEndEditing={async () => {
                    const v = (noms[l.id] ?? "").trim();
                    if (v && v !== l.nom) await modifierListe(l.id, v, l.icone, l.couleur);
                    await charger();
                  }}
                />
                <TouchableOpacity
                  hitSlop={10}
                  onPress={async () => {
                    if (listes.length <= 1) {
                      Alert.alert("Il faut garder au moins une liste.");
                      return;
                    }
                    const n = await compterTaches(l.id);
                    const repli = await listeDeRepli(l.id);
                    Alert.alert(
                      `Supprimer « ${l.nom} » ?`,
                      n > 0
                        ? `Ses ${n} tâche${n > 1 ? "s" : ""} passeront dans « ${repli?.nom} ».`
                        : "Elle est vide.",
                      [
                        { text: "Garder", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: async () => {
                            await supprimerListe(l.id);
                            if (filtre === l.id) setFiltre(null);
                            await charger();
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Texte style={[styles.gestionSupprimer, { color: t.danger }]}>✕</Texte>
                </TouchableOpacity>
              </View>
              <View style={styles.gestionCouleurs}>
                {CLES_COULEURS.map((cle) => {
                  const choisie = l.couleur === cle;
                  return (
                    <TouchableOpacity
                      key={cle}
                      onPress={async () => {
                        await modifierListe(l.id, l.nom, l.icone, cle);
                        await charger();
                      }}
                      style={[
                        styles.gestionCouleur,
                        {
                          backgroundColor: couleurListe(cle).fond,
                          borderColor: choisie ? t.textPrimary : "transparent",
                        },
                      ]}
                      hitSlop={4}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: choisie }}
                      accessibilityLabel={`Couleur ${cle} pour ${l.nom}`}
                    />
                  );
                })}
              </View>
              </View>
            ))}
            <View style={styles.gestionLigne}>
              <Texte style={{ fontSize: 18 }}>＋</Texte>
              <ChampTexte
                style={[
                  styles.gestionChamp,
                  { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary },
                ]}
                placeholder="Nouvelle liste (ex : Projet musique)"
                placeholderTextColor={t.textMuted}
                value={nouvelleListe}
                onChangeText={setNouvelleListe}
                onSubmitEditing={async () => {
                  if (!nouvelleListe.trim()) return;
                  await ajouterListe(nouvelleListe, "📁");
                  setNouvelleListe("");
                  await charger();
                }}
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity
              style={[styles.gestionFermer, { backgroundColor: t.accent }]}
              onPress={async () => {
                if (nouvelleListe.trim()) {
                  await ajouterListe(nouvelleListe, "📁");
                  setNouvelleListe("");
                }
                setGestion(false);
                await charger();
              }}
            >
              <Texte style={[styles.gestionFermerTexte, { color: t.textOnAccent }]}>
                Terminé
              </Texte>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {annulable && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Texte style={[styles.bandeauTexte, { color: t.bgApp }]} numberOfLines={1}>
            {annulable.texte}
          </Texte>
          <TouchableOpacity onPress={onAnnuler} hitSlop={10}>
            <Texte style={[styles.bandeauAction, { color: t.bgApp }]}>Annuler</Texte>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },

  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  jourSemaine: { fontSize: typography.small, fontWeight: "700", letterSpacing: 1 },
  date: { fontSize: 30, fontWeight: "600" },
  plus: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  plusTexte: { fontSize: 26, lineHeight: 30, fontWeight: "500" },

  semaine: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  jour: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 6,
  },
  jourNom: { fontSize: 11, fontWeight: "600" },
  jourNumero: { fontSize: typography.body, fontWeight: "700", marginTop: 2 },
  jourPoints: { flexDirection: "row", gap: 2, height: 6, marginTop: 4 },
  jourPoint: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },

  surtitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },

  grande: {
    minHeight: 78,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    justifyContent: "center",
  },
  grandeLigne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  numero: { fontSize: 34, fontWeight: "700", width: 26, textAlign: "center" },
  raisonLigne: { fontSize: typography.small, marginTop: 3 },
  segments: { flexDirection: "row", gap: 3, marginTop: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  cercle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },

  grille: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tuile: {
    width: "48.5%",
    minHeight: 112,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tuileNom: { fontSize: typography.body, fontWeight: "700" },
  tuilePoints: { flexDirection: "row", gap: 4, height: 6, marginTop: 6 },
  tuilePoint: { width: 6, height: 6, borderRadius: 3 },
  tuileEnsuite: { fontSize: typography.small, marginTop: 6, flex: 1 },
  tuileBarre: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: spacing.sm },
  tuileNouvelle: { borderStyle: "dashed", alignItems: "center", justifyContent: "center" },

  fondBas: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  feuilleLigne: { borderTopWidth: 1, paddingVertical: spacing.md, marginTop: spacing.md },
  feuilleTexte: { fontSize: typography.body, fontWeight: "600" },
  feuilleAide: { fontSize: typography.small, marginTop: 2 },

  compte: { fontSize: typography.small, fontWeight: "700", marginBottom: 4 },
  liensListe: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  objectifLigne: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  uneAutre: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  jeCommence: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  jeCommenceTexte: { fontSize: typography.small, fontWeight: "600" },
  ajout: { flexDirection: "row", gap: spacing.sm },
  filtre: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  filtreTexte: { fontSize: typography.small, fontWeight: "600" },
  fond: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  gestion: { borderRadius: radius.lg, padding: spacing.xl },
  gestionTitre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  gestionLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  gestionChamp: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: typography.bodySmall,
  },
  gestionSupprimer: { fontSize: 16, paddingHorizontal: 4 },
  gestionFermer: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, alignItems: "center" },
  gestionFermerTexte: { fontSize: typography.body, fontWeight: "600" },
  champ: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  boutonNoter: { borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center" },
  boutonNoterTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  confirmation: { flex: 1, fontSize: typography.small, marginRight: spacing.md },
  lien: { fontSize: typography.small, fontWeight: "600" },

  section: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  vide: { fontSize: typography.small, fontStyle: "italic", marginBottom: spacing.sm },

  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  carteListe: { borderLeftWidth: 4 },
  gestionBloc: { marginBottom: spacing.md },
  gestionIcone: {
    width: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 18,
  },
  gestionCouleurs: { flexDirection: "row", gap: 10, marginLeft: 52 },
  gestionCouleur: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  carteEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  raison: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  raisonTexte: { fontSize: typography.tiny, fontWeight: "700", textTransform: "uppercase" },
  duree: { fontSize: typography.small },
  nom: { fontSize: typography.h3, fontWeight: "600" },
  premiere: { fontSize: typography.small, marginTop: 6, lineHeight: 19 },
  decouper: { fontSize: typography.small, fontWeight: "600", marginTop: spacing.sm },

  progressionLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  barre: { flex: 1, height: 8, borderRadius: 4, flexDirection: "row", overflow: "hidden" },
  progressionTexte: { fontSize: typography.small, fontWeight: "600" },
  etape: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 8 },
  etapeCase: { fontSize: 18, width: 20, textAlign: "center" },
  etapeNom: { flex: 1, fontSize: typography.bodySmall },
  bonus: { fontSize: typography.tiny, marginTop: 4 },


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
  bandeauAction: { fontSize: typography.bodySmall, fontWeight: "700", textDecorationLine: "underline" },
});
