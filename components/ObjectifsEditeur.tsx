import { StyleSheet, TouchableOpacity, View } from "react-native";
import { GENRES_OBJECTIF, libelleObjectif, MAX_OBJECTIFS, type Objectif } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { PlusMoins } from "./PlusMoins";
import { Texte } from "./Texte";

/** Choisir 1 à 3 objectifs pour une semaine : un genre à cocher, une cible avec − / +. */
export function ObjectifsEditeur({ objectifs, onChange }: { objectifs: Objectif[]; onChange: (o: Objectif[]) => void }) {
  const t = useTheme();
  const plein = objectifs.length >= MAX_OBJECTIFS;

  const basculer = (genre: Objectif["genre"]) =>
    onChange(objectifs.some((o) => o.genre === genre) ? objectifs.filter((o) => o.genre !== genre) : [...objectifs, { genre, cible: genre === "seance" ? 1 : 2 }]);

  return (
    <View>
      {GENRES_OBJECTIF.map((g) => {
        const o = objectifs.find((x) => x.genre === g.cle);
        const bloque = !o && plein;
        return (
          <View key={g.cle} style={[styles.ligne, { borderColor: o ? t.accent : t.border, backgroundColor: o ? t.bgHighlight : t.bgCard, opacity: bloque ? 0.5 : 1 }]}>
            <TouchableOpacity
              onPress={() => !bloque && basculer(g.cle)}
              style={{ flex: 1 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!o, disabled: bloque }}
            >
              <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{o ? libelleObjectif(g.cle, o.cible) : g.unite[1]}</Texte>
            </TouchableOpacity>
            {o && g.max > 1 && (
              <PlusMoins
                valeur={String(o.cible)}
                libelle={`Nombre pour ${g.unite[1]}`}
                onPas={(sens) => onChange(objectifs.map((x) => (x.genre === g.cle ? { ...x, cible: Math.min(g.max, Math.max(1, x.cible + sens)) } : x)))}
              />
            )}
          </View>
        );
      })}
      <Texte style={{ color: t.textMuted, fontSize: typography.tiny }}>
        {MAX_OBJECTIFS} au plus. Sans changement, ceux de cette semaine se reconduisent.
      </Texte>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});
