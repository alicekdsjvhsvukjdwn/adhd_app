import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { annulerCompletion, getAujourdhui } from "../../lib/db/completions";
import {
  avanceePeriode,
  decalerJours,
  etatSelonMoment,
  intensiteJours,
  recapJour,
  tachesFaites,
  type AvanceeCategorie,
  type EtatSelonMoment,
  type EtatTranche,
  type Periode,
  type RecapJour,
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

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
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
const MOIS_ANNEE = [
  "jan",
  "fév",
  "mar",
  "avr",
  "mai",
  "juin",
  "juil",
  "août",
  "sep",
  "oct",
  "nov",
  "déc",
];
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_LONGS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

function dateLongue(d: string): string {
  const x = new Date(d + "T00:00:00Z");
  return `${JOURS_LONGS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS[x.getUTCMonth()]}`;
}
const ENTETES_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

/** Opacité de la couleur de réussite selon le niveau 0 à 4. */
const ALPHAS = [0, 0.3, 0.5, 0.75, 1];

function avecAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function iso(annee: number, mois: number, jour: number): string {
  return new Date(Date.UTC(annee, mois, jour)).toISOString().split("T")[0];
}

function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
}

function dateLisible(d: string, aujourdhui: string): string {
  if (d === aujourdhui) return "Aujourd'hui";
  if (d === decalerJours(aujourdhui, -1)) return "Hier";
  const x = new Date(d + "T00:00:00Z");
  return `${JOURS_COURTS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS_COURTS[x.getUTCMonth()]}`;
}

const nombre = (n: number) => String(Math.round(n * 10) / 10);

const DIMENSIONS_ETAT: {
  cle: "energie" | "focus" | "humeur";
  icone: string;
  libelle: string;
}[] = [
  { cle: "energie", icone: "⚡", libelle: "Énergie" },
  { cle: "focus", icone: "🎯", libelle: "Concentration" },
  { cle: "humeur", icone: "🙂", libelle: "Humeur" },
];

const TITRES_TRANCHE: Record<string, string> = {
  matin: "☀️ Matin",
  apres_midi: "🌤️ Après-midi",
  soir: "🌙 Soir",
};

const NOMS_TRANCHE: Record<string, string> = {
  matin: "le matin",
  apres_midi: "l'après-midi",
  soir: "le soir",
};

/**
 * Niveau affiché par une jauge (1 à 3). La phrase de conclusion compare
 * ces mêmes niveaux : elle ne peut donc jamais contredire ce qu'on voit.
 */
const niveauJauge = (v: number) => Math.max(1, Math.min(3, Math.round(v)));

const ADJECTIFS = ["plutôt basse", "moyenne", "plutôt haute"];

function joindre(liste: string[]): string {
  if (liste.length <= 1) return liste[0] ?? "";
  return `${liste.slice(0, -1).join(", ")} et ${liste[liste.length - 1]}`;
}

/** Moments de la journée où la dimension est au plus haut, s'ils se distinguent. */
function meilleursMoments(
  tranches: EtatTranche[],
  cle: "energie" | "focus",
): string[] | null {
  const niveaux = tranches.map((x) => niveauJauge(x[cle]));
  const max = Math.max(...niveaux);
  if (max === Math.min(...niveaux)) return null;
  return tranches
    .filter((_, i) => niveaux[i] === max)
    .map((x) => NOMS_TRANCHE[x.tranche]);
}

/** Une phrase qui dit seulement ce que les données permettent de dire. */
function lectureEtat(tranches: EtatTranche[]): string {
  if (tranches.length === 1) {
    const x = tranches[0];
    const moment = NOMS_TRANCHE[x.tranche];
    return `${moment[0].toUpperCase()}${moment.slice(1)}, ton énergie est ${ADJECTIFS[niveauJauge(x.energie) - 1]} et ta concentration ${ADJECTIFS[niveauJauge(x.focus) - 1]}.`;
  }
  const fiables = tranches.filter((x) => x.n >= 2);
  if (fiables.length < 2) {
    return "Encore quelques check-ins pour comparer les moments de la journée.";
  }
  const focus = meilleursMoments(fiables, "focus");
  if (focus) {
    return `Ta concentration est meilleure ${joindre(focus)} : c'est le bon moment pour ce qui demande de l'attention.`;
  }
  const energie = meilleursMoments(fiables, "energie");
  if (energie) {
    return `Tu as plus d'énergie ${joindre(energie)} : c'est le bon moment pour ce qui demande de l'effort.`;
  }
  return "Pas de grande différence selon le moment de la journée pour l'instant.";
}

function libelleCouverture(jours: number): string {
  if (jours <= 1) return "Aujourd'hui";
  if (jours === 2) return "Ces deux derniers jours";
  return `Ces ${jours} derniers jours`;
}

function heureLisible(h: number): string {
  const minutes = Math.round(h * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

function Barre({
  taux,
  couleur,
  fond,
}: {
  taux: number;
  couleur: string;
  fond: string;
}) {
  return (
    <View style={[styles.barre, { backgroundColor: fond }]}>
      <View style={{ flex: taux, backgroundColor: couleur, borderRadius: 4 }} />
      <View style={{ flex: 1 - taux }} />
    </View>
  );
}

/** Jauge à 3 segments : 1 = bas, 2 = moyen, 3 = haut. */
function Jauge({
  valeur,
  couleur,
  fond,
}: {
  valeur: number;
  couleur: string;
  fond: string;
}) {
  const pleins = niveauJauge(valeur);
  return (
    <View style={styles.jauge}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.jaugeSegment,
            { backgroundColor: i <= pleins ? couleur : fond },
          ]}
        />
      ))}
    </View>
  );
}

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
  const aujourdhui = getAujourdhui();
  const [anneeCourante, moisCourant] = aujourdhui.split("-").map(Number);

  const [periode, setPeriode] = useState<Periode>("semaine");
  const [mois, setMois] = useState({
    annee: anneeCourante,
    mois: moisCourant - 1,
  });

  const [global, setGlobal] = useState<number | null>(null);
  const [parCategorie, setParCategorie] = useState<AvanceeCategorie[]>([]);
  const [taches, setTaches] = useState<TacheFaite[]>([]);
  const [etat, setEtat] = useState<EtatSelonMoment>({
    tranches: [],
    nbCheckins: 0,
    joursCouverts: 0,
  });
  const [calendrier, setCalendrier] = useState<Record<string, number | null>>(
    {},
  );
  const [annee, setAnnee] = useState<Record<string, number | null>>({});
  const [recap, setRecap] = useState<RecapJour | null>(null);

  const charger = useCallback(async () => {
    const [avancee, tf, e, cal, an] = await Promise.all([
      avanceePeriode(periode),
      tachesFaites(periode),
      etatSelonMoment(30),
      intensiteJours(
        iso(mois.annee, mois.mois, 1),
        iso(mois.annee, mois.mois, joursDansMois(mois.annee, mois.mois)),
      ),
      intensiteJours(`${anneeCourante}-01-01`, `${anneeCourante}-12-31`),
    ]);
    setGlobal(avancee.global);
    setParCategorie(avancee.parCategorie);
    setTaches(tf);
    setEtat(e);
    setCalendrier(cal);
    setAnnee(an);
  }, [periode, mois, anneeCourante]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const ouvrirRecap = async (d: string) => {
    setRecap(await recapJour(d));
  };

  const remettreAFaire = (tf: TacheFaite) => {
    Alert.alert(
      "Remettre cette tâche à faire ?",
      `« ${tf.nom} » reviendra dans tes tâches.`,
      [
        { text: "Laisser", style: "cancel" },
        {
          text: "Remettre à faire",
          onPress: async () => {
            await annulerCompletion(tf.id, tf.date);
            await charger();
          },
        },
      ],
    );
  };

  const couleurNiveau = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "transparent";
    if (n === 0) return t.bgCard;
    return avecAlpha(t.success, ALPHAS[n]);
  };

  const detailPeriode = PERIODES.find((p) => p.valeur === periode)!.detail;
  const estMoisCourant =
    mois.annee === anneeCourante && mois.mois === moisCourant - 1;

  const changerMois = (delta: number) => {
    const d = new Date(Date.UTC(mois.annee, mois.mois + delta, 1));
    setMois({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
  };

  // Grille du mois, semaine commençant le lundi.
  const nbJours = joursDansMois(mois.annee, mois.mois);
  const decalage =
    (new Date(Date.UTC(mois.annee, mois.mois, 1)).getUTCDay() + 6) % 7;
  const cases: (number | null)[] = [
    ...Array(decalage).fill(null),
    ...Array.from({ length: nbJours }, (_, i) => i + 1),
  ];
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines: (number | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7)
    semaines.push(cases.slice(i, i + 7));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bgApp }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Text style={[styles.titre, { color: t.textPrimary }]}>
        Ce qui avance
      </Text>

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
              <Text
                style={[
                  styles.selecteurTexte,
                  { color: actif ? t.textOnAccent : t.textSecondary },
                ]}
              >
                {p.libelle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Taux global */}
      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        <Text style={[styles.grandChiffre, { color: t.textPrimary }]}>
          {global === null ? "—" : `${Math.round(global * 100)} %`}
        </Text>
        <Text style={[styles.carteTexte, { color: t.textSecondary }]}>
          {global === null
            ? "Pas encore de routine à suivre sur cette période."
            : `de tes routines tenues ${detailPeriode}`}
        </Text>
      </View>

      {/* Anneaux par domaine */}
      <Text style={[styles.sectionTitre, { color: t.textPrimary }]}>
        Par domaine
      </Text>
      {parCategorie.length === 0 ? (
        <Text style={[styles.vide, { color: t.textMuted }]}>
          Les domaines apparaîtront dès que tes routines ou tâches en auront un.
        </Text>
      ) : (
        <View style={styles.grilleAnneaux}>
          {parCategorie.map((a) => (
            <View key={a.categorie} style={styles.celluleAnneau}>
              <Anneau
                taux={a.taux}
                couleur={couleurCat(a.categorie)}
                fond={t.bgCard}
              >
                <Text style={[styles.anneauValeur, { color: t.textPrimary }]}>
                  {a.taux === null ? "—" : `${Math.round(a.taux * 100)}%`}
                </Text>
              </Anneau>
              <Text style={[styles.anneauLibelle, { color: t.textPrimary }]}>
                {ICONES_CATEGORIE[a.categorie]}{" "}
                {LIBELLES_CATEGORIE[a.categorie]}
              </Text>
              {a.attendu > 0 && (
                <Text style={[styles.anneauDetail, { color: t.textMuted }]}>
                  {nombre(a.fait)}/{a.attendu} routines
                </Text>
              )}
              {a.taches > 0 && (
                <Text style={[styles.anneauDetail, { color: t.textMuted }]}>
                  + {a.taches} {a.taches > 1 ? "tâches" : "tâche"}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Tâches faites */}
      <Text style={[styles.sectionTitre, { color: t.textPrimary }]}>
        Tâches faites{taches.length > 0 ? ` · ${taches.length}` : ""}
      </Text>
      {taches.length === 0 ? (
        <Text style={[styles.vide, { color: t.textMuted }]}>
          Aucune tâche terminée {detailPeriode}.
        </Text>
      ) : (
        <>
          <Text style={[styles.aideListe, { color: t.textMuted }]}>
            Cochée par erreur ? Touche-la pour la remettre à faire.
          </Text>
          <View
            style={[
              styles.carte,
              { backgroundColor: t.bgCard, paddingVertical: spacing.sm },
            ]}
          >
            {taches.map((tf, i) => (
              <TouchableOpacity
                key={`${tf.id}-${tf.date}`}
                onPress={() => remettreAFaire(tf)}
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
                <Text
                  style={[styles.tacheNom, { color: t.textPrimary }]}
                  numberOfLines={2}
                >
                  {tf.nom}
                </Text>
                <Text style={[styles.tacheDate, { color: t.textMuted }]}>
                  {dateLisible(tf.date, aujourdhui)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* État selon le moment : seulement les moments qui ont des données */}
      {etat.nbCheckins > 0 && (
        <View
          style={[
            styles.carte,
            { backgroundColor: t.bgCard, marginTop: spacing.lg },
          ]}
        >
          <Text style={[styles.carteTitre, { color: t.textPrimary }]}>
            Comment tu vas, selon le moment
          </Text>
          <Text
            style={[
              styles.etatAide,
              { color: t.textMuted, marginTop: 0, marginBottom: spacing.sm },
            ]}
          >
            {libelleCouverture(etat.joursCouverts)} · {etat.nbCheckins} check-in
            {etat.nbCheckins > 1 ? "s" : ""}
          </Text>

          <View style={styles.etatRangee}>
            <View style={styles.etatColLibelle} />
            {etat.tranches.map((x) => (
              <Text
                key={x.tranche}
                style={[styles.etatColTitre, { color: t.textSecondary }]}
              >
                {TITRES_TRANCHE[x.tranche]}
              </Text>
            ))}
          </View>

          {DIMENSIONS_ETAT.map((d) => (
            <View key={d.cle} style={styles.etatRangee}>
              <Text style={[styles.etatColLibelle, { color: t.textPrimary }]}>
                {d.icone} {d.libelle}
              </Text>
              {etat.tranches.map((x) => (
                <View key={x.tranche} style={styles.etatCol}>
                  <Jauge valeur={x[d.cle]} couleur={t.accent} fond={t.bgApp} />
                </View>
              ))}
            </View>
          ))}

          <View
            style={[styles.etatLecture, { backgroundColor: t.bgHighlight }]}
          >
            <Text style={[styles.etatLectureTexte, { color: t.accentText }]}>
              {lectureEtat(etat.tranches)}
            </Text>
          </View>
        </View>
      )}

      {/* Calendrier du mois */}
      <View style={styles.enteteMois}>
        <TouchableOpacity onPress={() => changerMois(-1)} hitSlop={12}>
          <Text style={[styles.fleche, { color: t.accentText }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.sectionTitreMois, { color: t.textPrimary }]}>
          {MOIS[mois.mois]} {mois.annee}
        </Text>
        <TouchableOpacity
          onPress={() => changerMois(1)}
          disabled={estMoisCourant}
          hitSlop={12}
        >
          <Text
            style={[
              styles.fleche,
              { color: estMoisCourant ? t.border : t.accentText },
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.semaine}>
        {ENTETES_SEMAINE.map((j, i) => (
          <Text key={i} style={[styles.enteteJour, { color: t.textMuted }]}>
            {j}
          </Text>
        ))}
      </View>
      {semaines.map((s, i) => (
        <View key={i} style={styles.semaine}>
          {s.map((jour, k) => {
            if (jour === null) return <View key={k} style={styles.caseJour} />;
            const d = iso(mois.annee, mois.mois, jour);
            const niveau = calendrier[d];
            const estAujourdhui = d === aujourdhui;
            const consultable = niveau !== null && niveau !== undefined;
            return (
              <TouchableOpacity
                key={k}
                disabled={!consultable}
                onPress={() => ouvrirRecap(d)}
                style={[
                  styles.caseJour,
                  {
                    backgroundColor: couleurNiveau(niveau),
                    borderColor: estAujourdhui ? t.accent : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.numeroJour,
                    {
                      color:
                        niveau !== null && niveau !== undefined && niveau >= 3
                          ? t.bgApp
                          : niveau === null
                            ? t.textMuted
                            : t.textPrimary,
                    },
                  ]}
                >
                  {jour}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <Text
        style={[
          styles.aideListe,
          { color: t.textMuted, marginTop: spacing.sm },
        ]}
      >
        Touche un jour pour voir son récap.
      </Text>

      <Modal
        visible={recap !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRecap(null)}
      >
        <Pressable style={styles.modalFond} onPress={() => setRecap(null)}>
          <Pressable style={[styles.modalCarte, { backgroundColor: t.bgApp }]}>
            {recap && (
              <ScrollView style={{ maxHeight: 520 }}>
                <Text style={[styles.modalTitre, { color: t.textPrimary }]}>
                  {recap.date === aujourdhui
                    ? "Aujourd'hui"
                    : dateLongue(recap.date)}
                </Text>
                <Text
                  style={[styles.modalSousTitre, { color: t.textSecondary }]}
                >
                  {recap.global === null
                    ? "Pas de routine prévue ce jour-là."
                    : `${Math.round(recap.global * 100)} % des routines tenues`}
                </Text>

                {recap.parCategorie.map((a) => (
                  <View key={a.categorie} style={styles.recapLigne}>
                    <Text
                      style={[styles.recapDomaine, { color: t.textPrimary }]}
                    >
                      {ICONES_CATEGORIE[a.categorie]}{" "}
                      {LIBELLES_CATEGORIE[a.categorie]}
                    </Text>
                    {a.attendu > 0 ? (
                      <Barre
                        taux={a.taux ?? 0}
                        couleur={couleurCat(a.categorie)}
                        fond={t.bgCard}
                      />
                    ) : (
                      <View style={styles.barreVide} />
                    )}
                    <Text style={[styles.recapChiffre, { color: t.textMuted }]}>
                      {a.attendu > 0 ? `${nombre(a.fait)}/${a.attendu}` : ""}
                      {a.taches > 0
                        ? `${a.attendu > 0 ? " · " : ""}+${a.taches} t.`
                        : ""}
                    </Text>
                  </View>
                ))}

                {recap.checkins.length > 0 && (
                  <View
                    style={[styles.recapEtat, { backgroundColor: t.bgCard }]}
                  >
                    {recap.checkins.map((c, i) => (
                      <View key={i} style={styles.recapEtatLigne}>
                        <Text
                          style={[
                            styles.recapEtatTitre,
                            { color: t.textSecondary },
                          ]}
                        >
                          {heureLisible(c.heure)}
                        </Text>
                        {DIMENSIONS_ETAT.map((dim) => (
                          <View key={dim.cle} style={styles.recapEtatDim}>
                            <Text style={{ fontSize: 12 }}>{dim.icone}</Text>
                            <Jauge
                              valeur={c[dim.cle]}
                              couleur={t.accent}
                              fond={t.bgApp}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.recapSection, { color: t.textPrimary }]}>
                  Fait ce jour-là
                </Text>
                {recap.faits.length === 0 ? (
                  <Text style={[styles.vide, { color: t.textMuted }]}>
                    Rien de coché ce jour-là.
                  </Text>
                ) : (
                  recap.faits.map((f) => (
                    <View key={`${f.type}-${f.id}`} style={styles.recapFait}>
                      <View
                        style={[
                          styles.pastille,
                          {
                            backgroundColor: f.categorie
                              ? couleurCat(f.categorie)
                              : t.border,
                          },
                        ]}
                      />
                      <Text
                        style={[styles.tacheNom, { color: t.textPrimary }]}
                        numberOfLines={2}
                      >
                        {f.nom}
                        {f.partiel ? " (en partie)" : ""}
                      </Text>
                      <Text style={[styles.tacheDate, { color: t.textMuted }]}>
                        {f.type === "tache" ? "tâche" : "routine"}
                      </Text>
                    </View>
                  ))
                )}

                <TouchableOpacity
                  style={[styles.modalFermer, { backgroundColor: t.bgCard }]}
                  onPress={() => setRecap(null)}
                >
                  <Text
                    style={[styles.modalFermerTexte, { color: t.textPrimary }]}
                  >
                    Fermer
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Année : une ligne par mois, une case par jour */}
      <Text style={[styles.sectionTitre, { color: t.textPrimary }]}>
        {anneeCourante}
      </Text>
      {MOIS_ANNEE.map((nomMois, m) => {
        const nb = joursDansMois(anneeCourante, m);
        return (
          <View key={m} style={styles.ligneAnnee}>
            <Text style={[styles.moisAnnee, { color: t.textMuted }]}>
              {nomMois}
            </Text>
            {Array.from({ length: 31 }, (_, i) => {
              const jour = i + 1;
              if (jour > nb) {
                return <View key={i} style={styles.caseAnnee} />;
              }
              const niveau = annee[iso(anneeCourante, m, jour)];
              return (
                <View
                  key={i}
                  style={[
                    styles.caseAnnee,
                    {
                      backgroundColor:
                        niveau === null || niveau === undefined
                          ? avecAlpha(t.border, 0.35)
                          : couleurNiveau(niveau),
                    },
                  ]}
                />
              );
            })}
          </View>
        );
      })}

      <View style={styles.legende}>
        <Text style={[styles.legendeTexte, { color: t.textMuted }]}>Moins</Text>
        {[0, 1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[styles.legendeCase, { backgroundColor: couleurNiveau(n) }]}
          />
        ))}
        <Text style={[styles.legendeTexte, { color: t.textMuted }]}>Plus</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },

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

  etatRangee: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  etatColLibelle: { flex: 1.4, fontSize: typography.small, fontWeight: "500" },
  etatColTitre: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.small,
    fontWeight: "600",
  },
  etatCol: { flex: 1, alignItems: "center" },
  jauge: { flexDirection: "row", gap: 3 },
  jaugeSegment: { width: 12, height: 10, borderRadius: 3 },
  etatLecture: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  etatLectureTexte: {
    fontSize: typography.small,
    fontWeight: "600",
    lineHeight: 19,
  },
  etatAide: {
    fontSize: typography.tiny,
    marginTop: spacing.sm,
    lineHeight: 17,
  },

  enteteMois: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitreMois: {
    fontSize: typography.h2,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  fleche: { fontSize: 28, paddingHorizontal: spacing.sm },
  semaine: { flexDirection: "row", marginBottom: 4 },
  enteteJour: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  caseJour: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  numeroJour: { fontSize: typography.small, fontWeight: "500" },

  ligneAnnee: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  moisAnnee: { width: 34, fontSize: 10 },
  caseAnnee: { flex: 1, height: 10, marginHorizontal: 0.5, borderRadius: 2 },

  legende: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
  },
  legendeTexte: { fontSize: 10 },
  legendeCase: { width: 12, height: 12, borderRadius: 2 },

  aideListe: { fontSize: typography.tiny, marginBottom: spacing.sm },

  barre: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "hidden",
  },
  barreVide: { flex: 1 },

  modalFond: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  modalCarte: { borderRadius: radius.lg, padding: spacing.xl },
  modalTitre: {
    fontSize: typography.h2,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  modalSousTitre: {
    fontSize: typography.bodySmall,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  recapLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recapDomaine: { width: 118, fontSize: typography.small, fontWeight: "500" },
  recapChiffre: { width: 74, fontSize: typography.tiny, textAlign: "right" },
  recapEtat: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  recapEtatLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recapEtatTitre: { width: 56, fontSize: typography.tiny, fontWeight: "600" },
  recapEtatDim: { flexDirection: "row", alignItems: "center", gap: 3 },
  recapSection: {
    fontSize: typography.h3,
    fontWeight: "600",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  recapFait: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 6,
  },
  modalFermer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalFermerTexte: { fontSize: typography.body, fontWeight: "600" },
});
