import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getFamille, type FamilleTemplate } from "../lib/catalogue";
import {
  DEMARRAGE_UNIVERSEL,
  DIFFICULTES,
  THEMES,
  type Difficulte,
} from "../lib/catalogue/difficultes";
import {
  addItem,
  getAncres,
  getItems,
  skipOnboarding,
  toggleAncre,
  type Ancre,
} from "../lib/db";
import {
  difficultesChoisies,
  enregistrerDifficultes,
} from "../lib/db/difficultes";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Mise en place guidée : ce qui est difficile → des routines prêtes →
 * (facultatif) juste après quoi → aperçu de la journée.
 * Une question par écran, des choix pré-cochés, rien à écrire.
 * Voir docs/mise-en-place-guidee.md.
 */

const MAX_DIFFICULTES = 2;
const MAX_ROUTINES = 3;

type Mode = "onboarding" | "ajout";
type Etape = 1 | 2 | 3 | 4;

type Groupe = {
  titre: string | null;
  familles: FamilleTemplate[];
  dejaEnPlace: number;
  lienAide: boolean;
};

const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const LIBELLES_MOMENT: Record<string, string> = {
  reveil: "Au réveil",
  matin: "Matin",
  midi: "Midi",
  "apres-midi": "Après-midi",
  soir: "Soir",
  coucher: "Au coucher",
  indifferent: "À tout moment",
};

function libelleRecurrence(r?: string): string | null {
  if (!r || r === "quotidien") return null;
  if (r === "hebdo") return "1 fois par semaine";
  if (r.startsWith("jours:")) {
    return `${r.slice(6).split(",").length} jours par semaine`;
  }
  return null;
}

/** Bloc de la journée où la routine apparaîtra sur l'accueil. */
function blocDe(moment: string): string {
  if (moment === "reveil" || moment === "matin") return "Matin";
  if (moment === "midi" || moment === "apres-midi" || moment === "apres_midi")
    return "Après-midi";
  if (moment === "soir" || moment === "coucher") return "Soir";
  return "À tout moment";
}
const ORDRE_BLOCS = ["Matin", "Après-midi", "Soir", "À tout moment"];

/** Le catalogue décrit le moment repère en toutes lettres ; on le relie aux ancres existantes. */
const REPERES: [string[], string][] = [
  [["reveil", "sonnerie"], "reveil"],
  [["petit-dejeuner", "petit dejeuner", "cafe"], "cafe"],
  [["dents", "brossage"], "dents"],
  [["partir", "depart"], "depart"],
  [["dejeuner"], "dejeuner"],
  [["rentre", "retour", "fin de journee"], "retour"],
  [["diner", "repas du soir"], "diner"],
  [["coucher", "oreiller"], "coucher"],
];

function ancreSuggeree(f: FamilleTemplate, ancres: Ancre[]): number | null {
  if (!f.ancre_suggeree) return null;
  const texte = normaliser(f.ancre_suggeree);
  for (const [indices, cle] of REPERES) {
    if (indices.some((i) => texte.includes(i))) {
      return ancres.find((a) => normaliser(a.nom).includes(cle))?.id ?? null;
    }
  }
  return null;
}

const premiereVariante = (f: FamilleTemplate) =>
  f.variantes.find((v) => v.rang === 1) ?? f.variantes[0];

export function MiseEnPlace({ mode }: { mode: Mode }) {
  const router = useRouter();
  const t = useTheme();

  const [etape, setEtape] = useState<Etape>(1);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [dejaChoisies, setDejaChoisies] = useState<string[]>([]);
  const [voirTout, setVoirTout] = useState(false);
  const [themeOuvert, setThemeOuvert] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [universel, setUniversel] = useState(false);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [cochees, setCochees] = useState<string[]>([]);
  const [pourquoi, setPourquoi] = useState<string | null>(null);

  const [ancres, setAncres] = useState<Ancre[]>([]);
  const [ancreDe, setAncreDe] = useState<Record<string, number | null>>({});
  const [actives, setActives] = useState<Set<string>>(new Set());
  const [enregistrement, setEnregistrement] = useState(false);

  const minuteurMessage = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defilement = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const [items, listeAncres, precedentes] = await Promise.all([
        getItems("actif"),
        getAncres(),
        difficultesChoisies(),
      ]);
      setActives(
        new Set(
          items.map((i) => i.template_id).filter((x): x is string => !!x),
        ),
      );
      setAncres(listeAncres);
      setDejaChoisies(precedentes);
    })();
    return () => {
      if (minuteurMessage.current) clearTimeout(minuteurMessage.current);
    };
  }, []);

  const afficherMessage = (texte: string) => {
    setMessage(texte);
    if (minuteurMessage.current) clearTimeout(minuteurMessage.current);
    minuteurMessage.current = setTimeout(() => setMessage(null), 3500);
  };

  const allerA = (e: Etape) => {
    setMessage(null);
    setEtape(e);
    defilement.current?.scrollTo({ y: 0, animated: false });
  };

  const quitter = async () => {
    if (mode === "onboarding") {
      await skipOnboarding();
      router.replace("/");
    } else {
      router.back();
    }
  };

  // ── Étape 1 : difficultés ────────────────────────────────────────────

  const basculerDifficulte = (id: string) => {
    if (choisies.includes(id)) {
      setChoisies(choisies.filter((x) => x !== id));
      return;
    }
    if (choisies.length >= MAX_DIFFICULTES) {
      afficherMessage(
        "Deux pour commencer. Retire-en une pour choisir celle-ci.",
      );
      return;
    }
    setChoisies([...choisies, id]);
  };

  const versEtape2 = (partirDeZero: boolean) => {
    setUniversel(partirDeZero);
    const vues = new Set<string>();
    const sources: {
      titre: string | null;
      ids: string[];
      lienAide: boolean;
    }[] = partirDeZero
      ? [{ titre: null, ids: DEMARRAGE_UNIVERSEL, lienAide: false }]
      : choisies.map((id) => {
          const d = DIFFICULTES.find((x) => x.id === id)!;
          return { titre: d.libelle, ids: d.routines, lienAide: !!d.lienAide };
        });

    const nouveauxGroupes: Groupe[] = sources.map((s) => {
      const toutes = s.ids
        .map((id) => getFamille(id))
        .filter((f): f is FamilleTemplate => !!f);
      const dejaEnPlace = toutes.filter((f) => actives.has(f.id)).length;
      const familles = toutes.filter((f) => {
        if (actives.has(f.id) || vues.has(f.id)) return false;
        vues.add(f.id);
        return true;
      });
      return { titre: s.titre, familles, dejaEnPlace, lienAide: s.lienAide };
    });

    // Pré-cocher : tout le démarrage universel, sinon la première de chaque difficulté.
    const precochees: string[] = [];
    for (const g of nouveauxGroupes) {
      const aCocher = partirDeZero ? g.familles : g.familles.slice(0, 1);
      for (const f of aCocher) {
        if (precochees.length < MAX_ROUTINES) precochees.push(f.id);
      }
    }

    setGroupes(nouveauxGroupes);
    setCochees(precochees);
    setPourquoi(null);
    allerA(2);
  };

  // ── Étape 2 : routines ───────────────────────────────────────────────

  const basculerRoutine = (id: string) => {
    if (cochees.includes(id)) {
      setCochees(cochees.filter((x) => x !== id));
      return;
    }
    if (cochees.length >= MAX_ROUTINES) {
      afficherMessage(
        "Trois pour commencer : ce qui démarre petit tient plus longtemps. Retire-en une pour prendre celle-ci.",
      );
      return;
    }
    setCochees([...cochees, id]);
  };

  const famillesCochees = cochees
    .map((id) => getFamille(id))
    .filter((f): f is FamilleTemplate => !!f);

  const versEtape3 = () => {
    const suggestions: Record<string, number | null> = {};
    for (const f of famillesCochees) {
      suggestions[f.id] =
        ancreDe[f.id] !== undefined ? ancreDe[f.id] : ancreSuggeree(f, ancres);
    }
    setAncreDe(suggestions);
    allerA(3);
  };

  // ── Fin : enregistrement ─────────────────────────────────────────────

  const terminer = async () => {
    if (enregistrement) return;
    setEnregistrement(true);
    try {
      for (const f of famillesCochees) {
        const v = premiereVariante(f);
        const ancreId = ancreDe[f.id] ?? null;
        await addItem({
          nom: v.libelle,
          type: "routine",
          recurrence: f.recurrence ?? "quotidien",
          template_id: f.id,
          variante_rang: v.rang,
          categorie: f.categorie,
          moment: f.moment === "indifferent" ? null : f.moment,
          effort: v.effort,
          duree_min: v.duree_min,
          premiere_action: v.premiere_action,
          ancre_id: ancreId,
          ancre_position: ancreId !== null ? "apres" : null,
        });
        if (ancreId !== null) {
          const a = ancres.find((x) => x.id === ancreId);
          if (a && a.active !== 1) await toggleAncre(ancreId, 1);
        }
      }
      await enregistrerDifficultes(choisies);
      if (mode === "onboarding") {
        await skipOnboarding();
        router.replace("/");
      } else {
        router.back();
      }
    } finally {
      setEnregistrement(false);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────

  const Tuile = ({ d }: { d: Difficulte }) => {
    const actif = choisies.includes(d.id);
    const precedente = !actif && dejaChoisies.includes(d.id);
    return (
      <TouchableOpacity
        style={[
          styles.tuile,
          {
            backgroundColor: actif ? t.bgHighlight : t.bgCard,
            borderColor: actif ? t.accent : "transparent",
          },
        ]}
        onPress={() => basculerDifficulte(d.id)}
        activeOpacity={0.7}
      >
        <View style={styles.tuileHaut}>
          <Text style={styles.tuileIcone}>{d.icone}</Text>
          {actif && <Text style={[styles.coche, { color: t.accent }]}>✓</Text>}
        </View>
        <Text
          style={[
            styles.tuileTexte,
            { color: actif ? t.accentText : t.textPrimary },
          ]}
        >
          {d.libelle}
        </Text>
        {precedente && (
          <Text style={[styles.tuileNote, { color: t.textMuted }]}>
            Déjà choisie
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const Grille = ({ liste }: { liste: Difficulte[] }) => (
    <View style={styles.grille}>
      {liste.map((d) => (
        <Tuile key={d.id} d={d} />
      ))}
    </View>
  );

  const resultatsRecherche = (() => {
    const q = normaliser(recherche).trim();
    if (q.length < 2) return null;
    const termes = q.split(/\s+/);
    return DIFFICULTES.filter((d) => {
      const corpus = normaliser(
        [
          d.libelle,
          ...d.routines.flatMap((id) => {
            const f = getFamille(id);
            return f ? [...f.mots_cles, ...f.problemes] : [];
          }),
        ].join(" "),
      );
      return termes.some((terme) => corpus.includes(terme));
    });
  })();

  const titreEtape =
    etape === 1
      ? "Qu'est-ce qui est difficile en ce moment ?"
      : etape === 2
        ? universel
          ? "Trois routines pour démarrer"
          : "Voilà par quoi commencer"
        : etape === 3
          ? "Juste après quoi ?"
          : "C'est prêt";

  const sousTitre =
    etape === 1
      ? "Choisis-en une ou deux. Tu pourras en ajouter d'autres plus tard."
      : etape === 2
        ? "Toutes dans leur version la plus simple. Trois au maximum : ce qui démarre petit tient plus longtemps."
        : etape === 3
          ? "Facultatif. Rattacher une routine à un moment qui existe déjà aide à ne pas l'oublier."
          : "Voilà ta journée. Tout se modifie ensuite depuis l'accueil.";

  const totalProposees = groupes.reduce((n, g) => n + g.familles.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView
        ref={defilement}
        contentContainerStyle={styles.contenu}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() =>
            etape === 1 ? quitter() : allerA((etape - 1) as Etape)
          }
          hitSlop={12}
        >
          <Text style={[styles.retour, { color: t.accentText }]}>
            {etape === 1
              ? mode === "onboarding"
                ? "Plus tard"
                : "← Annuler"
              : "← Retour"}
          </Text>
        </TouchableOpacity>

        {etape <= 3 && (
          <View style={styles.progression}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[
                  styles.progressionSegment,
                  { backgroundColor: n <= etape ? t.accent : t.bgCard },
                ]}
              />
            ))}
          </View>
        )}

        <Text style={[styles.titre, { color: t.textPrimary }]}>
          {titreEtape}
        </Text>
        <Text style={[styles.sousTitre, { color: t.textSecondary }]}>
          {sousTitre}
        </Text>

        {message && (
          <View style={[styles.message, { backgroundColor: t.bgHighlight }]}>
            <Text style={[styles.messageTexte, { color: t.accentText }]}>
              {message}
            </Text>
          </View>
        )}

        {/* ── Étape 1 ── */}
        {etape === 1 && (
          <>
            {!voirTout ? (
              <>
                <Grille liste={DIFFICULTES.filter((d) => d.frequente)} />
                <TouchableOpacity
                  style={[styles.lienLarge, { borderColor: t.border }]}
                  onPress={() => setVoirTout(true)}
                >
                  <Text
                    style={[styles.lienLargeTexte, { color: t.textPrimary }]}
                  >
                    Voir d'autres difficultés
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.recherche,
                    {
                      backgroundColor: t.bgCard,
                      borderColor: t.border,
                      color: t.textPrimary,
                    },
                  ]}
                  placeholder="Ou décris-le avec tes mots"
                  placeholderTextColor={t.textMuted}
                  value={recherche}
                  onChangeText={setRecherche}
                  returnKeyType="search"
                />
                {resultatsRecherche ? (
                  resultatsRecherche.length > 0 ? (
                    <Grille liste={resultatsRecherche} />
                  ) : (
                    <Text style={[styles.vide, { color: t.textMuted }]}>
                      Rien de proche. Essaie un autre mot, ou parcours les
                      thèmes.
                    </Text>
                  )
                ) : (
                  THEMES.map((th) => {
                    const ouvert = themeOuvert === th.id;
                    const liste = DIFFICULTES.filter((d) => d.theme === th.id);
                    const nbChoisies = liste.filter((d) =>
                      choisies.includes(d.id),
                    ).length;
                    return (
                      <View key={th.id}>
                        <TouchableOpacity
                          style={[styles.theme, { backgroundColor: t.bgCard }]}
                          onPress={() => setThemeOuvert(ouvert ? null : th.id)}
                        >
                          <Text style={styles.themeIcone}>{th.icone}</Text>
                          <Text
                            style={[
                              styles.themeTitre,
                              { color: t.textPrimary },
                            ]}
                          >
                            {th.titre}
                          </Text>
                          {nbChoisies > 0 && (
                            <Text
                              style={[
                                styles.themeCompte,
                                { color: t.accentText },
                              ]}
                            >
                              {nbChoisies} ✓
                            </Text>
                          )}
                          <Text
                            style={[styles.chevron, { color: t.textMuted }]}
                          >
                            {ouvert ? "−" : "+"}
                          </Text>
                        </TouchableOpacity>
                        {ouvert && <Grille liste={liste} />}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
        )}

        {/* ── Étape 2 ── */}
        {etape === 2 && (
          <>
            {totalProposees === 0 && (
              <Text style={[styles.vide, { color: t.textSecondary }]}>
                Tout ce qui répond à ces difficultés est déjà dans ta journée.
              </Text>
            )}
            {groupes.map((g, i) => (
              <View key={i} style={styles.groupe}>
                {g.titre && (
                  <Text
                    style={[styles.groupeTitre, { color: t.textSecondary }]}
                  >
                    {g.titre}
                  </Text>
                )}
                {g.familles.length === 0 && g.dejaEnPlace > 0 && (
                  <Text style={[styles.vide, { color: t.textMuted }]}>
                    Déjà en place dans ta journée.
                  </Text>
                )}
                {g.familles.map((f) => {
                  const v = premiereVariante(f);
                  const coche = cochees.includes(f.id);
                  const ouvert = pourquoi === f.id;
                  const details = [
                    LIBELLES_MOMENT[f.moment],
                    `${v.duree_min} min`,
                    libelleRecurrence(f.recurrence),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <View
                      key={f.id}
                      style={[
                        styles.routine,
                        {
                          backgroundColor: t.bgCard,
                          borderColor: coche ? t.accent : "transparent",
                        },
                      ]}
                    >
                      <View style={styles.routineLigne}>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.routineNom,
                              { color: t.textPrimary },
                            ]}
                          >
                            {v.libelle}
                          </Text>
                          <Text
                            style={[
                              styles.routineDetails,
                              { color: t.textSecondary },
                            ]}
                          >
                            {details}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => basculerRoutine(f.id)}
                          style={[
                            styles.prendre,
                            coche
                              ? {
                                  backgroundColor: t.accent,
                                  borderColor: t.accent,
                                }
                              : { borderColor: t.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.prendreTexte,
                              {
                                color: coche ? t.textOnAccent : t.textSecondary,
                              },
                            ]}
                          >
                            {coche ? "✓ Je prends" : "Je prends"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() => setPourquoi(ouvert ? null : f.id)}
                        hitSlop={8}
                      >
                        <Text
                          style={[styles.pourquoi, { color: t.accentText }]}
                        >
                          {ouvert ? "Masquer" : "Pourquoi ça aide"}
                        </Text>
                      </TouchableOpacity>
                      {ouvert && (
                        <Text
                          style={[
                            styles.justification,
                            { color: t.textSecondary },
                          ]}
                        >
                          {f.justification}
                        </Text>
                      )}
                    </View>
                  );
                })}
                {g.lienAide && (
                  <TouchableOpacity onPress={() => Linking.openURL("tel:3114")}>
                    <Text style={[styles.aide, { color: t.textMuted }]}>
                      Si ça ne va vraiment pas : le 3114, gratuit, 24 h/24.
                      Toucher pour appeler.
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {/* ── Étape 3 ── */}
        {etape === 3 &&
          famillesCochees.map((f) => {
            const choisie = ancreDe[f.id] ?? null;
            return (
              <View key={f.id} style={styles.groupe}>
                <Text style={[styles.routineNom, { color: t.textPrimary }]}>
                  {premiereVariante(f).libelle}
                </Text>
                <View style={styles.pastilles}>
                  {[{ id: null as number | null, nom: "Aucun" }, ...ancres].map(
                    (a) => {
                      const actif = choisie === a.id;
                      return (
                        <TouchableOpacity
                          key={a.id ?? "aucun"}
                          onPress={() =>
                            setAncreDe({ ...ancreDe, [f.id]: a.id })
                          }
                          style={[
                            styles.pastille,
                            {
                              backgroundColor: actif ? t.accent : t.bgCard,
                              borderColor: actif ? t.accent : t.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pastilleTexte,
                              {
                                color: actif ? t.textOnAccent : t.textSecondary,
                              },
                            ]}
                          >
                            {a.nom}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>
            );
          })}

        {/* ── Étape 4 ── */}
        {etape === 4 &&
          ORDRE_BLOCS.map((bloc) => {
            const dans = famillesCochees.filter((f) => {
              const a = ancres.find((x) => x.id === ancreDe[f.id]);
              return blocDe(a ? a.moment : f.moment) === bloc;
            });
            if (dans.length === 0) return null;
            return (
              <View key={bloc} style={styles.groupe}>
                <Text style={[styles.bloc, { color: t.accentText }]}>
                  {bloc}
                </Text>
                {dans.map((f) => {
                  const a = ancres.find((x) => x.id === ancreDe[f.id]);
                  return (
                    <View
                      key={f.id}
                      style={[styles.apercu, { backgroundColor: t.bgCard }]}
                    >
                      <Text
                        style={[styles.routineNom, { color: t.textPrimary }]}
                      >
                        ○{" "}
                        {a ? (
                          <Text style={{ color: t.accentText }}>
                            Après {a.nom.toLowerCase()} →{" "}
                          </Text>
                        ) : null}
                        {premiereVariante(f).libelle}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
      </ScrollView>

      {/* Boutons du bas, toujours à la même place */}
      <View
        style={[
          styles.pied,
          { borderTopColor: t.border, backgroundColor: t.bgApp },
        ]}
      >
        {etape === 1 && (
          <>
            <TouchableOpacity
              style={[styles.principal, { backgroundColor: t.accent }]}
              onPress={() =>
                choisies.length > 0 ? versEtape2(false) : quitter()
              }
            >
              <Text style={[styles.principalTexte, { color: t.textOnAccent }]}>
                {choisies.length > 0 ? "Continuer" : "Passer"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaire}
              onPress={() => versEtape2(true)}
            >
              <Text style={[styles.secondaireTexte, { color: t.accentText }]}>
                Je ne sais pas par où commencer
              </Text>
            </TouchableOpacity>
          </>
        )}
        {etape === 2 && (
          <>
            <TouchableOpacity
              style={[styles.principal, { backgroundColor: t.accent }]}
              onPress={() => (cochees.length > 0 ? versEtape3() : quitter())}
            >
              <Text style={[styles.principalTexte, { color: t.textOnAccent }]}>
                {cochees.length > 0
                  ? `Continuer (${cochees.length})`
                  : "Passer"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaire}
              onPress={() => router.push("/nouvelle-tache?type=routine")}
            >
              <Text style={[styles.secondaireTexte, { color: t.accentText }]}>
                Créer la mienne
              </Text>
            </TouchableOpacity>
          </>
        )}
        {etape === 3 && (
          <>
            <TouchableOpacity
              style={[styles.principal, { backgroundColor: t.accent }]}
              onPress={() => allerA(4)}
            >
              <Text style={[styles.principalTexte, { color: t.textOnAccent }]}>
                Continuer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaire}
              onPress={() => {
                const aucune: Record<string, number | null> = {};
                for (const f of famillesCochees) aucune[f.id] = null;
                setAncreDe(aucune);
                allerA(4);
              }}
            >
              <Text style={[styles.secondaireTexte, { color: t.accentText }]}>
                Passer cette étape
              </Text>
            </TouchableOpacity>
          </>
        )}
        {etape === 4 && (
          <TouchableOpacity
            style={[styles.principal, { backgroundColor: t.accent }]}
            onPress={terminer}
          >
            <Text style={[styles.principalTexte, { color: t.textOnAccent }]}>
              {enregistrement ? "Un instant…" : "C'est parti"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  retour: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  progression: { flexDirection: "row", gap: 6, marginBottom: spacing.lg },
  progressionSegment: { flex: 1, height: 4, borderRadius: 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", lineHeight: 30 },
  sousTitre: {
    fontSize: typography.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  message: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  messageTexte: {
    fontSize: typography.small,
    fontWeight: "600",
    lineHeight: 18,
  },

  grille: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm,
    marginBottom: spacing.md,
  },
  tuile: {
    width: "48.5%",
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.md,
  },
  tuileHaut: { flexDirection: "row", justifyContent: "space-between" },
  tuileIcone: { fontSize: 22 },
  coche: { fontSize: 18, fontWeight: "700" },
  tuileTexte: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 6,
  },
  tuileNote: { fontSize: typography.tiny, marginTop: 4 },

  lienLarge: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  lienLargeTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  recherche: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.body,
    marginBottom: spacing.md,
  },
  vide: { fontSize: typography.small, fontStyle: "italic", lineHeight: 19 },
  theme: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  themeIcone: { fontSize: 20 },
  themeTitre: { flex: 1, fontSize: typography.body, fontWeight: "600" },
  themeCompte: { fontSize: typography.small, fontWeight: "700" },
  chevron: { fontSize: 20, width: 16, textAlign: "center" },

  groupe: { marginBottom: spacing.lg },
  groupeTitre: {
    fontSize: typography.small,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  routine: {
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  routineLigne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  routineNom: { fontSize: typography.body, fontWeight: "600", lineHeight: 21 },
  routineDetails: { fontSize: typography.small, marginTop: 2 },
  prendre: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  prendreTexte: { fontSize: typography.small, fontWeight: "600" },
  pourquoi: {
    fontSize: typography.small,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  justification: {
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: 6,
  },
  aide: { fontSize: typography.small, textDecorationLine: "underline" },

  pastilles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pastille: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  pastilleTexte: { fontSize: typography.small, fontWeight: "500" },

  bloc: {
    fontSize: typography.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  apercu: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },

  pied: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  principal: {
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  principalTexte: { fontSize: typography.body, fontWeight: "600" },
  secondaire: { alignItems: "center", paddingTop: spacing.md },
  secondaireTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
});
