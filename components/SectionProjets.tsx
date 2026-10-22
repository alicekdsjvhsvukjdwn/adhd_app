import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { changerEtat, suiviProjets, type SuiviProjets } from "../lib/db/projets";
import { libelleDuree } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Texte } from "./Texte";

const HAUT = 72;

/**
 * Progrès › Projets : temps passé par semaine (8 semaines, une couleur par type), étapes faites, projets finis,
 * et les projets en cours restés sans rien depuis plus de 2 semaines (« mettre en pause ? », sans reproche).
 */
export function SectionProjets() {
  const t = useTheme();
  const router = useRouter();
  const aujourdhui = useJourCourant();
  const [d, setD] = useState<SuiviProjets | null>(null);

  const charger = useCallback(() => suiviProjets(aujourdhui).then(setD), [aujourdhui]);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (!d) return null;
  const max = Math.max(1, ...d.semaines.map((s) => s.total));
  const total = d.semaines.reduce((s, x) => s + x.total, 0);
  const couleurDe = (id: number) => d.types.find((x) => x.id === id)?.couleur ?? t.accent;
  const utilises = d.types.filter((ty) => d.semaines.some((s) => s.parType[ty.id]));

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Projets</Texte>

      <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <Texte style={[styles.etiquette, { color: t.textMuted }]}>TEMPS PASSÉ, PAR SEMAINE</Texte>
        {total === 0 ? (
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Pas encore de temps noté. Une séance dans un projet apparaît ici.</Texte>
        ) : (
          <>
            <View style={styles.barres} accessibilityLabel="Minutes passées sur les projets, par semaine">
              {d.semaines.map((s) => (
                <View key={s.lundi} style={styles.colonne}>
                  <View style={{ height: HAUT, justifyContent: "flex-end" }}>
                    {Object.entries(s.parType).map(([type, min]) => (
                      <View key={type} style={{ height: (min / max) * HAUT, backgroundColor: couleurDe(Number(type)) }} />
                    ))}
                  </View>
                  <Texte style={[styles.date, { color: t.textMuted }]}>{`${Number(s.lundi.slice(8))}/${Number(s.lundi.slice(5, 7))}`}</Texte>
                </View>
              ))}
            </View>
            <View style={styles.legende}>
              {utilises.map((ty) => (
                <View key={ty.id} style={styles.legendeItem}>
                  <View style={[styles.pastille, { backgroundColor: ty.couleur }]} />
                  <Texte style={{ color: t.textMuted, fontSize: 11 }}>{ty.nom}</Texte>
                </View>
              ))}
            </View>
            <Texte style={{ color: t.textSecondary, fontSize: typography.small, marginTop: spacing.sm }}>{libelleDuree(total)} sur 8 semaines</Texte>
          </>
        )}
      </View>

      <View style={styles.ligne}>
        <View style={[styles.carte, styles.moitie, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.nombre, { color: t.textPrimary }]}>{d.etapesFaites8s}</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>étape{d.etapesFaites8s > 1 ? "s" : ""} faite{d.etapesFaites8s > 1 ? "s" : ""} (8 semaines)</Texte>
        </View>
        <View style={[styles.carte, styles.moitie, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.nombre, { color: t.textPrimary }]}>{d.finis}</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>projet{d.finis > 1 ? "s" : ""} fini{d.finis > 1 ? "s" : ""}</Texte>
        </View>
      </View>

      {d.oublies.map((o) => (
        <View key={o.id} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <TouchableOpacity onPress={() => router.push(`/projet?id=${o.id}` as never)} accessibilityRole="button">
            <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{o.nom}</Texte>
            <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Dernier projet touché il y a {o.jours} jours.</Texte>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await changerEtat(o.id, "en_pause");
              await charger();
            }}
            style={[styles.bouton, { borderColor: t.accent }]}
            accessibilityRole="button"
          >
            <Texte style={{ color: t.accentText, fontWeight: "600", fontSize: typography.small }}>Le mettre en pause ?</Texte>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  barres: { flexDirection: "row", gap: 6 },
  colonne: { flex: 1, alignItems: "stretch" },
  date: { fontSize: 10, textAlign: "center", marginTop: 4 },
  legende: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  legendeItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  ligne: { flexDirection: "row", gap: spacing.sm },
  moitie: { flex: 1 },
  nombre: { fontSize: 32, fontWeight: "600" },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.md },
});
