import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { alternativeA, EXERCICES, faisable, filtrer } from "../lib/exercices";
import { nomMateriel, manquants, type Materiel } from "../lib/materiel";
import { ZONES, zone, type Zone } from "../lib/seances";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
import { ChampTexte, Texte } from "./Texte";

/** Les 4 zones de la bibliothèque (« corps complet » ne sert qu'aux séances). */
const ZONES_FILTRE: Zone[] = ["haut", "bas", "abdos", "mobilite"];
const NOM_ZONE: Record<string, string> = { haut: "Haut", bas: "Bas", abdos: "Abdos & gainage", mobilite: "Mobilité" };

/** Sport › Exercices : la bibliothèque, avec recherche, pastilles de filtre et matériel manquant grisé. */
export function OngletExercices({ materiel }: { materiel: Materiel }) {
  const t = useTheme();
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [zoneChoisie, setZoneChoisie] = useState<Zone | null>(null);
  const [niveau, setNiveau] = useState<number | null>(null);
  const [dispoSeulement, setDispoSeulement] = useState(false);

  const liste = filtrer({ texte, zone: zoneChoisie, niveau, materielDispo: dispoSeulement }, materiel);
  const ouvrir = (id: string) => router.push(`/exercice?id=${id}` as never);

  const puce = (actif: boolean, libelle: string, onPress: () => void, couleur?: string) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[styles.puce, { borderColor: actif ? (couleur ?? t.accent) : t.border }, actif && { backgroundColor: couleur ?? t.accent }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: actif }}
    >
      <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{libelle}</Texte>
    </TouchableOpacity>
  );

  return (
    <View>
      <ChampTexte
        value={texte}
        onChangeText={setTexte}
        placeholder="Chercher un exercice ou un muscle"
        placeholderTextColor={t.textMuted}
        autoCapitalize="none"
        style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
        accessibilityLabel="Rechercher un exercice"
      />
      <View style={styles.puces}>
        {ZONES_FILTRE.map((z) => puce(zoneChoisie === z, NOM_ZONE[z], () => setZoneChoisie(zoneChoisie === z ? null : z), zone(z).couleur))}
      </View>
      <View style={styles.puces}>
        {[1, 2, 3, 4, 5].map((n) => puce(niveau === n, `Niveau ${n}`, () => setNiveau(niveau === n ? null : n)))}
      </View>
      <View style={styles.puces}>{puce(dispoSeulement, "Matériel dispo seulement", () => setDispoSeulement(!dispoSeulement))}</View>

      <Texte style={{ color: t.textMuted, fontSize: typography.small, marginVertical: spacing.sm }}>
        {liste.length} exercice{liste.length > 1 ? "s" : ""} sur {EXERCICES.length}
      </Texte>

      {liste.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Aucun exercice avec ces filtres.</Texte>}

      {liste.map((e) => {
        const ok = faisable(e, materiel);
        const alt = ok ? null : alternativeA(e, materiel);
        const zonesE = e.zones.filter((z) => ZONES_FILTRE.includes(z));
        return (
          <TouchableOpacity
            key={e.id}
            onPress={() => ouvrir(e.id)}
            style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border, opacity: ok ? 1 : 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={`${e.nom}${ok ? "" : ", matériel manquant"}`}
          >
            <FigureSkill skill={e.figure} couleur={ok ? zone(zonesE[0] ?? e.zones[0]).couleur : t.textMuted} taille={48} />
            <View style={{ flex: 1 }}>
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }} numberOfLines={2}>
                {e.nom}
              </Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }} numberOfLines={1}>
                {zonesE.map((z) => NOM_ZONE[z]).join(" · ")} · niveau {e.niveau}
              </Texte>
              {!ok && (
                <>
                  <Texte style={{ color: t.danger, fontSize: typography.small, fontWeight: "600" }}>
                    Matériel manquant : {manquants(e.materiel, materiel).map(nomMateriel).join(", ").toLowerCase()}
                  </Texte>
                  {alt && (
                    <TouchableOpacity onPress={() => ouvrir(alt.id)} hitSlop={6} accessibilityRole="button">
                      <Texte style={{ color: t.accentText, fontSize: typography.small }}>Alternative : {alt.nom} →</Texte>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, marginBottom: spacing.sm },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  carte: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});
