import { useFocusEffect, useRouter } from "expo-router";
import { Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { dupliquerMaSeance, listerMesSeances, noterSeanceCommePrevu, supprimerMaSeance, type MaSeance } from "../lib/db/seances-sport";
import { exercice } from "../lib/exercices";
import { dureeEstimee, minutesDe } from "../lib/seances-sport";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
import { MenuOptions } from "./MenuOptions";
import type { Option } from "./Options";
import { Texte } from "./Texte";

/** Sport › Workout › Mes séances : celles que je construis avec la bibliothèque. Lancer, modifier, dupliquer, supprimer. */
export function MesSeances({ onChange }: { onChange?: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const [liste, setListe] = useState<MaSeance[]>([]);
  const [menu, setMenu] = useState<{ titre: string; options: Option[] }>({ titre: "", options: [] });

  const charger = useCallback(async () => setListe(await listerMesSeances()), []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const options = (s: MaSeance): Option[] => [
    { libelle: "Modifier", onPress: () => router.push(`/seance-edition?id=${s.id}` as never) },
    {
      libelle: "Dupliquer",
      onPress: async () => {
        await dupliquerMaSeance(s.id);
        await charger();
      },
    },
    {
      libelle: "Noter comme faite, comme prévu",
      onPress: async () => {
        const r = await noterSeanceCommePrevu(s.nom, "perso", s.lignes);
        onChange?.();
        Alert.alert("Séance notée", r.points > 0 ? `+${r.points} pts` : "Les points du sport sont déjà pris aujourd'hui.");
      },
    },
    { libelle: "Noter en détail", onPress: () => router.push(`/seance-sport?source=perso&id=${s.id}&liste=1` as never) },
    {
      libelle: "Supprimer",
      danger: true,
      onPress: () =>
        Alert.alert(`Supprimer « ${s.nom} » ?`, "Ce que tu as déjà fait reste dans ton historique.", [
          { text: "Garder", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: async () => {
              await supprimerMaSeance(s.id);
              await charger();
            },
          },
        ]),
    },
  ];

  return (
    <View>
      <Texte style={[styles.surtitre, { color: t.textMuted }]}>MES SÉANCES</Texte>
      {liste.length === 0 && (
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginBottom: spacing.sm }}>
          Compose tes séances avec les exercices de la bibliothèque, dans l&apos;ordre que tu veux.
        </Texte>
      )}
      {liste.map((s) => (
        <View key={s.id} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{s.nom}</Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                {s.lignes.length} exercice{s.lignes.length > 1 ? "s" : ""} · environ {minutesDe(dureeEstimee(s.lignes))} min
              </Texte>
            </View>
            <TouchableOpacity
              onPress={() => setMenu({ titre: s.nom, options: options(s) })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Actions pour ${s.nom}`}
            >
              <Texte style={{ color: t.textMuted, fontSize: 24 }}>⋯</Texte>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/seance-sport?source=perso&id=${s.id}` as never)}
              disabled={s.lignes.length === 0}
              style={[styles.lecture, { backgroundColor: t.accent, opacity: s.lignes.length === 0 ? 0.4 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Commencer ${s.nom}`}
            >
              <Play color={t.textOnAccent} size={20} fill={t.textOnAccent} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.figures}>
            {s.lignes.map((l, i) => (
              <FigureSkill key={i} skill={exercice(l.exercice)?.figure ?? ""} couleur={t.accent} taille={26} />
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity
        onPress={() => router.push("/seance-edition" as never)}
        style={[styles.creer, { borderColor: t.accent }]}
        accessibilityRole="button"
      >
        <Texte style={{ color: t.accentText, fontSize: typography.body, fontWeight: "600" }}>＋ Créer une séance</Texte>
      </TouchableOpacity>
      <MenuOptions titre={menu.titre} options={menu.options} onFermer={() => setMenu({ titre: "", options: [] })} />
    </View>
  );
}

const styles = StyleSheet.create({
  surtitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lecture: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.sm },
  creer: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.md },
});
