import { useFocusEffect, useRouter } from "expo-router";
import { Dumbbell, Flower2, Moon, Sun } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { JOURS_LONGS } from "../../components/CalendrierMois";
import { FeuilleSeanceNotee } from "../../components/FeuillesSport";
import { SelecteurHeure } from "../../components/SelecteurHeure";
import { Texte } from "../../components/Texte";
import { useJourCourant } from "../../hooks/useJourCourant";
import { decalerJours } from "../../lib/dates";
import { meditationsRecentes } from "../../lib/db/meditations";
import {
  ajusterCoucher,
  annulerNuitEnCours,
  corrigerHeures,
  getNuit,
  getNuitEnCours,
  heuresParDefaut,
  jeMeLeve,
  jeVaisDormir,
  nuitsEntre,
  type Nuit,
} from "../../lib/db/sommeil";
import { getReglages, seancesCetteSemaine } from "../../lib/db/sport";
import { semaineDe } from "../../lib/regles-taches";
import {
  barresSemaine,
  coucherPour,
  dateDuCoucher,
  dureeLisible,
  etatSommeil,
  heureLisible,
  hhmmMaintenant,
  minutesDe,
  type BarreNuit,
  type Coucher,
} from "../../lib/suivi-regles";
import { heureDecimale, radius, spacing, typography, useTheme } from "../../lib/theme";

const TAILLE = 210;
const HAUTEUR_SEMAINE = 120;

/** Teintes du grand bouton : indigo le soir, bleu clair au lever. */
const TEINTES = {
  dormir: { clair: "#A5B4FC", fond: "#312E81", anneau1: "#1E1B4B", anneau2: "#15133A", texte: "#E0E7FF" },
  lever: { clair: "#BAE6FD", fond: "#0C4A6E", anneau1: "#082F49", anneau2: "#06233A", texte: "#E0F2FE" },
};
const INDIGO = "#818CF8";
const BLEU_CLAIR = "#7DD3FC";

/**
 * Lever en cours de saisie. `ecrite` : jour de la nuit déjà écrite (tap du
 * matin, rien ne se perd si la feuille est fermée), null sinon.
 */
type Saisie = { coucher: Coucher; lever: string; ecrite: string | null; demanderCoucher: boolean };

/**
 * Suivi : le sommeil selon l'heure (etatSommeil, lib/suivi-regles.ts), la
 * semaine en barres, et l'entrée vers Méditer et Sport. Rien ici ne change
 * le tri des tâches ni les routines.
 */
export default function Suivi() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();

  const [enCours, setEnCours] = useState<Coucher | null>(null);
  const [nuit, setNuit] = useState<Nuit | null>(null);
  const [barres, setBarres] = useState<BarreNuit[]>([]);
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [feuille, setFeuille] = useState<"lever" | "coucher" | "couchee" | null>(null);
  const [seances, setSeances] = useState(0);
  const [sportConfigure, setSportConfigure] = useState(true);
  const [meditations, setMeditations] = useState(0);
  const [seanceNotee, setSeanceNotee] = useState(false);

  const charger = useCallback(async () => {
    setEnCours(await getNuitEnCours());
    setNuit(await getNuit(aujourdhui));
    const semaine = semaineDe(aujourdhui);
    setBarres(barresSemaine(await nuitsEntre(semaine[0], semaine[6]), semaine));
    setSeances(await seancesCetteSemaine());
    setSportConfigure((await getReglages()).configure);
    setMeditations(await meditationsRecentes(decalerJours(aujourdhui, -6)));
  }, [aujourdhui]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const etat = etatSommeil({ heure: heureDecimale(), enCours, leverNote: !!nuit });

  /** Matin : lever à maintenant, écrit tout de suite. Après-midi : l'habitude, écrite à la validation. */
  const commencerLever = async (maintenant: boolean) => {
    const h = await heuresParDefaut(aujourdhui);
    const coucher = enCours ?? coucherPour(aujourdhui, h.coucher);
    const lever = maintenant ? hhmmMaintenant() : h.lever;
    const ecrite = maintenant ? await jeMeLeve({ coucher, lever }) : null;
    setSaisie({ coucher, lever, ecrite, demanderCoucher: !enCours });
    setFeuille("lever");
  };

  /** Fin du lever : la nuit (écrite ou corrigée), puis les 2 questions. */
  const finirLever = async (s: Saisie) => {
    setFeuille(null);
    setSaisie(null);
    let date = s.ecrite;
    if (date) await corrigerHeures(date, s.coucher.heure, s.lever);
    else date = await jeMeLeve({ coucher: s.coucher, lever: s.lever });
    router.push(`/matin?date=${date}`);
  };

  const validerLever = async (hhmm: string) => {
    if (!saisie) return;
    const s = { ...saisie, lever: hhmm };
    // Pas de coucher noté hier soir : on le demande, avec la même feuille.
    if (s.demanderCoucher) {
      setSaisie(s);
      setFeuille("coucher");
    } else await finirLever(s);
  };

  const fermerFeuille = async () => {
    // Nuit déjà écrite au tap du matin : fermer garde ce qui est là et passe aux questions.
    if (saisie?.ecrite) return finirLever(saisie);
    setFeuille(null);
    setSaisie(null);
  };

  const validerFeuille = async (hhmm: string) => {
    if (feuille === "lever") return validerLever(hhmm);
    if (feuille === "coucher" && saisie) return finirLever({ ...saisie, coucher: coucherPour(aujourdhui, hhmm) });
    // « Couchée à … · ajuster » : le jour le plus proche de maintenant (passage de minuit).
    setFeuille(null);
    await ajusterCoucher(dateDuCoucher(aujourdhui, minutesDe(hhmmMaintenant()), hhmm));
    await charger();
  };

  const grandBouton = (genre: "dormir" | "lever", libelle: string, onPress?: () => void) => {
    const teinte = TEINTES[genre];
    return (
      <View style={[styles.anneau, { width: TAILLE + 36, height: TAILLE + 36, backgroundColor: teinte.anneau2 }]}>
        <View style={[styles.anneau, { width: TAILLE + 16, height: TAILLE + 16, backgroundColor: teinte.anneau1 }]}>
          <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.8}
            style={[styles.bouton, { width: TAILLE, height: TAILLE, backgroundColor: teinte.fond }]}
            accessibilityRole="button"
            accessibilityLabel={libelle}
          >
            {genre === "dormir" ? (
              <Moon color={teinte.clair} size={52} strokeWidth={1.6} />
            ) : (
              <Sun color={teinte.clair} size={52} strokeWidth={1.6} />
            )}
            <Texte style={[styles.boutonTexte, { color: teinte.texte }]}>{libelle}</Texte>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Suivi</Texte>

      {/* ── Le sommeil, selon l'heure ── */}
      <View style={styles.centre}>
        {etat === "dormir" && (
          <>
            {grandBouton("dormir", "Je vais dormir", async () => {
              await jeVaisDormir();
              await charger();
            })}
            <Texte style={[styles.phrase, { color: t.textSecondary }]}>Un tap en te couchant.</Texte>
          </>
        )}
        {etat === "couchee" && enCours && (
          <>
            {grandBouton("dormir", "Bonne nuit")}
            <View style={styles.liens}>
              <Texte style={[styles.phrase, { color: t.textSecondary, marginTop: 0 }]}>
                Couchée à {heureLisible(enCours.heure)} ·{" "}
              </Texte>
              <TouchableOpacity onPress={() => setFeuille("couchee")} hitSlop={8}>
                <Texte style={[styles.lien, { color: t.accentText, marginTop: 0 }]}>ajuster</Texte>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await annulerNuitEnCours();
                await charger();
              }}
              hitSlop={8}
            >
              <Texte style={[styles.lien, { color: t.textMuted }]}>Annuler (tapé par erreur)</Texte>
            </TouchableOpacity>
          </>
        )}
        {etat === "lever" && (
          <>
            {grandBouton("lever", "Je me suis levée", () => commencerLever(true))}
            <Texte style={[styles.phrase, { color: t.textSecondary }]}>
              Un tap en te levant, puis 2 questions.
            </Texte>
          </>
        )}
        {etat === "lever_discret" && (
          <TouchableOpacity
            onPress={() => commencerLever(false)}
            style={[styles.discret, { borderColor: t.border, backgroundColor: t.bgCard }]}
          >
            <Sun color={BLEU_CLAIR} size={20} strokeWidth={1.8} />
            <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>Noter mon heure de lever</Texte>
          </TouchableOpacity>
        )}
      </View>

      {etat === "resume" && nuit && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={styles.resumeHaut}>
            <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>
              Ta nuit · {dureeLisible(nuit.duree_min)}
            </Texte>
            <View style={styles.liens}>
              {nuit.reponses === 0 && (
                <TouchableOpacity onPress={() => router.push(`/matin?date=${nuit.date}`)} hitSlop={8}>
                  <Texte style={[styles.lien, { color: t.accentText, marginTop: 0 }]}>2 questions · </Texte>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => router.push(`/sommeil?date=${nuit.date}`)} hitSlop={8}>
                <Texte style={[styles.lien, { color: t.accentText, marginTop: 0 }]}>corriger</Texte>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.nuitLigne}>
            <Texte style={[styles.sous, { color: t.textMuted }]}>{nuit.coucher}</Texte>
            <Moon color={INDIGO} size={16} strokeWidth={1.8} />
            <View style={[styles.nuitBarre, { backgroundColor: INDIGO }]} />
            <Sun color={BLEU_CLAIR} size={16} strokeWidth={1.8} />
            <Texte style={[styles.sous, { color: t.textMuted }]}>{nuit.lever}</Texte>
          </View>
        </View>
      )}

      <SelecteurHeure
        visible={feuille !== null}
        titre={
          feuille === "lever"
            ? "Levée à quelle heure ?"
            : feuille === "coucher"
              ? "Et couchée hier vers quelle heure ?"
              : "Couchée à quelle heure ?"
        }
        heure={
          feuille === "lever"
            ? (saisie?.lever ?? hhmmMaintenant())
            : feuille === "coucher"
              ? (saisie?.coucher.heure ?? "23:00")
              : (enCours?.heure ?? hhmmMaintenant())
        }
        onFermer={fermerFeuille}
        onValider={validerFeuille}
      />

      {/* ── Ma semaine ── */}
      <Texte style={[styles.surtitre, { color: t.textMuted }]}>MA SEMAINE</Texte>
      <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <View style={styles.semaine}>
          {barres.map((b) => (
            <View key={b.date} style={styles.colonne}>
              <View style={{ height: HAUTEUR_SEMAINE, width: "100%", alignItems: "center" }}>
                {"vide" in b ? (
                  <View style={[styles.vide, { borderColor: t.border }]} />
                ) : (
                  <View
                    accessibilityLabel={`Nuit du ${b.date}`}
                    style={[
                      styles.barre,
                      {
                        top: b.haut * HAUTEUR_SEMAINE,
                        height: Math.max(4, (b.bas - b.haut) * HAUTEUR_SEMAINE),
                        backgroundColor: INDIGO,
                        opacity: b.pale ? 0.4 : 1,
                      },
                    ]}
                  />
                )}
              </View>
              <Texte
                style={[
                  styles.jour,
                  { color: b.date === aujourdhui ? t.accent : t.textMuted },
                ]}
              >
                {JOURS_LONGS[new Date(b.date + "T00:00:00Z").getUTCDay()].slice(0, 1).toUpperCase()}
              </Texte>
            </View>
          ))}
        </View>
        <View style={styles.legende}>
          <Texte style={[styles.legendeTexte, { color: t.textMuted }]}>21 h en haut · 11 h en bas</Texte>
          <TouchableOpacity onPress={() => router.push("/sommeil")} hitSlop={8}>
            <Texte style={[styles.lien, { color: t.accentText }]}>Noter une nuit</Texte>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Méditer, Sport ── */}
      <View style={styles.cartes}>
        <TouchableOpacity
          onPress={() => router.push("/mediter")}
          style={[styles.petiteCarte, { backgroundColor: t.bgCard, borderColor: t.border }]}
        >
          <Flower2 color="#A78BFA" size={26} strokeWidth={1.8} />
          <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>Méditer</Texte>
          <Texte style={[styles.sous, { color: t.textMuted }]}>
            {meditations > 0 ? `${meditations} cette semaine` : "1 min suffit"}
          </Texte>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/skills")}
          style={[styles.petiteCarte, { backgroundColor: t.bgCard, borderColor: t.border }]}
        >
          <Dumbbell color={t.accent} size={26} strokeWidth={1.8} />
          <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>Sport</Texte>
          <Texte style={[styles.sous, { color: t.textMuted }]}>
            {sportConfigure
              ? `${seances} séance${seances > 1 ? "s" : ""} en 7 jours`
              : "Où en es-tu ?"}
          </Texte>
          <TouchableOpacity
            onPress={() => setSeanceNotee(true)}
            style={[styles.noterSeance, { backgroundColor: t.accent }]}
            accessibilityRole="button"
            accessibilityLabel="J'ai fait une séance"
            hitSlop={4}
          >
            <Texte style={[styles.noterSeanceTexte, { color: t.textOnAccent }]}>+ J&apos;ai fait une séance</Texte>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
      <FeuilleSeanceNotee visible={seanceNotee} onFermer={() => setSeanceNotee(false)} onEnregistre={charger} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  centre: { alignItems: "center" },
  anneau: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  bouton: { borderRadius: 999, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  boutonTexte: { fontSize: typography.h2, fontWeight: "600" },
  phrase: { fontSize: typography.small, marginTop: spacing.md, textAlign: "center" },
  lien: { fontSize: typography.small, fontWeight: "600", marginTop: spacing.xs },

  surtitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.md },
  carteTitre: { fontSize: typography.body, fontWeight: "600" },
  sous: { fontSize: typography.small },
  noterSeance: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, alignSelf: "flex-start", marginTop: spacing.sm },
  noterSeanceTexte: { fontSize: typography.tiny, fontWeight: "700" },
  liens: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  discret: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  resumeHaut: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nuitLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  nuitBarre: { flex: 1, height: 8, borderRadius: 4 },

  semaine: { flexDirection: "row", gap: 8 },
  colonne: { flex: 1, alignItems: "center" },
  barre: { position: "absolute", width: 14, borderRadius: 7 },
  vide: { width: 14, height: "100%", borderRadius: 7, borderWidth: 1, borderStyle: "dashed" },
  jour: { fontSize: typography.tiny, fontWeight: "700", marginTop: 6 },
  legende: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  legendeTexte: { fontSize: typography.tiny },

  cartes: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  petiteCarte: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 6 },
});
