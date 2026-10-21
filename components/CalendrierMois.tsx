import { useFocusEffect } from "expo-router";
import { useJourCourant } from "../hooks/useJourCourant";
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "./Texte";
import { menageFaitLe, menageParJour } from "../lib/db/menage-stats";
import { intensiteJours, recapJour, type RecapJour } from "../lib/db/progression";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { useCouleurCategorie } from "../lib/theme-categories";

/**
 * Le calendrier du mois (onglet Progression), routines et tâches ensemble.
 * Chaque jour est coloré selon ce qui a été fait ; toucher un jour
 * montre ce qui a été fait, jamais ce qui manque.
 */

export const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
export const JOURS_LONGS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const ENTETES = ["L", "M", "M", "J", "V", "S", "D"];
const ALPHAS = [0, 0.3, 0.5, 0.75, 1];

function avecAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
}

const iso = (a: number, m: number, j: number) =>
  new Date(Date.UTC(a, m, j)).toISOString().split("T")[0];
const joursDansMois = (a: number, m: number) =>
  new Date(Date.UTC(a, m + 1, 0)).getUTCDate();

export function CalendrierMois() {
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  const aujourdhui = useJourCourant();
  const [anneeCourante, moisCourant] = aujourdhui.split("-").map(Number);

  const [mois, setMois] = useState({
    annee: anneeCourante,
    mois: moisCourant - 1,
  });
  const [niveaux, setNiveaux] = useState<Record<string, number | null>>({});
  const [recap, setRecap] = useState<RecapJour | null>(null);
  /** Ménage : couleurs des pièces par jour (points) et ce qui a été fait le jour ouvert. */
  const [menage, setMenage] = useState<Record<string, string[]>>({});
  const [menageJour, setMenageJour] = useState<{ nom: string; piece: string; couleur: string }[]>([]);

  const charger = useCallback(async () => {
    const nb = joursDansMois(mois.annee, mois.mois);
    setNiveaux(
      await intensiteJours(
        iso(mois.annee, mois.mois, 1),
        iso(mois.annee, mois.mois, nb),
      ),
    );
    setMenage(await menageParJour(iso(mois.annee, mois.mois, 1), iso(mois.annee, mois.mois, nb)));
  }, [mois]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger, aujourdhui]),
  );

  const estMoisCourant =
    mois.annee === anneeCourante && mois.mois === moisCourant - 1;
  const changerMois = (delta: number) => {
    const d = new Date(Date.UTC(mois.annee, mois.mois + delta, 1));
    setMois({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
  };

  const couleur = (n: number | null | undefined) =>
    n === null || n === undefined
      ? "transparent"
      : n === 0
        ? t.bgCard
        : avecAlpha(t.success, ALPHAS[n]);

  const nb = joursDansMois(mois.annee, mois.mois);
  const decalage =
    (new Date(Date.UTC(mois.annee, mois.mois, 1)).getUTCDay() + 6) % 7;
  const cases: (number | null)[] = [
    ...Array(decalage).fill(null),
    ...Array.from({ length: nb }, (_, i) => i + 1),
  ];
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines: (number | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7)
    semaines.push(cases.slice(i, i + 7));

  const ouvrir = async (d: string) => {
    setMenageJour(await menageFaitLe(d));
    setRecap(await recapJour(d));
  };

  const dateLongue = (d: string) => {
    const x = new Date(d + "T00:00:00Z");
    return `${JOURS_LONGS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS[x.getUTCMonth()]}`;
  };

  return (
    <View>
      <View style={styles.entete}>
        <TouchableOpacity onPress={() => changerMois(-1)} hitSlop={12}>
          <Texte style={[styles.fleche, { color: t.accentText }]}>‹</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>
          {MOIS[mois.mois]} {mois.annee}
        </Texte>
        <TouchableOpacity
          onPress={() => changerMois(1)}
          disabled={estMoisCourant}
          hitSlop={12}
        >
          <Texte
            style={[
              styles.fleche,
              { color: estMoisCourant ? t.border : t.accentText },
            ]}
          >
            ›
          </Texte>
        </TouchableOpacity>
      </View>

      <View style={styles.semaine}>
        {ENTETES.map((j, i) => (
          <Texte key={i} style={[styles.enteteJour, { color: t.textMuted }]}>
            {j}
          </Texte>
        ))}
      </View>
      {semaines.map((s, i) => (
        <View key={i} style={styles.semaine}>
          {s.map((jour, k) => {
            if (jour === null) return <View key={k} style={styles.case} />;
            const d = iso(mois.annee, mois.mois, jour);
            const niveau = niveaux[d];
            const consultable = niveau !== null && niveau !== undefined;
            return (
              <TouchableOpacity
                key={k}
                disabled={!consultable}
                onPress={() => ouvrir(d)}
                style={[
                  styles.case,
                  {
                    backgroundColor: couleur(niveau),
                    borderColor: d === aujourdhui ? t.accent : "transparent",
                  },
                ]}
              >
                <Texte
                  style={[
                    styles.numero,
                    {
                      color:
                        consultable && (niveau ?? 0) >= 3
                          ? t.bgApp
                          : consultable
                            ? t.textPrimary
                            : t.textMuted,
                    },
                  ]}
                >
                  {jour}
                </Texte>
                {(menage[d]?.length ?? 0) > 0 && (
                  <View style={styles.points} accessibilityLabel="Ménage fait ce jour-là">
                    {[...new Set(menage[d])].slice(0, 3).map((c) => (
                      <View key={c} style={[styles.point, { backgroundColor: c }]} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <Texte style={[styles.aide, { color: t.textMuted }]}>
        Touche un jour pour voir ce qui a été fait.
      </Texte>

      <Modal
        visible={recap !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRecap(null)}
      >
        <Pressable style={styles.fond} onPress={() => setRecap(null)}>
          <Pressable style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border, borderWidth: 1, maxHeight: "80%" }]}>
            {recap && (
              <>
                <Texte style={[styles.recapTitre, { color: t.textPrimary }]}>
                  {recap.date === aujourdhui
                    ? "Aujourd'hui"
                    : dateLongue(recap.date)}
                </Texte>
                <Texte style={[styles.recapSous, { color: t.textSecondary }]}>
                  {recap.faits.length === 0 && menageJour.length === 0
                    ? "Rien de coché ce jour-là."
                    : recap.global === null
                      ? "Pas de routine prévue ce jour-là."
                      : `${Math.round(recap.global * 100)} % des routines prévues`}
                </Texte>
                <ScrollView style={{ flexGrow: 0 }}>
                {(["routine", "tache"] as const).map((type) => {
                  const faits = recap.faits.filter((f) => f.type === type);
                  if (faits.length === 0) return null;
                  return (
                    <View key={type}>
                      <Texte style={[styles.recapGroupe, { color: t.textMuted }]}>
                        {type === "routine" ? "Routines" : "Tâches"} · {faits.length}
                      </Texte>
                      {faits.map((f) => (
                        <View key={f.id} style={styles.ligne}>
                          <View
                            style={[
                              styles.pastille,
                              {
                                backgroundColor: f.categorie
                                  ? couleurCat(f.categorie)
                                  : t.border,
                              },
                            ]}
                          />
                          <Texte style={[styles.ligneNom, { color: t.textPrimary }]}>
                            {f.nom}
                          </Texte>
                        </View>
                      ))}
                    </View>
                  );
                })}
                {menageJour.length > 0 && (
                  <View>
                    <Texte style={[styles.recapGroupe, { color: t.textMuted }]}>Ménage · {menageJour.length}</Texte>
                    {menageJour.map((m, i) => (
                      <View key={i} style={styles.ligne}>
                        <View style={[styles.pastille, { backgroundColor: m.couleur }]} />
                        <Texte style={[styles.ligneNom, { color: t.textPrimary }]}>
                          {m.nom}
                          <Texte style={{ color: t.textMuted }}> · {m.piece}</Texte>
                        </Texte>
                      </View>
                    ))}
                  </View>
                )}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.fermer, { backgroundColor: t.bgCardActive }]}
                  onPress={() => setRecap(null)}
                >
                  <Texte style={[styles.fermerTexte, { color: t.textPrimary }]}>
                    Fermer
                  </Texte>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  titre: { fontSize: typography.h3, fontWeight: "600" },
  fleche: { fontSize: 28, paddingHorizontal: spacing.sm },
  semaine: { flexDirection: "row", marginBottom: 4 },
  enteteJour: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  case: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  numero: { fontSize: typography.small, fontWeight: "500" },
  points: { flexDirection: "row", gap: 2, position: "absolute", bottom: 3 },
  point: { width: 5, height: 5, borderRadius: 3 },
  aide: { fontSize: typography.tiny, marginTop: spacing.sm },
  fond: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  carte: { borderRadius: radius.lg, padding: spacing.xl },
  recapTitre: {
    fontSize: typography.h2,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  recapSous: {
    fontSize: typography.bodySmall,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 6,
  },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  ligneNom: { flex: 1, fontSize: typography.bodySmall },
  recapGroupe: {
    fontSize: typography.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
  fermer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  fermerTexte: { fontSize: typography.body, fontWeight: "600" },
});
