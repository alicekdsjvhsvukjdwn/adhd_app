import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { Bonhomme } from "../components/Bonhomme";
import { ChampTexte, Texte } from "../components/Texte";
import { getZones, modifierZone } from "../lib/db/journee";
import { PALETTE_ZONES, PARTIES, type CleZone, type Zone } from "../lib/journee-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Profil › Zones du bonhomme : renommer, changer la couleur, désactiver. La forme ne change pas. */
export default function ZonesScreen() {
  const router = useRouter();
  const t = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [choisie, setChoisie] = useState<CleZone | null>(null);

  const charger = useCallback(async () => {
    const z = await getZones();
    setZones(z);
    setNoms(Object.fromEntries(z.map((x) => [x.cle, x.libelle])));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const maj = async (cle: CleZone, champs: Parameters<typeof modifierZone>[1]) => {
    await modifierZone(cle, champs);
    await charger();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Zones du bonhomme</Texte>
      <Texte style={[styles.intro, { color: t.textSecondary }]}>
        Ce que veut dire chaque partie du corps dans « Ma journée », et sa couleur. Une zone désactivée reste grise et ne se touche plus ; ses entrées restent.
      </Texte>

      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <Bonhomme zones={zones} comptes={Object.fromEntries(zones.map((z) => [z.cle, 3]))} choisie={choisie} onChoisir={setChoisie} />
      </View>

      {zones.map((z) => (
        <View key={z.cle} style={[styles.bloc, { backgroundColor: t.bgCard, borderColor: choisie === z.cle ? t.textPrimary : "transparent" }]}>
          <View style={styles.ligne}>
            <Texte style={[styles.partie, { color: t.textMuted }]}>{PARTIES[z.cle]}</Texte>
            <Switch value={!!z.active} onValueChange={(v) => maj(z.cle, { active: v ? 1 : 0 })} accessibilityLabel={`${PARTIES[z.cle]} active`} />
          </View>
          <ChampTexte
            style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
            value={noms[z.cle] ?? z.libelle}
            onChangeText={(v) => setNoms({ ...noms, [z.cle]: v })}
            onEndEditing={() => maj(z.cle, { libelle: noms[z.cle] ?? "" })}
            onBlur={() => maj(z.cle, { libelle: noms[z.cle] ?? "" })}
            accessibilityLabel={`Sens de la zone ${PARTIES[z.cle]}`}
          />
          <View style={styles.couleurs}>
            {PALETTE_ZONES.map((c) => {
              const actif = z.couleur === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => maj(z.cle, { couleur: c })}
                  style={[styles.couleur, { backgroundColor: c, borderColor: actif ? t.textPrimary : "transparent" }]}
                  hitSlop={4}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: actif }}
                  accessibilityLabel={`Couleur ${c} pour ${PARTIES[z.cle]}`}
                />
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  intro: { fontSize: typography.small, lineHeight: 19, marginBottom: spacing.lg },
  bloc: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.sm, borderWidth: 1 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  partie: { fontSize: typography.small, fontWeight: "700", letterSpacing: 0.5 },
  champ: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16 },
  couleurs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  couleur: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
});
