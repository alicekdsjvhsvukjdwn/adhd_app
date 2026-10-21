import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FigureSkill } from "../components/FigureSkill";
import { Texte } from "../components/Texte";
import { getMateriel } from "../lib/db/sport-materiel";
import { historiqueExercice, type HistoriqueExercice } from "../lib/db/exercices-historique";
import { dateCourte } from "../lib/esprit-regles";
import { alternativeA, exercice, faisable } from "../lib/exercices";
import { libellePoids, manquants, MATERIEL_DEFAUT, MATERIELS, nomMateriel, type Materiel } from "../lib/materiel";
import { zone } from "../lib/seances";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const MODES = { reps: "répétitions", s: "secondes", reps_poids: "répétitions avec un poids" } as const;
const NOM_ZONE: Record<string, string> = { haut: "Haut", bas: "Bas", abdos: "Abdos & gainage", mobilite: "Mobilité", complet: "Corps complet" };
const HAUT = 48;

/** Fiche d'un exercice : bonhomme, consignes, variantes, mon historique, « Faire maintenant ». */
export default function FicheExercice() {
  const router = useRouter();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = exercice(id);
  const [materiel, setMateriel] = useState<Materiel>(MATERIEL_DEFAUT);
  const [histo, setHisto] = useState<HistoriqueExercice | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setMateriel(await getMateriel());
        if (e) setHisto(await historiqueExercice(e));
      })();
    }, [e]),
  );

  if (!e) {
    return (
      <View style={[styles.ecran, { backgroundColor: t.bgApp }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={{ color: t.textMuted, marginTop: spacing.lg }}>Cet exercice n&apos;existe pas.</Texte>
      </View>
    );
  }

  const ok = faisable(e, materiel);
  const alt = alternativeA(e, materiel);
  const couleur = zone(e.zones[0]).couleur;
  const unite = e.mode === "s" ? "s" : "rép.";
  const max = Math.max(1, ...(histo?.courbe.map((c) => c.valeur) ?? [1]));
  const lien = (autre: string | undefined, libelle: string) => {
    const x = autre ? exercice(autre) : undefined;
    return x ? (
      <TouchableOpacity onPress={() => router.push(`/exercice?id=${x.id}` as never)} hitSlop={6} style={{ marginTop: 4 }} accessibilityRole="button">
        <Texte style={{ color: t.accentText, fontSize: typography.body }}>
          {libelle} : {x.nom} →
        </Texte>
      </TouchableOpacity>
    ) : null;
  };
  const etiquette = (s: string) => <Texte style={[styles.etiquette, { color: t.textMuted }]}>{s}</Texte>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
      </TouchableOpacity>
      <View style={styles.centre}>
        <FigureSkill skill={e.figure} couleur={ok ? couleur : t.textMuted} taille={150} />
      </View>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>{e.nom}</Texte>
      <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>
        {e.zones.map((z) => NOM_ZONE[z]).join(" · ")} · niveau {e.niveau} sur 5 · en {MODES[e.mode]}
      </Texte>

      {etiquette("MUSCLES PRINCIPAUX")}
      <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{e.muscles.join(", ")}</Texte>

      {etiquette("MATÉRIEL")}
      {e.materiel.length === 0 ? (
        <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>Aucun : le sol suffit.</Texte>
      ) : (
        e.materiel.map((m) => (
          <Texte key={m} style={{ color: materiel.dispo[m] ? t.textPrimary : t.danger, fontSize: typography.body }}>
            {materiel.dispo[m] ? "✓" : "✗"} {nomMateriel(m)}
            {!materiel.dispo[m] ? " (je ne l'ai pas)" : ""}
          </Texte>
        ))
      )}
      {e.mode === "reps_poids" && e.materiel.includes("halteres") && materiel.dispo.halteres && (
        <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
          {materiel.poids.length > 0 ? `Mes poids : ${materiel.poids.map(libellePoids).join(", ")}` : "Tu peux saisir tes poids dans Sport › ⚙️."}
        </Texte>
      )}
      {!ok && (
        <Texte style={{ color: t.danger, fontSize: typography.small, marginTop: 4 }}>
          Matériel manquant : {manquants(e.materiel, materiel).map((m) => MATERIELS.find((x) => x.cle === m)?.nom.toLowerCase()).join(", ")}.
        </Texte>
      )}
      {alt && lien(alt.id, "Alternative avec mon matériel")}

      {etiquette("CONSIGNES")}
      {e.consignes.map((c) => (
        <Texte key={c} style={{ color: t.textPrimary, fontSize: typography.body, lineHeight: 22, marginBottom: 2 }}>
          • {c}
        </Texte>
      ))}

      {(e.plus_facile || e.plus_dur) && etiquette("VARIANTES")}
      {lien(e.plus_facile, "Plus facile")}
      {lien(e.plus_dur, "Plus dur")}
      {e.lien ? (
        <TouchableOpacity onPress={() => Linking.openURL(e.lien!)} style={{ marginTop: spacing.md }} accessibilityRole="link">
          <Texte style={{ color: t.accentText, fontSize: typography.body }}>▶ Voir la vidéo</Texte>
        </TouchableOpacity>
      ) : null}

      {etiquette("MON HISTORIQUE")}
      {histo && !histo.record && histo.guidees.fois === 0 ? (
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>
          Pas encore d&apos;historique : il se remplira avec tes séances.
        </Texte>
      ) : null}
      {histo?.record && (
        <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>
          🏅 Meilleur : {histo.record.valeur} {unite} · {dateCourte(histo.record.date)}
        </Texte>
      )}
      {histo && histo.guidees.fois > 0 && (
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>
          Fait dans {histo.guidees.fois} séance{histo.guidees.fois > 1 ? "s" : ""} guidée{histo.guidees.fois > 1 ? "s" : ""}
          {histo.guidees.derniere ? `, dernière fois ${dateCourte(histo.guidees.derniere)}` : ""}.
        </Texte>
      )}
      {histo && histo.dernieres.length > 0 && (
        <>
          <View style={styles.courbe} accessibilityLabel="Meilleure série de chaque séance">
            {histo.courbe.map((c) => (
              <View key={c.date} style={styles.colonne}>
                <View style={{ height: HAUT, justifyContent: "flex-end" }}>
                  <View style={{ height: (c.valeur / max) * HAUT, backgroundColor: couleur, borderRadius: 2 }} />
                </View>
                <Texte style={{ color: t.textMuted, fontSize: 10, textAlign: "center", marginTop: 3 }}>{`${Number(c.date.slice(8))}/${Number(c.date.slice(5, 7))}`}</Texte>
              </View>
            ))}
          </View>
          {histo.dernieres.map((s) => (
            <Texte key={s.date} style={{ color: t.textSecondary, fontSize: typography.small }}>
              {dateCourte(s.date)} · {s.series} série{s.series > 1 ? "s" : ""} · meilleure {s.meilleure} {unite}
            </Texte>
          ))}
        </>
      )}

      <TouchableOpacity
        onPress={() => router.push(`/seance-sport?source=exercice&id=${e.id}` as never)}
        disabled={!ok}
        style={[styles.faire, { backgroundColor: ok ? t.accent : t.bgCard, borderColor: t.border }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ok }}
      >
        <Texte style={{ color: ok ? t.textOnAccent : t.textMuted, fontWeight: "700", fontSize: typography.body }}>
          {ok ? "Faire maintenant" : "Matériel manquant"}
        </Texte>
      </TouchableOpacity>
      {ok && <Texte style={{ color: t.textMuted, fontSize: typography.tiny, textAlign: "center", marginTop: 6 }}>3 séries, ce que tu fais est noté dans ton historique.</Texte>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  centre: { alignItems: "center", marginBottom: spacing.md },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: 4 },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  courbe: { flexDirection: "row", gap: 6, marginVertical: spacing.md },
  colonne: { flex: 1 },
  faire: { alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
});
