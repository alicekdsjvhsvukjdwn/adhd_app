import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Texte } from "../components/Texte";
import { getListes, type Liste } from "../lib/db/listes";
import { ecrirePrefsTrois, lirePrefsTrois } from "../lib/db/trois";
import { PREFS_DEFAUT, type Curseur, type ModeTrois, type PrefsTrois } from "../lib/trois-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const MODES: { cle: ModeTrois; libelle: string; aide: string }[] = [
  { cle: "choisis", libelle: "Je choisis la veille", aide: "Tu choisis le soir, rien d'autre n'est ajouté." },
  { cle: "appli", libelle: "L'appli choisit", aide: "Chaque matin, l'appli propose ses meilleures tâches." },
  { cle: "melange", libelle: "Mélange", aide: "Ton choix d'abord, l'appli complète s'il en manque." },
];

const CURSEURS: { cle: keyof PrefsTrois["curseurs"]; libelle: string; bas: string; haut: string }[] = [
  { cle: "echeance", libelle: "Importance de l'échéance", bas: "Moins", haut: "Plus" },
  { cle: "priorite", libelle: "Importance de la priorité", bas: "Moins", haut: "Plus" },
  { cle: "varier", libelle: "Varier les listes", bas: "Pas besoin", haut: "Beaucoup" },
];

/** Lundi → dimanche, avec la convention JS (0 = dimanche). */
const JOURS: { n: number; court: string }[] = [
  { n: 1, court: "L" },
  { n: 2, court: "M" },
  { n: 3, court: "M" },
  { n: 4, court: "J" },
  { n: 5, court: "V" },
  { n: 6, court: "S" },
  { n: 0, court: "D" },
];

/** Profil › Mes 3 tâches : mode, nombre, listes à écarter certains jours, importance donnée au tri. */
export default function ReglagesTrois() {
  const router = useRouter();
  const t = useTheme();
  const [prefs, setPrefs] = useState<PrefsTrois>(PREFS_DEFAUT);
  const [listes, setListes] = useState<Liste[]>([]);

  useEffect(() => {
    lirePrefsTrois().then(setPrefs);
    getListes().then(setListes);
  }, []);

  const changer = useCallback((p: PrefsTrois) => {
    setPrefs(p);
    ecrirePrefsTrois(p).catch(() => {});
  }, []);

  const basculerJour = (listeId: number, jour: number) => {
    const actuels = prefs.exclusions[listeId] ?? [];
    const suivants = actuels.includes(jour) ? actuels.filter((j) => j !== jour) : [...actuels, jour];
    const exclusions = { ...prefs.exclusions, [listeId]: suivants };
    if (suivants.length === 0) delete exclusions[listeId];
    changer({ ...prefs, exclusions });
  };

  const puce = (actif: boolean, libelle: string, onPress: () => void, cle?: string) => (
    <TouchableOpacity
      key={cle ?? libelle}
      onPress={onPress}
      style={[styles.puce, { borderColor: t.border }, actif && { backgroundColor: t.accentFonce }]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={{ color: actif ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small }}>{libelle}</Texte>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Mes 3 tâches</Texte>

      <Texte style={[styles.section, { color: t.textMuted }]}>COMMENT ELLES SONT CHOISIES</Texte>
      <View style={styles.rangee}>{MODES.map((m) => puce(prefs.mode === m.cle, m.libelle, () => changer({ ...prefs, mode: m.cle })))}</View>
      <Texte style={[styles.aide, { color: t.textSecondary }]}>{MODES.find((m) => m.cle === prefs.mode)?.aide}</Texte>

      <Texte style={[styles.section, { color: t.textMuted }]}>COMBIEN</Texte>
      <View style={styles.rangee}>
        {[1, 2, 3, 4, 5].map((n) => puce(prefs.nombre === n, String(n), () => changer({ ...prefs, nombre: n })))}
      </View>

      <Texte style={[styles.section, { color: t.textMuted }]}>LISTES ÉCARTÉES CERTAINS JOURS</Texte>
      <Texte style={[styles.aide, { color: t.textSecondary }]}>
        Touche les jours où une liste ne doit pas apparaître dans tes 3 (par exemple Travail le week-end).
      </Texte>
      {listes.map((l) => (
        <View key={l.id} style={[styles.carte, { backgroundColor: t.bgCard }]}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, marginBottom: spacing.sm }}>
            {l.icone ? `${l.icone} ` : ""}
            {l.nom}
          </Texte>
          <View style={styles.rangee}>
            {JOURS.map((j) =>
              puce((prefs.exclusions[l.id] ?? []).includes(j.n), j.court, () => basculerJour(l.id, j.n), `${l.id}-${j.n}`),
            )}
          </View>
        </View>
      ))}

      <Texte style={[styles.section, { color: t.textMuted }]}>CE QUI COMPTE LE PLUS</Texte>
      <Texte style={[styles.aide, { color: t.textSecondary }]}>
        Ça ne change que le choix de tes 3. Le classement des listes reste comme avant.
      </Texte>
      {CURSEURS.map((c) => (
        <View key={c.cle} style={[styles.carte, { backgroundColor: t.bgCard }]}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, marginBottom: spacing.sm }}>{c.libelle}</Texte>
          <View style={styles.rangee}>
            {([0, 1, 2] as Curseur[]).map((v) =>
              puce(
                prefs.curseurs[c.cle] === v,
                v === 0 ? c.bas : v === 1 ? "Normal" : c.haut,
                () => changer({ ...prefs, curseurs: { ...prefs.curseurs, [c.cle]: v } }),
                `${c.cle}-${v}`,
              ),
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.md },
  section: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  aide: { fontSize: typography.small, lineHeight: 19, marginBottom: spacing.md },
  rangee: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
});
