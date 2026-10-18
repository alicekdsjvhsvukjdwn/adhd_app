import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Categorie } from "../lib/catalogue";
import { dateLocale, decalerJours, jourDeCreation } from "../lib/dates";
import {
  addItem,
  confirmationSuppression,
  deleteItem,
  getAncres,
  getItem,
  modifierItem,
  type Ancre,
} from "../lib/db";
import { enregistrerEtapes, getEtapes } from "../lib/db/etapes";
import { getListes, type Liste } from "../lib/db/listes";
import { PlusMoins } from "../components/PlusMoins";
import {
  ecrireFrequence,
  lireFrequence,
  POINTS_DERNIERE_ETAPE,
  POINTS_ESSENTIELLES,
  POINTS_ETAPE,
  POINTS_TOUTES,
  type Periode,
} from "../lib/regles-taches";
import { momentStocke, type Moment } from "../lib/moments";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import {
  ICONES_CATEGORIE,
  LIBELLES_CATEGORIE,
  ORDRE_CATEGORIES,
  useCouleurCategorie,
} from "../lib/theme-categories";

/**
 * Écran d'ajout unique, en deux : une routine (revient certains jours) ou
 * une tâche (une fois, ou x fois par semaine / par mois).
 * Seul le nom est obligatoire : noter doit prendre quelques secondes.
 * - ?type=routine : démarre sur « Routine »
 * - ?id=12 : modifie l'item 12 au lieu d'en créer un
 */

type Mode = "tache" | "routine";
type Rythme = "une_fois" | Periode;
type Priorite = 1 | 2 | 3;

/** Colonne items.importance : seuls les libellés ont changé. */
const PRIORITES: { valeur: Priorite; libelle: string }[] = [
  { valeur: 3, libelle: "Haute" },
  { valeur: 2, libelle: "Normale" },
  { valeur: 1, libelle: "Basse" },
];

const RYTHMES: { valeur: Rythme; libelle: string }[] = [
  { valeur: "une_fois", libelle: "Une fois" },
  { valeur: "semaine", libelle: "x fois par semaine" },
  { valeur: "mois", libelle: "x fois par mois" },
];

const ECHEANCES: { jours: number | null; libelle: string }[] = [
  { jours: null, libelle: "Aucune" },
  { jours: 0, libelle: "Aujourd'hui" },
  { jours: 1, libelle: "Demain" },
  { jours: 3, libelle: "Dans 3 jours" },
  { jours: 7, libelle: "Dans 1 semaine" },
  { jours: 14, libelle: "Dans 2 semaines" },
];

/** Valeurs de lib/moments.ts. */
const MOMENTS: { valeur: Moment | null; libelle: string }[] = [
  { valeur: "matin", libelle: "☀️ Matin" },
  { valeur: "apres_midi", libelle: "🌤️ Après-midi" },
  { valeur: "soir", libelle: "🌙 Soir" },
  { valeur: null, libelle: "À tout moment" },
];

/** Moments du catalogue qui n'ont pas de bouton : affichés seulement s'ils sont déjà choisis. */
const AUTRES_MOMENTS: Partial<Record<Moment, string>> = {
  reveil: "⏰ Réveil",
  midi: "🍽️ Midi",
  coucher: "🛏️ Coucher",
};

const CATEGORIES_VALIDES = ORDRE_CATEGORIES as string[];

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

function dateCourte(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `Le ${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]}`;
}

/** Jours d'une récurrence, pour pré-remplir les ronds L M M J V S D. */
function joursDe(recurrence: string | null, creeLe: string): number[] {
  if (!recurrence || recurrence === "quotidien") return [0, 1, 2, 3, 4, 5, 6];
  if (recurrence.startsWith("jours:")) {
    return recurrence.slice(6).split(",").map(Number);
  }
  if (recurrence === "hebdo") {
    return [new Date(jourDeCreation(creeLe) + "T00:00:00Z").getUTCDay()];
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

/** Lundi en premier à l'écran ; valeurs en convention JavaScript (0 = dimanche). */
const JOURS: { valeur: number; libelle: string }[] = [
  { valeur: 1, libelle: "L" },
  { valeur: 2, libelle: "M" },
  { valeur: 3, libelle: "M" },
  { valeur: 4, libelle: "J" },
  { valeur: 5, libelle: "V" },
  { valeur: 6, libelle: "S" },
  { valeur: 0, libelle: "D" },
];
const TOUS_LES_JOURS = JOURS.map((j) => j.valeur);

const DUREES = [5, 15, 30, 60];

/** Difficulté : sert à savoir si c'est faisable selon l'énergie du jour. */
const DIFFICULTES: { valeur: 1 | 2 | 3; libelle: string }[] = [
  { valeur: 1, libelle: "Facile" },
  { valeur: 2, libelle: "Moyenne" },
  { valeur: 3, libelle: "Exigeante" },
];

/** Date locale dans n jours (même convention que getAujourdhui). */
function dateDansJours(n: number): string {
  return decalerJours(dateLocale(), n);
}

function recurrenceDe(jours: number[]): string {
  if (jours.length === 7) return "quotidien";
  return `jours:${[...jours].sort((a, b) => a - b).join(",")}`;
}

function resumeJours(jours: number[]): string {
  if (jours.length === 7) return "Tous les jours";
  if (jours.length === 0) return "Choisis au moins un jour";
  if (jours.length === 1) return "Une fois par semaine";
  return `${jours.length} jours par semaine`;
}

/** Une puce à toucher. Hors de l'écran : React ne la recrée pas à chaque rendu. */
function Choix({
  actif,
  libelle,
  onPress,
  couleurActive,
}: {
  actif: boolean;
  libelle: string;
  onPress: () => void;
  couleurActive?: string;
}) {
  const t = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.choix,
        {
          backgroundColor: actif ? (couleurActive ?? t.accent) : t.bgCard,
          borderColor: actif ? (couleurActive ?? t.accent) : t.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
    >
      <Text
        style={[
          styles.choixTexte,
          { color: actif ? t.textOnAccent : t.textSecondary },
        ]}
      >
        {libelle}
      </Text>
    </TouchableOpacity>
  );
}

export default function Ajouter() {
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    nom?: string;
    liste?: string;
  }>();
  const idModifie = params.id ? Number(params.id) : null;
  // Type en base au chargement (passer de l'un à l'autre réactive l'item).
  const [typeInitial, setTypeInitial] = useState<"routine" | "tache" | null>(null);

  const [mode, setMode] = useState<Mode>(
    params.type === "routine" ? "routine" : "tache",
  );
  const [nom, setNom] = useState(params.nom ?? "");
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [duree, setDuree] = useState<number | null>(null);
  const [premiereAction, setPremiereAction] = useState("");

  // Tâche
  const [importance, setImportance] = useState<Priorite>(2);
  const [echeance, setEcheance] = useState<string | null>(null);
  const [rythme, setRythme] = useState<Rythme>("une_fois");
  const [cible, setCible] = useState(3);

  // Routine
  const [moment, setMoment] = useState<Moment | null>("matin");
  const [jours, setJours] = useState<number[]>(TOUS_LES_JOURS);

  // Tâche : liste (Quotidien, Travail…) ; sans précision, la première.
  const [listes, setListes] = useState<Liste[]>([]);
  const [listeId, setListeId] = useState<number | null>(
    params.liste ? Number(params.liste) : null,
  );

  // Routine : moment repère (« Après le café »)
  const [ancres, setAncres] = useState<Ancre[]>([]);
  const [ancreId, setAncreId] = useState<number | null>(null);
  const [ancrePosition, setAncrePosition] = useState<"avant" | "apres">(
    "apres",
  );

  // Étapes : d'une tâche, ou d'une routine (essentielles / bonus)
  const [etapes, setEtapes] = useState<
    { id?: number; nom: string; faite?: number; essentielle?: number }[]
  >([]);
  const [nouvelleEtape, setNouvelleEtape] = useState("");

  const [effort, setEffort] = useState<1 | 2 | 3>(2);
  // Formulaire court par défaut ; tout est déplié quand on modifie.
  const [plusOptions, setPlusOptions] = useState(idModifie !== null);

  const [enregistrement, setEnregistrement] = useState(false);
  const [chargement, setChargement] = useState(idModifie !== null);

  // Mode modification : pré-remplir avec l'item existant.
  useEffect(() => {
    if (idModifie === null) return;
    (async () => {
      const item = await getItem(idModifie);
      if (item) {
        const freq = item.type === "tache" ? lireFrequence(item.recurrence) : null;
        setMode(item.type === "routine" ? "routine" : "tache");
        setTypeInitial(item.type === "routine" ? "routine" : "tache");
        if (freq) {
          setRythme(freq.periode);
          setCible(freq.cible);
        }
        setNom(item.nom);
        setCategorie(
          item.categorie && CATEGORIES_VALIDES.includes(item.categorie)
            ? (item.categorie as Categorie)
            : null,
        );
        setDuree(item.duree_min);
        setPremiereAction(item.premiere_action ?? "");
        setImportance(Math.max(1, Math.min(3, item.importance)) as Priorite);
        setEcheance(item.echeance);
        setMoment(momentStocke(item.moment));
        setJours(joursDe(item.recurrence, item.cree_le));
        setEffort(item.effort === 1 || item.effort === 3 ? item.effort : 2);
        if (item.liste_id !== null) setListeId(item.liste_id);
        setAncreId(item.ancre_id);
        setAncrePosition(item.ancre_position === "avant" ? "avant" : "apres");
        setEtapes(
          (await getEtapes(item.id)).map((e) => ({
            id: e.id,
            nom: e.nom,
            faite: e.faite,
            essentielle: e.essentielle,
          })),
        );
      }
      setChargement(false);
    })();
  }, [idModifie]);

  useEffect(() => {
    getAncres().then(setAncres);
    getListes().then((l) => {
      setListes(l);
      setListeId((actuelle) => actuelle ?? l[0]?.id ?? null);
    });
  }, []);

  // Moments repères actifs, plus celui déjà choisi s'il a été désactivé depuis.
  const ancresProposees = ancres.filter(
    (a) => a.active === 1 || a.id === ancreId,
  );

  const periodique = mode === "tache" && rythme !== "une_fois";
  const typeEffectif: Mode = mode;

  const valide =
    nom.trim().length > 0 && (typeEffectif === "tache" || jours.length > 0);

  const basculerJour = (j: number) =>
    setJours((actuels) =>
      actuels.includes(j) ? actuels.filter((x) => x !== j) : [...actuels, j],
    );

  const sansEssentielle =
    typeEffectif === "routine" &&
    etapes.length > 0 &&
    !etapes.some((e) => e.essentielle !== 0);

  const onAjouter = async () => {
    if (!valide || enregistrement) return;
    if (sansEssentielle) {
      Alert.alert(
        "Il faut au moins une étape essentielle",
        "Une routine à étapes est faite quand ses étapes essentielles le sont. Passe au moins une étape en « Essentielle » (touche « Bonus » à côté de son nom), ou retire les étapes.",
      );
      return;
    }
    setEnregistrement(true);
    try {
      const commun = {
        nom: nom.trim(),
        // La difficulté ne sert qu'aux routines (« Si l'énergie revient »).
        effort: typeEffectif === "routine" ? effort : null,
        categorie,
        duree_min: duree,
        premiere_action: premiereAction.trim() || null,
      };
      if (idModifie !== null) {
        // Passer d'une tâche à une routine (ou l'inverse) : l'item redevient actif.
        const changeDeType = typeInitial !== null && typeInitial !== typeEffectif;
        await modifierItem(idModifie, {
          ...commun,
          type: typeEffectif,
          ...(changeDeType ? { statut: "actif" as const } : {}),
          ...(typeEffectif === "tache"
            ? {
                importance,
                echeance: periodique ? null : echeance,
                recurrence: periodique
                  ? ecrireFrequence({ periode: rythme as Periode, cible })
                  : null,
                liste_id: listeId,
              }
            : {
                recurrence: recurrenceDe(jours),
                moment,
                ancre_id: ancreId,
                ancre_position: ancreId !== null ? ancrePosition : null,
              }),
        });
        await enregistrerEtapes(idModifie, etapes);
      } else if (typeEffectif === "tache") {
        const id = await addItem({
          ...commun,
          type: "tache",
          importance,
          echeance: periodique ? null : echeance,
          recurrence: periodique
            ? ecrireFrequence({ periode: rythme as Periode, cible })
            : null,
          liste_id: listeId,
        });
        if (etapes.length > 0) await enregistrerEtapes(id, etapes);
      } else {
        const id = await addItem({
          ...commun,
          type: "routine",
          recurrence: recurrenceDe(jours),
          moment,
          ancre_id: ancreId,
          ancre_position: ancreId !== null ? ancrePosition : null,
        });
        if (etapes.length > 0) await enregistrerEtapes(id, etapes);
      }
      router.back();
    } finally {
      setEnregistrement(false);
    }
  };

  const onSupprimer = () => {
    if (idModifie === null) return;
    const { titre, message } = confirmationSuppression(
      typeInitial === "routine" ? "routine" : "tache",
      nom,
    );
    Alert.alert(titre, message, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteItem(idModifie);
          router.back();
        },
      },
    ]);
  };

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bgApp }}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  const ajouterEtape = () => {
    if (!nouvelleEtape.trim()) return;
    setEtapes([...etapes, { nom: nouvelleEtape.trim(), essentielle: 1 }]);
    setNouvelleEtape("");
  };

  /**
   * Étapes : d'une grosse tâche (cochées une fois), ou d'une routine
   * (recochées chaque jour, essentielles ou bonus).
   */
  const editeurEtapes = () => {
    const pourRoutine = typeEffectif === "routine";
    return (
      <>
        <Text style={[styles.label, { color: t.textSecondary }]}>
          Étapes (facultatif)
        </Text>
        <Text
          style={[
            styles.aide,
            { color: t.textMuted, marginTop: 0, marginBottom: spacing.sm },
          ]}
        >
          {pourRoutine
            ? `Des petits pas, recochés chaque jour. Essentielles faites : ${POINTS_ESSENTIELLES} pts ; tout fait : ${POINTS_TOUTES}. Un jour difficile, les essentielles suffisent pour ${POINTS_TOUTES}.`
            : `${periodique ? "Remises à zéro après chaque fois faite. " : "Pour une grosse tâche, des petits morceaux. "}+${POINTS_ETAPE} par étape ; la dernière termine la tâche : +${POINTS_DERNIERE_ETAPE} en tout.`}
        </Text>
        {etapes.map((e, i) => (
          <View
            key={e.id ?? `n${i}`}
            style={[styles.etape, { backgroundColor: t.bgCard }]}
          >
            <Text style={[styles.etapeNumero, { color: t.textMuted }]}>
              {!pourRoutine && e.faite ? "✓" : i + 1}
            </Text>
            <Text style={[styles.etapeNom, { color: t.textPrimary }]}>{e.nom}</Text>
            {pourRoutine && (
              <TouchableOpacity
                onPress={() =>
                  setEtapes(
                    etapes.map((x, k) =>
                      k === i ? { ...x, essentielle: x.essentielle === 0 ? 1 : 0 } : x,
                    ),
                  )
                }
                hitSlop={8}
                accessibilityRole="switch"
                accessibilityState={{ checked: e.essentielle !== 0 }}
                accessibilityLabel={`${e.nom} : étape essentielle`}
              >
                <Text style={[styles.etapeType, { color: t.accentText }]}>
                  {e.essentielle === 0 ? "Bonus" : "Essentielle"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setEtapes(etapes.filter((_, k) => k !== i))}
              hitSlop={10}
            >
              <Text style={[styles.etapeRetirer, { color: t.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {pourRoutine && sansEssentielle && (
          <Text style={[styles.aide, { color: t.danger, marginTop: 0, marginBottom: spacing.sm }]}>
            Il faut au moins une étape essentielle.
          </Text>
        )}
        <View style={styles.etapeAjout}>
          <TextInput
            style={[styleInput, { flex: 1 }]}
            placeholder={
              etapes.length === 0
                ? pourRoutine
                  ? "Ex : sortir le tapis"
                  : "Ex : trouver le formulaire"
                : "Étape suivante"
            }
            placeholderTextColor={t.textMuted}
            value={nouvelleEtape}
            onChangeText={setNouvelleEtape}
            onSubmitEditing={ajouterEtape}
            blurOnSubmit={false}
            returnKeyType="next"
          />
          <TouchableOpacity
            style={[styles.etapeBouton, { backgroundColor: t.accent }]}
            onPress={ajouterEtape}
          >
            <Text style={[styles.etapeBoutonTexte, { color: t.textOnAccent }]}>+</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const styleInput = [
    styles.input,
    {
      borderColor: t.border,
      color: t.textPrimary,
      backgroundColor: t.bgCard,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.annuler, { color: t.accentText }]}>
            ← Annuler
          </Text>
        </TouchableOpacity>

        <Text style={[styles.titre, { color: t.textPrimary }]}>
          {idModifie !== null ? "Modifier" : "Ajouter"}
        </Text>

        {/* Routine / Tâche */}
        <View style={[styles.selecteur, { backgroundColor: t.bgCard }]}>
          {(
            [
              { valeur: "routine", libelle: "Routine" },
              { valeur: "tache", libelle: "Tâche" },
            ] as { valeur: Mode; libelle: string }[]
          ).map((m) => {
            const actif = m.valeur === mode;
            return (
              <TouchableOpacity
                key={m.valeur}
                style={[
                  styles.selecteurBouton,
                  actif && { backgroundColor: t.accent },
                ]}
                onPress={() => setMode(m.valeur)}
              >
                <Text
                  style={[
                    styles.selecteurTexte,
                    { color: actif ? t.textOnAccent : t.textSecondary },
                  ]}
                >
                  {m.libelle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text
          style={[
            styles.aide,
            { color: t.textMuted, marginBottom: spacing.lg },
          ]}
        >
          {mode === "routine"
            ? "Revient les jours choisis, à son moment."
            : periodique
              ? "Proposée tant que l'objectif de la période n'est pas atteint."
              : "Disparaît une fois faite. L'appli choisit quand te la proposer."}
        </Text>

        <TextInput
          style={styleInput}
          placeholder={
            mode === "tache"
              ? "Ex : appeler la mutuelle"
              : "Ex : jouer de la guitare"
          }
          placeholderTextColor={t.textMuted}
          value={nom}
          onChangeText={setNom}
          autoFocus={idModifie === null}
          returnKeyType="done"
        />

        {/* Tâche : liste, priorité, rythme, échéance, étapes */}
        {typeEffectif === "tache" && listes.length > 0 && (
          <>
            <Text style={[styles.label, { color: t.textSecondary }]}>
              Liste
            </Text>
            <View style={styles.ligneChoix}>
              {listes.map((l) => (
                <Choix
                  key={l.id}
                  actif={listeId === l.id}
                  libelle={`${l.icone ? `${l.icone} ` : ""}${l.nom}`}
                  onPress={() => setListeId(l.id)}
                />
              ))}
            </View>
          </>
        )}


        {typeEffectif === "tache" && (
          <>
            <Text style={[styles.label, { color: t.textSecondary }]}>
              Priorité
            </Text>
            <View style={styles.ligneChoix}>
              {PRIORITES.map((i) => (
                <Choix
                  key={i.valeur}
                  actif={importance === i.valeur}
                  libelle={i.libelle}
                  onPress={() => setImportance(i.valeur)}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: t.textSecondary }]}>
              Combien de fois ?
            </Text>
            <View style={styles.ligneChoix}>
              {RYTHMES.map((r) => (
                <Choix
                  key={r.valeur}
                  actif={rythme === r.valeur}
                  libelle={r.libelle}
                  onPress={() => setRythme(r.valeur)}
                />
              ))}
            </View>
            {periodique && (
              <View style={[styles.ligneChoix, { alignItems: "center", marginTop: spacing.md }]}>
                <PlusMoins
                  valeur={String(cible)}
                  libelle={`Nombre de fois par ${rythme}`}
                  onPas={(sens) => setCible((c) => Math.max(1, Math.min(31, c + sens)))}
                />
                <Text style={[styles.aide, { color: t.textSecondary, marginTop: 0 }]}>
                  fois par {rythme}
                </Text>
              </View>
            )}

            {!periodique && (
              <>
                <Text style={[styles.label, { color: t.textSecondary }]}>
                  Pour quand ?
                </Text>
                <View style={styles.ligneChoix}>
                  {ECHEANCES.map((e) => (
                    <Choix
                      key={e.libelle}
                      actif={
                        e.jours === null
                          ? echeance === null
                          : echeance === dateDansJours(e.jours)
                      }
                      libelle={e.libelle}
                      onPress={() =>
                        setEcheance(
                          e.jours === null ? null : dateDansJours(e.jours),
                        )
                      }
                    />
                  ))}
                  {echeance !== null &&
                    !ECHEANCES.some(
                      (e) =>
                        e.jours !== null &&
                        dateDansJours(e.jours) === echeance,
                    ) && (
                      <Choix
                        actif
                        libelle={dateCourte(echeance)}
                        onPress={() => {}}
                      />
                    )}
                </View>
              </>
            )}

            {editeurEtapes()}
          </>
        )}

        {typeEffectif === "routine" && (
          <>
            <Text style={[styles.label, { color: t.textSecondary }]}>
              À quel moment de la journée ?
            </Text>
            <View style={styles.ligneChoix}>
              {MOMENTS.map((m) => (
                <Choix
                  key={m.libelle}
                  actif={moment === m.valeur}
                  libelle={m.libelle}
                  onPress={() => setMoment(m.valeur)}
                />
              ))}
              {moment !== null && AUTRES_MOMENTS[moment] && (
                <Choix
                  actif
                  libelle={AUTRES_MOMENTS[moment]}
                  onPress={() => {}}
                />
              )}
            </View>

            <Text style={[styles.label, { color: t.textSecondary }]}>
              Quels jours ?
            </Text>
            <View style={styles.ligneJours}>
              {JOURS.map((j) => {
                const actif = jours.includes(j.valeur);
                return (
                  <TouchableOpacity
                    key={j.valeur}
                    style={[
                      styles.jour,
                      {
                        backgroundColor: actif ? t.accent : t.bgCard,
                        borderColor: actif ? t.accent : t.border,
                      },
                    ]}
                    onPress={() => basculerJour(j.valeur)}
                  >
                    <Text
                      style={[
                        styles.jourTexte,
                        { color: actif ? t.textOnAccent : t.textSecondary },
                      ]}
                    >
                      {j.libelle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text
              style={[
                styles.aide,
                { color: jours.length === 0 ? t.danger : t.textMuted },
              ]}
            >
              {resumeJours(jours)}
            </Text>

                <Text style={[styles.label, { color: t.textSecondary }]}>
                  Moment repère (facultatif)
                </Text>
                {ancresProposees.length === 0 ? (
                  <TouchableOpacity
                    onPress={() => router.push("/ancres")}
                    hitSlop={8}
                  >
                    <Text style={[styles.aide, { color: t.accentText }]}>
                      Aucun moment repère pour l&apos;instant · Mes moments
                      repères
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.ligneChoix}>
                      <Choix
                        actif={ancreId === null}
                        libelle="Aucun"
                        onPress={() => setAncreId(null)}
                      />
                      {ancresProposees.map((a) => (
                        <Choix
                          key={a.id}
                          actif={ancreId === a.id}
                          libelle={a.nom}
                          onPress={() => setAncreId(a.id)}
                        />
                      ))}
                    </View>
                    {ancreId !== null && (
                      <View style={[styles.ligneChoix, { marginTop: spacing.sm }]}>
                        <Choix
                          actif={ancrePosition === "avant"}
                          libelle="Avant"
                          onPress={() => setAncrePosition("avant")}
                        />
                        <Choix
                          actif={ancrePosition === "apres"}
                          libelle="Après"
                          onPress={() => setAncrePosition("apres")}
                        />
                      </View>
                    )}
                    <Text style={[styles.aide, { color: t.textMuted }]}>
                      La routine se range au moment de son repère.
                    </Text>
                  </>
                )}

            {editeurEtapes()}
          </>
        )}

        {!plusOptions ? (
          <TouchableOpacity
            style={[styles.plusOptions, { borderColor: t.border }]}
            onPress={() => setPlusOptions(true)}
          >
            <Text style={[styles.plusOptionsTexte, { color: t.textPrimary }]}>
              Plus d&apos;options
            </Text>
            <Text style={[styles.plusOptionsDetail, { color: t.textMuted }]}>
              {typeEffectif === "routine"
                ? "Difficulté, domaine, durée, première action"
                : "Domaine, durée, première action"}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {typeEffectif === "routine" && (
              <>
                <Text style={[styles.label, { color: t.textSecondary }]}>
                  Difficulté
                </Text>
                <View style={styles.ligneChoix}>
                  {DIFFICULTES.map((d) => (
                    <Choix
                      key={d.valeur}
                      actif={effort === d.valeur}
                      libelle={d.libelle}
                      onPress={() => setEffort(d.valeur)}
                    />
                  ))}
                </View>
                <Text style={[styles.aide, { color: t.textMuted }]}>
                  Les jours difficiles, les routines exigeantes passent à part,
                  sans pression.
                </Text>

              </>
            )}

            <Text style={[styles.label, { color: t.textSecondary }]}>
              Domaine (facultatif)
            </Text>
            <View style={styles.ligneChoix}>
              {ORDRE_CATEGORIES.map((c) => (
                <Choix
                  key={c}
                  actif={categorie === c}
                  libelle={`${ICONES_CATEGORIE[c]} ${LIBELLES_CATEGORIE[c]}`}
                  couleurActive={couleurCat(c)}
                  onPress={() => setCategorie(categorie === c ? null : c)}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: t.textSecondary }]}>
              Durée estimée (facultatif)
            </Text>
            <View style={styles.ligneChoix}>
              {DUREES.map((d) => (
                <Choix
                  key={d}
                  actif={duree === d}
                  libelle={d === 60 ? "1 h ou +" : `${d} min`}
                  onPress={() => setDuree(duree === d ? null : d)}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: t.textSecondary }]}>
              Première petite action (facultatif)
            </Text>
            <TextInput
              style={styleInput}
              placeholder={
                mode === "tache"
                  ? "Ex : chercher le numéro"
                  : "Ex : sortir la guitare de sa housse"
              }
              placeholderTextColor={t.textMuted}
              value={premiereAction}
              onChangeText={setPremiereAction}
              returnKeyType="done"
            />
            <Text style={[styles.aide, { color: t.textMuted }]}>
              Le plus dur, c&apos;est de commencer. Une action de deux minutes
              suffit.
            </Text>
          </>
        )}

        <TouchableOpacity
          style={[
            styles.bouton,
            { backgroundColor: valide ? t.accent : t.bgCard },
          ]}
          onPress={onAjouter}
          disabled={!valide || enregistrement}
        >
          <Text
            style={[
              styles.boutonTexte,
              { color: valide ? t.textOnAccent : t.textMuted },
            ]}
          >
            {idModifie !== null
              ? "Enregistrer"
              : mode === "tache"
                ? "Ajouter la tâche"
                : "Ajouter la routine"}
          </Text>
        </TouchableOpacity>

        {idModifie !== null && (
          <TouchableOpacity
            style={[styles.boutonSupprimer, { borderColor: t.danger }]}
            onPress={onSupprimer}
            disabled={enregistrement}
          >
            <Text style={[styles.boutonSupprimerTexte, { color: t.danger }]}>
              {typeInitial === "routine"
                ? "Supprimer cette routine"
                : "Supprimer cette tâche"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  boutonSupprimer: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  boutonSupprimerTexte: { fontSize: typography.body, fontWeight: "600" },
  container: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  annuler: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  selecteur: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.sm,
  },
  selecteurBouton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  selecteurTexte: { fontSize: typography.small, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.body,
  },
  label: {
    fontSize: typography.small,
    fontWeight: "600",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  ligneChoix: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choix: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  choixTexte: { fontSize: typography.small, fontWeight: "500" },
  ligneJours: { flexDirection: "row", justifyContent: "space-between" },
  jour: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  jourTexte: { fontSize: typography.small, fontWeight: "600" },
  aide: { fontSize: typography.tiny, marginTop: 6, lineHeight: 17 },
  sousLabel: {
    fontSize: typography.small,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  plusOptions: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignItems: "center",
  },
  plusOptionsTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  plusOptionsDetail: {
    fontSize: typography.tiny,
    marginTop: 2,
    textAlign: "center",
  },
  etape: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: 6,
    gap: spacing.md,
  },
  etapeNumero: {
    width: 18,
    textAlign: "center",
    fontSize: typography.small,
    fontWeight: "600",
  },
  etapeNom: { flex: 1, fontSize: typography.bodySmall },
  etapeRetirer: { fontSize: 16 },
  etapeAjout: { flexDirection: "row", gap: spacing.sm },
  etapeType: { fontSize: typography.small, fontWeight: "600" },
  etapeBouton: {
    width: 46,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  etapeBoutonTexte: { fontSize: 22, fontWeight: "500" },
  bouton: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
});
