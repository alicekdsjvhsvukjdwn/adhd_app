import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { decalerJours } from "../lib/dates";
import { emplacementsDuJour, etoiler, placerDansTrois, placerEnBonus } from "../lib/db/trois";
import type { Proposition } from "../lib/db/moteur";
import type { Emplacement } from "../lib/trois-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { JOURS_LONGS, MOIS } from "./CalendrierMois";
import { Texte } from "./Texte";

/** « Aujourd'hui », « Demain » ou « ven. 23 oct. ». */
export function libelleJourPlan(jour: string, aujourdhui: string): string {
  if (jour === aujourdhui) return "Aujourd'hui";
  if (jour === decalerJours(aujourdhui, 1)) return "Demain";
  const d = new Date(jour + "T00:00:00Z");
  return `${JOURS_LONGS[d.getUTCDay()].slice(0, 3)}. ${d.getUTCDate()} ${MOIS[d.getUTCMonth()].slice(0, 4)}.`;
}

type Etape = { type: "jour" } | { type: "date" } | { type: "plein"; jour: string; occupants: { rang: number; nom: string; faite: boolean }[]; remplacer: boolean };

/**
 * L'étoile ☆ : pour quel jour ? Aujourd'hui, demain, ou une date (28 jours). Comme priorité ou comme bonus.
 * Si les 3 du jour sont pris : « En bonus » ou « Remplacer… » (je choisis laquelle), jamais d'écrasement silencieux.
 * Un ✓ montre où la tâche est déjà placée ; le toucher la retire.
 */
export function FeuilleEtoile({
  tache,
  aujourdhui,
  classement,
  placements,
  nomDe,
  onFini,
}: {
  tache: { itemId: number; nom: string } | null;
  aujourdhui: string;
  classement: Proposition[];
  /** Où la tâche est déjà placée (aujourd'hui et plus tard). */
  placements: { jour: string; bonus: boolean }[];
  /** Le nom d'une tâche (même déjà faite, donc absente du classement). */
  nomDe: (itemId: number) => string;
  onFini: () => void;
}) {
  const t = useTheme();
  const [etape, setEtape] = useState<Etape>({ type: "jour" });
  const [bonus, setBonus] = useState(false);

  if (!tache) return null;
  const ou = (j: string) => placements.find((p) => p.jour === j);

  const choisir = async (jour: string) => {
    const r = await etoiler(jour, tache.itemId, bonus ? "bonus" : "priorite", classement, aujourdhui);
    if (r !== "plein") return onFini();
    const empl: Emplacement[] = await emplacementsDuJour(jour, classement, false, aujourdhui);
    setEtape({
      type: "plein",
      jour,
      occupants: empl.flatMap((e) => (e.itemId !== null ? [{ rang: e.rang, nom: nomDe(e.itemId), faite: e.faite }] : [])),
      remplacer: false,
    });
  };

  const ligne = (jour: string) => {
    const deja = ou(jour);
    return (
      <TouchableOpacity key={jour} onPress={() => choisir(jour)} style={[styles.ligne, { borderColor: deja ? t.accent : t.border }]} accessibilityRole="button" accessibilityLabel={`${deja ? "Retirer de" : "Mettre pour"} ${libelleJourPlan(jour, aujourdhui)}`}>
        <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{libelleJourPlan(jour, aujourdhui)}</Texte>
        {deja && <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "700" }}>✓ {deja.bonus ? "en bonus" : "dans les 3"}</Texte>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFini}>
      <Pressable style={styles.fond} onPress={onFini}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600" }}>★ Pour quand ?</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small, marginBottom: spacing.md }} numberOfLines={1}>
            {tache.nom}
          </Texte>

          {etape.type !== "plein" && (
            <View style={styles.segments}>
              {(
                [
                  [false, "Dans les 3"],
                  [true, "En bonus"],
                ] as const
              ).map(([b, lib]) => (
                <TouchableOpacity key={lib} onPress={() => setBonus(b)} style={[styles.segment, bonus === b && { backgroundColor: t.accent }]} accessibilityRole="button" accessibilityState={{ selected: bonus === b }}>
                  <Texte style={{ color: bonus === b ? t.textOnAccent : t.textSecondary, fontWeight: "700", fontSize: typography.bodySmall }}>{lib}</Texte>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {etape.type === "jour" && (
            <>
              {ligne(aujourdhui)}
              {ligne(decalerJours(aujourdhui, 1))}
              {placements
                .filter((p) => p.jour > decalerJours(aujourdhui, 1))
                .map((p) => ligne(p.jour))}
              <TouchableOpacity onPress={() => setEtape({ type: "date" })} style={[styles.ligne, { borderColor: t.border }]} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.body }}>Choisir une date…</Texte>
              </TouchableOpacity>
            </>
          )}

          {etape.type === "date" && (
            <ScrollView style={{ maxHeight: 320 }}>
              <View style={styles.dates}>
                {Array.from({ length: 28 }, (_, i) => decalerJours(aujourdhui, i + 2)).map((j) => {
                  const deja = ou(j);
                  return (
                    <TouchableOpacity key={j} onPress={() => choisir(j)} style={[styles.date, { borderColor: deja ? t.accent : t.border, backgroundColor: deja ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityLabel={libelleJourPlan(j, aujourdhui)}>
                      <Texte style={{ color: deja ? t.textOnAccent : t.textPrimary, fontSize: typography.small, fontWeight: "600" }}>{libelleJourPlan(j, aujourdhui)}</Texte>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {etape.type === "plein" && (
            <>
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600", marginBottom: spacing.sm }}>Les 3 de {libelleJourPlan(etape.jour, aujourdhui).toLowerCase()} sont pris.</Texte>
              {!etape.remplacer ? (
                <>
                  <TouchableOpacity
                    onPress={async () => {
                      await placerEnBonus(etape.jour, tache.itemId);
                      onFini();
                    }}
                    style={[styles.ligne, { borderColor: t.accent }]}
                    accessibilityRole="button"
                  >
                    <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>En bonus</Texte>
                  </TouchableOpacity>
                  {etape.occupants.some((o) => !o.faite) && (
                    <TouchableOpacity onPress={() => setEtape({ ...etape, remplacer: true })} style={[styles.ligne, { borderColor: t.border }]} accessibilityRole="button">
                      <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>Remplacer…</Texte>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>Laquelle remplacer ?</Texte>
                  {etape.occupants
                    .filter((o) => !o.faite)
                    .map((o) => (
                      <TouchableOpacity
                        key={o.rang}
                        onPress={async () => {
                          await placerDansTrois(etape.jour, o.rang, tache.itemId);
                          onFini();
                        }}
                        style={[styles.ligne, { borderColor: t.border }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Remplacer ${o.nom}`}
                      >
                        <Texte style={{ color: t.textPrimary, fontSize: typography.body }} numberOfLines={2}>
                          {o.nom}
                        </Texte>
                      </TouchableOpacity>
                    ))}
                </>
              )}
            </>
          )}

          <TouchableOpacity onPress={onFini} style={{ alignSelf: "center", marginTop: spacing.md }} hitSlop={8}>
            <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  segments: { flexDirection: "row", borderRadius: radius.pill, padding: 3, marginBottom: spacing.md, backgroundColor: "rgba(127,127,127,0.15)" },
  segment: { flex: 1, alignItems: "center", borderRadius: radius.pill, paddingVertical: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  dates: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  date: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
});
