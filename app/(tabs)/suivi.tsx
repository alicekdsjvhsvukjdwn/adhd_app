import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../../components/Texte";
import { useJourCourant } from "../../hooks/useJourCourant";
import { resumeSommeil, type ResumeSommeil } from "../../lib/db/sommeil";
import {
  changerPalier,
  configurerSport,
  getReglages,
  historiqueFamille,
  refuserMontee,
  seanceProposee,
  seancesCetteSemaine,
  type ExerciceDuJour,
  type Reglages,
  type SeanceHistorique,
} from "../../lib/db/sport";
import {
  dureeLisible,
  ECHELLES,
  FAMILLES,
  LIBELLES_FAMILLE,
  nbPaliers,
  palier,
  phraseRegularite,
  QUALITES,
  SEANCES_PAR_SEMAINE,
  type Famille,
} from "../../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

/**
 * Suivi du sommeil et du sport. Rien ici ne change le tri des tâches,
 * les routines ou Jour difficile : les liens se lisent dans Progression.
 */
export default function Suivi() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();

  const [sommeil, setSommeil] = useState<ResumeSommeil | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [exercices, setExercices] = useState<ExerciceDuJour[]>([]);
  const [semaine, setSemaine] = useState(0);
  const [ouverte, setOuverte] = useState<Famille | null>(null);
  const [historique, setHistorique] = useState<SeanceHistorique[]>([]);

  // Premier lancement du sport
  const [barre, setBarre] = useState<boolean | null>(null);
  const [depart, setDepart] = useState<Record<Famille, number | "inconnu">>({
    pousser: "inconnu",
    tirer: "inconnu",
    jambes: "inconnu",
    gainage: "inconnu",
  });

  const charger = useCallback(async () => {
    setSommeil(await resumeSommeil());
    const r = await getReglages();
    setReglages(r);
    if (r.configure) {
      setExercices(await seanceProposee());
      setSemaine(await seancesCetteSemaine());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger, aujourdhui]),
  );

  const ouvrir = async (f: Famille) => {
    if (ouverte === f) return setOuverte(null);
    setHistorique(await historiqueFamille(f));
    setOuverte(f);
  };

  const puce = (actif: boolean, libelle: string, onPress: () => void) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[
        styles.puce,
        { backgroundColor: actif ? t.accent : t.bgApp, borderColor: actif ? t.accent : t.border },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={[styles.puceTexte, { color: actif ? t.textOnAccent : t.textSecondary }]}>
        {libelle}
      </Texte>
    </TouchableOpacity>
  );

  const derniere = sommeil?.derniere;
  const nuitDuJourNotee = derniere?.date === aujourdhui;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Suivi</Texte>

      {/* ── Sommeil ── */}
      <Texte style={[styles.section, { color: t.textPrimary }]}>🌙 Sommeil</Texte>
      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        {derniere ? (
          <>
            <Texte style={[styles.ligneForte, { color: t.textPrimary }]}>
              Dernière nuit : {dureeLisible(derniere.duree_min)} · {QUALITES[derniere.qualite]}
            </Texte>
            <Texte style={[styles.ligne, { color: t.textSecondary }]}>
              {derniere.coucher} → {derniere.lever} ·{" "}
              {derniere.ecrans ? "avec écrans" : "sans écrans"}
              {nuitDuJourNotee ? "" : ` · nuit du ${derniere.date.slice(8)}/${derniere.date.slice(5, 7)}`}
            </Texte>
            <Texte style={[styles.ligne, { color: t.textSecondary }]}>
              {sommeil.moyenne7j !== null
                ? `Moyenne sur 7 jours : ${dureeLisible(sommeil.moyenne7j)} (${sommeil.nuits7j} nuit${sommeil.nuits7j > 1 ? "s" : ""})`
                : "Aucune nuit notée ces 7 derniers jours."}
            </Texte>
            <Texte style={[styles.ligne, { color: t.textSecondary }]}>
              {phraseRegularite(sommeil.ecartCoucher)}
            </Texte>
          </>
        ) : (
          <Texte style={[styles.ligne, { color: t.textSecondary }]}>
            Aucune nuit notée pour l&apos;instant.
          </Texte>
        )}
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: nuitDuJourNotee ? t.bgApp : t.accent }]}
          onPress={() => router.push("/sommeil")}
        >
          <Texte
            style={[styles.boutonTexte, { color: nuitDuJourNotee ? t.accentText : t.textOnAccent }]}
          >
            {nuitDuJourNotee ? "Corriger cette nuit" : "Noter cette nuit"}
          </Texte>
        </TouchableOpacity>
      </View>

      {/* ── Sport ── */}
      <Texte style={[styles.section, { color: t.textPrimary }]}>💪 Sport</Texte>
      {reglages && !reglages.configure ? (
        <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
          <Texte style={[styles.ligneForte, { color: t.textPrimary }]}>
            As-tu une barre de traction ?
          </Texte>
          <View style={styles.puces}>
            {puce(barre === true, "Oui", () => setBarre(true))}
            {puce(barre === false, "Non", () => setBarre(false))}
          </View>

          {barre !== null && (
            <>
              <Texte style={[styles.ligneForte, { color: t.textPrimary, marginTop: spacing.lg }]}>
                Par où commencer ?
              </Texte>
              {FAMILLES.map((f) => (
                <View key={f} style={{ marginTop: spacing.md }}>
                  <Texte style={[styles.ligne, { color: t.textSecondary }]}>
                    {LIBELLES_FAMILLE[f]}
                  </Texte>
                  <View style={styles.puces}>
                    {puce(depart[f] === "inconnu", "Je ne sais pas", () =>
                      setDepart({ ...depart, [f]: "inconnu" }),
                    )}
                    {ECHELLES[f].slice(0, nbPaliers(f, barre)).map((p, i) =>
                      puce(depart[f] === i + 1, `${i + 1}. ${p.nom}`, () =>
                        setDepart({ ...depart, [f]: i + 1 }),
                      ),
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.bouton, { backgroundColor: t.accent }]}
                onPress={async () => {
                  await configurerSport(barre, depart);
                  await charger();
                }}
              >
                <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>C&apos;est parti</Texte>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : reglages?.configure ? (
        <>
          <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <Texte style={[styles.ligneForte, { color: t.textPrimary }]}>
              {semaine}/{SEANCES_PAR_SEMAINE} séances ces 7 derniers jours
            </Texte>
            <Texte style={[styles.ligne, { color: t.textMuted }]}>
              Rythme indicatif, sans jour imposé.
            </Texte>
            <TouchableOpacity
              style={[styles.bouton, { backgroundColor: t.accent }]}
              onPress={() => router.push("/seance")}
            >
              <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>
                Commencer une séance
              </Texte>
            </TouchableOpacity>
          </View>

          {exercices.map((ex) => (
            <View key={ex.famille} style={[styles.carte, { backgroundColor: t.bgCard }]}>
              <TouchableOpacity
                onPress={() => ouvrir(ex.famille)}
                accessibilityRole="button"
                accessibilityState={{ expanded: ouverte === ex.famille }}
              >
                <Texte style={[styles.famille, { color: t.accentText }]}>
                  {LIBELLES_FAMILLE[ex.famille]} · palier {ex.numero}/{ex.max}
                </Texte>
                <Texte style={[styles.ligneForte, { color: t.textPrimary }]}>
                  {ex.palier.nom} {ouverte === ex.famille ? "−" : "+"}
                </Texte>
              </TouchableOpacity>

              {ex.montee && (
                <View style={[styles.montee, { backgroundColor: t.bgHighlight }]}>
                  <Texte style={[styles.ligne, { color: t.textPrimary }]}>
                    Objectif atteint deux fois de suite. Passer à «{" "}
                    {palier(ex.famille, ex.numero + 1).nom} » ?
                  </Texte>
                  <View style={styles.puces}>
                    {puce(true, "Monter", async () => {
                      await changerPalier(ex.famille, ex.numero + 1, "propose_accepte");
                      await charger();
                    })}
                    {puce(false, "Pas encore", async () => {
                      await refuserMontee(ex.famille);
                      await charger();
                    })}
                  </View>
                </View>
              )}

              {ouverte === ex.famille && (
                <View style={{ marginTop: spacing.md }}>
                  {historique.length === 0 ? (
                    <Texte style={[styles.ligne, { color: t.textMuted }]}>
                      Pas encore de séance.
                    </Texte>
                  ) : (
                    (() => {
                      const max = Math.max(...historique.map((h) => h.meilleure));
                      return historique.map((h, i) => (
                        <View key={i} style={styles.histo}>
                          <Texte style={[styles.histoDate, { color: t.textMuted }]}>
                            {h.date.slice(8)}/{h.date.slice(5, 7)}
                          </Texte>
                          <View style={[styles.barreFond, { backgroundColor: t.bgApp }]}>
                            <View
                              style={{
                                width: `${(h.meilleure / max) * 100}%`,
                                height: "100%",
                                borderRadius: 4,
                                backgroundColor: h.palier === ex.numero ? t.accent : t.border,
                              }}
                            />
                          </View>
                          <Texte style={[styles.histoTexte, { color: t.textSecondary }]}>
                            {h.series.join(" · ")} {h.unite === "s" ? "s" : ""}
                            {h.palier !== ex.numero ? ` (p. ${h.palier})` : ""}
                          </Texte>
                        </View>
                      ));
                    })()
                  )}
                  {ex.numero > 1 && (
                    <TouchableOpacity
                      onPress={async () => {
                        await changerPalier(ex.famille, ex.numero - 1, "manuel");
                        await charger();
                      }}
                      hitSlop={8}
                      style={{ marginTop: spacing.sm }}
                    >
                      <Texte style={[styles.lien, { color: t.accentText }]}>
                        Redescendre à « {palier(ex.famille, ex.numero - 1).nom} »
                      </Texte>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  section: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  ligneForte: { fontSize: typography.body, fontWeight: "600" },
  ligne: { fontSize: typography.small, lineHeight: 19, marginTop: 4 },
  famille: { fontSize: typography.tiny, fontWeight: "700", textTransform: "uppercase" },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  puce: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  puceTexte: { fontSize: typography.small, fontWeight: "600" },
  montee: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  histo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  histoDate: { width: 40, fontSize: typography.tiny },
  barreFond: { width: 70, height: 8, borderRadius: 4, overflow: "hidden" },
  histoTexte: { flex: 1, fontSize: typography.small },
  lien: { fontSize: typography.small, fontWeight: "600" },
});
