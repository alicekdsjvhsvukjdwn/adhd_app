import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FigureSkill } from "../components/FigureSkill";
import { PlusMoins } from "../components/PlusMoins";
import { Texte } from "../components/Texte";
import { getAujourdhui } from "../lib/db/completions";
import {
  commencerSeanceSport,
  lireMaSeance,
  noterSerieSport,
  terminerSeanceSport,
  type OrigineSeance,
} from "../lib/db/seances-sport";
import { seanceSkills } from "../lib/db/sport";
import { getMateriel } from "../lib/db/sport-materiel";
import { exercice } from "../lib/exercices";
import { dateCourte } from "../lib/esprit-regles";
import { formatRestant } from "../lib/minuteur";
import { libellePoids, MATERIEL_DEFAUT, type Materiel } from "../lib/materiel";
import { RESSENTIS, zone } from "../lib/seances";
import {
  dureeEstimee,
  ligneParDefaut,
  minutesDe,
  pasDeSaisie,
  pastillesRapides,
  proposerSeance,
  resumeSeance,
  type DureeProposee,
  type LigneSeance,
  type SeanceSport,
  type SerieFaite,
  type ZoneProposee,
} from "../lib/seances-sport";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Phase = "serie" | "repos" | "fin";

/**
 * Lecteur de séance : pour chaque série, ce que j'ai VRAIMENT fait (répétitions, secondes ou poids, pré-remplis
 * avec la cible), un repos chronométré, « passer » un exercice. À la fin : fait contre prévu, records 🏅, ressenti.
 * Chaque série est enregistrée dès qu'elle est validée : rien ne se perd si l'appli se ferme.
 * `?liste=1` : noter une séance après coup, toutes les séries sur un seul écran.
 */
export default function SeanceSportEcran() {
  const router = useRouter();
  const t = useTheme();
  useKeepAwake();
  const bip = useAudioPlayer(require("../assets/sons/bip.wav"));
  const p = useLocalSearchParams<{ source?: string; id?: string; zone?: string; min?: string; graine?: string; liste?: string; date?: string; series?: string; cible?: string }>();
  const modeListe = p.liste === "1";
  const date = p.date || getAujourdhui();

  const [seance, setSeance] = useState<SeanceSport | null>(null);
  const [origine, setOrigine] = useState<OrigineSeance>("perso");
  const [materiel, setMateriel] = useState<Materiel>(MATERIEL_DEFAUT);
  const [phase, setPhase] = useState<Phase>("serie");
  const [idx, setIdx] = useState(0);
  const [numero, setNumero] = useState(1);
  const [valeur, setValeur] = useState(0);
  const [poids, setPoids] = useState<number | null>(null);
  const [faites, setFaites] = useState<SerieFaite[]>([]);
  const [records, setRecords] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [ressenti, setRessenti] = useState("");
  const [points, setPoints] = useState(0);
  // Repos : heure de fin (les calculs partent de l'heure, pas d'un compteur).
  const [finRepos, setFinRepos] = useState(0);
  const [maintenant, setMaintenant] = useState(0);
  // Séries en secondes : chronomètre.
  const [debutChrono, setDebutChrono] = useState<number | null>(null);
  // Mode liste : valeurs par exercice et série (0 = pas faite).
  const [grille, setGrille] = useState<{ valeur: number; poids: number | null }[][]>([]);
  const seanceId = useRef<number | null>(null);
  const termine = useRef(false);

  useEffect(() => {
    (async () => {
      const m = await getMateriel();
      setMateriel(m);
      let s: SeanceSport | null = null;
      let o: OrigineSeance = "perso";
      if (p.source === "perso" && p.id) {
        const x = await lireMaSeance(Number(p.id));
        if (x) s = { nom: x.nom, lignes: x.lignes };
      } else if (p.source === "proposee") {
        s = proposerSeance((p.zone as ZoneProposee) ?? "complet", (Number(p.min) as DureeProposee) || 20, m, Number(p.graine) || 0);
        o = "proposee";
      } else if (p.source === "skills") {
        s = await seanceSkills(m);
        o = "skills";
      } else if (p.source === "exercice" && p.id && exercice(p.id)) {
        // Depuis la fiche d'un skill : les séries et la cible de l'étape.
        s = { nom: exercice(p.id)!.nom, lignes: [{ ...ligneParDefaut(p.id, m), series: Number(p.series) || 3, cible: Number(p.cible) || ligneParDefaut(p.id, m).cible }] };
        o = "exercice";
      }
      if (!s || s.lignes.length === 0) return router.back();
      setOrigine(modeListe ? "notee" : o);
      setSeance(s);
      setGrille(s.lignes.map((l) => Array.from({ length: l.series }, () => ({ valeur: l.cible, poids: l.poids }))));
      setValeur(s.lignes[0].cible);
      setPoids(s.lignes[0].poids);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Quitter en cours de route garde ce qui est fait ; rien de fait : la séance n'a pas eu lieu. */
  const cloturer = useCallback(async (r: string) => {
    if (termine.current) return null;
    termine.current = true;
    return seanceId.current === null ? null : terminerSeanceSport(seanceId.current, r);
  }, []);
  useEffect(
    () => () => {
      cloturer("").catch(() => {});
    },
    [cloturer],
  );

  const signal = () => {
    try {
      bip.seekTo(0);
      bip.play();
    } catch {
      // pas de son : la vibration suffit
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const afficherToast = (texte: string) => {
    setToast(texte);
    setTimeout(() => setToast(null), 2500);
  };

  /** Prépare l'écran d'une série. */
  const preparer = (l: LigneSeance, n: number) => {
    setNumero(n);
    setValeur(l.cible);
    setPoids(l.poids);
    setDebutChrono(null);
  };

  const suivante = (apresRepos: boolean) => {
    if (!seance) return;
    const l = seance.lignes[idx];
    if (numero < l.series) {
      if (apresRepos) preparer(l, numero + 1);
      return;
    }
    if (idx + 1 < seance.lignes.length) {
      setIdx(idx + 1);
      preparer(seance.lignes[idx + 1], 1);
    } else {
      setPhase("fin");
    }
  };

  const demarrerRepos = (l: LigneSeance) => {
    const dernier = idx + 1 >= (seance?.lignes.length ?? 0) && numero >= l.series;
    if (dernier || l.repos_s <= 0) return suivante(true);
    setFinRepos(Date.now() + l.repos_s * 1000);
    setMaintenant(Date.now());
    setPhase("repos");
  };

  /** Enregistre une série dans la base (créée à la première) et garde son résultat à l'écran. */
  const enregistrerSerie = async (exerciceId: string, n: number, realise: number, kg: number | null, prevu: number) => {
    if (seanceId.current === null) seanceId.current = await commencerSeanceSport(seance!.nom, origine, date);
    const r = await noterSerieSport(seanceId.current, { exercice: exerciceId, numero: n, realise, poids: kg, prevu });
    setFaites((f) => [...f.filter((x) => !(x.exercice === exerciceId && x.numero === n)), { exercice: exerciceId, numero: n, realise, poids: kg }]);
    if (r.points > 0) setPoints((x) => x + r.points);
    if (r.record) {
      setRecords((x) => (x.includes(exerciceId) ? x : [...x, exerciceId]));
      afficherToast("🏅 Record battu !");
    }
  };

  const valider = async () => {
    if (!seance) return;
    const l = seance.lignes[idx];
    const e = exercice(l.exercice)!;
    const realise = debutChrono !== null ? Math.max(1, Math.round((Date.now() - debutChrono) / 1000)) : valeur;
    setDebutChrono(null);
    await enregistrerSerie(l.exercice, numero, realise, e.mode === "reps_poids" ? poids : null, l.cible);
    Haptics.selectionAsync().catch(() => {});
    demarrerRepos(l);
  };

  const passerExercice = () => {
    if (!seance) return;
    setDebutChrono(null);
    if (idx + 1 < seance.lignes.length) {
      setIdx(idx + 1);
      preparer(seance.lignes[idx + 1], 1);
    } else {
      setPhase("fin");
    }
  };

  // Compte à rebours du repos : tout part de l'heure de fin.
  useEffect(() => {
    if (phase !== "repos" && debutChrono === null) return;
    const iv = setInterval(() => {
      const n = Date.now();
      setMaintenant(n);
      if (phase === "repos" && n >= finRepos) {
        signal();
        setPhase("serie");
        suivante(true);
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finRepos, debutChrono, idx, numero]);

  const quitter = () => {
    if (faites.length === 0 || phase === "fin") return router.back();
    Alert.alert("Arrêter la séance ?", "Ce que tu as déjà fait est gardé.", [
      { text: "Continuer", style: "cancel" },
      {
        text: "Arrêter",
        onPress: async () => {
          await cloturer("");
          router.back();
        },
      },
    ]);
  };

  const terminer = async () => {
    await cloturer(ressenti);
    router.back();
  };

  /** Mode liste : tout enregistrer d'un coup. */
  const enregistrerListe = async () => {
    if (!seance) return;
    for (const [i, l] of seance.lignes.entries()) {
      const e = exercice(l.exercice)!;
      for (const [k, g] of grille[i].entries()) {
        if (g.valeur > 0) await enregistrerSerie(l.exercice, k + 1, g.valeur, e.mode === "reps_poids" ? g.poids : null, l.cible);
      }
    }
    setPhase("fin");
  };

  if (!seance) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;

  const chips = (valeurs: number[], actuel: number, onPress: (v: number) => void, format: (v: number) => string = String) => (
    <View style={styles.puces}>
      {valeurs.map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => onPress(v)}
          style={[styles.puce, { borderColor: actuel === v ? t.accent : t.border }, actuel === v && { backgroundColor: t.accent }]}
          accessibilityRole="radio"
          accessibilityState={{ selected: actuel === v }}
        >
          <Texte style={{ color: actuel === v ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{format(v)}</Texte>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Fin : fait contre prévu, records, ressenti ───
  if (phase === "fin") {
    const r = resumeSeance(seance.lignes, faites, records);
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{faites.length === 0 ? "Rien de noté" : "Bien joué."}</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginBottom: spacing.md }}>
          {seance.nom}
          {modeListe ? ` · ${dateCourte(date)}` : ""}
        </Texte>
        {faites.length > 0 && (
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, marginBottom: spacing.md }}>
            {Math.round(r.completion * 100)} % des séries prévues faites{points > 0 ? ` · +${points} pts` : ""}
          </Texte>
        )}
        {r.exercices.map((x) => {
          const e = exercice(x.exercice)!;
          const unite = e.mode === "s" ? "s" : "rép.";
          return (
            <View key={x.exercice} style={[styles.ligneBilan, { borderColor: t.border, backgroundColor: t.bgCard }]}>
              <FigureSkill skill={e.figure} couleur={zone(e.zones[0]).couleur} taille={32} />
              <View style={{ flex: 1 }}>
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }} numberOfLines={1}>
                  {x.record ? "🏅 " : ""}
                  {e.nom}
                </Texte>
                <Texte style={{ color: x.faites >= x.prevues ? t.textSecondary : t.textMuted, fontSize: typography.small }}>
                  {x.faites}/{x.prevues} séries · {x.totalFait}/{x.totalPrevu} {unite}
                </Texte>
              </View>
            </View>
          );
        })}
        {faites.length > 0 && (
          <>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>COMMENT C&apos;ÉTAIT ?</Texte>
            <View style={styles.puces}>
              {RESSENTIS.map((x) => (
                <TouchableOpacity
                  key={x.cle}
                  onPress={() => setRessenti(ressenti === x.cle ? "" : x.cle)}
                  style={[styles.puce, { borderColor: ressenti === x.cle ? t.accent : t.border }, ressenti === x.cle && { backgroundColor: t.accent }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ressenti === x.cle }}
                >
                  <Texte style={{ color: ressenti === x.cle ? t.textOnAccent : t.textSecondary, fontSize: typography.body, fontWeight: "600" }}>{x.nom}</Texte>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <TouchableOpacity onPress={terminer} style={[styles.grand, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Terminer</Texte>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Noter après coup : toutes les séries sur un écran ───
  if (modeListe) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{seance.nom}</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.md }}>
          {dateCourte(date)}. Ce que j&apos;ai vraiment fait, série par série. 0 = pas faite.
        </Texte>
        {seance.lignes.map((l, i) => {
          const e = exercice(l.exercice)!;
          const unite = e.mode === "s" ? "s" : "rép.";
          return (
            <View key={`${l.exercice}-${i}`} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <View style={styles.entete}>
                <FigureSkill skill={e.figure} couleur={zone(e.zones[0]).couleur} taille={30} />
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600", flex: 1 }}>{e.nom}</Texte>
              </View>
              {grille[i]?.map((g, k) => (
                <View key={k} style={styles.reglage}>
                  <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, width: 70 }}>Série {k + 1}</Texte>
                  <PlusMoins
                    valeur={`${g.valeur} ${unite}`}
                    libelle={`${e.nom}, série ${k + 1}`}
                    onPas={(s) =>
                      setGrille((m) => m.map((ligne, a) => (a === i ? ligne.map((x, b) => (b === k ? { ...x, valeur: Math.max(0, x.valeur + s * pasDeSaisie(e.mode, l.cible)) } : x)) : ligne)))
                    }
                  />
                  {e.mode === "reps_poids" && (
                    <PlusMoins
                      valeur={g.poids ? libellePoids(g.poids) : "—"}
                      libelle={`${e.nom}, poids de la série ${k + 1}`}
                      onPas={(s) =>
                        setGrille((m) => m.map((ligne, a) => (a === i ? ligne.map((x, b) => (b === k ? { ...x, poids: Math.max(0, (x.poids ?? 0) + s * 0.5) || null } : x)) : ligne)))
                      }
                    />
                  )}
                </View>
              ))}
            </View>
          );
        })}
        <TouchableOpacity onPress={enregistrerListe} style={[styles.grand, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer la séance</Texte>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const l = seance.lignes[idx];
  const e = exercice(l.exercice)!;
  const unite = e.mode === "s" ? "s" : "rép.";
  const couleur = zone(e.zones[0]).couleur;

  // ─── Repos ───
  if (phase === "repos") {
    const restant = Math.max(0, finRepos - maintenant);
    const enchaine = numero < l.series ? { l, n: numero + 1 } : { l: seance.lignes[idx + 1], n: 1 };
    const prochain = enchaine.l ? exercice(enchaine.l.exercice) : null;
    return (
      <View style={[styles.repos, { backgroundColor: t.bgApp }]}>
        <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: 0 }]}>REPOS</Texte>
        <Texte style={{ color: t.accent, fontSize: 72, fontWeight: "300" }}>{formatRestant(restant)}</Texte>
        {prochain && enchaine.l && (
          <Texte style={{ color: t.textSecondary, fontSize: typography.body, textAlign: "center" }}>
            Ensuite : {prochain.nom} · série {enchaine.n}/{enchaine.l.series}
          </Texte>
        )}
        <View style={styles.boutonsRepos}>
          <TouchableOpacity onPress={() => setFinRepos((f) => f + 15_000)} hitSlop={8} accessibilityRole="button">
            <Texte style={{ color: t.accentText, fontSize: typography.body }}>+ 15 s</Texte>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setPhase("serie");
              suivante(true);
            }}
            style={[styles.grandRond, { backgroundColor: t.accent }]}
            accessibilityRole="button"
          >
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Passer le repos</Texte>
          </TouchableOpacity>
        </View>
        {toast && <Texte style={[styles.toast, { color: t.textPrimary, backgroundColor: t.bgCard }]}>{toast}</Texte>}
      </View>
    );
  }

  // ─── Une série ───
  const cible = l.cible;
  const chrono = e.mode === "s" && debutChrono !== null ? Math.round((maintenant - debutChrono) / 1000) : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={quitter} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Arrêter</Texte>
      </TouchableOpacity>
      <View style={styles.segments}>
        {seance.lignes.map((_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < idx ? t.accent : i === idx ? t.accentFonce : t.border }]} />
        ))}
      </View>
      <View style={styles.centre}>
        <FigureSkill skill={e.figure} couleur={couleur} taille={120} />
      </View>
      <Texte style={[styles.titre, { color: t.textPrimary, textAlign: "center" }]}>{e.nom}</Texte>
      <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, textAlign: "center" }}>
        Exercice {idx + 1}/{seance.lignes.length} · série {numero}/{l.series} · cible {cible} {unite}
        {l.poids ? ` · ${libellePoids(l.poids)}` : ""}
      </Texte>
      <Texte style={{ color: t.textSecondary, fontSize: typography.small, textAlign: "center", marginTop: spacing.sm }}>{e.consigne}</Texte>

      <Texte style={[styles.etiquette, { color: t.textMuted, textAlign: "center" }]}>
        {e.mode === "s" ? "CE QUE J'AI TENU" : "CE QUE J'AI FAIT"}
      </Texte>
      {chrono !== null ? (
        <View style={styles.centre}>
          <Texte style={{ color: t.accent, fontSize: 64, fontWeight: "300" }}>{chrono} s</Texte>
          <TouchableOpacity onPress={valider} style={[styles.grandRond, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Stop · valider la série</Texte>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.centre}>
            <PlusMoins
              valeur={`${valeur} ${unite}`}
              libelle={`Ce que j'ai fait : ${e.nom}`}
              grand
              onPas={(s) => setValeur((v) => Math.max(0, v + s * pasDeSaisie(e.mode, cible)))}
            />
          </View>
          {chips(pastillesRapides(cible), valeur, setValeur)}
          {e.mode === "reps_poids" && (
            <>
              <Texte style={[styles.etiquette, { color: t.textMuted, textAlign: "center" }]}>POIDS</Texte>
              <View style={styles.centre}>
                <PlusMoins
                  valeur={poids ? libellePoids(poids) : "—"}
                  libelle={`Poids : ${e.nom}`}
                  onPas={(s) => setPoids((v) => Math.max(0, (v ?? 0) + s * 0.5) || null)}
                />
              </View>
              {materiel.poids.length > 0 && chips(materiel.poids, poids ?? 0, setPoids, libellePoids)}
            </>
          )}
          <TouchableOpacity onPress={valider} style={[styles.grand, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Valider la série</Texte>
          </TouchableOpacity>
          {e.mode === "s" && (
            <TouchableOpacity onPress={() => {
                const n = Date.now();
                setMaintenant(n);
                setDebutChrono(n);
              }} style={[styles.secondaire, { borderColor: t.accent }]} accessibilityRole="button">
              <Texte style={{ color: t.accentText, fontWeight: "600", fontSize: typography.body }}>▶ Lancer le chrono</Texte>
            </TouchableOpacity>
          )}
        </>
      )}
      <TouchableOpacity onPress={passerExercice} style={{ alignSelf: "center", marginTop: spacing.xl }} hitSlop={8} accessibilityRole="button">
        <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Passer cet exercice</Texte>
      </TouchableOpacity>
      <Texte style={{ color: t.textMuted, fontSize: typography.tiny, textAlign: "center", marginTop: spacing.md }}>
        {seance.lignes.length} exercices · environ {minutesDe(dureeEstimee(seance.lignes))} min
      </Texte>
      {toast && <Texte style={[styles.toast, { color: t.textPrimary, backgroundColor: t.bgCard }]}>{toast}</Texte>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: 4 },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  centre: { alignItems: "center", marginVertical: spacing.md },
  segments: { flexDirection: "row", gap: 4, marginBottom: spacing.md },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center", marginVertical: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  grand: { alignItems: "center", borderRadius: radius.md, paddingVertical: spacing.lg, marginTop: spacing.xl },
  secondaire: { alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.md },
  carte: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  entete: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reglage: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm, flexWrap: "wrap" },
  ligneBilan: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  repos: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  boutonsRepos: { alignItems: "center", gap: spacing.xl, marginTop: spacing.xl },
  grandRond: { borderRadius: radius.pill, paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, marginTop: spacing.md },
  toast: { alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, overflow: "hidden", marginTop: spacing.lg, fontSize: typography.body, fontWeight: "700" },
});
