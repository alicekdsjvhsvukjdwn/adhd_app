import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Check, Star } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FigureSkill, GRIS, VERT } from "../components/FigureSkill";
import { FeuilleAcquis, FeuilleEssai } from "../components/FeuillesSport";
import { Texte } from "../components/Texte";
import {
  basculerActif,
  ficheSkill,
  getEtats,
  redescendre,
  refuserValidation,
  validerEtape,
  type FicheSkill,
} from "../lib/db/sport";
import {
  critere,
  etapeFaisable,
  manques,
  MAX_ACTIFS,
  NIVEAUX,
  phraseMotivante,
  seriesAtteintes,
  skill as skillDe,
  statut,
  type Statut,
} from "../lib/skills";
import { getMateriel } from "../lib/db/sport-materiel";
import { alternativeA, exercice } from "../lib/exercices";
import { MATERIEL_DEFAUT, nomMateriel, type Materiel } from "../lib/materiel";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const dateCourte = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;

/** Fiche d'un skill : l'étape en cours, puis l'échelle de toutes les étapes. */
export default function SkillFiche() {
  const router = useRouter();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fiche, setFiche] = useState<FicheSkill | null>(null);
  const [st, setSt] = useState<Statut>("en_cours");
  const [manque, setManque] = useState<{ prerequis: string[]; materiel: string[] }>({ prerequis: [], materiel: [] });
  const [materiel, setMateriel] = useState<Materiel>(MATERIEL_DEFAUT);
  const [essai, setEssai] = useState(false);
  const [acquis, setAcquis] = useState(false);

  const charger = useCallback(async () => {
    const s = skillDe(id);
    if (!s) return;
    const m = await getMateriel();
    const etats = await getEtats();
    setMateriel(m);
    setSt(statut(s, etats, m));
    setManque(manques(s, etats, m));
    setFiche(await ficheSkill(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (!fiche) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;

  const { skill: s, etat } = fiche;
  const enCours = st === "en_cours";
  const etape = s.etapes[etat.etape - 1];
  const derniere = fiche.seances[0]?.realise ?? null;
  const exoEtape = etape ? exercice(etape.exercice) : undefined;
  const etapeOk = !etape || etapeFaisable(etape, materiel);
  const alternative = exoEtape ? alternativeA(exoEtape, materiel) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>{s.nom}</Texte>
      <Texte style={[styles.niveau, { color: t.textMuted }]}>
        {NIVEAUX.find((n) => n.cle === s.niveau)?.nom}
      </Texte>

      {st === "verrouille" && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: 0 }]}>CE QUI MANQUE</Texte>
          {manque.prerequis.map((p) => (
            <TouchableOpacity key={p} onPress={() => router.push(`/skill?id=${p}`)} hitSlop={6}>
              <Texte style={[styles.lien, { color: t.accentText }]}>
                Maîtriser {skillDe(p)?.nom} →
              </Texte>
            </TouchableOpacity>
          ))}
          {manque.materiel.length > 0 && (
            <Texte style={[styles.ligne, { color: t.textSecondary }]}>
              Matériel nécessaire : {manque.materiel.map((m) => nomMateriel(m as never).toLowerCase()).join(", ")}. Tu peux le régler dans Sport › ⚙️.
            </Texte>
          )}
        </View>
      )}

      {enCours && etape && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent }]}>
          <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: 0 }]}>ÉTAPE EN COURS</Texte>
          <View style={styles.enCours}>
            <FigureSkill skill={s.id} couleur={t.accent} taille={110} />
            <View style={{ flex: 1 }}>
              <Texte style={[styles.etapeNom, { color: t.textPrimary }]}>{etape.nom}</Texte>
              <Texte style={[styles.ligne, { color: t.textSecondary }]}>{critere(etape)}</Texte>
              <View style={styles.series}>
                {seriesAtteintes(derniere ?? [], etape).map((ok, i) => (
                  <View
                    key={i}
                    style={[styles.serie, { backgroundColor: ok ? t.accent : t.bgApp, borderColor: t.accent }]}
                  />
                ))}
              </View>
              <Texte style={[styles.phrase, { color: t.accentText }]}>{phraseMotivante(derniere, etape)}</Texte>
            </View>
          </View>

          {exoEtape && (
            <TouchableOpacity onPress={() => router.push(`/exercice?id=${exoEtape.id}` as never)} hitSlop={6} style={{ marginTop: spacing.md }} accessibilityRole="button">
              <Texte style={[styles.lien, { color: t.accentText }]}>Exercice : {exoEtape.nom} →</Texte>
            </TouchableOpacity>
          )}
          {!etapeOk && exoEtape && (
            <View style={{ marginTop: spacing.sm }}>
              <Texte style={[styles.ligne, { color: t.danger }]}>
                Matériel manquant pour cette étape. Les séries d&apos;une alternative ne comptent pas pour elle ; « C&apos;est acquis » reste possible.
              </Texte>
              {alternative && (
                <TouchableOpacity onPress={() => router.push(`/exercice?id=${alternative.id}` as never)} hitSlop={6} accessibilityRole="button">
                  <Texte style={[styles.lien, { color: t.accentText }]}>Alternative : {alternative.nom} →</Texte>
                </TouchableOpacity>
              )}
            </View>
          )}
          {etapeOk && (
            <TouchableOpacity
              onPress={() => router.push(`/seance-sport?source=exercice&id=${etape.exercice}&series=${etape.series}&cible=${etape.objectif}` as never)}
              style={[styles.petitBouton, { backgroundColor: t.accent, alignSelf: "flex-start", marginTop: spacing.md }]}
              accessibilityRole="button"
            >
              <Texte style={[styles.petitBoutonTexte, { color: t.textOnAccent }]}>▶ Faire cette étape</Texte>
            </TouchableOpacity>
          )}

          {fiche.proposition && (
            <View style={[styles.proposition, { backgroundColor: t.bgCardActive }]}>
              <Texte style={[styles.ligne, { color: t.textPrimary, marginTop: 0 }]}>
                Réussie 2 séances de suite. Valider cette étape ?
              </Texte>
              <View style={styles.boutons}>
                <TouchableOpacity
                  style={[styles.petitBouton, { backgroundColor: t.accent }]}
                  onPress={async () => {
                    const r = await validerEtape(s.id);
                    if (r.maitrise) Alert.alert(`${s.nom} maîtrisé !`, r.points ? `+${r.points} pts` : undefined);
                    await charger();
                  }}
                >
                  <Texte style={[styles.petitBoutonTexte, { color: t.textOnAccent }]}>Valider</Texte>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.petitBouton, { borderColor: t.border, borderWidth: 1 }]}
                  onPress={async () => {
                    await refuserValidation(s.id);
                    await charger();
                  }}
                >
                  <Texte style={[styles.petitBoutonTexte, { color: t.textSecondary }]}>Pas encore</Texte>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Noter ce qui a été fait ailleurs (YouTube, salle…) : sans passer par le lecteur */}
          <View style={styles.boutons}>
            <TouchableOpacity
              style={[styles.petitBouton, { backgroundColor: t.accent }]}
              onPress={() => setEssai(true)}
              accessibilityRole="button"
            >
              <Texte style={[styles.petitBoutonTexte, { color: t.textOnAccent }]}>Noter un essai</Texte>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.petitBouton, { borderColor: VERT, borderWidth: 1 }]}
              onPress={() => setAcquis(true)}
              accessibilityRole="button"
            >
              <Texte style={[styles.petitBoutonTexte, { color: VERT }]}>✓ C&apos;est acquis</Texte>
            </TouchableOpacity>
          </View>

          <View style={styles.liens}>
            <TouchableOpacity
              onPress={async () => {
                if (!(await basculerActif(s.id)))
                  Alert.alert(`Déjà ${MAX_ACTIFS} skills en cours`, "Mets-en un en pause d'abord.");
                await charger();
              }}
              hitSlop={8}
            >
              <Texte style={[styles.lien, { color: t.accentText }]}>
                {etat.actif ? "Mettre en pause" : "Travailler ce skill"}
              </Texte>
            </TouchableOpacity>
            {etat.etape > 1 && (
              <TouchableOpacity
                onPress={async () => {
                  await redescendre(s.id);
                  await charger();
                }}
                hitSlop={8}
              >
                <Texte style={[styles.lien, { color: t.textMuted }]}>Revenir à l&apos;étape précédente</Texte>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {st === "maitrise" && (
        <View style={[styles.carte, { backgroundColor: "#0B1A12", borderColor: "#1F4A30" }]}>
          <View style={styles.enCours}>
            <FigureSkill skill={s.id} couleur={VERT} taille={110} />
            <View style={{ flex: 1 }}>
              <Texte style={[styles.etapeNom, { color: VERT }]}>Maîtrisé</Texte>
              <Texte style={[styles.ligne, { color: t.textSecondary }]}>
                Une série d&apos;entretien revient de temps en temps dans la séance.
              </Texte>
              <TouchableOpacity
                onPress={async () => {
                  await redescendre(s.id);
                  await charger();
                }}
                hitSlop={8}
              >
                <Texte style={[styles.lien, { color: t.textMuted, marginTop: spacing.sm }]}>
                  Retravailler la dernière étape
                </Texte>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FeuilleEssai skillId={essai ? s.id : null} onFermer={() => setEssai(false)} onFini={charger} />
      <FeuilleAcquis skillId={acquis ? s.id : null} onFermer={() => setAcquis(false)} onFini={charger} />

      {/* L'échelle des étapes */}
      <Texte style={[styles.surtitre, { color: t.textMuted }]}>LES ÉTAPES</Texte>
      {s.etapes.map((e, i) => {
        const n = i + 1;
        const validee = n < etat.etape;
        const courante = n === etat.etape && enCours;
        const derniereEtape = n === s.etapes.length;
        const couleurRond = validee ? VERT : courante ? t.accent : GRIS;
        return (
          <View key={n} style={styles.echelon}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.rond,
                  validee
                    ? { backgroundColor: VERT, borderColor: VERT }
                    : { backgroundColor: t.bgApp, borderColor: couleurRond, borderWidth: courante ? 3 : 2 },
                ]}
              >
                {validee ? (
                  <Check color="#0B1A12" size={14} strokeWidth={3} />
                ) : derniereEtape ? (
                  <Star color={couleurRond} size={12} strokeWidth={2.4} />
                ) : null}
              </View>
              {!derniereEtape && (
                <View style={[styles.trait, { backgroundColor: validee ? VERT : GRIS, opacity: validee ? 1 : 0.5 }]} />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.lg }}>
              <View style={styles.echelonTete}>
                <Texte
                  style={[
                    styles.echelonNom,
                    { color: validee || courante ? t.textPrimary : t.textMuted },
                  ]}
                >
                  {e.nom} · {critere(e)}
                  {!validee && !etapeFaisable(e, materiel) ? "  (matériel manquant)" : ""}
                </Texte>
                {validee && (
                  <Texte style={[styles.date, { color: VERT }]}>
                    {fiche.validees[n] ? dateCourte(fiche.validees[n]) : "acquis"}
                  </Texte>
                )}
              </View>
              {courante && (
                <View style={[styles.detail, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                  <Texte style={[styles.ligne, { color: t.textSecondary, marginTop: 0 }]}>
                    Ton meilleur : {fiche.meilleur !== null ? `${fiche.meilleur}${e.unite === "s" ? " s" : ""}` : "pas encore de séance"}
                  </Texte>
                  {e.consignes.map((c) => (
                    <Texte key={c} style={[styles.ligne, { color: t.textSecondary }]}>• {c}</Texte>
                  ))}
                  <Texte style={[styles.ligne, { color: t.textMuted }]}>
                    Ce qui aide : {e.appuis.join(", ")}
                  </Texte>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  niveau: { fontSize: typography.small, marginTop: 2 },
  surtitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg },
  enCours: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  etapeNom: { fontSize: typography.h3, fontWeight: "600" },
  ligne: { fontSize: typography.small, marginTop: 4, lineHeight: 18 },
  series: { flexDirection: "row", gap: 4, marginTop: spacing.sm },
  serie: { flex: 1, height: 8, borderRadius: 4, borderWidth: 1 },
  phrase: { fontSize: typography.small, fontWeight: "600", marginTop: spacing.sm },
  proposition: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  boutons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  petitBouton: { borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  petitBoutonTexte: { fontSize: typography.small, fontWeight: "700" },
  liens: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  lien: { fontSize: typography.small, fontWeight: "600", marginTop: 4 },
  echelon: { flexDirection: "row", gap: spacing.md },
  rail: { alignItems: "center", width: 24 },
  rond: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  trait: { width: 2, flex: 1, marginVertical: 2 },
  echelonTete: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, minHeight: 24, alignItems: "center" },
  echelonNom: { flex: 1, fontSize: typography.bodySmall, fontWeight: "600" },
  date: { fontSize: typography.tiny, fontWeight: "700" },
  detail: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.sm },
});
