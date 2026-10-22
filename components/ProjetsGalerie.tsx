import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { listerProjets, listerTypes, photosFinales, type Projet, type TypeProjet } from "../lib/db/projets";
import { ETATS_PROJET, filtrerProjets, nomEtat, type EtatProjet } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { IconeProjet } from "./IconeProjet";
import { Texte } from "./Texte";

type Carte = Projet & { jauge: number };

/** Tâches › Projets : la galerie de mes projets créatifs (en cours d'abord), puis « Mes réalisations ». */
export function ProjetsGalerie() {
  const t = useTheme();
  const router = useRouter();
  const [projets, setProjets] = useState<Carte[]>([]);
  const [types, setTypes] = useState<TypeProjet[]>([]);
  const [finales, setFinales] = useState<Record<number, string>>({});
  const [etat, setEtat] = useState<EtatProjet | null>(null);
  const [type, setType] = useState<number | null>(null);
  const [charge, setCharge] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [p, ty] = await Promise.all([listerProjets(), listerTypes()]);
        const f: Record<number, string> = {};
        for (const x of p.filter((q) => q.etat === "fini")) f[x.id] = (await photosFinales(x.id))[0]?.data ?? "";
        setProjets(p);
        setTypes(ty);
        setFinales(f);
        setCharge(true);
      })().catch(() => setCharge(true));
    }, []),
  );

  const typeDe = (id: number) => types.find((x) => x.id === id) ?? { id, nom: "", icone: "sparkles", couleur: t.accent };
  const ouvrir = (id: number) => router.push(`/projet?id=${id}` as never);
  const visibles = filtrerProjets(projets, { etat, type });
  const realisations = projets.filter((p) => p.etat === "fini");

  const carte = (p: Carte, grande = false) => {
    const ty = typeDe(p.type_id);
    const image = grande ? finales[p.id] || p.couverture : p.couverture;
    return (
      <TouchableOpacity
        key={p.id}
        onPress={() => ouvrir(p.id)}
        style={[styles.carte, grande && styles.carteGrande, { backgroundColor: t.bgCard, borderColor: t.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${p.nom}, ${ty.nom}, ${nomEtat(p.etat)}`}
      >
        <View style={[styles.visuel, grande && { height: 220 }, { backgroundColor: ty.couleur + "33" }]}>
          {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <IconeProjet nom={ty.icone} couleur={ty.couleur} taille={grande ? 56 : 40} />}
        </View>
        <View style={{ padding: spacing.md, gap: 2 }}>
          <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }} numberOfLines={2}>
            {p.nom}
          </Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.small }} numberOfLines={1}>
            {ty.nom}
          </Texte>
          <Texte style={{ color: ty.couleur, fontSize: typography.small, fontWeight: "600" }}>{nomEtat(p.etat)}</Texte>
          {p.etat !== "fini" && (
            <View style={[styles.piste, { backgroundColor: t.border }]}>
              <View style={{ width: `${Math.round(p.jauge * 100)}%`, height: "100%", backgroundColor: ty.couleur, borderRadius: 3 }} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const pastille = (libelle: string, actif: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{libelle}</Texte>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.push("/projet-edition" as never)} style={[styles.nouveau, { backgroundColor: t.accent }]} accessibilityRole="button">
        <Plus color={t.textOnAccent} size={18} />
        <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Nouveau projet</Texte>
      </TouchableOpacity>

      {projets.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles}>
            {pastille("Tous", etat === null, () => setEtat(null))}
            {ETATS_PROJET.map((e) => pastille(e.nom, etat === e.cle, () => setEtat(etat === e.cle ? null : e.cle)))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles}>
            {pastille("Tous les types", type === null, () => setType(null))}
            {types.map((ty) => pastille(ty.nom, type === ty.id, () => setType(type === ty.id ? null : ty.id)))}
          </ScrollView>
        </>
      )}

      {charge && projets.length === 0 && (
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg, lineHeight: 20 }}>
          Pas encore de projet. Une idée, même vague, a sa place ici : crée-la, tu la feras avancer quand tu veux.
        </Texte>
      )}
      {projets.length > 0 && visibles.length === 0 && (
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg }}>Aucun projet avec ce filtre.</Texte>
      )}

      <View style={styles.grille}>{visibles.map((p) => carte(p))}</View>

      {etat === null && realisations.length > 0 && (
        <>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>MES RÉALISATIONS</Texte>
          {[...realisations].sort((a, b) => b.fini_le.localeCompare(a.fini_le)).map((p) => carte(p, true))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  nouveau: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.pill, paddingVertical: spacing.md, marginTop: spacing.sm },
  pastilles: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.md },
  pastille: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  carte: { width: "47.5%", borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  carteGrande: { width: "100%", marginBottom: spacing.md },
  visuel: { height: 110, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  piste: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.md },
});
