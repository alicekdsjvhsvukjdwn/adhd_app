import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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
import { addItem, getItem, modifierItem } from "../lib/db";
import { enregistrerEtapes, getEtapes } from "../lib/db/etapes";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import {
  ICONES_CATEGORIE,
  LIBELLES_CATEGORIE,
  ORDRE_CATEGORIES,
  useCouleurCategorie,
} from "../lib/theme-categories";
import { versionsDe } from "../lib/versions";

/**
 * Écran d'ajout unique : une tâche (une fois) ou une routine (régulièrement).
 * Seul le nom est obligatoire : noter doit prendre quelques secondes.
 * - ?type=routine : démarre sur « Régulièrement »
 * - ?id=12 : modifie l'item 12 au lieu d'en créer un
 */

type Mode = "tache" | "routine";
type Importance = 1 | 2 | 3;

const IMPORTANCES: { valeur: Importance; libelle: string }[] = [
  { valeur: 3, libelle: "Essentiel" },
  { valeur: 2, libelle: "Utile" },
  { valeur: 1, libelle: "Bonus" },
];

const ECHEANCES: { jours: number | null; libelle: string }[] = [
  { jours: null, libelle: "Aucune" },
  { jours: 0, libelle: "Aujourd'hui" },
  { jours: 1, libelle: "Demain" },
  { jours: 3, libelle: "Dans 3 jours" },
  { jours: 7, libelle: "Dans 1 semaine" },
  { jours: 14, libelle: "Dans 2 semaines" },
];

/** Valeurs alignées sur le type Moment du catalogue. */
const MOMENTS: { valeur: string | null; libelle: string }[] = [
  { valeur: "matin", libelle: "☀️ Matin" },
  { valeur: "apres-midi", libelle: "🌤️ Après-midi" },
  { valeur: "soir", libelle: "🌙 Soir" },
  { valeur: null, libelle: "À tout moment" },
];

/** Moments du catalogue qui n'ont pas de bouton : affichés seulement s'ils sont déjà choisis. */
const AUTRES_MOMENTS: Record<string, string> = {
  reveil: "⏰ Réveil",
  midi: "🍽️ Midi",
  coucher: "🛏️ Coucher",
  apres_midi: "🌤️ Après-midi",
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

export default function Ajouter() {
  const router = useRouter();
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    nom?: string;
  }>();
  const idModifie = params.id ? Number(params.id) : null;
  const [typeInitial, setTypeInitial] = useState<Mode | null>(null);

  const [mode, setMode] = useState<Mode>(
    params.type === "routine" ? "routine" : "tache",
  );
  const [nom, setNom] = useState(params.nom ?? "");
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [duree, setDuree] = useState<number | null>(null);
  const [premiereAction, setPremiereAction] = useState("");

  // Tâche
  const [importance, setImportance] = useState<Importance>(2);
  const [echeance, setEcheance] = useState<string | null>(null);

  // Routine
  const [moment, setMoment] = useState<string | null>("matin");
  const [jours, setJours] = useState<number[]>(TOUS_LES_JOURS);

  // Routine : versions selon l'énergie
  const [versionCourte, setVersionCourte] = useState("");
  const [versionLongue, setVersionLongue] = useState("");
  const [suggestionsVersions, setSuggestionsVersions] = useState<{
    courte: string | null;
    longue: string | null;
  }>({ courte: null, longue: null });

  // Tâche : étapes
  const [etapes, setEtapes] = useState<
    { id?: number; nom: string; faite?: number }[]
  >([]);
  const [nouvelleEtape, setNouvelleEtape] = useState("");

  const [enregistrement, setEnregistrement] = useState(false);
  const [chargement, setChargement] = useState(idModifie !== null);

  // Mode modification : pré-remplir avec l'item existant.
  useEffect(() => {
    if (idModifie === null) return;
    (async () => {
      const item = await getItem(idModifie);
      if (item) {
        const m: Mode = item.type === "routine" ? "routine" : "tache";
        setMode(m);
        setTypeInitial(m);
        setNom(item.nom);
        setCategorie(
          item.categorie && CATEGORIES_VALIDES.includes(item.categorie)
            ? (item.categorie as Categorie)
            : null,
        );
        setDuree(item.duree_min);
        setPremiereAction(item.premiere_action ?? "");
        setImportance(Math.max(1, Math.min(3, item.importance)) as Importance);
        setEcheance(item.echeance);
        setMoment(item.moment === "indifferent" ? null : item.moment);
        setJours(joursDe(item.recurrence, item.cree_le));
        setVersionCourte(item.version_courte ?? "");
        setVersionLongue(item.version_longue ?? "");
        // Ce que proposerait le catalogue, affiché en exemple dans les champs vides
        const duCatalogue = versionsDe({
          ...item,
          version_courte: null,
          version_longue: null,
        });
        setSuggestionsVersions({
          courte: duCatalogue.distincte.courte ? duCatalogue.courte.nom : null,
          longue: duCatalogue.distincte.longue ? duCatalogue.longue.nom : null,
        });
        setEtapes(
          (await getEtapes(item.id)).map((e) => ({
            id: e.id,
            nom: e.nom,
            faite: e.faite,
          })),
        );
      }
      setChargement(false);
    })();
  }, [idModifie]);

  const valide =
    nom.trim().length > 0 && (mode === "tache" || jours.length > 0);

  const basculerJour = (j: number) =>
    setJours((actuels) =>
      actuels.includes(j) ? actuels.filter((x) => x !== j) : [...actuels, j],
    );

  const onAjouter = async () => {
    if (!valide || enregistrement) return;
    setEnregistrement(true);
    try {
      const commun = {
        nom: nom.trim(),
        categorie,
        duree_min: duree,
        premiere_action: premiereAction.trim() || null,
      };
      if (idModifie !== null) {
        // Passer d'une tâche à une routine (ou l'inverse) : l'item redevient actif.
        const changeDeType = typeInitial !== null && typeInitial !== mode;
        await modifierItem(idModifie, {
          ...commun,
          type: mode,
          ...(changeDeType ? { statut: "actif" as const } : {}),
          ...(mode === "tache"
            ? { importance, echeance, recurrence: null }
            : {
                recurrence: recurrenceDe(jours),
                moment,
                version_courte: versionCourte.trim() || null,
                version_longue: versionLongue.trim() || null,
              }),
        });
        if (mode === "tache") await enregistrerEtapes(idModifie, etapes);
      } else if (mode === "tache") {
        const id = await addItem({
          ...commun,
          type: "tache",
          importance,
          echeance,
        });
        if (etapes.length > 0) await enregistrerEtapes(id, etapes);
      } else {
        await addItem({
          ...commun,
          type: "routine",
          recurrence: recurrenceDe(jours),
          moment,
          version_courte: versionCourte.trim() || null,
          version_longue: versionLongue.trim() || null,
        });
      }
      router.back();
    } finally {
      setEnregistrement(false);
    }
  };

  const Choix = ({
    actif,
    libelle,
    onPress,
    couleurActive,
  }: {
    actif: boolean;
    libelle: string;
    onPress: () => void;
    couleurActive?: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.choix,
        {
          backgroundColor: actif ? (couleurActive ?? t.accent) : t.bgCard,
          borderColor: actif ? (couleurActive ?? t.accent) : t.border,
        },
      ]}
      onPress={onPress}
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

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bgApp }}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

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

        {/* Une fois / Régulièrement */}
        <View style={[styles.selecteur, { backgroundColor: t.bgCard }]}>
          {(
            [
              { valeur: "tache", libelle: "Une fois" },
              { valeur: "routine", libelle: "Régulièrement" },
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
          {mode === "tache"
            ? "Une tâche disparaît une fois faite."
            : "Une routine revient les jours choisis."}
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

        {mode === "tache" ? (
          <>
            <Text style={[styles.label, { color: t.textSecondary }]}>
              Importance
            </Text>
            <View style={styles.ligneChoix}>
              {IMPORTANCES.map((i) => (
                <Choix
                  key={i.valeur}
                  actif={importance === i.valeur}
                  libelle={i.libelle}
                  onPress={() => setImportance(i.valeur)}
                />
              ))}
            </View>

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
                    e.jours !== null && dateDansJours(e.jours) === echeance,
                ) && (
                  <Choix
                    actif
                    libelle={dateCourte(echeance)}
                    onPress={() => {}}
                  />
                )}
            </View>

            <Text style={[styles.label, { color: t.textSecondary }]}>
              Étapes (facultatif)
            </Text>
            <Text
              style={[
                styles.aide,
                { color: t.textMuted, marginTop: 0, marginBottom: spacing.sm },
              ]}
            >
              Pour une grosse tâche : des petits morceaux à cocher un par un.
              Chaque étape rapporte des points, et finir le tout donne un bonus.
            </Text>
            {etapes.map((e, i) => (
              <View
                key={e.id ?? `n${i}`}
                style={[styles.etape, { backgroundColor: t.bgCard }]}
              >
                <Text style={[styles.etapeNumero, { color: t.textMuted }]}>
                  {e.faite ? "✓" : i + 1}
                </Text>
                <Text style={[styles.etapeNom, { color: t.textPrimary }]}>
                  {e.nom}
                </Text>
                <TouchableOpacity
                  onPress={() => setEtapes(etapes.filter((_, k) => k !== i))}
                  hitSlop={10}
                >
                  <Text style={[styles.etapeRetirer, { color: t.textMuted }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.etapeAjout}>
              <TextInput
                style={[styleInput, { flex: 1 }]}
                placeholder={
                  etapes.length === 0
                    ? "Ex : trouver le formulaire"
                    : "Étape suivante"
                }
                placeholderTextColor={t.textMuted}
                value={nouvelleEtape}
                onChangeText={setNouvelleEtape}
                onSubmitEditing={() => {
                  if (!nouvelleEtape.trim()) return;
                  setEtapes([...etapes, { nom: nouvelleEtape.trim() }]);
                  setNouvelleEtape("");
                }}
                blurOnSubmit={false}
                returnKeyType="next"
              />
              <TouchableOpacity
                style={[styles.etapeBouton, { backgroundColor: t.accent }]}
                onPress={() => {
                  if (!nouvelleEtape.trim()) return;
                  setEtapes([...etapes, { nom: nouvelleEtape.trim() }]);
                  setNouvelleEtape("");
                }}
              >
                <Text
                  style={[styles.etapeBoutonTexte, { color: t.textOnAccent }]}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
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
              Selon ton énergie (facultatif)
            </Text>
            <Text
              style={[
                styles.aide,
                { color: t.textMuted, marginTop: 0, marginBottom: spacing.sm },
              ]}
            >
              La version affichée change avec ton énergie du jour. Les trois
              rapportent les mêmes points.
            </Text>
            <Text style={[styles.sousLabel, { color: t.textSecondary }]}>
              🪫 Version courte, quand l'énergie est basse
            </Text>
            <TextInput
              style={styleInput}
              placeholder={
                suggestionsVersions.courte ?? "Ex : deux minutes seulement"
              }
              placeholderTextColor={t.textMuted}
              value={versionCourte}
              onChangeText={setVersionCourte}
              returnKeyType="done"
            />
            <Text style={[styles.sousLabel, { color: t.textSecondary }]}>
              ⚡ Version longue, quand l'énergie est haute
            </Text>
            <TextInput
              style={styleInput}
              placeholder={suggestionsVersions.longue ?? "Ex : vingt minutes"}
              placeholderTextColor={t.textMuted}
              value={versionLongue}
              onChangeText={setVersionLongue}
              returnKeyType="done"
            />
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
          Le plus dur, c'est de commencer. Une action de deux minutes suffit.
        </Text>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
