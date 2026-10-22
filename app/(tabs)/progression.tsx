import { useFocusEffect } from "expo-router";
import { useJourCourant } from "../../hooks/useJourCourant";
import { useCallback, useState, type ReactNode } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../../components/Texte";
import Svg, { Circle } from "react-native-svg";
import { CalendrierMois } from "../../components/CalendrierMois";
import { SectionHumeur } from "../../components/SectionHumeur";
import { SectionConfiance } from "../../components/SectionConfiance";
import { SectionCuisine } from "../../components/SectionCuisine";
import { SectionProjets } from "../../components/SectionProjets";
import { LiensSommeilSport } from "../../components/LiensSommeilSport";
import { remettreAFaire } from "../../lib/db/etapes";
import { menageFaitesEntre } from "../../lib/db/menage-stats";
import { roueMenage, TACHES_PAR_ROUE } from "../../lib/menage-regles";
import { getStats } from "../../lib/db/stats";
import {
  avanceePeriode,
  bornesPeriode,
  decalerJours,
  mesureAdaptation,
  tachesFaites,
  type AvanceeCategorie,
  type MesureAdaptation,
  type Periode,
  type TacheFaite,
} from "../../lib/db/progression";
import { radius, spacing, typography, useTheme } from "../../lib/theme";
import {
  ICONES_CATEGORIE,
  LIBELLES_CATEGORIE,
  useCouleurCategorie,
} from "../../lib/theme-categories";

const PERIODES: { valeur: Periode; libelle: string; detail: string }[] = [
  { valeur: "jour", libelle: "Jour", detail: "aujourd'hui" },
  { valeur: "semaine", libelle: "Semaine", detail: "sur les 7 derniers jours" },
  { valeur: "mois", libelle: "Mois", detail: "sur les 30 derniers jours" },
];

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
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
function dateLisible(d: string, aujourdhui: string): string {
  if (d === aujourdhui) return "Aujourd'hui";
  if (d === decalerJours(aujourdhui, -1)) return "Hier";
  const x = new Date(d + "T00:00:00Z");
  return `${JOURS_COURTS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS_COURTS[x.getUTCMonth()]}`;
}

const nombre = (n: number) => String(Math.round(n * 10) / 10);

function Anneau({
  taux,
  couleur,
  fond,
  taille = 72,
  epaisseur = 8,
  children,
}: {
  taux: number | null;
  couleur: string;
  fond: string;
  taille?: number;
  epaisseur?: number;
  children?: ReactNode;
}) {
  const r = (taille - epaisseur) / 2;
  const centre = taille / 2;
  const circonference = 2 * Math.PI * r;
  const valeur = taux ?? 0;

  return (
    <View
      style={{
        width: taille,
        height: taille,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={taille} height={taille} style={StyleSheet.absoluteFill}>
        <Circle
          cx={centre}
          cy={centre}
          r={r}
          stroke={fond}
          strokeWidth={epaisseur}
          fill="none"
        />
        {valeur > 0 && (
          <Circle
            cx={centre}
            cy={centre}
            r={r}
            stroke={couleur}
            strokeWidth={epaisseur}
            fill="none"
            strokeDasharray={`${circonference} ${circonference}`}
            strokeDashoffset={circonference * (1 - valeur)}
            strokeLinecap="round"
            rotation={-90}
            origin={`${centre}, ${centre}`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export default function Progression() {
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  const aujourdhui = useJourCourant();
  const [periode, setPeriode] = useState<Periode>("semaine");
  const [global, setGlobal] = useState<number | null>(null);
  const [parCategorie, setParCategorie] = useState<AvanceeCategorie[]>([]);
  const [taches, setTaches] = useState<TacheFaite[]>([]);
  const [mesure, setMesure] = useState<MesureAdaptation | null>(null);
  /** Tâches de ménage faites sur la période : une roue complète = 3. */
  const [menage, setMenage] = useState(0);
  const [serie, setSerie] = useState<{ actuelle: number; record: number } | null>(null);

  const charger = useCallback(async () => {
    const [avancee, tf, m, stats] = await Promise.all([
      avanceePeriode(periode),
      tachesFaites(periode),
      mesureAdaptation(14),
      getStats(),
    ]);
    setSerie({ actuelle: stats.currentStreak, record: stats.bestStreak });
    const b = bornesPeriode(periode);
    setMenage(await menageFaitesEntre(b.debut, b.fin));
    setGlobal(avancee.global);
    setParCategorie(avancee.parCategorie);
    setTaches(tf);
    setMesure(m);
  }, [periode]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger, aujourdhui]),
  );

  const confirmerRemettreAFaire = (tf: TacheFaite) => {
    Alert.alert(
      "Remettre cette tâche à faire ?",
      `« ${tf.nom} » reviendra dans tes tâches.`,
      [
        { text: "Laisser", style: "cancel" },
        {
          text: "Remettre à faire",
          onPress: async () => {
            // Avec ses étapes et leurs points : la refaire redonne tout, une fois.
            await remettreAFaire(tf.id, tf.date);
            await charger();
          },
        },
      ],
    );
  };

  const detailPeriode = PERIODES.find((p) => p.valeur === periode)!.detail;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Texte style={[styles.titre, { color: t.textPrimary }]}>
        Ce qui avance
      </Texte>

      {/* Série : jours d'affilée avec au moins une coche (venue de l'onglet Routines) */}
      {serie && (
        <Texte style={[styles.serie, { color: t.textSecondary }]}>
          🔥 {serie.actuelle} jour{serie.actuelle > 1 ? "s" : ""} d&apos;affilée
          {serie.record > serie.actuelle ? ` · record ${serie.record}` : ""}
        </Texte>
      )}

      {/* Sélecteur de période */}
      <View style={[styles.selecteur, { backgroundColor: t.bgCard }]}>
        {PERIODES.map((p) => {
          const actif = p.valeur === periode;
          return (
            <TouchableOpacity
              key={p.valeur}
              style={[
                styles.selecteurBouton,
                actif && { backgroundColor: t.accent },
              ]}
              onPress={() => setPeriode(p.valeur)}
            >
              <Texte
                style={[
                  styles.selecteurTexte,
                  { color: actif ? t.textOnAccent : t.textSecondary },
                ]}
              >
                {p.libelle}
              </Texte>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Taux global */}
      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        <Texte style={[styles.grandChiffre, { color: t.textPrimary }]}>
          {global === null ? "—" : `${Math.round(global * 100)} %`}
        </Texte>
        <Texte style={[styles.carteTexte, { color: t.textSecondary }]}>
          {global === null
            ? "Pas encore de routine à suivre sur cette période."
            : `de tes routines tenues ${detailPeriode}`}
        </Texte>
      </View>

      {/* Anneaux par domaine */}
      <Texte style={[styles.sectionTitre, { color: t.textPrimary }]}>
        Par domaine
      </Texte>
      {parCategorie.length === 0 && (
        <Texte style={[styles.vide, { color: t.textMuted }]}>
          Les domaines apparaîtront dès que tes routines ou tâches en auront un.
        </Texte>
      )}
      {(
        <View style={styles.grilleAnneaux}>
          {parCategorie.map((a) => (
            <View key={a.categorie} style={styles.celluleAnneau}>
              <Anneau
                taux={a.taux}
                couleur={couleurCat(a.categorie)}
                fond={t.bgCard}
              >
                <Texte style={[styles.anneauValeur, { color: t.textPrimary }]}>
                  {a.taux === null ? "—" : `${Math.round(a.taux * 100)}%`}
                </Texte>
              </Anneau>
              <Texte style={[styles.anneauLibelle, { color: t.textPrimary }]}>
                {ICONES_CATEGORIE[a.categorie]}{" "}
                {LIBELLES_CATEGORIE[a.categorie]}
              </Texte>
              {a.attendu > 0 && (
                <Texte style={[styles.anneauDetail, { color: t.textMuted }]}>
                  {nombre(a.fait)}/{a.attendu} routines
                </Texte>
              )}
              {a.taches > 0 && (
                <Texte style={[styles.anneauDetail, { color: t.textMuted }]}>
                  + {a.taches} {a.taches > 1 ? "tâches" : "tâche"}
                </Texte>
              )}
            </View>
          ))}
          {/* Ménage : une roue complète = 3 tâches de ménage faites sur la période */}
          <View style={styles.celluleAnneau}>
            <Anneau taux={roueMenage(menage)} couleur={t.accent} fond={t.bgCard}>
              <Texte style={[styles.anneauValeur, { color: t.textPrimary }]}>
                {Math.min(menage, TACHES_PAR_ROUE)}/{TACHES_PAR_ROUE}
              </Texte>
            </Anneau>
            <Texte style={[styles.anneauLibelle, { color: t.textPrimary }]}>🧹 Ménage</Texte>
            <Texte style={[styles.anneauDetail, { color: t.textMuted }]}>
              {menage} tâche{menage > 1 ? "s" : ""}
            </Texte>
          </View>
        </View>
      )}

      {/* Tâches faites */}
      <Texte style={[styles.sectionTitre, { color: t.textPrimary }]}>
        Tâches faites{taches.length > 0 ? ` · ${taches.length}` : ""}
      </Texte>
      {taches.length === 0 ? (
        <Texte style={[styles.vide, { color: t.textMuted }]}>
          Aucune tâche terminée {detailPeriode}.
        </Texte>
      ) : (
        <>
          <Texte style={[styles.aideListe, { color: t.textMuted }]}>
            Cochée par erreur ? Touche-la pour la remettre à faire.
          </Texte>
          <View
            style={[
              styles.carte,
              { backgroundColor: t.bgCard, paddingVertical: spacing.sm },
            ]}
          >
            {taches.map((tf, i) => (
              <TouchableOpacity
                key={`${tf.id}-${tf.date}`}
                onPress={() => confirmerRemettreAFaire(tf)}
                style={[
                  styles.ligneTache,
                  i > 0 && { borderTopWidth: 1, borderTopColor: t.border },
                ]}
              >
                <View
                  style={[
                    styles.pastille,
                    {
                      backgroundColor: tf.categorie
                        ? couleurCat(tf.categorie)
                        : t.border,
                    },
                  ]}
                />
                <Texte
                  style={[styles.tacheNom, { color: t.textPrimary }]}
                  numberOfLines={2}
                >
                  {tf.nom}
                </Texte>
                <Texte style={[styles.tacheDate, { color: t.textMuted }]}>
                  {dateLisible(tf.date, aujourdhui)}
                </Texte>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Ce que l'appli apprend : ses propositions sont-elles utiles ? */}
      {mesure &&
        (mesure.propositions > 0 || mesure.suggestionsDecidees > 0) && (
          <View
            style={[
              styles.carte,
              { backgroundColor: t.bgCard, marginTop: spacing.lg },
            ]}
          >
            <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>
              Ce que l'appli apprend
            </Texte>
            {mesure.propositions > 0 && (
              <>
                <Texte style={[styles.mesureChiffre, { color: t.textPrimary }]}>
                  {Math.round((mesure.faites / mesure.propositions) * 100)} %
                </Texte>
                <Texte style={[styles.carteTexte, { color: t.textSecondary }]}>
                  des tâches proposées faites le jour même ({mesure.faites} sur{" "}
                  {mesure.propositions}, 14 derniers jours)
                </Texte>
              </>
            )}
            {mesure.suggestionsDecidees > 0 && (
              <Texte
                style={[
                  styles.carteTexte,
                  { color: t.textSecondary, marginTop: spacing.sm },
                ]}
              >
                Suggestions d'ajustement : {mesure.suggestionsAcceptees}{" "}
                acceptée{mesure.suggestionsAcceptees > 1 ? "s" : ""} sur{" "}
                {mesure.suggestionsDecidees}
              </Texte>
            )}
          </View>
        )}

      {/* Calendrier du mois, routines et tâches */}
      <View style={{ marginTop: spacing.xxl }}>
        <CalendrierMois />
      </View>

      <LiensSommeilSport />

      <SectionHumeur />
      <SectionConfiance />
      <SectionProjets />
      <SectionCuisine />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: spacing.md, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  serie: { fontSize: typography.bodySmall, fontWeight: "600", marginBottom: spacing.lg },

  selecteur: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  selecteurBouton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  selecteurTexte: { fontSize: typography.small, fontWeight: "600" },

  carte: { borderRadius: radius.lg, padding: spacing.lg },
  grandChiffre: { fontSize: 44, fontWeight: "300" },
  carteTexte: { fontSize: typography.bodySmall, marginTop: 4 },
  carteTitre: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },

  sectionTitre: {
    fontSize: typography.h2,
    fontWeight: "600",
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  vide: { fontSize: typography.small, fontStyle: "italic" },

  grilleAnneaux: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.lg },
  celluleAnneau: { width: "33.33%", alignItems: "center" },
  anneauValeur: { fontSize: typography.small, fontWeight: "700" },
  anneauLibelle: {
    fontSize: typography.tiny,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  anneauDetail: { fontSize: typography.tiny, textAlign: "center" },

  ligneTache: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  tacheNom: { flex: 1, fontSize: typography.bodySmall },
  tacheDate: { fontSize: typography.tiny },

  mesureChiffre: { fontSize: 32, fontWeight: "300", marginTop: 4 },
  aideListe: { fontSize: typography.tiny, marginBottom: spacing.sm },

});
