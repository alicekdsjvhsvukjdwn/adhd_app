import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { ecrireRappelEsprit, lireRappelEsprit, type RappelEsprit } from "../lib/rappels-esprit";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { SelecteurHeure } from "./SelecteurHeure";
import { Texte } from "./Texte";

/** Rappel du soir « 30 secondes pour toi » : ouvre l'Esprit sur l'humeur. Seule l'heure compte, rien d'autre. */
export function CarteRappelEsprit() {
  const t = useTheme();
  const [r, setR] = useState<RappelEsprit | null>(null);
  const [heure, setHeure] = useState(false);

  useEffect(() => {
    Promise.resolve(lireRappelEsprit()).then(setR);
  }, []);

  if (!r) return null;

  const changer = async (suivant: RappelEsprit) => {
    try {
      if (await ecrireRappelEsprit(suivant)) setR(suivant);
      else Alert.alert("Notifications refusées", "Autorise-les dans les réglages pour recevoir ce rappel.");
    } catch (e) {
      Alert.alert("Le rappel n'a pas pu être mis à jour", String(e));
    }
  };

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
      <View style={styles.ligne}>
        <View style={{ flex: 1 }}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>30 secondes pour toi</Texte>
          <Texte style={[styles.aide, { color: t.textMuted }]}>Un rappel le soir, qui ouvre l&apos;Esprit sur l&apos;humeur.</Texte>
        </View>
        <Switch value={r.actif} onValueChange={(actif) => changer({ ...r, actif })} trackColor={{ false: t.border, true: t.accent }} />
      </View>
      {r.actif && (
        <TouchableOpacity style={[styles.heure, { borderColor: t.border }]} onPress={() => setHeure(true)} accessibilityLabel={`Changer l'heure, ${r.heure}`}>
          <Texte style={{ color: t.textPrimary, fontSize: 36, fontWeight: "600" }}>{r.heure}</Texte>
          <Texte style={[styles.aide, { color: t.accentText }]}>Changer l&apos;heure</Texte>
        </TouchableOpacity>
      )}
      <SelecteurHeure
        visible={heure}
        titre="30 secondes pour toi"
        heure={r.heure}
        onValider={(hhmm) => {
          setHeure(false);
          changer({ ...r, heure: hhmm });
        }}
        onFermer={() => setHeure(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titre: { fontSize: typography.h3, fontWeight: "600" },
  aide: { fontSize: typography.small, marginTop: 2 },
  heure: { borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md, alignItems: "center" },
});
