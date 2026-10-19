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
import { PlusMoins } from "../../components/PlusMoins";
import { Texte } from "../../components/Texte";
import { useJourCourant } from "../../hooks/useJourCourant";
import { decalerJours } from "../../lib/dates";
import { meditationsRecentes } from "../../lib/db/meditations";
import {
  annulerNuitEnCours,
  getNuit,
  getNuitEnCours,
  heuresParDefaut,
  jeMeLeve,
  jeVaisDormir,
  nuitsEntre,
} from "../../lib/db/sommeil";
import { getReglages, seancesCetteSemaine } from "../../lib/db/sport";
import { semaineDe } from "../../lib/regles-taches";
import {
  barresSemaine,
  boutonSommeil,
  coucherPour,
  decalerHeure,
  leverOublie,
  type BarreNuit,
  type Coucher,
} from "../../lib/suivi-regles";
import { heureDecimale, radius, spacing, typography, useTheme } from "../../lib/theme";

const TAILLE = 210;
const HAUTEUR_SEMAINE = 120;
const PAS_MIN = 15;

/** Teintes du grand bouton : indigo le soir, bleu clair au lever. */
const TEINTES = {
  dormir: { clair: "#A5B4FC", fond: "#312E81", anneau1: "#1E1B4B", anneau2: "#15133A", texte: "#E0E7FF" },
  lever: { clair: "#BAE6FD", fond: "#0C4A6E", anneau1: "#082F49", anneau2: "#06233A", texte: "#E0F2FE" },
};
const INDIGO = "#818CF8";

type Demande = { type: "coucher" | "lever"; heure: string };

/**
 * Suivi : le sommeil en un geste, la semaine en barres, et l'entrée vers
 * Méditer et Sport. Rien ici ne change le tri des tâches ni les routines.
 */
export default function Suivi() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();

  const [enCours, setEnCours] = useState<Coucher | null>(null);
  const [nuitNotee, setNuitNotee] = useState(false);
  const [barres, setBarres] = useState<BarreNuit[]>([]);
  const [demande, setDemande] = useState<Demande | null>(null);
  const [seances, setSeances] = useState(0);
  const [sportConfigure, setSportConfigure] = useState(true);
  const [meditations, setMeditations] = useState(0);

  const charger = useCallback(async () => {
    const c = await getNuitEnCours();
    setEnCours(c);
    setNuitNotee(!!(await getNuit(aujourdhui)));
    const semaine = semaineDe(aujourdhui);
    setBarres(barresSemaine(await nuitsEntre(semaine[0], semaine[6]), semaine));
    // Lever oublié : on demande l'heure, pré-remplie avec l'habitude.
    if (leverOublie(c, aujourdhui, heureDecimale())) {
      const h = await heuresParDefaut(aujourdhui);
      setDemande({ type: "lever", heure: h.lever });
    }
    setSeances(await seancesCetteSemaine());
    setSportConfigure((await getReglages()).configure);
    setMeditations(await meditationsRecentes(decalerJours(aujourdhui, -6)));
  }, [aujourdhui]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const etat = boutonSommeil({ enCours, heure: heureDecimale(), nuitDuJourNotee: nuitNotee });
  const teinte = TEINTES[etat];

  const leve = async (p: Parameters<typeof jeMeLeve>[0]) => {
    setDemande(null);
    const date = await jeMeLeve(p);
    router.push(`/matin?date=${date}`);
  };

  const onBouton = async () => {
    if (etat === "dormir") {
      setDemande(null);
      await jeVaisDormir();
      await charger();
    } else if (enCours) {
      await leve({});
    } else {
      // Pas de tap hier soir : l'heure de coucher d'abord.
      const h = await heuresParDefaut(aujourdhui);
      setDemande({ type: "coucher", heure: h.coucher });
    }
  };

  const validerDemande = async () => {
    if (!demande) return;
    if (demande.type === "coucher") await leve({ coucher: coucherPour(aujourdhui, demande.heure) });
    else await leve({ lever: demande.heure });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Suivi</Texte>

      {/* ── Le grand bouton ── */}
      <View style={styles.centre}>
        <View style={[styles.anneau, { width: TAILLE + 36, height: TAILLE + 36, backgroundColor: teinte.anneau2 }]}>
          <View style={[styles.anneau, { width: TAILLE + 16, height: TAILLE + 16, backgroundColor: teinte.anneau1 }]}>
            <TouchableOpacity
              onPress={onBouton}
              activeOpacity={0.8}
              style={[styles.bouton, { width: TAILLE, height: TAILLE, backgroundColor: teinte.fond }]}
              accessibilityRole="button"
              accessibilityLabel={etat === "dormir" ? "Je vais dormir" : "Je me lève"}
            >
              {etat === "dormir" ? (
                <Moon color={teinte.clair} size={52} strokeWidth={1.6} />
              ) : (
                <Sun color={teinte.clair} size={52} strokeWidth={1.6} />
              )}
              <Texte style={[styles.boutonTexte, { color: teinte.texte }]}>
                {etat === "dormir" ? "Je vais dormir" : "Je me lève"}
              </Texte>
            </TouchableOpacity>
          </View>
        </View>
        <Texte style={[styles.phrase, { color: t.textSecondary }]}>
          {enCours
            ? `Couchée à ${enCours.heure}. Demain matin : Je me lève.`
            : "Un tap en te couchant. Demain matin : Je me lève."}
        </Texte>
        {enCours && (
          <TouchableOpacity
            onPress={async () => {
              await annulerNuitEnCours();
              setDemande(null);
              await charger();
            }}
            hitSlop={8}
          >
            <Texte style={[styles.lien, { color: t.textMuted }]}>Annuler (tapé par erreur)</Texte>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Oubli du soir ou du matin ── */}
      {demande && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>
            {demande.type === "coucher"
              ? "Tu t'es couchée vers quelle heure ?"
              : "Tu t'es levée vers quelle heure ?"}
          </Texte>
          <View style={styles.demandeLigne}>
            <PlusMoins
              valeur={demande.heure}
              libelle={demande.type === "coucher" ? "Heure de coucher" : "Heure de lever"}
              onPas={(s) => setDemande((d) => d && { ...d, heure: decalerHeure(d.heure, s * PAS_MIN) })}
              grand
            />
            <TouchableOpacity
              onPress={validerDemande}
              style={[styles.valider, { backgroundColor: t.accent }]}
            >
              <Texte style={[styles.validerTexte, { color: t.textOnAccent }]}>Valider</Texte>
            </TouchableOpacity>
          </View>
          {demande.type === "coucher" && (
            <TouchableOpacity onPress={() => setDemande(null)} hitSlop={8}>
              <Texte style={[styles.lien, { color: t.textMuted, marginTop: spacing.sm }]}>Pas maintenant</Texte>
            </TouchableOpacity>
          )}
        </View>
      )}

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
        </TouchableOpacity>
      </View>
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
  demandeLigne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  valider: { borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  validerTexte: { fontSize: typography.body, fontWeight: "700" },

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
