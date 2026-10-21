import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { dateCourte } from "../lib/esprit-regles";
import { definirObjectifs, objectifsDe, ouJenSuis, type OuJenSuis as Donnees } from "../lib/db/tcc";
import { libelleObjectif, lundiDe, type Objectif } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { ObjectifsEditeur } from "./ObjectifsEditeur";
import { Texte } from "./Texte";

const VERT = "#4ADE80";
const PREVU = "#FB923C";
const HAUT = 44;

/**
 * « Où j'en suis » : l'objectif de la semaine (pastilles), les marches franchies, l'évolution de
 * l'anxiété prévue et réelle sur 8 semaines, la dernière séance avec moi-même. En haut du programme.
 */
export function OuJenSuis() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [d, setD] = useState<Donnees | null>(null);
  const [edition, setEdition] = useState<Objectif[] | null>(null);

  const charger = useCallback(() => ouJenSuis(aujourdhui).then(setD), [aujourdhui]);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const enregistrer = async () => {
    if (!edition) return;
    await definirObjectifs(lundiDe(aujourdhui), edition);
    setEdition(null);
    await charger();
  };

  if (!d) return null;
  const aDonnees = d.courbe.some((c) => c.prevue !== null);

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <View style={styles.ligne}>
        <Texte style={[styles.etiquette, { color: t.textMuted, flex: 1 }]}>MON OBJECTIF DE LA SEMAINE</Texte>
        <TouchableOpacity
          onPress={async () => setEdition(await objectifsDe(lundiDe(aujourdhui)))}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Texte style={{ color: t.accentText, fontSize: typography.small }}>{d.objectifs.length === 0 ? "Choisir" : "Modifier"}</Texte>
        </TouchableOpacity>
      </View>
      {d.objectifs.length === 0 ? (
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>Choisis 1 à 3 petites choses pour cette semaine.</Texte>
      ) : (
        d.objectifs.map((o) => (
          <View key={o.genre} style={{ marginTop: spacing.sm }}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall }}>
              {o.atteint ? "✓ " : ""}
              {libelleObjectif(o.genre, o.cible)}
            </Texte>
            <View style={styles.pastilles}>
              {Array.from({ length: o.cible }, (_, i) => (
                <View key={i} style={[styles.pastille, { backgroundColor: i < o.fait ? VERT : "transparent", borderColor: i < o.fait ? VERT : t.border }]} />
              ))}
            </View>
          </View>
        ))
      )}

      <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.lg }]}>MON ÉCHELLE</Texte>
      <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall }}>
        {d.marches.total === 0
          ? "Pas encore de situation. On commence quand tu veux."
          : `${d.marches.franchies} marche${d.marches.franchies > 1 ? "s" : ""} franchie${d.marches.franchies > 1 ? "s" : ""} sur ${d.marches.total}`}
      </Texte>
      {d.marches.total > 0 && (
        <View style={styles.pastilles}>
          {Array.from({ length: d.marches.total }, (_, i) => (
            <View key={i} style={[styles.marche, { backgroundColor: i < d.marches.franchies ? VERT : t.bgApp, borderColor: i < d.marches.franchies ? VERT : t.border }]} />
          ))}
        </View>
      )}

      <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.lg }]}>MON ANXIÉTÉ, PRÉVUE ET RÉELLE</Texte>
      {aDonnees ? (
        <>
          <View style={styles.courbe} accessibilityLabel="Anxiété prévue et réelle sur 8 semaines">
            {d.courbe.map((c) => (
              <View key={c.debut} style={styles.colonne}>
                <View style={styles.paire}>
                  <View style={{ height: ((c.prevue ?? 0) / 100) * HAUT, width: 7, backgroundColor: PREVU, borderRadius: 2 }} />
                  <View style={{ height: ((c.reelle ?? 0) / 100) * HAUT, width: 7, backgroundColor: VERT, borderRadius: 2 }} />
                </View>
              </View>
            ))}
          </View>
          <Texte style={{ color: t.textMuted, fontSize: typography.tiny, marginTop: 4 }}>
            <Texte style={{ color: PREVU }}>■</Texte> prévue · <Texte style={{ color: VERT }}>■</Texte> réelle · 8 dernières semaines
          </Texte>
        </>
      ) : (
        <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Elle apparaîtra après ta première exposition.</Texte>
      )}

      {d.derniereSeance && (
        <>
          <Texte style={[styles.etiquette, { color: t.textMuted, marginTop: spacing.lg }]}>MA DERNIÈRE SÉANCE AVEC MOI · {dateCourte(d.derniereSeance.jour).toUpperCase()}</Texte>
          {d.derniereSeance.retenu ? (
            <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>J&apos;en retenais : {d.derniereSeance.retenu}</Texte>
          ) : null}
          <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall }}>
            {d.derniereSeance.prochaine ? `Prochain pas : ${d.derniereSeance.prochaine}` : "Pas de prochain pas choisi."}
          </Texte>
        </>
      )}

      <Modal visible={edition !== null} transparent animationType="slide" onRequestClose={() => setEdition(null)}>
        <Pressable style={styles.fond} onPress={() => setEdition(null)}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>Mon objectif de la semaine</Texte>
            {edition && <ObjectifsEditeur objectifs={edition} onChange={setEdition} />}
            <View style={styles.boutons}>
              <TouchableOpacity onPress={() => setEdition(null)} hitSlop={8}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={enregistrer} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
                <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer</Texte>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  ligne: { flexDirection: "row", alignItems: "center" },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pastille: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  marche: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  courbe: { flexDirection: "row", gap: 6, height: HAUT, alignItems: "flex-end", marginTop: 6 },
  colonne: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  paire: { flexDirection: "row", gap: 2, alignItems: "flex-end" },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
