import { useFocusEffect, useRouter } from "expo-router";
import { ArrowUp, Play, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { getAujourdhui } from "../lib/db/completions";
import { derniereFois, enregistrerSeancePerso, getSeancePerso, hier } from "../lib/db/seances-guidees";
import { exercice, EXERCICES } from "../lib/exercices";
import {
  couleurSeance,
  DUREES,
  dureeSeance,
  faiteLe,
  ID_REVEIL,
  minutes,
  SEANCES,
  ZONES,
  type Seance,
  type Zone,
} from "../lib/seances";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
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
 * Onglet « Séances » de l'écran Sport : Ma routine du matin (modifiable),
 * puis les séances guidées par zone et par durée.
 */
export function OngletSeances() {
  const router = useRouter();
  const t = useTheme();
  const [perso, setPerso] = useState<Seance | null>(null);
  const [derniere, setDerniere] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Seance | null>(null);
  const [filtreZone, setFiltreZone] = useState<Zone | null>(null);
  const [filtreDuree, setFiltreDuree] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSeancePerso().then(setPerso);
      derniereFois(ID_REVEIL).then(setDerniere);
    }, []),
  );

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

  const liste = SEANCES.filter(
    (s) => (!filtreZone || s.zone === filtreZone) && (!filtreDuree || dureeSeance(s) === filtreDuree * 60),
  );
  const faite = faiteLe(derniere, getAujourdhui(), hier());

  return (
    <View>
      <Texte style={[styles.surtitre, { color: t.textMuted }]}>MA ROUTINE DU MATIN</Texte>
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
          <Texte style={[styles.sousTitre, { color: t.textMuted }]}>Ajouter</Texte>
          <View style={styles.puces}>
            {EXERCICES.map((x) => puce(false, x.nom, () => majB({ exercices: [...b.exercices, x.id] })))}
          </View>
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

      <Texte style={[styles.surtitre, { color: t.textMuted }]}>SÉANCES GUIDÉES</Texte>
      <View style={styles.puces}>
        {puce(!filtreZone, "Toutes", () => setFiltreZone(null))}
        {ZONES.map((z) => puce(filtreZone === z.cle, z.nom, () => setFiltreZone(z.cle), z.couleur))}
      </View>
      <View style={[styles.puces, { marginBottom: spacing.sm }]}>
        {puce(!filtreDuree, "Toutes durées", () => setFiltreDuree(null))}
        {DUREES.map((d) => puce(filtreDuree === d, `${d} min`, () => setFiltreDuree(d)))}
      </View>
      {liste.map((s) => {
        const c = couleurSeance(s, t.accent);
        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => lancer(s.id)}
            style={[styles.carte, styles.rangee, { backgroundColor: t.bgCard, borderColor: t.border }]}
          >
            <View style={[styles.pastille, { backgroundColor: c }]} />
            <View style={{ flex: 1 }}>
              <Texte style={[styles.nomEx, { color: t.textPrimary }]}>{s.nom}</Texte>
              <Texte style={[styles.sous, { color: t.textMuted }]}>
                {s.exercices.length} exercices · {s.tours > 1 ? `${s.tours} tours · ` : ""}
                {s.effort_s} s / {s.repos_s} s
              </Texte>
              <Figures s={s} couleur={c} taille={26} />
            </View>
            <Play color={c} size={20} fill={c} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  sousTitre: { fontSize: typography.tiny, fontWeight: "700", marginTop: spacing.md },
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
