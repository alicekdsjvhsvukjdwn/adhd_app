import { useFocusEffect, useRouter } from "expo-router";
import { ArrowUp, Play, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { getAujourdhui } from "../lib/db/completions";
import {
  derniereFois,
  enregistrerSeanceGuidee,
  enregistrerSeanceNotee,
  enregistrerSeancePerso,
  getSeancePerso,
  hier,
  seancesRecentes,
  type RecenteNotee,
} from "../lib/db/seances-guidees";
import { FeuilleSeanceNotee } from "./FeuillesSport";
import { exercice } from "../lib/exercices";
import type { Materiel } from "../lib/materiel";
import { dureeSeance, faiteLe, ID_REVEIL, minutes, type Seance } from "../lib/seances";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";
import { ChoixExercices } from "./ChoixExercices";
import { FigureSkill } from "./FigureSkill";
import { MesSeances } from "./MesSeances";
import { SeancesProposees } from "./SeancesProposees";
import { PlusMoins } from "./PlusMoins";
import { Texte } from "./Texte";

/** Rangée de bonhommes d'une séance. */
function Figures({ s, couleur, taille }: { s: Seance; couleur: string; taille: number }) {
  return (
    <View style={styles.figures}>
      {s.exercices.map((id, i) => (
        <FigureSkill key={i} skill={exercice(id)?.figure ?? ""} couleur={couleur} taille={taille} />
      ))}
    </View>
  );
}

/**
 * Sport › Workout : « J'ai fait une séance », Réveil du corps (ma routine du matin, modifiable), Mes séances
 * (construites avec la bibliothèque) et les séances proposées par zone et durée, filtrées par mon matériel.
 */
export function OngletSeances({ materiel }: { materiel: Materiel }) {
  const router = useRouter();
  const t = useTheme();
  const [perso, setPerso] = useState<Seance | null>(null);
  const [derniere, setDerniere] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Seance | null>(null);
  const [choix, setChoix] = useState(false);
  const [notee, setNotee] = useState(false);
  const [recentes, setRecentes] = useState<RecenteNotee[]>([]);

  const charger = useCallback(() => {
    getSeancePerso().then(setPerso);
    derniereFois(ID_REVEIL).then(setDerniere);
    seancesRecentes().then(setRecentes);
  }, []);
  useFocusEffect(charger);

  /** Une séance récente refaite en 1 tap (aujourd'hui, sans note). */
  const refaire = async (r: RecenteNotee) => {
    const points = await enregistrerSeanceNotee(r);
    charger();
    Alert.alert("Séance notée", points > 0 ? `+${points} pts` : "Les points du sport sont déjà pris aujourd'hui.");
  };

  /** Ma routine du matin notée faite, sans lancer le lecteur. */
  const noterMatin = async () => {
    if (!perso) return;
    const points = await enregistrerSeanceGuidee(ID_REVEIL, dureeSeance(perso), perso.exercices, true);
    charger();
    Alert.alert("Routine du matin faite", points > 0 ? `+${points} pts` : undefined);
  };

  const lancer = (id: string) => router.push(`/seance-guidee?id=${id}`);

  const puce = (actif: boolean, libelle: string, onPress: () => void, couleur = t.accent) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[
        styles.puce,
        { backgroundColor: actif ? avecAlpha(couleur, 0.18) : t.bgApp, borderColor: actif ? couleur : t.border },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={[styles.puceTexte, { color: actif ? t.textPrimary : t.textSecondary }]}>{libelle}</Texte>
    </TouchableOpacity>
  );

  const b = brouillon;
  const majB = (champs: Partial<Seance>) => setBrouillon((x) => (x ? { ...x, ...champs } : x));
  const deplacer = (i: number) => {
    if (!b || i === 0) return;
    const ex = [...b.exercices];
    [ex[i - 1], ex[i]] = [ex[i], ex[i - 1]];
    majB({ exercices: ex });
  };

  const faite = faiteLe(derniere, getAujourdhui(), hier());

  return (
    <View>
      <TouchableOpacity
        onPress={() => setNotee(true)}
        style={[styles.noter, { backgroundColor: t.accent }]}
        accessibilityRole="button"
      >
        <Texte style={[styles.noterTexte, { color: t.textOnAccent }]}>+ J&apos;ai fait une séance</Texte>
      </TouchableOpacity>
      {recentes.length > 0 && (
        <View>
          <Texte style={[styles.surtitre, { color: t.textMuted }]}>RÉCENTES · 1 TAP POUR REFAIRE</Texte>
          <View style={styles.puces}>
            {recentes.map((r) => puce(false, r.etiquette, () => refaire(r)))}
          </View>
        </View>
      )}
      <FeuilleSeanceNotee visible={notee} onFermer={() => setNotee(false)} onEnregistre={charger} />

      <Texte style={[styles.surtitre, { color: t.textMuted }]}>RÉVEIL DU CORPS · MA ROUTINE DU MATIN</Texte>
      {perso && !b && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.accent }]}>
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <Texte style={[styles.titreCarte, { color: t.textPrimary }]}>{perso.nom}</Texte>
              <Texte style={[styles.sous, { color: t.textMuted }]}>
                {minutes(dureeSeance(perso))} · {perso.effort_s} s / {perso.repos_s} s
              </Texte>
            </View>
            <TouchableOpacity
              onPress={() => lancer(ID_REVEIL)}
              disabled={perso.exercices.length === 0}
              style={[styles.lecture, { backgroundColor: t.accent }]}
              accessibilityRole="button"
              accessibilityLabel={`Commencer ${perso.nom}`}
            >
              <Play color={t.textOnAccent} size={28} fill={t.textOnAccent} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
          <Figures s={perso} couleur={t.accent} taille={40} />
          <View style={styles.liens}>
            <Texte style={[styles.sous, { color: faite ? t.success : t.textMuted }]}>{faite ?? "Pas faite hier"}</Texte>
            <View style={styles.ligne}>
              {!!perso.lien && (
                <TouchableOpacity onPress={() => Linking.openURL(perso.lien!).catch(() => {})} hitSlop={8}>
                  <Texte style={[styles.lien, { color: t.accentText }]}>voir la vidéo</Texte>
                </TouchableOpacity>
              )}
              {derniere !== getAujourdhui() && perso.exercices.length > 0 && (
                <TouchableOpacity onPress={noterMatin} hitSlop={8} accessibilityLabel="Noter la routine du matin comme faite">
                  <Texte style={[styles.lien, { color: t.accentText }]}>✓ Faite</Texte>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setBrouillon(perso)} hitSlop={8}>
                <Texte style={[styles.lien, { color: t.accentText }]}>Modifier</Texte>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {b && (
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {b.exercices.map((id, i) => (
            <View key={`${id}-${i}`} style={[styles.ligne, styles.ligneEx]}>
              <FigureSkill skill={exercice(id)?.figure ?? ""} couleur={t.textSecondary} taille={28} />
              <Texte style={[styles.nomEx, { color: t.textPrimary }]}>
                {i + 1}. {exercice(id)?.nom ?? id}
              </Texte>
              <TouchableOpacity onPress={() => deplacer(i)} disabled={i === 0} hitSlop={6} accessibilityLabel="Monter">
                <ArrowUp color={i === 0 ? t.border : t.textSecondary} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => majB({ exercices: b.exercices.filter((_, j) => j !== i) })}
                hitSlop={6}
                accessibilityLabel="Retirer"
              >
                <X color={t.textSecondary} size={18} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => setChoix(true)} style={[styles.ajoutEx, { borderColor: t.accent }]} accessibilityRole="button">
            <Texte style={[styles.lien, { color: t.accentText }]}>＋ Ajouter un exercice</Texte>
          </TouchableOpacity>
          <ChoixExercices
            visible={choix}
            materiel={materiel}
            onChoisir={(id) => {
              majB({ exercices: [...b.exercices, id] });
              setChoix(false);
            }}
            onFermer={() => setChoix(false)}
          />
          <View style={[styles.ligne, styles.reglage]}>
            <Texte style={[styles.nomEx, { color: t.textSecondary }]}>Effort</Texte>
            <PlusMoins
              valeur={`${b.effort_s} s`}
              libelle="Effort"
              onPas={(p) => setBrouillon((x) => x && { ...x, effort_s: Math.max(10, x.effort_s + 5 * p) })}
            />
          </View>
          <View style={[styles.ligne, styles.reglage]}>
            <Texte style={[styles.nomEx, { color: t.textSecondary }]}>Repos</Texte>
            <PlusMoins
              valeur={`${b.repos_s} s`}
              libelle="Repos"
              onPas={(p) => setBrouillon((x) => x && { ...x, repos_s: Math.max(0, x.repos_s + 5 * p) })}
            />
          </View>
          <TextInput
            value={b.lien ?? ""}
            onChangeText={(lien) => majB({ lien })}
            placeholder="Lien de la vidéo (facultatif)"
            placeholderTextColor={t.textMuted}
            autoCapitalize="none"
            keyboardType="url"
            style={[styles.champ, { color: t.textPrimary, borderColor: t.border }]}
          />
          <View style={styles.puces}>
            {puce(true, "Enregistrer", async () => {
              await enregistrerSeancePerso(b);
              setPerso(b);
              setBrouillon(null);
            })}
            {puce(false, "Annuler", () => setBrouillon(null))}
          </View>
        </View>
      )}

      <MesSeances onChange={charger} />
      <SeancesProposees materiel={materiel} onChange={charger} />
    </View>
  );
}

const styles = StyleSheet.create({
  noter: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.lg },
  noterTexte: { fontSize: typography.body, fontWeight: "700" },
  surtitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titreCarte: { fontSize: typography.h2, fontWeight: "600" },
  sous: { fontSize: typography.small, marginTop: 2 },
  lecture: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.sm },
  liens: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  lien: { fontSize: typography.small, fontWeight: "600" },
  ligneEx: { paddingVertical: 4 },
  nomEx: { flex: 1, fontSize: typography.body, fontWeight: "600" },
  ajoutEx: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.md },
  reglage: { marginTop: spacing.sm },
  champ: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    fontSize: typography.bodySmall,
  },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  puceTexte: { fontSize: typography.small, fontWeight: "600" },
  rangee: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pastille: { width: 10, height: 10, borderRadius: 5 },
});
