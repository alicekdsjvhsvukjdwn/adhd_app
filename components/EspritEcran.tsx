import { useFocusEffect, useRouter } from "expo-router";
import { BookHeart, Eye, Flower2, HeartHandshake, PenLine } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { decalerJours } from "../lib/dates";
import { ecrireBilan, humeursEntre, lireBilan, listerPensees } from "../lib/db/esprit";
import { meditationsRecentes } from "../lib/db/meditations";
import { lireReglagesSeanceMoi, ouJenSuis, seancesMoi } from "../lib/db/tcc";
import { moyenne } from "../lib/esprit-regles";
import { semaineDe } from "../lib/regles-taches";
import { lundiDe } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { HumeurRapide } from "./HumeurRapide";
import { ChampTexte, Texte } from "./Texte";
import { VisageHumeur } from "./VisageHumeur";

const AIDES = ["Sommeil", "Sport", "Dehors", "La mer", "Quelqu'un", "Une pause", "Musique", "Bien manger"];

/** Le dimanche : humeur de la semaine, ce qui a aidé, une chose à garder. Une minute. */
function MaSemaine({ aujourdhui }: { aujourdhui: string }) {
  const t = useTheme();
  const lundi = semaineDe(aujourdhui)[0];
  const [moy, setMoy] = useState<number | null>(null);
  const [aide, setAide] = useState("");
  const [garder, setGarder] = useState("");
  const [fait, setFait] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const jours = semaineDe(aujourdhui);
        setMoy(moyenne((await humeursEntre(jours[0], jours[6])).map((h) => h.niveau)));
        const b = await lireBilan(lundi);
        if (b) {
          setAide(b.aide);
          setGarder(b.garder);
          setFait(true);
        }
      })();
    }, [aujourdhui, lundi]),
  );

  const ajouter = (mot: string) => {
    setFait(false);
    setAide((a) => (a.split(", ").includes(mot) ? a : a ? `${a}, ${mot}` : mot));
  };

  const enregistrer = async () => {
    await ecrireBilan({ semaine: lundi, aide, garder });
    setFait(true);
  };

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <View style={styles.ligne}>
        <Texte style={[styles.titre, { color: t.textPrimary, flex: 1 }]}>Ma semaine</Texte>
        {moy !== null && <VisageHumeur niveau={moy} taille={36} />}
      </View>
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>CE QUI A AIDÉ</Texte>
      <View style={styles.puces}>
        {AIDES.map((a) => (
          <TouchableOpacity key={a} onPress={() => ajouter(a)} style={[styles.puce, { borderColor: t.border }]} accessibilityRole="button">
            <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>{a}</Texte>
          </TouchableOpacity>
        ))}
      </View>
      <ChampTexte
        value={aide}
        onChangeText={(x) => {
          setAide(x);
          setFait(false);
        }}
        placeholder="Ce qui m'a fait du bien"
        placeholderTextColor={t.textMuted}
        style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
      />
      <Texte style={[styles.etiquette, { color: t.textMuted }]}>UNE CHOSE À GARDER</Texte>
      <ChampTexte
        value={garder}
        onChangeText={(x) => {
          setGarder(x);
          setFait(false);
        }}
        placeholder="Pour la semaine qui vient"
        placeholderTextColor={t.textMuted}
        style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
      />
      <TouchableOpacity
        onPress={enregistrer}
        disabled={fait}
        style={[styles.bouton, { backgroundColor: fait ? t.bgApp : t.accent, borderColor: t.border }]}
        accessibilityRole="button"
      >
        <Texte style={{ color: fait ? t.textMuted : t.textOnAccent, fontWeight: "700" }}>{fait ? "✓ Enregistré" : "Enregistrer"}</Texte>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Suivi › Esprit : l'humeur d'abord, puis le journal de pensées, Mon programme (TCC en autonomie), Méditer et Ma vision.
 * Pas de points pour l'humeur ni le journal.
 */
export function EspritEcran() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();
  /** C'est le jour que j'ai choisi pour ma séance avec moi, et elle n'est pas encore faite cette semaine. */
  const [jourDeSeance, setJourDeSeance] = useState(false);
  const [programme, setProgramme] = useState("Anxiété sociale, confiance");
  const [meditations, setMeditations] = useState(0);
  const [entrees, setEntrees] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const r = await lireReglagesSeanceMoi();
        const faite = (await seancesMoi()).some((s) => s.semaine === lundiDe(aujourdhui));
        setJourDeSeance(r.actif && new Date(aujourdhui + "T00:00:00Z").getUTCDay() === r.jour && !faite);
        const o = await ouJenSuis(aujourdhui);
        setProgramme(
          o.objectifs.length > 0
            ? `Objectif : ${o.objectifs.filter((x) => x.atteint).length}/${o.objectifs.length} atteint${o.objectifs.length > 1 ? "s" : ""}`
            : o.marches.total > 0
              ? `${o.marches.franchies}/${o.marches.total} marches franchies`
              : "Anxiété sociale, confiance",
        );
        setMeditations(await meditationsRecentes(decalerJours(aujourdhui, -6)));
        setEntrees((await listerPensees()).length);
      })();
    }, [aujourdhui]),
  );

  const dimanche = new Date(aujourdhui + "T00:00:00Z").getUTCDay() === 0;
  const aller = (route: string) => router.push(route as never);

  const tuile = (Icone: typeof Eye, couleur: string, titre: string, sous: string, route: string) => (
    <TouchableOpacity
      key={route}
      onPress={() => aller(route)}
      style={[styles.tuile, { backgroundColor: t.bgCard, borderColor: t.border }]}
      accessibilityRole="button"
    >
      <Icone color={couleur} size={26} strokeWidth={1.8} />
      <Texte style={[styles.tuileTitre, { color: t.textPrimary }]}>{titre}</Texte>
      <Texte style={[styles.sous, { color: t.textMuted }]}>{sous}</Texte>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.ecran} contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }} keyboardShouldPersistTaps="handled">
      <Texte style={[styles.grandTitre, { color: t.textPrimary }]}>Esprit</Texte>

      {jourDeSeance && (
        <TouchableOpacity
          onPress={() => aller("/seance-moi")}
          style={[styles.bandeau, { backgroundColor: t.bgHighlight, borderColor: t.accent }]}
          accessibilityRole="button"
        >
          <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall }}>C&apos;est le jour de ta séance avec toi · commencer</Texte>
        </TouchableOpacity>
      )}

      <HumeurRapide />

      {dimanche && (
        <View style={{ marginTop: spacing.md }}>
          <MaSemaine aujourdhui={aujourdhui} />
        </View>
      )}

      <View style={styles.grille}>
        {tuile(PenLine, "#A78BFA", "Noter une pensée", "Étape par étape", "/pensee")}
        {tuile(BookHeart, "#F472B6", "Mon journal", entrees > 0 ? `${entrees} entrée${entrees > 1 ? "s" : ""}` : "Rien pour l'instant", "/journal")}
        {tuile(HeartHandshake, "#60A5FA", "Mon programme", programme, "/tcc")}
        {tuile(Flower2, "#34D399", "Méditer", meditations > 0 ? `${meditations} cette semaine` : "1 min suffit", "/mediter")}
        {tuile(Eye, "#FACC15", "Ma vision", "Photos et phrases", "/vision")}
        {tuile(Eye, "#22D3EE", "Lire ma vision", "Plein écran, doucement", "/vision-lecture")}
      </View>

      <TouchableOpacity onPress={() => aller("/rappels")} style={{ marginTop: spacing.lg }} hitSlop={8}>
        <Texte style={{ color: t.accentText, fontSize: typography.small }}>Régler le rappel du soir « 30 secondes pour toi »</Texte>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingTop: spacing.md, paddingHorizontal: spacing.xl },
  grandTitre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  bandeau: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  titre: { fontSize: typography.h3, fontWeight: "600" },
  ligne: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.sm },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, marginTop: spacing.sm },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.lg },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  tuile: { width: "47.5%", borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 6 },
  tuileTitre: { fontSize: typography.body, fontWeight: "600" },
  sous: { fontSize: typography.small },
});
