import { useFocusEffect, useRouter } from "expo-router";
import { BookOpen, Footprints, HeartHandshake, PenLine, Sparkles } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { OuJenSuis } from "../components/OuJenSuis";
import { Texte } from "../components/Texte";
import { useJourCourant } from "../hooks/useJourCourant";
import { lireReglagesSeanceMoi, seancesMoi } from "../lib/db/tcc";
import { lundiDe } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Mon programme : la TCC en autonomie (anxiété sociale, confiance en soi). « Où j'en suis » en haut,
 * puis l'échelle d'exposition, le journal de confiance, la séance avec moi-même et les fiches.
 * Rien ici ne pose de diagnostic ; tout reste sur l'appareil.
 */
export default function Programme() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [jourDeSeance, setJourDeSeance] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const r = await lireReglagesSeanceMoi();
        const faiteCetteSemaine = (await seancesMoi()).some((s) => s.semaine === lundiDe(aujourdhui));
        setJourDeSeance(r.actif && new Date(aujourdhui + "T00:00:00Z").getUTCDay() === r.jour && !faiteCetteSemaine);
      })();
    }, [aujourdhui]),
  );

  const aller = (route: string) => router.push(route as never);
  const tuile = (Icone: typeof PenLine, couleur: string, titre: string, sous: string, route: string) => (
    <TouchableOpacity
      key={route}
      onPress={() => aller(route)}
      style={[styles.tuile, { backgroundColor: t.bgCard, borderColor: t.border }]}
      accessibilityRole="button"
    >
      <Icone color={couleur} size={26} strokeWidth={1.8} />
      <Texte style={[styles.tuileTitre, { color: t.textPrimary }]}>{titre}</Texte>
      <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{sous}</Texte>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.ecran}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Mon programme</Texte>
      <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
        Petit à petit, à mon rythme. Un pas de plus que la dernière fois, c&apos;est déjà un pas.
      </Texte>

      <OuJenSuis />

      {jourDeSeance && (
        <TouchableOpacity
          onPress={() => aller("/seance-moi")}
          style={[styles.bandeau, { backgroundColor: t.bgHighlight, borderColor: t.accent }]}
          accessibilityRole="button"
        >
          <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall }}>C&apos;est le jour de ta séance avec toi · commencer</Texte>
        </TouchableOpacity>
      )}

      <View style={styles.grille}>
        {tuile(Footprints, "#4ADE80", "Mon échelle", "Les situations, marche par marche", "/echelle")}
        {tuile(Sparkles, "#F472B6", "Journal de confiance", "1 à 3 choses bien faites", "/confiance")}
        {tuile(HeartHandshake, "#60A5FA", "Ma séance avec moi", "15 minutes, chaque semaine", "/seance-moi")}
        {tuile(BookOpen, "#FACC15", "Apprendre", "Des fiches d'une minute", "/apprendre")}
      </View>

      <TouchableOpacity onPress={() => aller("/pensee")} style={styles.lien} hitSlop={8}>
        <PenLine color={t.accentText} size={16} />
        <Texte style={{ color: t.accentText, fontSize: typography.small }}>Noter une pensée, puis la tester si je veux</Texte>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => Linking.openURL("tel:3114")} style={{ marginTop: spacing.xl }}>
        <Texte style={{ color: t.textMuted, fontSize: typography.small, textAlign: "center", lineHeight: 17 }}>
          Si ça ne va vraiment pas : le 3114, numéro national de prévention du suicide, gratuit, 24 h/24. Toucher pour appeler.
        </Texte>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  bandeau: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  tuile: { width: "47.5%", borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 6 },
  tuileTitre: { fontSize: typography.body, fontWeight: "600" },
  lien: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg },
});
