import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte, ChampTexte } from "../../components/Texte";
import { Swipeable } from "react-native-gesture-handler";
import { BarresObjectif } from "../../components/BarresObjectif";
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
  POINTS_DERNIERE_ETAPE,
  POINTS_ETAPE,
  type Periode,
} from "../../lib/regles-taches";
import { genererPropositions, type Proposition } from "../../lib/db/moteur";
import { ordreJourDifficile } from "../../lib/moteur-regles";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
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
  const [voirPlusTard, setVoirPlusTard] = useState(false);
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

  const carteJourDifficile = (p: Proposition) => {
    const prochaine = (etapes[p.itemId] ?? []).find((e) => e.faite === 0);
    return (
      <View style={[styles.carte, styles.carteListe, { backgroundColor: t.bgCard, borderLeftColor: bordure(p) }]}>
        {prochaine ? (
          <>
            {/* Tâche découpée : seulement sa prochaine étape */}
            <Texte style={[styles.premiere, { color: t.textMuted, marginTop: 0 }]}>
              {p.nom}
            </Texte>
            <TouchableOpacity
              onPress={() => onEtape(p, prochaine)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
            >
              <Texte style={[styles.nom, { color: t.textPrimary }]}>
                ○ {prochaine.nom}
              </Texte>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => onTerminer(p)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
          >
            <Texte style={[styles.nom, { color: t.textPrimary }]}>○ {icone(p)}{p.nom}</Texte>
            {p.premiere_action ? (
              <Texte style={[styles.premiere, { color: t.textSecondary }]}>
                Commencer par : {p.premiere_action}
              </Texte>
            ) : null}
            {p.duree_min ? (
              <Texte style={[styles.premiere, { color: t.textMuted }]}>
                {p.duree_min} min
              </Texte>
            ) : null}
          </TouchableOpacity>
        )}
        {boutonJeCommence(p)}
      </View>
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

  // Jour difficile (vue « Toutes ») : une seule tâche (voir ordreJourDifficile), le reste attend.
  const modeUnique = jourDifficile && filtre === null;
  const ordre = modeUnique
    ? ordreJourDifficile(classement, (id) =>
        (etapes[id] ?? []).some((e) => e.faite === 0),
      )
    : [];
  const unique = ordre.length > 0 ? ordre[rangUneAutre % ordre.length] : null;
  const maintenant = modeUnique ? [] : classement.filter((p) => p.propose);
  const plusTard = modeUnique ? [] : classement.filter((p) => !p.propose);
  const dansListe = filtre === null ? [] : classement.filter((p) => p.liste_id === filtre);

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}
      >
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Tâches</Texte>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtres}
          style={{ marginBottom: spacing.md, flexGrow: 0 }}
        >
          {[
            { id: null as number | null, nom: "Toutes", icone: null as string | null, couleur: null as string | null },
            ...listes,
          ].map(
            (l) => {
              const actif = filtre === l.id;
              // « Toutes » garde l'accent ; une liste prend sa couleur.
              const c =
                l.id === null
                  ? { fond: t.accent, texte: t.textOnAccent }
                  : couleurListe(l.couleur);
              const n =
                l.id === null
                  ? classement.length
                  : classement.filter((p) => p.liste_id === l.id).length;
              return (
                <TouchableOpacity
                  key={l.id ?? "toutes"}
                  onPress={() => {
                    setNoteOuverte(null);
                    setFiltre(l.id);
                  }}
                  style={[
                    styles.filtre,
                    {
                      backgroundColor: actif ? c.fond : t.bgCard,
                      borderColor: l.id === null && !actif ? t.border : c.fond,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                >
                  <Texte
                    style={[
                      styles.filtreTexte,
                      { color: actif ? c.texte : t.textSecondary },
                    ]}
                  >
                    {l.icone ? `${l.icone} ` : ""}
                    {l.nom}
                    {n > 0 ? ` · ${n}` : ""}
                  </Texte>
                </TouchableOpacity>
              );
            },
          )}
          <TouchableOpacity
            onPress={() => setGestion(true)}
            style={[styles.filtre, { borderColor: t.border }]}
            accessibilityLabel="Gérer les listes"
          >
            <Texte style={[styles.filtreTexte, { color: t.textMuted }]}>✎ Listes</Texte>
          </TouchableOpacity>
        </ScrollView>

        {/* Noter en une ligne : l'appli devine le domaine et trie */}
        <View style={styles.ajout}>
          <ChampTexte
            style={[
              styles.champ,
              { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary },
            ]}
            placeholder={
              listeActive ? `Une tâche pour ${listeActive.nom}` : "Une tâche à noter"
            }
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
            <Texte style={[styles.boutonNoterTexte, { color: t.textOnAccent }]}>Noter</Texte>
          </TouchableOpacity>
        </View>
        <View style={styles.ajoutPied}>
          {tacheNotee ? (
            <Texte style={[styles.confirmation, { color: t.textSecondary }]}>
              ✓ « {tacheNotee} » est notée
              {filtre === null && listes[0] ? ` dans ${listes[0].nom}` : ""}.
            </Texte>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={() => {
              const n = nouvelleTache.trim();
              setNouvelleTache("");
              const params = [
                n ? `nom=${encodeURIComponent(n)}` : null,
                filtre !== null ? `liste=${filtre}` : null,
              ].filter(Boolean);
              router.push(
                params.length ? `/nouvelle-tache?${params.join("&")}` : "/nouvelle-tache",
              );
            }}
            hitSlop={8}
          >
            <Texte style={[styles.lien, { color: t.accentText }]}>Plus d'options</Texte>
          </TouchableOpacity>
        </View>

        {filtre !== null ? (
          <>
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
                Rien dans cette liste pour l'instant.
              </Texte>
            ) : (
              <Texte style={[styles.vide, { color: t.textMuted, fontStyle: "normal" }]}>
                Dans l'ordre où l'appli te les conseille.
              </Texte>
            )}
            {dansListe.map(carte)}
          </>
        ) : (
          <>
        <Texte style={[styles.section, { color: t.textPrimary }]}>
          {modeUnique ? "Une seule chose" : "À faire maintenant"}
        </Texte>
        {zoneNote}
        {modeUnique && unique && (
          <>
            <Texte style={[styles.vide, { color: t.textMuted, marginTop: 0 }]}>
              Jour difficile : le reste attend.
            </Texte>
            {carteJourDifficile(unique)}
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
        {(modeUnique ? !unique : maintenant.length === 0) && (
          <Texte style={[styles.vide, { color: t.textMuted }]}>
            Aucune tâche en cours.
          </Texte>
        )}

        {maintenant.map(carte)}

        {plusTard.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.plusTardEntete}
              onPress={() => setVoirPlusTard(!voirPlusTard)}
            >
              <Texte style={[styles.section, { color: t.textPrimary, marginTop: 0 }]}>
                Plus tard · {plusTard.length}
              </Texte>
              <Texte style={[styles.chevron, { color: t.textMuted }]}>
                {voirPlusTard ? "−" : "+"}
              </Texte>
            </TouchableOpacity>
            {!voirPlusTard && (
              <Texte style={[styles.vide, { color: t.textMuted }]}>
                L'appli les proposera au bon moment.
              </Texte>
            )}
            {voirPlusTard &&
              plusTard.map((p) => {
                const liste = etapes[p.itemId] ?? [];
                const faites = liste.filter((e) => e.faite === 1).length;
                return (
                  <Swipeable key={p.itemId} renderRightActions={() => actions(p)}>
                    <TouchableOpacity
                      style={[styles.ligne, { backgroundColor: t.bgCard }]}
                      onPress={() =>
                        liste.length > 0
                          ? router.push(`/nouvelle-tache?id=${p.itemId}`)
                          : onTerminer(p)
                      }
                    >
                      <Texte style={[styles.ligneNom, { color: t.textPrimary }]}>
                        ○ {p.nom}
                      </Texte>
                      {liste.length > 0 && (
                        <Texte style={[styles.progressionTexte, { color: t.textMuted }]}>
                          {faites}/{liste.length}
                        </Texte>
                      )}
                    </TouchableOpacity>
                  </Swipeable>
                );
              })}
          </>
        )}

          </>
        )}

      </ScrollView>

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
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },

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
  filtres: { gap: spacing.sm, paddingRight: spacing.xl },
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
  ajoutPied: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    minHeight: 18,
  },
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
  bandeauAction: { fontSize: typography.bodySmall, fontWeight: "700", textDecorationLine: "underline" },
});
