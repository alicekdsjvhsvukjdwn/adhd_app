import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, KeyboardAvoidingView, Platform } from "react-native";
import { useJourCourant } from "../hooks/useJourCourant";
import { CATEGORIES, EMPLACEMENTS, type Categorie, type Emplacement } from "../lib/cuisine-catalogue";
import { alerteDate, jaugeDe, NIVEAUX, rechercherCatalogue, type Niveau } from "../lib/cuisine-regles";
import { ajouterAliment, basculerToujoursLa, changerNiveau, listerAliments, modifierAliment, retirerAliment, type Aliment } from "../lib/db/cuisine";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { BoutonMenu } from "./BoutonMenu";
import type { Option } from "./Options";
import { ChampTexte, Texte } from "./Texte";

const ORANGE = "#FB923C";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cuisine › Frigo & placards : ce que j'ai vraiment, rangé par emplacement puis par catégorie. */
export function CuisineFrigo() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [aliments, setAliments] = useState<Aliment[]>([]);
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Emplacement | null>(null);
  const [edition, setEdition] = useState<{ id: number; nom: string; emplacement: Emplacement; categorie: Categorie; peremption: string } | null>(null);

  const charger = useCallback(() => listerAliments().then(setAliments), []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const suggestions = rechercherCatalogue(q, aliments.map((a) => a.nom));
  const exact = aliments.some((a) => a.nom.toLowerCase() === q.trim().toLowerCase()) || suggestions.some((s) => s.nom.toLowerCase() === q.trim().toLowerCase());

  const ajouter = async (nom: string, libre = false) => {
    await ajouterAliment({ nom, ...(libre && filtre ? { emplacement: filtre } : {}) });
    setQ("");
    await charger();
  };

  const options = (a: Aliment): Option[] => [
    { libelle: "Modifier", onPress: () => setEdition({ id: a.id, nom: a.nom, emplacement: a.emplacement, categorie: a.categorie, peremption: a.peremption }) },
    { libelle: a.toujours_la ? "Plus « toujours là »" : "Toujours là (sel, huile…)", onPress: () => basculerToujoursLa(a.id).then(charger) },
    { libelle: "Fini, plus rien", onPress: () => retirerAliment(a.id, "fini").then(charger) },
    { libelle: "Jeté (périmé)", danger: true, onPress: () => retirerAliment(a.id, "jete").then(charger) },
    { libelle: "Supprimer (erreur)", danger: true, onPress: () => retirerAliment(a.id, "supprime").then(charger) },
  ];

  const visibles = aliments.filter((a) => !filtre || a.emplacement === filtre);

  return (
    <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
      <ChampTexte
        value={q}
        onChangeText={setQ}
        placeholder="Ajouter un aliment (lentilles, tofu, épinards…)"
        placeholderTextColor={t.textMuted}
        style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
        returnKeyType="done"
        onSubmitEditing={() => (suggestions[0] ? ajouter(suggestions[0].nom) : q.trim() && ajouter(q, true))}
        accessibilityLabel="Ajouter un aliment"
      />
      {q.trim() !== "" && (
        <View style={[styles.suggestions, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s.nom} onPress={() => ajouter(s.nom)} style={[styles.suggestion, { borderTopColor: t.border }]} accessibilityRole="button" accessibilityLabel={`Ajouter ${s.nom}`}>
              <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>{s.nom}</Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{EMPLACEMENTS.find((e) => e.cle === s.emplacement)?.nom}</Texte>
            </TouchableOpacity>
          ))}
          {!exact && (
            <TouchableOpacity onPress={() => ajouter(q, true)} style={[styles.suggestion, { borderTopColor: t.border }]} accessibilityRole="button">
              <Texte style={{ color: t.accentText, fontSize: typography.body }}>+ Ajouter « {q.trim()} »</Texte>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles}>
        {[{ cle: null, nom: "Tout" }, ...EMPLACEMENTS].map((e) => {
          const actif = filtre === e.cle;
          return (
            <TouchableOpacity key={e.nom} onPress={() => setFiltre(e.cle)} style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
              <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{e.nom}</Texte>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {aliments.length === 0 && (
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.lg, lineHeight: 20 }}>
          Ton frigo et tes placards sont vides ici. Tape un aliment ci-dessus : un tap suffit, l&apos;appli sait déjà où il se range.
        </Texte>
      )}

      {EMPLACEMENTS.map((emp) => {
        const dedans = visibles.filter((a) => a.emplacement === emp.cle);
        if (dedans.length === 0) return null;
        return (
          <View key={emp.cle}>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>{emp.nom.toUpperCase()}</Texte>
            {CATEGORIES.map((cat) => {
              const lignes = dedans.filter((a) => a.categorie === cat.cle);
              if (lignes.length === 0) return null;
              return (
                <View key={cat.cle}>
                  <Texte style={{ color: t.textSecondary, fontSize: typography.small, fontWeight: "600", marginTop: spacing.sm, marginBottom: 4 }}>{cat.nom}</Texte>
                  {lignes.map((a) => {
                    const alerte = alerteDate(a.peremption, aujourdhui);
                    return (
                      <View key={a.id} style={[styles.ligne, { backgroundColor: t.bgCard, borderColor: alerte ? ORANGE : t.border }]}>
                        <View style={{ flex: 1 }}>
                          <Texte style={{ color: t.textPrimary, fontSize: typography.body }}>
                            {a.nom}
                            {a.toujours_la ? "  ∞" : ""}
                          </Texte>
                          {alerte && <Texte style={{ color: ORANGE, fontSize: typography.small }}>{alerte === "vite" ? "à utiliser vite" : "date passée : à vérifier"}</Texte>}
                        </View>
                        {!a.toujours_la && <Jauge niveau={a.niveau} onChoisir={(n) => changerNiveau(a.id, n).then(charger)} nom={a.nom} />}
                        <BoutonMenu options={options(a)} titre={a.nom} />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        );
      })}

      <Modal visible={edition !== null} transparent animationType="slide" onRequestClose={() => setEdition(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.fond} onPress={() => setEdition(null)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {edition && (
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>Modifier</Texte>
                  <ChampTexte value={edition.nom} onChangeText={(v) => setEdition({ ...edition, nom: v })} style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]} accessibilityLabel="Nom de l'aliment" />
                  <Texte style={[styles.etiquette, { color: t.textMuted }]}>OÙ</Texte>
                  <View style={styles.puces}>
                    {EMPLACEMENTS.map((e) => (
                      <Puce key={e.cle} libelle={e.nom} actif={edition.emplacement === e.cle} onPress={() => setEdition({ ...edition, emplacement: e.cle })} />
                    ))}
                  </View>
                  <Texte style={[styles.etiquette, { color: t.textMuted }]}>CATÉGORIE</Texte>
                  <View style={styles.puces}>
                    {CATEGORIES.map((c) => (
                      <Puce key={c.cle} libelle={c.nom} actif={edition.categorie === c.cle} onPress={() => setEdition({ ...edition, categorie: c.cle })} />
                    ))}
                  </View>
                  <Texte style={[styles.etiquette, { color: t.textMuted }]}>DATE DE PÉREMPTION (FACULTATIF)</Texte>
                  <ChampTexte
                    value={edition.peremption}
                    onChangeText={(v) => setEdition({ ...edition, peremption: v.trim() })}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor={t.textMuted}
                    style={[styles.champ, { color: t.textPrimary, borderColor: edition.peremption && !DATE.test(edition.peremption) ? t.danger : t.border, backgroundColor: t.bgApp }]}
                    accessibilityLabel="Date de péremption"
                  />
                  <View style={styles.boutons}>
                    <TouchableOpacity onPress={() => setEdition(null)} hitSlop={8}>
                      <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!edition.nom.trim() || (edition.peremption && !DATE.test(edition.peremption))) return;
                        await modifierAliment(edition.id, edition);
                        setEdition(null);
                        await charger();
                      }}
                      style={[styles.valider, { backgroundColor: t.accent }]}
                      accessibilityRole="button"
                    >
                      <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Enregistrer</Texte>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function Puce({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accent : "transparent" }]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
      <Texte style={{ color: actif ? t.textOnAccent : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{libelle}</Texte>
    </TouchableOpacity>
  );
}

/** Jauge à 3 niveaux (plein / un peu / presque fini) : on touche le segment voulu. */
function Jauge({ niveau, onChoisir, nom }: { niveau: Niveau; onChoisir: (n: Niveau) => void; nom: string }) {
  const t = useTheme();
  const rang = NIVEAUX.findIndex((n) => n.cle === niveau);
  const couleur = niveau === "presque_fini" ? ORANGE : t.accent;
  return (
    <View style={styles.jauge} accessibilityLabel={`${nom} : ${NIVEAUX[rang]?.nom ?? ""}`}>
      {/* du presque fini (gauche) au plein (droite) */}
      {[...NIVEAUX].reverse().map((n, i) => {
        const rempli = jaugeDe(n.cle) <= jaugeDe(niveau);
        return (
          <TouchableOpacity key={n.cle} onPress={() => onChoisir(n.cle)} hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }} accessibilityRole="button" accessibilityLabel={`${nom} : ${n.nom}`} style={[styles.segment, { backgroundColor: rempli ? couleur : t.border }, i === 0 && { opacity: 1 }]} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2, paddingTop: spacing.sm },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  suggestions: { borderWidth: 1, borderRadius: radius.md, marginTop: spacing.xs, overflow: "hidden" },
  suggestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  pastilles: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.md },
  pastille: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  jauge: { flexDirection: "row", gap: 3, alignItems: "center" },
  segment: { width: 16, height: 10, borderRadius: 3 },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
