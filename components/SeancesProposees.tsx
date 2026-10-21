import { useRouter } from "expo-router";
import { Play } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { enregistrerMaSeance } from "../lib/db/seances-sport";
import { exercice } from "../lib/exercices";
import { libellePoids, type Materiel } from "../lib/materiel";
import {
  DUREES_PROPOSEES,
  dureeEstimee,
  minutesDe,
  proposerSeance,
  ZONES_PROPOSEES,
  type DureeProposee,
  type LigneSeance,
  type ZoneProposee,
} from "../lib/seances-sport";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
import { Texte } from "./Texte";

/** « 3 × 12 », « 3 × 30 s », « 3 × 10 · 8 kg » */
const libelleLigne = (l: LigneSeance): string => {
  const e = exercice(l.exercice);
  return `${l.series} × ${l.cible}${e?.mode === "s" ? " s" : ""}${l.poids ? ` · ${libellePoids(l.poids)}` : ""}`;
};

/**
 * Séances proposées : une zone, une durée, et l'appli compose une séance avec le matériel que j'ai. « Une autre »
 * en propose une différente ; je peux la lancer ou la garder dans Mes séances.
 */
export function SeancesProposees({ materiel, onChange }: { materiel: Materiel; onChange?: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const [zone, setZone] = useState<ZoneProposee>("complet");
  const [minutes, setMinutes] = useState<DureeProposee>(20);
  const [graine, setGraine] = useState(0);

  const s = useMemo(() => proposerSeance(zone, minutes, materiel, graine), [zone, minutes, materiel, graine]);
  const couleur = ZONES_PROPOSEES.find((z) => z.cle === zone)!.couleur;

  const puce = (actif: boolean, libelle: string, onPress: () => void, c = t.accent) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[styles.puce, { backgroundColor: actif ? avecAlpha(c, 0.18) : t.bgApp, borderColor: actif ? c : t.border }]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={{ color: actif ? t.textPrimary : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{libelle}</Texte>
    </TouchableOpacity>
  );

  return (
    <View>
      <Texte style={[styles.surtitre, { color: t.textMuted }]}>SÉANCES PROPOSÉES</Texte>
      <View style={styles.puces}>
        {ZONES_PROPOSEES.map((z) =>
          puce(zone === z.cle, z.nom, () => {
            setZone(z.cle);
            setGraine(0);
          }, z.couleur),
        )}
      </View>
      <View style={styles.puces}>
        {DUREES_PROPOSEES.map((d) =>
          puce(minutes === d, `${d} min`, () => {
            setMinutes(d);
            setGraine(0);
          }),
        )}
      </View>

      <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: couleur }]}>
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{s.nom}</Texte>
            <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
              {s.lignes.length} exercices · environ {minutesDe(dureeEstimee(s.lignes))} min · avec ton matériel
            </Texte>
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/seance-sport?source=proposee&zone=${zone}&min=${minutes}&graine=${graine}` as never)}
            style={[styles.lecture, { backgroundColor: couleur }]}
            accessibilityRole="button"
            accessibilityLabel={`Commencer ${s.nom}`}
          >
            <Play color={t.textOnAccent} size={20} fill={t.textOnAccent} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
        {s.lignes.map((l, i) => {
          const e = exercice(l.exercice)!;
          return (
            <View key={`${l.exercice}-${i}`} style={styles.exo}>
              <FigureSkill skill={e.figure} couleur={couleur} taille={28} />
              <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall, flex: 1 }} numberOfLines={1}>
                {e.nom}
              </Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{libelleLigne(l)}</Texte>
            </View>
          );
        })}
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => setGraine((g) => g + 1)} hitSlop={8} accessibilityRole="button">
            <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>↻ Une autre</Texte>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await enregistrerMaSeance({ nom: s.nom, lignes: s.lignes });
              onChange?.();
              Alert.alert("Ajoutée à Mes séances", s.nom);
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>＋ Garder dans Mes séances</Texte>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surtitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  lecture: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  exo: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 3 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
});
