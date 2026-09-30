import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import type { Categorie } from "../lib/catalogue";
import { getAujourdhui } from "../lib/db/completions";
import { faitsDuJour, intensiteJours } from "../lib/db/progression";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { useCouleurCategorie } from "../lib/theme-categories";

/**
 * Calendrier du mois pour un type d'item (routines ou tâches).
 * Chaque jour est coloré selon ce qui a été fait ; toucher un jour
 * montre ce qui a été fait, jamais ce qui manque.
 */

const MOIS = [
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
const JOURS_LONGS = [
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

export function CalendrierMois({
  type,
  titre,
}: {
  type: "routine" | "tache";
  titre?: string;
}) {
  const t = useTheme();
  const couleurCat = useCouleurCategorie();
  const aujourdhui = getAujourdhui();
  const [anneeCourante, moisCourant] = aujourdhui.split("-").map(Number);

  const [mois, setMois] = useState({
    annee: anneeCourante,
    mois: moisCourant - 1,
  });
  const [niveaux, setNiveaux] = useState<Record<string, number | null>>({});
  const [recap, setRecap] = useState<{
    date: string;
    faits: {
      nom: string;
      categorie: Categorie | null;
      version: string | null;
    }[];
  } | null>(null);

  const charger = useCallback(async () => {
    const nb = joursDansMois(mois.annee, mois.mois);
    setNiveaux(
      await intensiteJours(
        iso(mois.annee, mois.mois, 1),
        iso(mois.annee, mois.mois, nb),
        type,
      ),
    );
  }, [mois, type]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
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
    setRecap({ date: d, faits: await faitsDuJour(d, type) });
  };

  const dateLongue = (d: string) => {
    const x = new Date(d + "T00:00:00Z");
    return `${JOURS_LONGS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS[x.getUTCMonth()]}`;
  };

  return (
    <View>
      <View style={styles.entete}>
        <TouchableOpacity onPress={() => changerMois(-1)} hitSlop={12}>
          <Text style={[styles.fleche, { color: t.accentText }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.titre, { color: t.textPrimary }]}>
          {titre ? `${titre} · ` : ""}
          {MOIS[mois.mois]} {mois.annee}
        </Text>
        <TouchableOpacity
          onPress={() => changerMois(1)}
          disabled={estMoisCourant}
          hitSlop={12}
        >
          <Text
            style={[
              styles.fleche,
              { color: estMoisCourant ? t.border : t.accentText },
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.semaine}>
        {ENTETES.map((j, i) => (
          <Text key={i} style={[styles.enteteJour, { color: t.textMuted }]}>
            {j}
          </Text>
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
                <Text
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
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <Text style={[styles.aide, { color: t.textMuted }]}>
        Touche un jour pour voir ce qui a été fait.
      </Text>

      <Modal
        visible={recap !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRecap(null)}
      >
        <Pressable style={styles.fond} onPress={() => setRecap(null)}>
          <Pressable style={[styles.carte, { backgroundColor: t.bgApp }]}>
            {recap && (
              <>
                <Text style={[styles.recapTitre, { color: t.textPrimary }]}>
                  {recap.date === aujourdhui
                    ? "Aujourd'hui"
                    : dateLongue(recap.date)}
                </Text>
                <Text style={[styles.recapSous, { color: t.textSecondary }]}>
                  {recap.faits.length === 0
                    ? "Rien de coché ce jour-là."
                    : `${recap.faits.length} ${
                        type === "routine"
                          ? recap.faits.length > 1
                            ? "routines faites"
                            : "routine faite"
                          : recap.faits.length > 1
                            ? "tâches faites"
                            : "tâche faite"
                      }`}
                </Text>
                {recap.faits.map((f, i) => (
                  <View key={i} style={styles.ligne}>
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
                    <Text style={[styles.ligneNom, { color: t.textPrimary }]}>
                      {f.nom}
                    </Text>
                    {f.version && f.version !== "normale" && (
                      <Text style={[styles.version, { color: t.textMuted }]}>
                        {f.version}
                      </Text>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.fermer, { backgroundColor: t.bgCard }]}
                  onPress={() => setRecap(null)}
                >
                  <Text style={[styles.fermerTexte, { color: t.textPrimary }]}>
                    Fermer
                  </Text>
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
  version: { fontSize: typography.tiny, fontStyle: "italic" },
  fermer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  fermerTexte: { fontSize: typography.body, fontWeight: "600" },
});
