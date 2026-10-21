import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { MaterielEditeur } from "../components/MaterielEditeur";
import { PlusMoins } from "../components/PlusMoins";
import { Texte } from "../components/Texte";
import { creerPlan, planActif } from "../lib/db/plan-sport";
import { basculerActif, getEtats } from "../lib/db/sport";
import { ecrireMateriel, getMateriel } from "../lib/db/sport-materiel";
import { MATERIEL_DEFAUT, nomMateriel, type Materiel } from "../lib/materiel";
import {
  CLES_TESTS,
  DUREES_PLAN,
  JOURS_MAX,
  OBJECTIFS_PLAN,
  testNiveau,
  type CleTest,
  type DureePlan,
  type ObjectifPlan,
  type ResultatsTests,
} from "../lib/plan-sport";
import { manques, SKILLS, statut, type EtatSkill } from "../lib/skills";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const JOURS = [
  { v: 1, l: "L", nom: "lundi" },
  { v: 2, l: "M", nom: "mardi" },
  { v: 3, l: "M", nom: "mercredi" },
  { v: 4, l: "J", nom: "jeudi" },
  { v: 5, l: "V", nom: "vendredi" },
  { v: 6, l: "S", nom: "samedi" },
  { v: 0, l: "D", nom: "dimanche" },
];

type Etape = 1 | 2 | 3 | 4;

/**
 * Démarrer mon plan, en écrans courts : 1) mon objectif, 2) un test de niveau rapide (je fais, je note),
 * 3) mes jours et la durée, 4) mon matériel. `?mode=ajuster` saute le test (mes derniers résultats servent) ;
 * `?mode=cycle` ne refait que le test, puis repart pour 6 semaines avec les mêmes réglages.
 */
export default function PlanDemarrage() {
  const router = useRouter();
  const t = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const ajuster = mode === "ajuster";
  const cycle = mode === "cycle";
  const ordre: Etape[] = cycle ? [2] : ajuster ? [1, 3, 4] : [1, 2, 3, 4];

  const [i, setI] = useState(0);
  const etape = ordre[i];
  const [objectif, setObjectif] = useState<ObjectifPlan | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<CleTest, number>>({ pompes: 0, dips: 0, planche: 0, tuck_lsit: 0, squats: 0, pont: 0 });
  // Au départ, aucun test n'est fait : un résultat ne compte que si je choisis de le noter.
  const [passes, setPasses] = useState<Set<CleTest>>(new Set(CLES_TESTS));
  const [chrono, setChrono] = useState<{ cle: CleTest; debut: number } | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const [jours, setJours] = useState<number[]>([1, 3, 5]);
  const [duree, setDuree] = useState<DureePlan>(30);
  const [materiel, setMateriel] = useState<Materiel>(MATERIEL_DEFAUT);
  const [etats, setEtats] = useState<Record<string, EtatSkill>>({});
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    (async () => {
      setMateriel(await getMateriel());
      setEtats(await getEtats());
      const p = await planActif();
      if (p) {
        setObjectif(p.objectif);
        setSkill(p.skill || null);
        setJours(p.jours);
        setDuree(p.duree);
      }
    })();
  }, []);

  // Chrono des tests en secondes : tout part de l'heure de départ.
  useEffect(() => {
    if (!chrono) return;
    const iv = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(iv);
  }, [chrono]);

  const puce = (actif: boolean, libelle: string, onPress: () => void, desactive = false) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      disabled={desactive}
      style={[styles.puce, { borderColor: actif ? t.accent : t.border, opacity: desactive ? 0.4 : 1 }, actif && { backgroundColor: t.accent }]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif, disabled: desactive }}
    >
      <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.body, fontWeight: "600" }}>{libelle}</Texte>
    </TouchableOpacity>
  );

  const peutContinuer = etape === 1 ? objectif !== null && (objectif !== "skill" || skill !== null) : etape === 3 ? jours.length >= 1 : true;

  const terminer = async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      const resultats: ResultatsTests = Object.fromEntries(CLES_TESTS.map((c) => [c, passes.has(c) ? null : tests[c]]));
      const m = ajuster || !cycle ? await ecrireMateriel(materiel) : await getMateriel();
      const actuel = await planActif();
      await creerPlan({
        objectif: cycle ? (actuel?.objectif ?? "force") : (objectif ?? "force"),
        skill: cycle ? (actuel?.skill ?? undefined) : (skill ?? undefined),
        jours: cycle ? (actuel?.jours ?? [1, 3, 5]) : jours,
        duree: cycle ? (actuel?.duree ?? 30) : duree,
        materiel: m,
        tests: ajuster ? undefined : resultats,
      });
      // Le skill du plan fait partie des skills travaillés (jusqu'à 4).
      const choisi = cycle ? actuel?.skill : skill;
      if ((cycle ? actuel?.objectif : objectif) === "skill" && choisi && !(await getEtats())[choisi]?.actif) await basculerActif(choisi);
      router.back();
    } catch (e) {
      Alert.alert("Le plan n'a pas pu être créé", String(e));
    } finally {
      setEnCours(false);
    }
  };

  const suite = () => (i + 1 < ordre.length ? setI(i + 1) : terminer());

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <TouchableOpacity onPress={() => (i === 0 ? router.back() : setI(i - 1))} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>{i === 0 ? "✕ Fermer" : "‹ Retour"}</Texte>
      </TouchableOpacity>
      <View style={styles.points}>
        {ordre.map((_, k) => (
          <View key={k} style={[styles.point, { backgroundColor: k <= i ? t.accent : t.border }]} />
        ))}
      </View>

      {etape === 1 && (
        <>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Mon objectif</Texte>
          <Texte style={[styles.aide, { color: t.textSecondary }]}>Un seul pour ce cycle de 6 semaines. Tu pourras le changer.</Texte>
          {OBJECTIFS_PLAN.map((o) => {
            const actif = objectif === o.cle;
            return (
              <TouchableOpacity
                key={o.cle}
                onPress={() => {
                  setObjectif(o.cle);
                  if (o.cle !== "skill") setSkill(null);
                }}
                style={[styles.option, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.bgHighlight : t.bgCard }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif }}
              >
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{actif ? "✓ " : ""}{o.nom}</Texte>
                <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{o.aide}</Texte>
              </TouchableOpacity>
            );
          })}
          {objectif === "skill" && (
            <>
              <Texte style={[styles.etiquette, { color: t.textMuted }]}>QUEL SKILL ?</Texte>
              {SKILLS.map((s) => {
                const st = statut(s, etats, materiel);
                const m = manques(s, etats, materiel);
                const ok = st === "en_cours";
                const actif = skill === s.id;
                const raison = st === "maitrise" ? "déjà maîtrisé" : m.materiel.length > 0 ? `${m.materiel.map(nomMateriel).join(", ").toLowerCase()} nécessaire` : m.prerequis.length > 0 ? `d'abord : ${m.prerequis.map((p) => SKILLS.find((x) => x.id === p)?.nom).join(", ")}` : "";
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => ok && setSkill(s.id)}
                    disabled={!ok}
                    style={[styles.option, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.bgHighlight : t.bgCard, opacity: ok ? 1 : 0.5 }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif, disabled: !ok }}
                  >
                    <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{actif ? "✓ " : ""}{s.nom}</Texte>
                    {raison !== "" && <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{raison}</Texte>}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </>
      )}

      {etape === 2 && (
        <>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Un test de niveau rapide</Texte>
          <Texte style={[styles.aide, { color: t.textSecondary }]}>
            Fais chaque test, puis note ton résultat avec « Je l&apos;ai fait ». Pas de pression : un test passé est simplement ignoré, et ce n&apos;est pas un jugement, juste un point de départ.
          </Texte>
          {CLES_TESTS.map((cle) => {
            const test = testNiveau(cle);
            const manque = test.materiel.filter((m) => !materiel.dispo[m]);
            const passe = passes.has(cle) || manque.length > 0;
            const enChrono = chrono?.cle === cle;
            return (
              <View key={cle} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border, opacity: manque.length > 0 ? 0.5 : 1 }]}>
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{test.nom}</Texte>
                <Texte style={{ color: t.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
                  {manque.length > 0 ? `${manque.map(nomMateriel).join(", ")} : on passe.` : test.consigne}
                </Texte>
                {!passe && (
                  <View style={styles.ligne}>
                    <PlusMoins
                      valeur={enChrono ? `${Math.round((maintenant - chrono.debut) / 1000)} s` : `${tests[cle]}${test.unite === "s" ? " s" : ""}`}
                      libelle={`Résultat : ${test.nom}`}
                      onPas={(s) => setTests((x) => ({ ...x, [cle]: Math.max(0, x[cle] + s * (test.unite === "s" ? 5 : 1)) }))}
                    />
                    {test.unite === "s" && (
                      <TouchableOpacity
                        onPress={() => {
                          if (enChrono) {
                            setTests((x) => ({ ...x, [cle]: Math.round((Date.now() - chrono.debut) / 1000) }));
                            setChrono(null);
                          } else {
                            setMaintenant(Date.now());
                            setChrono({ cle, debut: Date.now() });
                          }
                        }}
                        style={[styles.chronoBtn, { borderColor: t.accent }]}
                        accessibilityRole="button"
                      >
                        <Texte style={{ color: t.accentText, fontWeight: "600" }}>{enChrono ? "■ Stop" : "▶ Chrono"}</Texte>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {manque.length === 0 && (
                  <TouchableOpacity
                    onPress={() => setPasses((s) => (s.has(cle) ? new Set([...s].filter((x) => x !== cle)) : new Set([...s, cle])))}
                    hitSlop={8}
                    style={{ marginTop: spacing.sm }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: passes.has(cle) }}
                  >
                    <Texte style={{ color: t.accentText, fontSize: typography.small }}>{passes.has(cle) ? "Je l'ai fait : noter mon résultat" : "Passer ce test"}</Texte>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}

      {etape === 3 && (
        <>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Mes disponibilités</Texte>
          <Texte style={[styles.aide, { color: t.textSecondary }]}>
            Quels jours pour t&apos;entraîner ? {JOURS_MAX} au plus, un jour de repos au moins. Le Réveil du corps reste tous les jours, à part.
          </Texte>
          <View style={styles.jours}>
            {JOURS.map((j) => {
              const actif = jours.includes(j.v);
              return (
                <TouchableOpacity
                  key={j.v}
                  onPress={() => setJours((l) => (l.includes(j.v) ? l.filter((x) => x !== j.v) : l.length >= JOURS_MAX ? l : [...l, j.v]))}
                  style={[styles.jour, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : t.bgCard }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: actif }}
                  accessibilityLabel={j.nom}
                >
                  <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontWeight: "600" }}>{j.l}</Texte>
                </TouchableOpacity>
              );
            })}
          </View>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>DURÉE D&apos;UNE SÉANCE</Texte>
          <View style={styles.puces}>{DUREES_PLAN.map((d) => puce(duree === d, `${d} min`, () => setDuree(d)))}</View>
        </>
      )}

      {etape === 4 && (
        <>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Mon matériel</Texte>
          <Texte style={[styles.aide, { color: t.textSecondary }]}>Les exercices sont choisis avec ce que tu as. Rien à ajouter ? Continue.</Texte>
          <MaterielEditeur materiel={materiel} onChange={setMateriel} />
          <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent, marginTop: spacing.lg }]}>
            <Texte style={{ color: t.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>MON PLAN</Texte>
            <Texte style={{ color: t.textPrimary, fontSize: typography.body, marginTop: 4 }}>
              {OBJECTIFS_PLAN.find((o) => o.cle === objectif)?.nom}
              {skill ? ` · ${SKILLS.find((s) => s.id === skill)?.nom}` : ""}
            </Texte>
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>
              {jours.length} séance{jours.length > 1 ? "s" : ""} par semaine · {duree} min · 6 semaines
            </Texte>
          </View>
        </>
      )}

      <TouchableOpacity
        onPress={suite}
        disabled={!peutContinuer || enCours}
        style={[styles.suivant, { backgroundColor: t.accent, opacity: peutContinuer ? 1 : 0.4 }]}
        accessibilityRole="button"
      >
        <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>
          {i + 1 < ordre.length ? "Suivant" : cycle ? "Nouveau cycle" : ajuster ? "Mettre à jour mon plan" : "Générer mon plan"}
        </Texte>
      </TouchableOpacity>
      {ajuster && i === ordre.length - 1 && (
        <Texte style={{ color: t.textMuted, fontSize: typography.tiny, textAlign: "center", marginTop: spacing.sm }}>
          Les séances déjà faites restent dans ton historique ; le cycle repart de la semaine 1.
        </Texte>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  points: { flexDirection: "row", gap: 6, marginBottom: spacing.lg },
  point: { width: 22, height: 6, borderRadius: 3 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  aide: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  option: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: 2 },
  carte: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  chronoBtn: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  jours: { flexDirection: "row", justifyContent: "space-between" },
  jour: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  suivant: { alignItems: "center", borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
});
