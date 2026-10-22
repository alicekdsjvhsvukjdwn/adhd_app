import { ProjetsGalerie } from "../../components/ProjetsGalerie";
import { useCleReset } from "../../lib/reset-onglet";
import * as Haptics from "expo-haptics";
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
import { Glissable } from "../../components/Options";
import { BarresObjectif } from "../../components/BarresObjectif";
import { JOURS_LONGS, MOIS } from "../../components/CalendrierMois";
import { BandeJours } from "../../components/BandeJours";
import { Etoile } from "../../components/Etoile";
import { FeuilleChoixTache, type GroupeChoix } from "../../components/FeuilleChoixTache";
import { MenuOptions } from "../../components/MenuOptions";
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
  placerTache,
} from "../../lib/db";
import { FeuilleTache } from "../../components/FeuilleTache";
import {
  ajouterEtape,
  cocherEtape,
  decocherEtape,
  getEtapesPour,
  type Etape,
} from "../../lib/db/etapes";
import { estJourDifficile } from "../../lib/db/jour-difficile";
import {
  getListes,
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
  ordreManuel,
  prevueLe,
  POINTS_ETAPE,
  type Periode,
} from "../../lib/regles-taches";
import { joursAvecRdv, rdvDuJour, type Evenement } from "../../lib/agenda-regles";
import { agendaEnCache, chargerAgenda } from "../../lib/agenda";
import { decalerJours } from "../../lib/dates";
import { genererPropositions, type Proposition } from "../../lib/db/moteur";
import { bonusDuJour, emplacementsDuJour, placerDansTrois, planifications, retirerDesTrois, retirerDuBonus } from "../../lib/db/trois";
import { getItem } from "../../lib/db/items";
import { lireMeta, ecrireMeta } from "../../lib/db/meta";
import { FeuilleEtoile, libelleJourPlan } from "../../components/FeuilleEtoile";
import { candidatsOrdonnes, estPropose, faiteAvant, troisFaits, type Bonus, type Emplacement } from "../../lib/trois-regles";
import { ordreJourDifficile } from "../../lib/moteur-regles";
import { avecAlpha, melanger, radius, spacing, typography, useTheme } from "../../lib/theme";
import { useCouleurListe } from "../../lib/theme-listes";

type Annulable =
  | { type: "tache"; id: number; texte: string }
  | { type: "etape"; etapeId: number; texte: string };

function TachesContenu() {
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
  /** Les 3 emplacements et les bonus d'aujourd'hui, de demain et du jour choisi (voir lib/db/trois.ts), et les rendez-vous. */
  const [plan, setPlan] = useState<Record<string, { prio: Emplacement[]; bonus: Bonus[] }>>({});
  /** Nom et liste des tâches placées mais absentes du classement (déjà faites). */
  const [infos, setInfos] = useState<Record<number, { nom: string; liste_id: number | null }>>({});
  /** Où chaque tâche est placée (aujourd'hui et plus tard) : l'étoile ★. */
  const [planifs, setPlanifs] = useState<Record<number, { jour: string; bonus: boolean }[]>>({});
  /** La tâche dont l'étoile est ouverte. */
  const [etoilePour, setEtoilePour] = useState<{ itemId: number; nom: string } | null>(null);
  /** Menu d'une tâche faite affichée dans les 3 ou en bonus. */
  const [menuFaite, setMenuFaite] = useState<{ itemId: number; nom: string; jour: string; rang: number | null; faiteLe: string | null } | null>(null);
  /** Les 3 viennent d'être faits : le bandeau de célébration (une fois par jour). */
  const [celebre, setCelebre] = useState(false);
  const jourChoisiRef = useRef<string | null>(null);
  const [rdv, setRdv] = useState<Evenement[]>([]);
  const [rdvHorsLigne, setRdvHorsLigne] = useState(false);
  /** Feuille « Choisir » : l'emplacement à remplir. */
  const [choixTrois, setChoixTrois] = useState<{ jour: string; rang: number } | null>(null);
  /** Tâche dont le menu d'appui long est ouvert ; s'il vient d'un emplacement, lequel. */
  const [menuTache, setMenuTache] = useState<Proposition | null>(null);
  const [menuEmplacement, setMenuEmplacement] = useState<{ jour: string; rang: number } | null>(null);
  /** Feuille du bouton « + ». */
  const [feuille, setFeuille] = useState(false);
  /** Tâche dont la feuille « détail » est ouverte. */
  const [detailId, setDetailId] = useState<number | null>(null);
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

  /**
   * Les 3 et les bonus d'aujourd'hui, de demain et du jour choisi. Les propositions d'aujourd'hui sont figées à l'ouverture
   * (sauf jour difficile : une seule tâche) ; un autre jour n'affiche que ce que j'y ai placé.
   */
  const chargerPlan = useCallback(
    async (toutes: Proposition[]) => {
      const difficile = await estJourDifficile();
      const jours = [...new Set([jour, decalerJours(jour, 1), ...(jourChoisiRef.current ? [jourChoisiRef.current] : [])])];
      const entrees = await Promise.all(
        jours.map(async (j) => [j, { prio: await emplacementsDuJour(j, toutes, j === jour && !difficile, jour), bonus: await bonusDuJour(j, toutes) }] as const),
      );
      setPlan(Object.fromEntries(entrees));
      const ids = new Set(entrees.flatMap(([, v]) => [...v.prio.flatMap((e) => (e.itemId !== null ? [e.itemId] : [])), ...v.bonus.map((b) => b.itemId)]));
      const autres = await Promise.all(
        [...ids]
          .filter((id) => !toutes.some((p) => p.itemId === id))
          .map(async (id) => {
            const it = await getItem(id);
            return it ? ([id, { nom: it.nom, liste_id: it.liste_id }] as const) : null;
          }),
      );
      setInfos(Object.fromEntries(autres.filter((x) => x !== null)));
      setPlanifs(await planifications(jour));
      // Les 3 sont faits : haptique et bandeau, une seule fois par jour.
      const auj = entrees.find(([j]) => j === jour)?.[1].prio;
      if (!difficile && auj && troisFaits(auj) && (await lireMeta(`trois_celebre:${jour}`)) === null) {
        await ecrireMeta(`trois_celebre:${jour}`, "1");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setCelebre(true);
      }
    },
    [jour],
  );

  useEffect(() => {
    jourChoisiRef.current = jourChoisi;
    chargerPlan(classement).catch(() => {});
    // Seulement au changement de jour choisi : le reste se recharge avec charger().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jourChoisi]);

  const charger = useCallback(async () => {
    // Le mode du jour d'abord : il est lu en une requête, alors que le
    // classement (négligence, score, journal) prend du temps. En revenant
    // sur l'onglet après avoir changé l'énergie, la bonne vue s'applique tout de suite.
    setJourDifficile(await estJourDifficile());
    setRangUneAutre(0);
    const toutes = await genererPropositions();
    setClassement(toutes);
    // Rendez-vous : le cache d'abord (rapide, sert à la charge du jour), le serveur ensuite.
    const cache = await agendaEnCache();
    const evenements = cache?.evenements ?? [];
    setRdv(evenements);
    setRdvHorsLigne(false);
    await chargerPlan(toutes);
    chargerAgenda()
      .then((a) => {
        if (!a) return;
        setRdv(a.evenements);
        setRdvHorsLigne(a.horsLigne);
      })
      .catch(() => {});
    setEtapes(await getEtapesPour(toutes.map((p) => p.itemId)));
    const l = await getListes();
    setListes(l);
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
  }, [jour, chargerPlan]);

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
    // Une proposition d'aujourd'hui est enregistrée avant d'être cochée : elle reste affichée, cochée.
    if (!(await estJourDifficile())) await emplacementsDuJour(jour, classement, true, jour);
    await completer(p.itemId, "complet");
    proposerAnnulation({ type: "tache", id: p.itemId, texte: `✓ ${p.nom}` });
    setNoteOuverte({ itemId: p.itemId, nom: p.nom, date: getAujourdhui() });
    await charger();
  };

  /** Renvoie true si cocher cette étape a terminé la tâche. */
  const onEtape = async (p: Proposition, e: Etape): Promise<boolean> => {
    setNoteOuverte(null);
    Haptics.selectionAsync().catch(() => {});
    let derniere = false;
    if (e.faite === 1) {
      await decocherEtape(e.id);
    } else {
      derniere = await cocherEtape(e.id);
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
    return derniere;
  };

  // Feuille « détail » d'une tâche : relue dans le classement à chaque rechargement.
  const detail = classement.find((p) => p.itemId === detailId) ?? null;
  const detailEtapes = detail ? (etapes[detail.itemId] ?? []) : [];
  const ouvrirDetail = (p: Proposition) => setDetailId(p.itemId);

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

  const optionsTache = (p: Proposition) => [
    { libelle: "Historique", onPress: () => historique(p) },
    { libelle: "Modifier", onPress: () => router.push(`/nouvelle-tache?id=${p.itemId}`) },
    { libelle: "Supprimer", danger: true, onPress: () => onSupprimer(p) },
  ];

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
  // Mes 3 : l'étoile ouvre le choix du jour (aujourd'hui, demain, une date) et de la place (dans les 3 ou en bonus).
  const demain = decalerJours(jour, 1);
  const emplacementsDe = (j: string) => plan[j]?.prio ?? [];
  const bonusDe = (j: string) => plan[j]?.bonus ?? [];
  const enTrois = (p: Proposition) => (planifs[p.itemId]?.length ?? 0) > 0;
  const onEtoile = (p: { itemId: number; nom: string }) => setEtoilePour({ itemId: p.itemId, nom: p.nom });
  const nomTache = (id: number) => classement.find((p) => p.itemId === id)?.nom ?? infos[id]?.nom ?? "Tâche";
  const ouvrirMenu = (p: Proposition, emplacement: { jour: string; rang: number } | null) => {
    setMenuEmplacement(emplacement);
    setMenuTache(p);
  };
  const placer3 = async (j: string, rang: number, itemId: number) => {
    await placerDansTrois(j, rang, itemId);
    await charger();
  };
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
            <Glissable key={p.itemId} renderRightActions={() => actions(p)} options={optionsTache(p)} titre={p.nom}>
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
                  <Etoile active={enTrois(p)} onPress={() => onEtoile(p)} />
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
                    <View style={styles.ligneNom}>
                      <TouchableOpacity
                        onPress={() => onTerminer(p)}
                        hitSlop={8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: false }}
                        accessibilityLabel={`Cocher ${p.nom}`}
                      >
                        <Texte style={[styles.nom, { color: t.textPrimary }]}>○</Texte>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => ouvrirDetail(p)}
                        onLongPress={() => setMenuTache(p)}
                        accessibilityHint="Toucher : détail · appui long : actions"
                      >
                        <Texte style={[styles.nom, { color: t.textPrimary }]}>{icone(p)}{p.nom}</Texte>
                        {p.premiere_action ? (
                          <Texte style={[styles.premiere, { color: t.textSecondary }]}>
                            Commencer par : {p.premiere_action}
                          </Texte>
                        ) : null}
                      </TouchableOpacity>
                    </View>
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
                      onPress={() => ouvrirDetail(p)}
                      onLongPress={() => setMenuTache(p)}
                      accessibilityHint="Toucher : détail · appui long : actions"
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
            </Glissable>
          );
          };

  const couleurDe = (id: number | null) =>
    couleurListe(listes.find((l) => l.id === id)?.couleur ?? null).fond;

  /**
   * « Mes 3 » : grande carte, numéro et cercle de la couleur de la liste.
   * Tâche à étapes : barre segmentée, le cercle coche la prochaine étape.
   * rang null : sans numéro (tâches d'un autre jour de la semaine).
   */
  const carteGrande = (p: Proposition, rang: number | null, slot?: { jour: string; propose: boolean }) => {
    const liste = etapes[p.itemId] ?? [];
    const suivante = liste.find((e) => e.faite === 0);
    const couleur = couleurDe(p.liste_id);
    const raison =
      p.raison === "Échéance proche" && p.echeance
        ? libelleEcheance(p.echeance, jour)
        : p.raison.charAt(0).toLowerCase() + p.raison.slice(1);
    const ligne = [
      slot?.propose ? "proposée" : null,
      nomListe(p.liste_id)?.nom,
      raison,
      p.compte ? libelleCompte(p.compte.fait, p.compte.cible, p.compte.periode) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <Glissable key={p.itemId} renderRightActions={() => actions(p)} options={optionsTache(p)} titre={p.nom}>
        <View style={[styles.grande, { backgroundColor: t.bgCard }]}>
          <View style={styles.grandeLigne}>
            {rang !== null && (
              <Texte style={[styles.numero, { color: couleur }]}>{rang + 1}</Texte>
            )}
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => ouvrirDetail(p)}
              onLongPress={() => ouvrirMenu(p, slot && rang !== null ? { jour: slot.jour, rang } : null)}
              accessibilityHint="Toucher : détail · appui long : actions"
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
            {slot && rang !== null ? (
              <TouchableOpacity
                onPress={() => ouvrirMenu(p, { jour: slot.jour, rang })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Retirer ou remplacer ${p.nom}`}
              >
                <Texte style={{ fontSize: 22, color: t.textMuted }}>⋯</Texte>
              </TouchableOpacity>
            ) : (
              <Etoile active={enTrois(p)} onPress={() => onEtoile(p)} />
            )}
            <TouchableOpacity
              onPress={() => (suivante ? onEtape(p, suivante) : onTerminer(p))}
              hitSlop={10}
              style={[styles.cercle, { borderColor: couleur }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel={suivante ? `Cocher l'étape ${suivante.nom}` : `Cocher ${p.nom}`}
            />
          </View>
          {rang === 0 && (!slot || slot.jour === jour) && boutonJeCommence(p)}
        </View>
      </Glissable>
    );
  };

  // Jour difficile : une seule tâche (voir ordreJourDifficile), le reste attend.
  const ordre = jourDifficile
    ? ordreJourDifficile(classement, (id) =>
        (etapes[id] ?? []).some((e) => e.faite === 0),
      )
    : [];
  const unique = ordre.length > 0 ? ordre[rangUneAutre % ordre.length] : null;
  const jourVu = jourChoisi ?? jour;
  const rdvVus = rdvDuJour(rdv, jourVu);
  const carteDemain = (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent, borderWidth: 1 }]}>
      <Texte style={[styles.nom, { color: t.textPrimary }]}>Prépare demain</Texte>
      <Texte style={[styles.premiere, { color: t.textSecondary }]}>
        Ce soir, tu décides. Demain matin, tout est prêt.
      </Texte>
      <TouchableOpacity
        onPress={() => setJourChoisi(demain)}
        style={[styles.boutonTrois, { backgroundColor: t.accent }]}
        accessibilityRole="button"
      >
        <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Choisir mes 3</Texte>
      </TouchableOpacity>
    </View>
  );
  const caseVide = (j: string, rang: number) => (
    <TouchableOpacity
      key={`vide-${j}-${rang}`}
      onPress={() => setChoixTrois({ jour: j, rang })}
      style={[styles.caseVide, { borderColor: t.border }]}
      accessibilityRole="button"
      accessibilityLabel={`Choisir la tâche ${rang + 1}`}
    >
      <Texte style={[styles.numero, { color: t.textMuted }]}>{rang + 1}</Texte>
      <Texte style={[styles.lien, { color: t.accentText }]}>+ Choisir</Texte>
    </TouchableOpacity>
  );
  /** « ven. » : le jour où une tâche a été faite. */
  const jourCourt = (iso: string) => libelleJourPlan(iso, jour);

  /**
   * Une tâche faite reste à sa place : cercle plein de la couleur de sa liste, titre barré, atténuée.
   * Toucher : décocher, libérer l'emplacement. Faite un autre jour que le sien : « déjà faite le ven. » et « Libérer » d'un geste.
   */
  const carteFaite = (itemId: number, faiteLe: string, j: string, rang: number | null) => {
    const couleur = couleurDe(classement.find((p) => p.itemId === itemId)?.liste_id ?? infos[itemId]?.liste_id ?? null);
    const avant = faiteAvant({ faite: true, faiteLe }, j);
    return (
      <View key={`faite-${j}-${itemId}`} style={[styles.grande, { backgroundColor: t.bgCard, opacity: 0.65 }]}>
        <View style={styles.grandeLigne}>
          {rang !== null && <Texte style={[styles.numero, { color: couleur }]}>{rang + 1}</Texte>}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setMenuFaite({ itemId, nom: nomTache(itemId), jour: j, rang, faiteLe })}
            accessibilityRole="button"
            accessibilityLabel={`${nomTache(itemId)}, faite. Toucher : décocher ou libérer`}
          >
            <Texte style={[styles.nom, { color: t.textPrimary, textDecorationLine: "line-through" }]} numberOfLines={2}>
              {nomTache(itemId)}
            </Texte>
            <Texte style={[styles.raisonLigne, { color: t.textMuted }]}>{avant ? `déjà faite le ${jourCourt(faiteLe)}` : "faite ✓"}</Texte>
          </TouchableOpacity>
          {avant && (
            <TouchableOpacity onPress={() => libererFaite(j, rang, itemId)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Libérer l'emplacement de ${nomTache(itemId)}`}>
              <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "700" }}>Libérer</Texte>
            </TouchableOpacity>
          )}
          <View style={[styles.cercle, { borderColor: couleur, backgroundColor: couleur, alignItems: "center", justifyContent: "center" }]}>
            <Texte style={{ color: "#000", fontSize: 16, fontWeight: "700", lineHeight: 20 }}>✓</Texte>
          </View>
        </View>
      </View>
    );
  };
  const libererFaite = async (j: string, rang: number | null, itemId: number) => {
    if (rang !== null) await retirerDesTrois(j, rang);
    else await retirerDuBonus(j, itemId);
    await charger();
  };

  /** Une tâche placée que le classement ne propose pas aujourd'hui (ex. récurrente d'un autre jour) : une carte simple, ⋯ pour la libérer. */
  const cartePlanifiee = (itemId: number, j: string, rang: number | null) => (
    <View key={`prevue-${j}-${rang ?? "b"}-${itemId}`} style={[styles.grande, { backgroundColor: t.bgCard }]}>
      <View style={styles.grandeLigne}>
        {rang !== null && <Texte style={[styles.numero, { color: couleurDe(infos[itemId]?.liste_id ?? null) }]}>{rang + 1}</Texte>}
        <View style={{ flex: 1 }}>
          <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={2}>
            {nomTache(itemId)}
          </Texte>
          <Texte style={[styles.raisonLigne, { color: t.textMuted }]}>prévue ce jour-là</Texte>
        </View>
        <TouchableOpacity onPress={() => setMenuFaite({ itemId, nom: nomTache(itemId), jour: j, rang, faiteLe: null })} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Libérer ou modifier ${nomTache(itemId)}`}>
          <Texte style={{ fontSize: 22, color: t.textMuted }}>⋯</Texte>
        </TouchableOpacity>
      </View>
    </View>
  );

  /** Un jour passé : ce qui était prévu et ce qui a été fait, rien à modifier. */
  const ligneLecture = (itemId: number, faite: boolean, faiteLe: string | null, j: string, rang: number | null) => (
    <View key={`lecture-${j}-${rang ?? "b"}-${itemId}`} style={[styles.grande, { backgroundColor: t.bgCard, opacity: faite ? 0.8 : 1 }]}>
      <View style={styles.grandeLigne}>
        {rang !== null && <Texte style={[styles.numero, { color: couleurDe(classement.find((p) => p.itemId === itemId)?.liste_id ?? infos[itemId]?.liste_id ?? null) }]}>{rang + 1}</Texte>}
        <View style={{ flex: 1 }}>
          <Texte style={[styles.nom, { color: t.textPrimary, textDecorationLine: faite ? "line-through" : "none" }]} numberOfLines={2}>
            {nomTache(itemId)}
          </Texte>
          <Texte style={[styles.raisonLigne, { color: t.textMuted }]}>{faite ? (faiteLe === j ? "faite ✓" : `faite le ${jourCourt(faiteLe ?? j)}`) : "pas faite"}</Texte>
        </View>
      </View>
    </View>
  );

  /** Les 3 emplacements d'un jour : tâche (cochable, ⋯ pour retirer ou remplacer), tâche faite (restée, cochée) ou « + Choisir ». */
  const sectionTrois = (j: string, lecture = false) =>
    emplacementsDe(j).map((e) => {
      if (e.itemId !== null && e.faite) return lecture ? ligneLecture(e.itemId, true, e.faiteLe, j, e.rang) : carteFaite(e.itemId, e.faiteLe ?? j, j, e.rang);
      const p = e.itemId !== null ? classement.find((x) => x.itemId === e.itemId) : undefined;
      if (lecture) {
        return e.itemId !== null ? ligneLecture(e.itemId, false, null, j, e.rang) : (
          <View key={`vide-${j}-${e.rang}`} style={[styles.caseVide, { borderColor: t.border }]}>
            <Texte style={[styles.numero, { color: t.textMuted }]}>{e.rang + 1}</Texte>
            <Texte style={[styles.vide, { color: t.textMuted }]}>rien de prévu</Texte>
          </View>
        );
      }
      if (!p && e.itemId !== null) return cartePlanifiee(e.itemId, j, e.rang);
      return p ? carteGrande(p, e.rang, { jour: j, propose: estPropose(e) }) : caseVide(j, e.rang);
    });

  /** Les bonus d'un jour (autant que je veux), à la suite des 3. */
  const sectionBonus = (j: string, lecture = false) =>
    bonusDe(j).map((b) => {
      if (b.faite) return lecture ? ligneLecture(b.itemId, true, b.faiteLe, j, null) : carteFaite(b.itemId, b.faiteLe ?? j, j, null);
      const p = classement.find((x) => x.itemId === b.itemId);
      if (!p) return lecture ? ligneLecture(b.itemId, false, null, j, null) : cartePlanifiee(b.itemId, j, null);
      return lecture ? ligneLecture(p.itemId, false, null, j, null) : carteGrande(p, null);
    });
  const aChoisiDemain = emplacementsDe(demain).some((e) => e.itemId !== null && !estPropose(e));
  /** Feuille « Choisir » : suggestions du moteur d'abord, puis toutes les tâches à faire par liste. */
  const groupesChoix = (j: string): { suggestions: GroupeChoix; groupes: GroupeChoix[] } => {
    const prises = new Set([...emplacementsDe(j).flatMap((e) => (e.itemId !== null ? [e.itemId] : [])), ...bonusDe(j).map((b) => b.itemId)]);
    const libres = classement.filter((p) => !prises.has(p.itemId));
    const tache = (p: Proposition) => ({ itemId: p.itemId, nom: p.nom, duree_min: p.duree_min });
    const parRang = [...libres].sort((a, b) => a.rang - b.rang);
    const suggeres = candidatsOrdonnes({
      dus: parRang.filter((p) => prevueLe(p.jours, j)).map((p) => p.itemId),
      veille: [],
      ordre: parRang.map((p) => p.itemId),
    })
      .slice(0, 5)
      .map((c) => libres.find((p) => p.itemId === c.itemId)!);
    // Un jour futur : ses tâches prévues d'abord (« Prévues ce jour-là »), puis les suggestions du moteur.
    const prevues = j > jour ? libres.filter((p) => prevueLe(p.jours, j) || p.echeance === j) : [];
    const moteur: GroupeChoix = { titre: "Suggestions", couleur: t.accent, taches: suggeres.filter((p) => !prevues.includes(p)).map(tache) };
    return {
      suggestions: prevues.length > 0 ? { titre: "Prévues ce jour-là", couleur: t.accent, taches: prevues.map(tache) } : moteur,
      groupes: [
        ...(prevues.length > 0 ? [moteur] : []),
        ...[...listes.map((l) => ({ id: l.id as number | null, titre: l.nom })), { id: null as number | null, titre: "Sans liste" }]
          .map((g) => ({
            titre: g.titre,
            couleur: g.id === null ? t.textMuted : couleurDe(g.id),
            taches: ordreManuel(libres.filter((p) => p.liste_id === g.id)).map(tache),
          }))
          .filter((g) => g.taches.length > 0),
      ],
    };
  };
  const blocRdv = rdvVus.length > 0 && (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: 0 }]}>
        RENDEZ-VOUS{rdvHorsLigne ? " · derniers connus" : ""}
      </Texte>
      {rdvVus.map((e) => (
        <View key={e.id} style={styles.rdvLigne}>
          <View style={styles.rdvPastille} />
          <Texte style={[styles.rdvHeure, { color: t.textSecondary }]}>{e.journee ? "Journée" : e.debut}</Texte>
          <Texte style={[styles.rdvTitre, { color: t.textPrimary }]} numberOfLines={1}>
            {e.titre}
          </Texte>
        </View>
      ))}
    </View>
  );
  const dansListe = filtre === null ? [] : ordreManuel(classement.filter((p) => p.liste_id === filtre));
  const placer = async (p: Proposition, ou: "haut" | "bas" | null) => {
    await placerTache(p.itemId, ou);
    await charger();
  };
  const optionsAppui = (p: Proposition) => [
    ...(menuEmplacement
      ? [
          { libelle: "Remplacer", onPress: () => setTimeout(() => setChoixTrois(menuEmplacement), 350) },
          {
            libelle: "Retirer des 3",
            onPress: async () => {
              await retirerDesTrois(menuEmplacement.jour, menuEmplacement.rang);
              await charger();
            },
          },
        ]
      : []),
    { libelle: "Mettre en haut de la liste", onPress: () => placer(p, "haut") },
    { libelle: "Mettre en bas de la liste", onPress: () => placer(p, "bas") },
    ...(p.rang_manuel ? [{ libelle: "Remettre dans l'ordre de l'appli", onPress: () => placer(p, null) }] : []),
    ...optionsTache(p),
  ];

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
        style={[styles.container, { paddingTop: spacing.md }]}
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

            {/* La semaine : défile de semaine en semaine, passé et futur */}
            <BandeJours
              aujourdhui={jour}
              choisi={jourChoisi}
              points={(jours) =>
                pointsEcheance(
                  classement.map((p) => ({ echeance: p.echeance, couleur: couleurDe(p.liste_id) })),
                  jours,
                )
              }
              rdv={joursAvecRdv(rdv)}
              onChoisir={setJourChoisi}
            />

            {zoneNote}

            {blocRdv}

            {jourChoisi !== null && jourChoisi > jour && (
              <>
                <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: spacing.md }]}>MES 3 POUR {jourCourt(jourChoisi).toUpperCase()}</Texte>
                {sectionTrois(jourChoisi)}
                {bonusDe(jourChoisi).length > 0 && <Texte style={[styles.surtitre, { color: t.textMuted }]}>BONUS</Texte>}
                {sectionBonus(jourChoisi)}
              </>
            )}
            {jourChoisi !== null && jourChoisi < jour && (
              <>
                <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: spacing.md }]}>CE QUI ÉTAIT PRÉVU</Texte>
                {sectionTrois(jourChoisi, true)}
                {bonusDe(jourChoisi).length > 0 && <Texte style={[styles.surtitre, { color: t.textMuted }]}>BONUS</Texte>}
                {sectionBonus(jourChoisi, true)}
              </>
            )}

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
                {jourDifficile && !unique && (
                  <Texte style={[styles.vide, { color: t.textMuted }]}>
                    Aucune tâche en cours.
                  </Texte>
                )}
                {!jourDifficile && celebre && (
                  <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent, borderWidth: 1 }]}>
                    <Texte style={{ color: t.accentText, fontSize: typography.body, fontWeight: "700" }}>Les 3 sont faites ✓</Texte>
                  </View>
                )}
                {!jourDifficile && sectionTrois(jour)}
                {!jourDifficile && bonusDe(jour).length > 0 && <Texte style={[styles.surtitre, { color: t.textMuted }]}>BONUS</Texte>}
                {!jourDifficile && sectionBonus(jour)}
                {!jourDifficile && new Date().getHours() >= 18 && !aChoisiDemain && carteDemain}
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
            </View>
          </>
        )}
      </ScrollView>

      <MenuOptions
        titre={menuTache?.nom ?? ""}
        options={menuTache ? optionsAppui(menuTache) : []}
        onFermer={() => {
          setMenuTache(null);
          setMenuEmplacement(null);
        }}
      />

      <FeuilleChoixTache
        visible={choixTrois !== null}
        titre={choixTrois ? `Choisir pour ${libelleJourPlan(choixTrois.jour, jour).toLowerCase()}` : "Choisir"}
        {...groupesChoix(choixTrois?.jour ?? jour)}
        onChoisir={async (id) => {
          if (!choixTrois) return;
          const c = choixTrois;
          setChoixTrois(null);
          await placer3(c.jour, c.rang, id);
        }}
        onFermer={() => setChoixTrois(null)}
      />

      {etoilePour && (
        <FeuilleEtoile
          key={etoilePour.itemId}
          tache={etoilePour}
          aujourdhui={jour}
          classement={classement}
          placements={planifs[etoilePour.itemId] ?? []}
          nomDe={nomTache}
          onFini={() => {
            setEtoilePour(null);
            charger();
          }}
        />
      )}

      <MenuOptions
        titre={menuFaite?.nom ?? ""}
        options={
          menuFaite
            ? [
                ...(menuFaite.faiteLe
                  ? [
                      {
                        libelle: "Décocher (remettre à faire)",
                        onPress: async () => {
                          await annulerCompletion(menuFaite.itemId, menuFaite.faiteLe ?? undefined);
                          await charger();
                        },
                      },
                    ]
                  : []),
                { libelle: "Libérer l'emplacement", onPress: () => libererFaite(menuFaite.jour, menuFaite.rang, menuFaite.itemId) },
                { libelle: "Modifier la tâche", onPress: () => router.push(`/nouvelle-tache?id=${menuFaite.itemId}`) },
              ]
            : []
        }
        onFermer={() => setMenuFaite(null)}
      />

      {/* Bouton « + » : noter vite, tâche complète, listes */}
      <Modal
        visible={feuille}
        transparent
        animationType="slide"
        onRequestClose={() => setFeuille(false)}
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
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <FeuilleTache
        tache={detail}
        etapes={detailEtapes}
        liste={detail ? (nomListe(detail.liste_id)?.nom ?? null) : null}
        couleur={detail ? couleurDe(detail.liste_id) : t.accent}
        jour={jour}
        enTrois={detail ? enTrois(detail) : false}
        nomJourTrois=""
        onEtoile={() => {
          if (!detail) return;
          const d = detail;
          setDetailId(null);
          onEtoile(d);
        }}
        onFermer={() => setDetailId(null)}
        onEtape={async (e) => {
          if (detail && (await onEtape(detail, e))) setDetailId(null);
        }}
        onTerminer={() => {
          if (!detail) return;
          setDetailId(null);
          onTerminer(detail);
        }}
        onAjouter={async (nom) => {
          if (!detail) return;
          await ajouterEtape(detail.itemId, nom);
          await charger();
        }}
        onModifier={() => {
          if (!detail) return;
          setDetailId(null);
          router.push(`/nouvelle-tache?id=${detail.itemId}`);
        }}
        onCommence={() => {
          if (!detail) return;
          const prochaine = detailEtapes.find((e) => e.faite === 0);
          setDetailId(null);
          router.push(
            prochaine
              ? `/je-commence?id=${detail.itemId}&etape=${prochaine.id}`
              : `/je-commence?id=${detail.itemId}`,
          );
        }}
        onHistorique={() => {
          if (!detail) return;
          setDetailId(null);
          historique(detail);
        }}
      />

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
  selecteur: { flexDirection: "row", marginTop: 60, marginHorizontal: spacing.xl, borderWidth: 1, borderRadius: radius.pill, padding: 3 },
  segmentVue: { flex: 1, alignItems: "center", borderRadius: radius.pill, paddingVertical: spacing.sm },

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

  titreTrois: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  boutonTrois: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.md },
  rdvLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  rdvPastille: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8A9A98" },
  rdvHeure: { fontSize: typography.small, fontWeight: "600", minWidth: 52 },
  rdvTitre: { flex: 1, fontSize: typography.body },
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
  caseVide: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
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
  ligneNom: { flexDirection: "row", gap: spacing.sm },
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

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à son accueil (voir lib/reset-onglet.ts). */
export default function Taches() {
  return <TachesEtProjets key={useCleReset("taches")} />;
}

/** En haut de l'onglet : « Mes tâches » ou « Projets » (les projets créatifs). Le re-tap de l'onglet revient à « Mes tâches ». */
function TachesEtProjets() {
  const t = useTheme();
  const [vue, setVue] = useState<"taches" | "projets">("taches");
  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <View style={[styles.selecteur, { backgroundColor: t.bgCard, borderColor: t.border }]} accessibilityRole="tablist">
        {(
          [
            ["taches", "Mes tâches"],
            ["projets", "Projets"],
          ] as const
        ).map(([cle, libelle]) => (
          <TouchableOpacity
            key={cle}
            onPress={() => setVue(cle)}
            style={[styles.segmentVue, vue === cle && { backgroundColor: t.accent }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: vue === cle }}
          >
            <Texte style={{ color: vue === cle ? t.textOnAccent : t.textSecondary, fontSize: typography.bodySmall, fontWeight: "700" }}>{libelle}</Texte>
          </TouchableOpacity>
        ))}
      </View>
      {vue === "taches" ? <TachesContenu /> : <ProjetsGalerie />}
    </View>
  );
}
