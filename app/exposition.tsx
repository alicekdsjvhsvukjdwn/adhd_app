import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Curseur } from "../components/Curseur";
import { ChampTexte, Texte } from "../components/Texte";
import {
  commencerExposition,
  expositionEnCours,
  listerSituations,
  penseeDeSituation,
  terminerExposition,
  type SituationDb,
} from "../lib/db/tcc";
import { COMPORTEMENTS_SECURITE } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Etape = "avant" | "pendant" | "apres" | "fin";

/**
 * « Je le fais » : avant (anxiété prévue, ce que je crains), pendant (j'y vais, je reviens),
 * après (anxiété réelle, ce qui s'est passé, ce que j'en retiens, comportements de sécurité).
 * Rien n'est obligatoire sauf les deux curseurs ; une exposition commencée se retrouve si l'appli se ferme.
 */
export default function Exposition() {
  const router = useRouter();
  const t = useTheme();
  const { situation: param } = useLocalSearchParams<{ situation?: string }>();
  const id = Number(param);

  const [situation, setSituation] = useState<SituationDb | null>(null);
  const [etape, setEtape] = useState<Etape>("avant");
  const [expoId, setExpoId] = useState<number | null>(null);
  const [prevue, setPrevue] = useState(50);
  const [crainte, setCrainte] = useState("");
  const [reelle, setReelle] = useState(50);
  const [vecu, setVecu] = useState("");
  const [retenu, setRetenu] = useState("");
  const [securite, setSecurite] = useState<string[]>([]);
  const [resultat, setResultat] = useState<{ points: number; reussie: boolean; marcheFranchie: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const s = (await listerSituations()).find((x) => x.id === id) ?? null;
      setSituation(s);
      if (!s) return;
      const enCours = await expositionEnCours(id);
      if (enCours) {
        setExpoId(enCours.id);
        setPrevue(enCours.anx_prevue ?? s.anxiete);
        setCrainte(enCours.crainte);
        setReelle(enCours.anx_prevue ?? s.anxiete);
        setEtape("pendant");
      } else {
        setPrevue(s.anxiete);
        setReelle(s.anxiete);
        setCrainte(await penseeDeSituation(id));
      }
    })();
  }, [id]);

  const basculer = (s: string) => setSecurite((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const partir = async () => {
    setExpoId(await commencerExposition(id, prevue, crainte));
    setReelle(prevue);
    setEtape("pendant");
  };
  const enregistrer = async () => {
    if (expoId === null) return;
    setResultat(await terminerExposition(expoId, { anxReelle: reelle, vecu, retenu, securite }));
    setEtape("fin");
  };

  if (!situation) {
    return (
      <View style={[styles.ecran, { backgroundColor: t.bgApp }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={{ color: t.textMuted, marginTop: spacing.lg }}>Cette marche n&apos;existe plus.</Texte>
      </View>
    );
  }

  const bouton = (libelle: string, onPress: () => void) => (
    <TouchableOpacity onPress={onPress} style={[styles.bouton, { backgroundColor: t.accent }]} accessibilityRole="button">
      <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>{libelle}</Texte>
    </TouchableOpacity>
  );
  const champ = (v: string, set: (s: string) => void, placeholder: string) => (
    <ChampTexte
      value={v}
      onChangeText={set}
      multiline
      placeholder={placeholder}
      placeholderTextColor={t.textMuted}
      style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>{etape === "fin" ? "Fermer" : "← Retour"}</Texte>
        </TouchableOpacity>
        <Texte style={[styles.situation, { color: t.textMuted }]}>{situation.nom}</Texte>

        {etape === "avant" && (
          <>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>Avant</Texte>
            <Texte style={[styles.aide, { color: t.textSecondary }]}>Quelle anxiété je prévois, de 0 à 100 ?</Texte>
            <Curseur valeur={prevue} onChange={setPrevue} libelle="Anxiété prévue, sur 100" />
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>CE QUE JE CRAINS QU&apos;IL SE PASSE</Texte>
            {champ(crainte, setCrainte, "Ex : je vais bafouiller et elle va me trouver bizarre")}
            {bouton("C'est parti", partir)}
          </>
        )}

        {etape === "pendant" && (
          <>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>À toi de jouer</Texte>
            <Texte style={[styles.aide, { color: t.textSecondary }]}>
              Tu avais prévu {prevue}/100. Fais-le, même imparfaitement. L&apos;anxiété peut monter : c&apos;est normal, ça redescend. Reviens ici après.
            </Texte>
            {crainte ? (
              <View style={[styles.rappel, { borderColor: t.border, backgroundColor: t.bgCard }]}>
                <Texte style={{ color: t.textMuted, fontSize: typography.tiny, fontWeight: "700", letterSpacing: 0.8 }}>CE QUE JE CRAIGNAIS</Texte>
                <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{crainte}</Texte>
              </View>
            ) : null}
            {bouton("C'est fait", () => setEtape("apres"))}
            <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: "center", marginTop: spacing.xl }} hitSlop={8}>
              <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Pas maintenant (je reprendrai plus tard)</Texte>
            </TouchableOpacity>
          </>
        )}

        {etape === "apres" && (
          <>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>Après</Texte>
            <Texte style={[styles.aide, { color: t.textSecondary }]}>Quelle anxiété j&apos;ai vraiment ressentie, de 0 à 100 ?</Texte>
            <Curseur valeur={reelle} onChange={setReelle} libelle="Anxiété réelle, sur 100" />
            <Texte style={{ color: t.textMuted, fontSize: typography.small, textAlign: "center" }}>Prévue : {prevue}</Texte>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>CE QUI S&apos;EST VRAIMENT PASSÉ</Texte>
            {champ(vecu, setVecu, "Ex : elle m'a répondu normalement")}
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>CE QUE J&apos;EN RETIENS</Texte>
            {champ(retenu, setRetenu, "Ex : c'était moins pire que prévu")}
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>COMPORTEMENTS DE SÉCURITÉ UTILISÉS (SI JE VEUX)</Texte>
            <View style={styles.puces}>
              {COMPORTEMENTS_SECURITE.map((s) => {
                const actif = securite.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => basculer(s)}
                    style={[styles.puce, { borderColor: actif ? t.accent : t.border }, actif && { backgroundColor: t.accent }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: actif }}
                  >
                    <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small }}>{s}</Texte>
                  </TouchableOpacity>
                );
              })}
            </View>
            {bouton("Enregistrer", enregistrer)}
          </>
        )}

        {etape === "fin" && resultat && (
          <>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>C&apos;est noté.</Texte>
            <Texte style={[styles.aide, { color: t.textPrimary, fontSize: typography.body }]}>
              Prévu {prevue} → réel {reelle}.
            </Texte>
            <Texte style={[styles.aide, { color: t.textSecondary }]}>
              {resultat.reussie
                ? reelle <= prevue - 20
                  ? "C'était nettement plus supportable que prévu. Garde ça en tête pour la prochaine fois."
                  : "L'anxiété est restée faible : ça compte comme une réussite. Garde ça en tête pour la prochaine fois."
                : reelle > prevue
                  ? "Cette fois, c'était plus dur que prévu, et tu l'as fait quand même. C'est de l'information utile, pas un échec."
                  : "Tu l'as fait. Refaire la même marche aide aussi : l'écart se creuse avec le temps."}
            </Texte>
            {resultat.marcheFranchie && (
              <View style={[styles.rappel, { borderColor: "#4ADE80", backgroundColor: t.bgCard }]}>
                <Texte style={{ color: "#4ADE80", fontSize: typography.body, fontWeight: "700" }}>🎉 Marche franchie !</Texte>
                <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>Tu peux passer à la suivante quand tu veux, ou refaire celle-ci.</Texte>
              </View>
            )}
            {resultat.points > 0 && <Texte style={{ color: t.accentText, fontSize: typography.small }}>+{resultat.points} pts</Texte>}
            {bouton("Fermer", () => router.back())}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { flexGrow: 1, paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  situation: { fontSize: typography.small, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  aide: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.md },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, minHeight: 72, textAlignVertical: "top" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  bouton: { alignSelf: "flex-end", borderRadius: radius.pill, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, marginTop: spacing.xl },
  rappel: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4, marginVertical: spacing.md },
});
