import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { libellePoids, MATERIELS, type Materiel, type MaterielCle } from "../lib/materiel";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { ChampTexte, Texte } from "./Texte";

/** Cocher son matériel, et saisir les poids d'haltères qu'on a. Utilisé au premier lancement et depuis ⚙️. */
export function MaterielEditeur({ materiel, onChange }: { materiel: Materiel; onChange: (m: Materiel) => void }) {
  const t = useTheme();
  const [saisie, setSaisie] = useState("");

  const basculer = (cle: MaterielCle) => onChange({ ...materiel, dispo: { ...materiel.dispo, [cle]: !materiel.dispo[cle] } });

  const ajouterPoids = () => {
    const kg = Number(saisie.replace(",", "."));
    if (!Number.isFinite(kg) || kg <= 0 || kg > 100) return;
    const arrondi = Math.round(kg * 2) / 2;
    if (!materiel.poids.includes(arrondi)) onChange({ ...materiel, poids: [...materiel.poids, arrondi].sort((a, b) => a - b) });
    setSaisie("");
  };

  return (
    <View>
      {MATERIELS.map((m) => {
        const actif = materiel.dispo[m.cle];
        return (
          <View key={m.cle}>
            <TouchableOpacity
              onPress={() => !m.fixe && basculer(m.cle)}
              disabled={m.fixe}
              style={[styles.ligne, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.bgHighlight : t.bgCard }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: actif, disabled: !!m.fixe }}
            >
              <View style={[styles.case, { borderColor: actif ? t.accent : t.textMuted, backgroundColor: actif ? t.accent : "transparent" }]}>
                {actif && <Texte style={{ color: t.textOnAccent, fontSize: 12, fontWeight: "700" }}>✓</Texte>}
              </View>
              <View style={{ flex: 1 }}>
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{m.nom}</Texte>
                <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{m.aide}</Texte>
              </View>
            </TouchableOpacity>
            {m.cle === "halteres" && actif && (
              <View style={[styles.poids, { borderColor: t.border, backgroundColor: t.bgCard }]}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.small, marginBottom: spacing.sm }}>Mes poids (kg)</Texte>
                <View style={styles.puces}>
                  {materiel.poids.map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => onChange({ ...materiel, poids: materiel.poids.filter((x) => x !== p) })}
                      style={[styles.puce, { borderColor: t.accent }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${libellePoids(p)}`}
                    >
                      <Texte style={{ color: t.textPrimary, fontSize: typography.small }}>{libellePoids(p)} ✕</Texte>
                    </TouchableOpacity>
                  ))}
                  {materiel.poids.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Aucun pour l&apos;instant.</Texte>}
                </View>
                <View style={styles.ajout}>
                  <ChampTexte
                    value={saisie}
                    onChangeText={setSaisie}
                    onSubmitEditing={ajouterPoids}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    placeholder="Ex : 8 ou 2,5"
                    placeholderTextColor={t.textMuted}
                    style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
                  />
                  <TouchableOpacity onPress={ajouterPoids} style={[styles.bouton, { backgroundColor: t.accent }]} accessibilityRole="button">
                    <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Ajouter</Texte>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  case: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  poids: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, marginTop: -spacing.xs },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  ajout: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  champ: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.body },
  bouton: { borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center" },
});
