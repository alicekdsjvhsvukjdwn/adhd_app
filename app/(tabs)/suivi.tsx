import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
      <Text style={[styles.puceTexte, { color: actif ? t.textOnAccent : t.textSecondary }]}>
        {libelle}
      </Text>
    </TouchableOpacity>
  );

  const derniere = sommeil?.derniere;
  const nuitDuJourNotee = derniere?.date === aujourdhui;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Text style={[styles.titre, { color: t.textPrimary }]}>Suivi</Text>

      {/* ── Sommeil ── */}
      <Text style={[styles.section, { color: t.textPrimary }]}>🌙 Sommeil</Text>
      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        {derniere ? (
          <>
            <Text style={[styles.ligneForte, { color: t.textPrimary }]}>
              Dernière nuit : {dureeLisible(derniere.duree_min)} · {QUALITES[derniere.qualite]}
            </Text>
            <Text style={[styles.ligne, { color: t.textSecondary }]}>
              {derniere.coucher} → {derniere.lever} ·{" "}
              {derniere.ecrans ? "avec écrans" : "sans écrans"}
              {nuitDuJourNotee ? "" : ` · nuit du ${derniere.date.slice(8)}/${derniere.date.slice(5, 7)}`}
            </Text>
            <Text style={[styles.ligne, { color: t.textSecondary }]}>
              {sommeil.moyenne7j !== null
                ? `Moyenne sur 7 jours : ${dureeLisible(sommeil.moyenne7j)} (${sommeil.nuits7j} nuit${sommeil.nuits7j > 1 ? "s" : ""})`
                : "Aucune nuit notée ces 7 derniers jours."}
            </Text>
            <Text style={[styles.ligne, { color: t.textSecondary }]}>
              {phraseRegularite(sommeil.ecartCoucher)}
            </Text>
          </>
        ) : (
          <Text style={[styles.ligne, { color: t.textSecondary }]}>
            Aucune nuit notée pour l&apos;instant.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: nuitDuJourNotee ? t.bgApp : t.accent }]}
          onPress={() => router.push("/sommeil")}
        >
          <Text
            style={[styles.boutonTexte, { color: nuitDuJourNotee ? t.accentText : t.textOnAccent }]}
          >
            {nuitDuJourNotee ? "Corriger cette nuit" : "Noter cette nuit"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Sport ── */}
      <Text style={[styles.section, { color: t.textPrimary }]}>💪 Sport</Text>
      {reglages && !reglages.configure ? (
        <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
          <Text style={[styles.ligneForte, { color: t.textPrimary }]}>
            As-tu une barre de traction ?
          </Text>
          <View style={styles.puces}>
            {puce(barre === true, "Oui", () => setBarre(true))}
            {puce(barre === false, "Non", () => setBarre(false))}
          </View>

          {barre !== null && (
            <>
              <Text style={[styles.ligneForte, { color: t.textPrimary, marginTop: spacing.lg }]}>
                Par où commencer ?
              </Text>
              {FAMILLES.map((f) => (
                <View key={f} style={{ marginTop: spacing.md }}>
                  <Text style={[styles.ligne, { color: t.textSecondary }]}>
                    {LIBELLES_FAMILLE[f]}
                  </Text>
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
                <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>C&apos;est parti</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : reglages?.configure ? (
        <>
          <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <Text style={[styles.ligneForte, { color: t.textPrimary }]}>
              {semaine}/{SEANCES_PAR_SEMAINE} séances ces 7 derniers jours
            </Text>
            <Text style={[styles.ligne, { color: t.textMuted }]}>
              Rythme indicatif, sans jour imposé.
            </Text>
            <TouchableOpacity
              style={[styles.bouton, { backgroundColor: t.accent }]}
              onPress={() => router.push("/seance")}
            >
              <Text style={[styles.boutonTexte, { color: t.textOnAccent }]}>
                Commencer une séance
              </Text>
            </TouchableOpacity>
          </View>

          {exercices.map((ex) => (
            <View key={ex.famille} style={[styles.carte, { backgroundColor: t.bgCard }]}>
              <TouchableOpacity
                onPress={() => ouvrir(ex.famille)}
                accessibilityRole="button"
                accessibilityState={{ expanded: ouverte === ex.famille }}
              >
                <Text style={[styles.famille, { color: t.accentText }]}>
                  {LIBELLES_FAMILLE[ex.famille]} · palier {ex.numero}/{ex.max}
                </Text>
                <Text style={[styles.ligneForte, { color: t.textPrimary }]}>
                  {ex.palier.nom} {ouverte === ex.famille ? "−" : "+"}
                </Text>
              </TouchableOpacity>

              {ex.montee && (
                <View style={[styles.montee, { backgroundColor: t.bgHighlight }]}>
                  <Text style={[styles.ligne, { color: t.textPrimary }]}>
                    Objectif atteint deux fois de suite. Passer à «{" "}
                    {palier(ex.famille, ex.numero + 1).nom} » ?
                  </Text>
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
                    <Text style={[styles.ligne, { color: t.textMuted }]}>
                      Pas encore de séance.
                    </Text>
                  ) : (
                    (() => {
                      const max = Math.max(...historique.map((h) => h.meilleure));
                      return historique.map((h, i) => (
                        <View key={i} style={styles.histo}>
                          <Text style={[styles.histoDate, { color: t.textMuted }]}>
                            {h.date.slice(8)}/{h.date.slice(5, 7)}
                          </Text>
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
                          <Text style={[styles.histoTexte, { color: t.textSecondary }]}>
                            {h.series.join(" · ")} {h.unite === "s" ? "s" : ""}
                            {h.palier !== ex.numero ? ` (p. ${h.palier})` : ""}
                          </Text>
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
                      <Text style={[styles.lien, { color: t.accentText }]}>
                        Redescendre à « {palier(ex.famille, ex.numero - 1).nom} »
                      </Text>
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
