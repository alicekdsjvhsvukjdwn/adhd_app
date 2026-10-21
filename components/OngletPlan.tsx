import { useFocusEffect, useRouter } from "expo-router";
import { Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import {
  bilanARepondre,
  enregistrerBilan,
  planActif,
  prochaineSeance,
  replanifier,
  resumeDuPlan,
  seanceDuJour,
  testsProgression,
  type PlanActif,
  type ResumePlan,
  type SeanceDuPlan,
} from "../lib/db/plan-sport";
import { getEtats } from "../lib/db/sport";
import { exercice } from "../lib/exercices";
import { dateCourte } from "../lib/esprit-regles";
import { jaugeObjectif, OBJECTIFS_PLAN, semaineCalendaire, SEMAINES, testNiveau, type ProgressionTest } from "../lib/plan-sport";
import { dureeEstimee, minutesDe } from "../lib/seances-sport";
import { SKILLS } from "../lib/skills";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
import { Texte } from "./Texte";

const LETTRES = ["L", "M", "M", "J", "V", "S", "D"];

/** Sport › Plan : l'objectif et où j'en suis, la semaine, la séance du jour, mes tests, le bilan du dimanche. */
export function OngletPlan() {
  const t = useTheme();
  const router = useRouter();
  const aujourdhui = useJourCourant();
  const [plan, setPlan] = useState<PlanActif | null | undefined>(undefined);
  const [resume, setResume] = useState<ResumePlan | null>(null);
  const [duJour, setDuJour] = useState<SeanceDuPlan | null>(null);
  const [prochaine, setProchaine] = useState<SeanceDuPlan | null>(null);
  const [tests, setTests] = useState<ProgressionTest[]>([]);
  const [bilan, setBilan] = useState<string | null>(null);
  const [jauge, setJauge] = useState(0);

  const charger = useCallback(async () => {
    await replanifier(aujourdhui);
    const p = await planActif();
    setPlan(p);
    if (!p) return;
    const r = resumeDuPlan(p);
    setResume(r);
    setDuJour(await seanceDuJour(aujourdhui));
    setProchaine(await prochaineSeance());
    const tp = await testsProgression();
    setTests(tp);
    setBilan(await bilanARepondre(aujourdhui));
    const s = p.skill ? SKILLS.find((x) => x.id === p.skill) : undefined;
    setJauge(
      jaugeObjectif({
        objectif: p.objectif,
        skillEtape: s ? ((await getEtats())[s.id]?.etape ?? 1) : undefined,
        skillNbEtapes: s?.etapes.length,
        tests: tp,
        faites: r.faites,
        prevues: r.prevues,
      }),
    );
  }, [aujourdhui]);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (plan === undefined) return null;

  if (plan === null) {
    return (
      <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent }]}>
        <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>Mon plan</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginTop: spacing.sm }}>
          Tu choisis un objectif, tu fais un test de niveau rapide, tu dis quels jours et combien de temps : l&apos;appli compose un programme de
          6 semaines avec ton matériel, et le fait monter quand tu progresses.
        </Texte>
        <TouchableOpacity onPress={() => router.push("/plan-demarrage" as never)} style={[styles.grand, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Créer mon plan</Texte>
        </TouchableOpacity>
      </View>
    );
  }

  const objectif = OBJECTIFS_PLAN.find((o) => o.cle === plan.objectif)!;
  const skillNom = plan.skill ? SKILLS.find((s) => s.id === plan.skill)?.nom : null;
  const semaine = semaineCalendaire(plan.seances, aujourdhui);
  const lancer = (s: SeanceDuPlan) => router.push(`/seance-sport?source=plan&id=${s.planSeance.id}${s.courte ? "&courte=1" : ""}` as never);
  const carteSeance = (s: SeanceDuPlan, titre: string) => (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent }]}>
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>{titre}</Texte>
      <View style={styles.ligne}>
        <View style={{ flex: 1 }}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>{s.nom}</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
            {s.lignes.length} exercices · environ {minutesDe(dureeEstimee(s.lignes))} min · semaine {s.planSeance.semaine}/{SEMAINES}
            {s.planSeance.semaine >= SEMAINES ? " (plus légère)" : ""}
          </Texte>
        </View>
        <TouchableOpacity onPress={() => lancer(s)} style={[styles.lecture, { backgroundColor: t.accent }]} accessibilityRole="button" accessibilityLabel={`Commencer ${s.nom}`}>
          <Play color={t.textOnAccent} size={22} fill={t.textOnAccent} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>
      <View style={styles.figures}>
        {s.lignes.map((l, i) => (
          <FigureSkill key={i} skill={exercice(l.exercice)?.figure ?? ""} couleur={t.accent} taille={26} />
        ))}
      </View>
      {s.courte && <Texte style={{ color: t.accentText, fontSize: typography.small, marginTop: spacing.sm }}>Jour difficile : voici une version courte. Ce que tu fais est déjà bien.</Texte>}
    </View>
  );

  return (
    <View>
      {/* L'objectif et où j'en suis */}
      <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <Texte style={[styles.etiquette, { color: t.textMuted }]}>MON OBJECTIF</Texte>
        <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>
          {objectif.nom}
          {skillNom ? ` · ${skillNom}` : ""}
        </Texte>
        <View style={[styles.barre, { backgroundColor: t.bgApp }]}>
          <View style={{ width: `${Math.round(jauge * 100)}%`, height: "100%", backgroundColor: t.accent, borderRadius: 4 }} />
        </View>
        {resume && (
          <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>
            {resume.cycleTermine ? "Cycle terminé" : `Semaine ${resume.semaine} sur ${SEMAINES}`} · {resume.faites}/{resume.prevues} séances faites
          </Texte>
        )}
      </View>

      {resume?.cycleTermine ? (
        <View style={[styles.carte, { backgroundColor: t.bgCardActive, borderColor: t.accent }]}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>🎉 6 semaines faites !</Texte>
          <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: 4 }}>Refais ton test de niveau pour voir le chemin parcouru, puis repars sur un nouveau cycle.</Texte>
          <TouchableOpacity onPress={() => router.push("/plan-demarrage?mode=cycle" as never)} style={[styles.grand, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Refaire le test, nouveau cycle</Texte>
          </TouchableOpacity>
        </View>
      ) : duJour ? (
        carteSeance(duJour, "SÉANCE DU JOUR")
      ) : (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>AUJOURD&apos;HUI</Texte>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>Jour de repos. Le corps progresse aussi pendant ces jours-là.</Texte>
          {prochaine && (
            <>
              <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>
                Prochaine séance : {prochaine.nom}, {prochaine.planSeance.jour ? dateCourte(prochaine.planSeance.jour) : "bientôt"}.
              </Texte>
              <TouchableOpacity onPress={() => lancer(prochaine)} hitSlop={8} style={{ marginTop: spacing.sm }} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.body, fontWeight: "600" }}>▶ La faire quand même aujourd&apos;hui</Texte>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Bilan du dimanche */}
      {bilan && (
        <View style={[styles.carte, { backgroundColor: t.bgCardActive, borderColor: t.accent }]}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>Cette semaine, c&apos;était comment ?</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 2 }}>La semaine prochaine s&apos;ajuste : une série de plus ou de moins.</Texte>
          <View style={styles.puces}>
            {(
              [
                ["facile", "Trop facile"],
                ["ok", "OK"],
                ["dur", "Trop dur"],
              ] as const
            ).map(([cle, libelle]) => (
              <TouchableOpacity
                key={cle}
                onPress={async () => {
                  await enregistrerBilan(cle, aujourdhui);
                  await charger();
                }}
                style={[styles.puce, { borderColor: t.accent }]}
                accessibilityRole="button"
              >
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{libelle}</Texte>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* La semaine */}
      <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.xl }]}>CETTE SEMAINE</Texte>
      <View style={styles.semaine}>
        {semaine.map((j, i) => {
          const faite = j.seance?.statut === "faite";
          const prevue = j.seance?.statut === "a_faire";
          const estAujourdhui = j.jour === aujourdhui;
          return (
            <View key={j.jour} style={[styles.jour, { borderColor: estAujourdhui ? t.accent : t.border, backgroundColor: faite ? t.accent : t.bgCard }]} accessibilityLabel={`${LETTRES[i]} ${Number(j.jour.slice(8))}${faite ? ", séance faite" : prevue ? `, ${j.seance!.nom}` : ""}`}>
              <Texte style={{ color: faite ? t.textOnAccent : t.textMuted, fontSize: 11, fontWeight: "600" }}>{LETTRES[i]}</Texte>
              <Texte style={{ color: faite ? t.textOnAccent : t.textPrimary, fontSize: typography.body, fontWeight: "700" }}>{Number(j.jour.slice(8))}</Texte>
              <Texte style={{ color: faite ? t.textOnAccent : t.accentText, fontSize: 12 }}>{faite ? "✓" : prevue ? "•" : " "}</Texte>
            </View>
          );
        })}
      </View>
      {semaine.filter((j) => j.seance).map((j) => (
        <Texte key={j.jour} style={{ color: j.seance!.statut === "faite" ? t.textMuted : t.textSecondary, fontSize: typography.small, marginTop: 2 }}>
          {dateCourte(j.jour)} · {j.seance!.nom}
          {j.seance!.statut === "faite" ? " · faite ✓" : ""}
        </Texte>
      ))}
      {semaine.every((j) => !j.seance) && <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Pas de séance cette semaine.</Texte>}

      {/* Mes tests de niveau */}
      {tests.length > 0 && (
        <>
          <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.xl }]}>MES TESTS DE NIVEAU</Texte>
          {tests.map((x) => {
            const nom = testNiveau(x.cle);
            const gain = (x.dernier ?? 0) - (x.premier ?? 0);
            const u = nom.unite === "s" ? " s" : "";
            return (
              <View key={x.cle} style={styles.test}>
                <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall, flex: 1 }}>{nom.nom}</Texte>
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>
                  {x.premier}
                  {u} → {x.dernier}
                  {u}
                  {gain > 0 ? ` (+${gain})` : ""}
                </Texte>
              </View>
            );
          })}
        </>
      )}

      <TouchableOpacity onPress={() => router.push("/plan-demarrage?mode=ajuster" as never)} style={[styles.secondaire, { borderColor: t.border }]} accessibilityRole="button">
        <Texte style={{ color: t.accentText, fontSize: typography.body, fontWeight: "600" }}>Ajuster mon plan (jours, durée, objectif)</Texte>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lecture: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.sm },
  grand: { alignItems: "center", borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.lg },
  barre: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: spacing.md },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  semaine: { flexDirection: "row", gap: 4, marginBottom: spacing.sm },
  jour: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm },
  test: { flexDirection: "row", gap: spacing.md, paddingVertical: 3 },
  secondaire: { alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
});
