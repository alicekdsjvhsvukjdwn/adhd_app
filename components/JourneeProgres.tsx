import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { decalerJours } from "../lib/dates";
import { entreesEntre, getZones, type Entree } from "../lib/db/journee";
import { chaleur, compterParZone, libelleDuree, statsJournee, type Zone } from "../lib/journee-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { Bonhomme } from "./Bonhomme";
import { Texte } from "./Texte";
import { VisageHumeur } from "./VisageHumeur";

/**
 * Suivi › Ma journée : où va ma journée, sur 7 ou 30 jours. Le bonhomme en carte de chaleur, et par zone :
 * entrées, ressenti moyen, temps noté ; puis le nombre de zones colorées chaque jour. Rien à rattraper.
 */
export function JourneeProgres() {
  const t = useTheme();
  const jour = useJourCourant();
  const [periode, setPeriode] = useState<7 | 30>(7);
  const [zones, setZones] = useState<Zone[]>([]);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const jours = Array.from({ length: periode }, (_, i) => decalerJours(jour, i - periode + 1));

  useFocusEffect(
    useCallback(() => {
      Promise.all([getZones(), entreesEntre(decalerJours(jour, 1 - periode), jour)]).then(([z, e]) => {
        setZones(z);
        setEntrees(e);
      });
    }, [jour, periode]),
  );

  const { parZone, zonesParJour } = statsJournee(entrees, jours);
  const actives = zones.filter((z) => z.active);
  const maxZones = Math.max(1, actives.length);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.selecteur, { borderColor: t.border, backgroundColor: t.bgCard }]}>
        {([7, 30] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriode(p)}
            style={[styles.segment, periode === p && { backgroundColor: t.accentFonce }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: periode === p }}
          >
            <Texte style={{ color: periode === p ? t.textOnAccentFonce : t.textSecondary, fontWeight: "600", fontSize: typography.small }}>{p} jours</Texte>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.haut}>
        <Bonhomme zones={zones} comptes={chaleur(compterParZone(entrees))} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          {actives.map((z) => {
            const s = parZone[z.cle];
            return (
              <View key={z.cle} style={styles.ligne}>
                <View style={[styles.point, { backgroundColor: z.couleur }]} />
                <View style={{ flex: 1 }}>
                  <Texte style={[styles.libelle, { color: s ? t.textPrimary : t.textMuted }]} numberOfLines={2}>
                    {z.libelle}
                  </Texte>
                  {s && (
                    <Texte style={[styles.infos, { color: t.textMuted }]}>
                      {s.n} entrée{s.n > 1 ? "s" : ""}
                      {s.minutes ? ` · ${libelleDuree(s.minutes)}` : ""}
                    </Texte>
                  )}
                </View>
                {s?.ressentiMoyen ? (
                  <View style={styles.ressenti} accessibilityLabel={`Ressenti moyen ${s.ressentiMoyen} sur 5`}>
                    <VisageHumeur niveau={s.ressentiMoyen} taille={20} />
                    <Texte style={[styles.infos, { color: t.textSecondary }]}>{String(s.ressentiMoyen).replace(".", ",")}</Texte>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <Texte style={[styles.titre, { color: t.textSecondary }]}>Zones colorées par jour</Texte>
      <View style={[styles.barres, { gap: periode === 7 ? 8 : 2 }]}>
        {zonesParJour.map((n, i) => (
          <View key={jours[i]} style={styles.colonne} accessibilityLabel={`${jours[i]} : ${n} zone${n > 1 ? "s" : ""}`}>
            <View style={[styles.fondBarre, { backgroundColor: t.bgCard }]}>
              <View style={[styles.barre, { height: `${(n / maxZones) * 100}%`, backgroundColor: t.accent }]} />
            </View>
            {periode === 7 && <Texte style={[styles.infos, { color: t.textMuted, marginTop: 4 }]}>{n}</Texte>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl * 2 },
  selecteur: { flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, padding: 3 },
  segment: { paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.pill },
  haut: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignItems: "flex-start" },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  point: { width: 10, height: 10, borderRadius: 5 },
  libelle: { fontSize: typography.tiny, lineHeight: 15 },
  infos: { fontSize: typography.tiny },
  ressenti: { alignItems: "center", gap: 2 },
  titre: { fontSize: typography.small, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm },
  barres: { flexDirection: "row", height: 90, alignItems: "flex-end" },
  colonne: { flex: 1, alignItems: "center", height: "100%" },
  fondBarre: { flex: 1, width: "100%", maxWidth: 18, borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" },
  barre: { width: "100%", borderRadius: 4 },
});
