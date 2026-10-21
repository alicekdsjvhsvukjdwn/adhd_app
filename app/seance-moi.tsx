import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ObjectifsEditeur } from "../components/ObjectifsEditeur";
import { ChampTexte, Texte } from "../components/Texte";
import { VisageHumeur } from "../components/VisageHumeur";
import { useJourCourant } from "../hooks/useJourCourant";
import {
  echelle,
  ecrireReglagesSeanceMoi,
  enregistrerSeanceMoi,
  expositionsTerminees,
  lireReglagesSeanceMoi,
  objectifsDe,
  recapAutomatique,
  seancesMoi,
  type ReglagesSeanceMoi,
  type SeanceMoi,
  type SituationDb,
} from "../lib/db/tcc";
import { dateCourte } from "../lib/esprit-regles";
import { programmerRappelSeanceMoi } from "../lib/rappels-esprit";
import { joursDeFranchissement, libelleObjectif, lundiDe, type Marche, type Objectif, type RecapSemaine } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Ecran = "accueil" | 1 | 2 | 3 | 4 | 5 | "fin";

const JOURS = [
  { v: 1, l: "L", nom: "lundi" },
  { v: 2, l: "M", nom: "mardi" },
  { v: 3, l: "M", nom: "mercredi" },
  { v: 4, l: "J", nom: "jeudi" },
  { v: 5, l: "V", nom: "vendredi" },
  { v: 6, l: "S", nom: "samedi" },
  { v: 0, l: "D", nom: "dimanche" },
];

const TITRES: Record<number, string> = {
  1: "Comment s'est passée ma semaine",
  2: "Ce que j'ai fait",
  3: "Ce que j'en retiens",
  4: "Le prochain pas",
  5: "Un mot gentil pour moi",
};

const un = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/**
 * Ma séance avec moi-même : une fois par semaine, une quinzaine de minutes, guidée en 5 étapes. Les étapes 1 et 2
 * se remplissent toutes seules ; l'historique garde ce que j'avais décidé et le chemin parcouru depuis le début.
 */
export default function SeanceMoiEcran() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const lundi = lundiDe(aujourdhui);

  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [recap, setRecap] = useState<RecapSemaine | null>(null);
  const [liste, setListe] = useState<Marche<SituationDb>[]>([]);
  const [historique, setHistorique] = useState<SeanceMoi[]>([]);
  const [chemin, setChemin] = useState<{ expositions: number; marches: number } | null>(null);
  const [reglages, setReglages] = useState<ReglagesSeanceMoi>({ actif: false, jour: 0, heure: "18:00" });
  const [refus, setRefus] = useState(false);

  const [retenu, setRetenu] = useState("");
  const [marche, setMarche] = useState<number | null>(null);
  const [suivants, setSuivants] = useState<Objectif[]>([]);
  const [mot, setMot] = useState("");
  const [points, setPoints] = useState(0);

  const charger = useCallback(async () => {
    const seances = await seancesMoi();
    setHistorique(seances);
    setReglages(await lireReglagesSeanceMoi());
    const premiere = seances.at(-1)?.jour;
    if (premiere) {
      const expos = await expositionsTerminees();
      const franchies = [...joursDeFranchissement(expos).values()].filter((j) => j >= premiere).length;
      setChemin({ expositions: expos.filter((e) => e.jour >= premiere).length, marches: franchies });
    } else {
      setChemin(null);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const commencer = async () => {
    setRecap(await recapAutomatique(lundi));
    const l = await echelle();
    setListe(l);
    setMarche(l.find((m) => m.prochaine)?.situation.id ?? null);
    setSuivants(await objectifsDe(lundi));
    setRetenu("");
    setMot("");
    setEcran(1);
  };

  const enregistrer = async () => {
    const r = await enregistrerSeanceMoi({ retenu, situationId: marche, objectifsSuivants: suivants, motGentil: mot });
    setPoints(r.points);
    await charger();
    setEcran("fin");
  };

  const regler = async (r: ReglagesSeanceMoi) => {
    setReglages(r);
    setRefus(false);
    await ecrireReglagesSeanceMoi(r);
    if (!(await programmerRappelSeanceMoi(r))) {
      setRefus(true);
      const sans = { ...r, actif: false };
      setReglages(sans);
      await ecrireReglagesSeanceMoi(sans);
    }
  };

  const fiche = (etiquette: string, valeur: string) => (
    <View style={{ marginBottom: spacing.md }}>
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>{etiquette}</Texte>
      <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{valeur}</Texte>
    </View>
  );

  const nav = (suivant: () => void, libelle = "Suivant") => (
    <View style={styles.boutons}>
      <TouchableOpacity onPress={() => setEcran(typeof ecran === "number" && ecran > 1 ? ((ecran - 1) as Ecran) : "accueil")} hitSlop={8}>
        <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>‹ Retour</Texte>
      </TouchableOpacity>
      <TouchableOpacity onPress={suivant} style={[styles.suivant, { backgroundColor: t.accent }]} accessibilityRole="button">
        <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>{libelle}</Texte>
      </TouchableOpacity>
    </View>
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
        <TouchableOpacity onPress={() => (ecran === "accueil" || ecran === "fin" ? router.back() : setEcran("accueil"))} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>
            {ecran === "accueil" ? "← Retour" : ecran === "fin" ? "Fermer" : "✕ Quitter la séance"}
          </Texte>
        </TouchableOpacity>

        {ecran === "accueil" && (
          <>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>Ma séance avec moi</Texte>
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
              Une fois par semaine, un quart d&apos;heure : je regarde comment ça s&apos;est passé, ce que j&apos;en retiens, et je choisis la suite. Sans me juger.
            </Texte>
            <TouchableOpacity onPress={commencer} style={[styles.grand, { backgroundColor: t.accent }]} accessibilityRole="button">
              <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>
                {historique.some((s) => s.semaine === lundi) ? "Refaire une séance" : "Commencer ma séance"}
              </Texte>
            </TouchableOpacity>

            <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.xl }]}>MON RAPPEL, CHAQUE SEMAINE</Texte>
            <View style={styles.jours}>
              {JOURS.map((j) => {
                const actif = reglages.jour === j.v;
                return (
                  <TouchableOpacity
                    key={j.v}
                    onPress={() => regler({ ...reglages, jour: j.v })}
                    style={[styles.jour, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : t.bgCard }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                    accessibilityLabel={j.nom}
                  >
                    <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontWeight: "600" }}>{j.l}</Texte>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => regler({ ...reglages, actif: !reglages.actif })}
              style={[styles.option, { borderColor: reglages.actif ? t.accent : t.border }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: reglages.actif }}
            >
              <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>
                {reglages.actif ? "✓ " : ""}Me le rappeler le {JOURS.find((j) => j.v === reglages.jour)?.nom} à {reglages.heure}
              </Texte>
            </TouchableOpacity>
            {refus && <Texte style={{ color: t.danger, fontSize: typography.small }}>Les notifications ne sont pas autorisées pour l&apos;appli.</Texte>}
            {Platform.OS === "web" && (
              <Texte style={{ color: t.textMuted, fontSize: typography.tiny, marginTop: spacing.sm }}>
                Sur le web, pas de notification : le jour choisi, un bandeau te le rappelle dans Mon programme.
              </Texte>
            )}

            {chemin && historique.length > 0 && (
              <View style={[styles.chemin, { borderColor: t.border, backgroundColor: t.bgCard }]}>
                <Texte style={[styles.etiquette, { color: t.textMuted }]}>LE CHEMIN PARCOURU</Texte>
                <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall }}>
                  Depuis ta première séance ({dateCourte(historique.at(-1)!.jour)}) : {historique.length} séance{historique.length > 1 ? "s" : ""},{" "}
                  {chemin.expositions} exposition{chemin.expositions > 1 ? "s" : ""}, {chemin.marches} marche{chemin.marches > 1 ? "s" : ""} franchie{chemin.marches > 1 ? "s" : ""}.
                </Texte>
              </View>
            )}

            {historique.length > 0 && <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.xl }]}>MES SÉANCES</Texte>}
            {historique.map((s) => {
              const decide: Objectif[] = (() => {
                try {
                  return JSON.parse(s.objectifs_suivants || "[]");
                } catch {
                  return [];
                }
              })();
              const faits: { genre: Objectif["genre"]; cible: number; atteint: boolean }[] = (() => {
                try {
                  return JSON.parse(s.objectifs || "[]");
                } catch {
                  return [];
                }
              })();
              return (
                <View key={s.id} style={[styles.seance, { borderColor: t.border, backgroundColor: t.bgCard }]}>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{dateCourte(s.jour)}</Texte>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                    Cette semaine-là : {s.expositions} exposition{s.expositions > 1 ? "s" : ""}, {s.confiance} ligne{s.confiance > 1 ? "s" : ""} de confiance
                    {s.anx_reelle_moy !== null && s.anx_prevue_moy !== null ? ` · anxiété prévue ${un(s.anx_prevue_moy)} → réelle ${un(s.anx_reelle_moy)}` : ""}
                  </Texte>
                  {faits.length > 0 && (
                    <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>
                      Objectifs : {faits.map((o) => `${o.atteint ? "✓" : "•"} ${libelleObjectif(o.genre, o.cible)}`).join(" · ")}
                    </Texte>
                  )}
                  {s.retenu ? <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>J&apos;en retenais : {s.retenu}</Texte> : null}
                  {s.prochain_pas ? <Texte style={{ color: t.textPrimary, fontSize: typography.small }}>Prochain pas : {s.prochain_pas}</Texte> : null}
                  {decide.length > 0 && (
                    <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>
                      Pour la semaine d&apos;après : {decide.map((o) => libelleObjectif(o.genre, o.cible)).join(", ")}
                    </Texte>
                  )}
                  {s.mot_gentil ? <Texte style={{ color: t.accentText, fontSize: typography.small, fontStyle: "italic" }}>« {s.mot_gentil} »</Texte> : null}
                </View>
              );
            })}
          </>
        )}

        {typeof ecran === "number" && (
          <>
            <View style={styles.points}>
              {[1, 2, 3, 4, 5].map((k) => (
                <View key={k} style={[styles.pointEtape, { backgroundColor: k <= ecran ? t.accent : t.border }]} />
              ))}
            </View>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>{TITRES[ecran]}</Texte>
          </>
        )}

        {ecran === 1 && recap && (
          <>
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
              Rempli tout seul à partir de ce que tu as noté, de lundi à dimanche.
            </Texte>
            <View style={styles.ligneHumeur}>
              {recap.humeur !== null ? <VisageHumeur niveau={recap.humeur} taille={44} /> : null}
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, flex: 1 }}>
                {recap.humeur !== null ? `Humeur moyenne : ${un(recap.humeur)} sur 5` : "Pas d'humeur notée cette semaine."}
              </Texte>
            </View>
            {recap.anxieteReelle !== null && recap.anxietePrevue !== null
              ? fiche("ANXIÉTÉ, EN MOYENNE", `Prévue ${un(recap.anxietePrevue)} → réelle ${un(recap.anxieteReelle)} sur 100`)
              : fiche("ANXIÉTÉ, EN MOYENNE", "Pas d'exposition cette semaine, rien à comparer.")}
            {nav(() => setEcran(2))}
          </>
        )}

        {ecran === 2 && recap && (
          <>
            {fiche("EXPOSITIONS", `${recap.expositions} cette semaine`)}
            {fiche("JOURNAL DE CONFIANCE", `${recap.confiance} ligne${recap.confiance > 1 ? "s" : ""}`)}
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>MES OBJECTIFS</Texte>
            {recap.objectifs.length === 0 ? (
              <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Pas d&apos;objectif cette semaine.</Texte>
            ) : (
              recap.objectifs.map((o) => (
                <Texte key={o.genre} style={{ color: o.atteint ? t.textPrimary : t.textSecondary, fontSize: typography.body, marginBottom: 4 }}>
                  {o.atteint ? "✓" : "•"} {libelleObjectif(o.genre, o.cible)} · {o.fait}/{o.cible}
                </Texte>
              ))
            )}
            <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.md }}>
              Quel que soit le résultat, tu es là : c&apos;est ce qui compte.
            </Texte>
            {nav(() => setEcran(3))}
          </>
        )}

        {ecran === 3 && (
          <>
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.md }}>
              Une ligne : ce que j&apos;ai appris, ce qui m&apos;a surprise, ce qui a aidé.
            </Texte>
            {champ(retenu, setRetenu, "Ex : ça passe mieux quand je ne prépare pas mes phrases")}
            {nav(() => setEcran(4))}
          </>
        )}

        {ecran === 4 && (
          <>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>LA PROCHAINE MARCHE</Texte>
            {liste.filter((m) => !m.franchie).length === 0 ? (
              <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>
                Toutes tes marches sont franchies, ou l&apos;échelle est vide. Tu peux ajouter une situation dans « Mon échelle ».
              </Texte>
            ) : (
              liste
                .filter((m) => !m.franchie)
                .map((m) => {
                  const actif = marche === m.situation.id;
                  return (
                    <TouchableOpacity
                      key={m.situation.id}
                      onPress={() => setMarche(actif ? null : m.situation.id)}
                      style={[styles.option, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.bgHighlight : t.bgCard }]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: actif }}
                    >
                      <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>
                        {actif ? "✓ " : ""}
                        {m.situation.nom}
                      </Texte>
                      <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                        anxiété imaginée {m.situation.anxiete}
                        {m.prochaine ? " · la suivante dans l'ordre" : ""}
                      </Texte>
                    </TouchableOpacity>
                  );
                })
            )}
            <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.lg }]}>MON OBJECTIF DE LA SEMAINE QUI VIENT</Texte>
            <ObjectifsEditeur objectifs={suivants} onChange={setSuivants} />
            {nav(() => setEcran(5))}
          </>
        )}

        {ecran === 5 && (
          <>
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.md }}>
              Ce que tu dirais à une amie qui a fait ce que tu as fait cette semaine.
            </Texte>
            {champ(mot, setMot, "Ex : tu as osé, et c'est déjà beaucoup")}
            {nav(enregistrer, "Enregistrer ma séance")}
          </>
        )}

        {ecran === "fin" && (
          <>
            <Texte style={[styles.titre, { color: t.textPrimary }]}>C&apos;est fait.</Texte>
            <Texte style={{ color: t.textSecondary, fontSize: typography.body, lineHeight: 22 }}>
              Ta séance est gardée avec ce que tu as décidé. À la semaine prochaine, ou quand tu veux.
            </Texte>
            {points > 0 && <Texte style={{ color: t.accentText, fontSize: typography.small, marginTop: spacing.md }}>+{points} pts</Texte>}
            <TouchableOpacity onPress={() => router.back()} style={[styles.grand, { backgroundColor: t.accent, marginTop: spacing.xl }]} accessibilityRole="button">
              <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Fermer</Texte>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  grand: { alignItems: "center", borderRadius: radius.md, paddingVertical: spacing.md },
  jours: { flexDirection: "row", justifyContent: "space-between" },
  jour: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  option: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  chemin: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  seance: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: 3 },
  points: { flexDirection: "row", gap: 6, marginBottom: spacing.lg },
  pointEtape: { width: 22, height: 6, borderRadius: 3 },
  ligneHumeur: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, minHeight: 100, textAlignVertical: "top" },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xxl },
  suivant: { borderRadius: radius.pill, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
});
