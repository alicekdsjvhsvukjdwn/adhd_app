import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDown, ArrowUp, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ChoixExercices } from "../components/ChoixExercices";
import { FigureSkill } from "../components/FigureSkill";
import { PlusMoins } from "../components/PlusMoins";
import { ChampTexte, Texte } from "../components/Texte";
import { enregistrerMaSeance, lireMaSeance, supprimerMaSeance } from "../lib/db/seances-sport";
import { getMateriel } from "../lib/db/sport-materiel";
import { exercice } from "../lib/exercices";
import { libellePoids, MATERIEL_DEFAUT, type Materiel } from "../lib/materiel";
import { zone } from "../lib/seances";
import { dureeEstimee, ligneParDefaut, minutesDe, pasDeSaisie, type LigneSeance } from "../lib/seances-sport";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Créer ou modifier une de mes séances : des exercices de la bibliothèque, dans l'ordre, avec séries, cible, poids et repos. */
export default function EditionSeance() {
  const router = useRouter();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const idSeance = id ? Number(id) : null;

  const [nom, setNom] = useState("");
  const [lignes, setLignes] = useState<LigneSeance[]>([]);
  const [materiel, setMateriel] = useState<Materiel>(MATERIEL_DEFAUT);
  const [choix, setChoix] = useState(false);
  const [charge, setCharge] = useState(idSeance === null);

  useEffect(() => {
    (async () => {
      setMateriel(await getMateriel());
      if (idSeance !== null) {
        const s = await lireMaSeance(idSeance);
        if (s) {
          setNom(s.nom);
          setLignes(s.lignes);
        }
        setCharge(true);
      }
    })();
  }, [idSeance]);

  const maj = (i: number, patch: Partial<LigneSeance>) => setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const deplacer = (i: number, sens: -1 | 1) =>
    setLignes((l) => {
      const j = i + sens;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const enregistrer = async () => {
    if (lignes.length === 0) {
      Alert.alert("Ajoute au moins un exercice.");
      return;
    }
    await enregistrerMaSeance({ id: idSeance ?? undefined, nom, lignes });
    router.back();
  };

  const supprimer = () =>
    Alert.alert(`Supprimer « ${nom || "cette séance"} » ?`, "Ce que tu as déjà fait reste dans ton historique.", [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          if (idSeance !== null) await supprimerMaSeance(idSeance);
          router.back();
        },
      },
    ]);

  if (!charge) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{idSeance === null ? "Nouvelle séance" : "Modifier la séance"}</Texte>
        <ChampTexte
          value={nom}
          onChangeText={setNom}
          placeholder="Nom de la séance (ex : Pousser + gainage)"
          placeholderTextColor={t.textMuted}
          style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
        />
        {lignes.length > 0 && (
          <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>
            {lignes.length} exercice{lignes.length > 1 ? "s" : ""} · environ {minutesDe(dureeEstimee(lignes))} min
          </Texte>
        )}

        {lignes.map((l, i) => {
          const e = exercice(l.exercice);
          if (!e) return null;
          const unite = e.mode === "s" ? "s" : "rép.";
          return (
            <View key={`${l.exercice}-${i}`} style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <View style={styles.entete}>
                <FigureSkill skill={e.figure} couleur={zone(e.zones[0]).couleur} taille={34} />
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600", flex: 1 }} numberOfLines={2}>
                  {i + 1}. {e.nom}
                </Texte>
                <TouchableOpacity onPress={() => deplacer(i, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel="Monter">
                  <ArrowUp color={i === 0 ? t.border : t.textSecondary} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deplacer(i, 1)} disabled={i === lignes.length - 1} hitSlop={8} accessibilityLabel="Descendre">
                  <ArrowDown color={i === lignes.length - 1 ? t.border : t.textSecondary} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setLignes((x) => x.filter((_, k) => k !== i))} hitSlop={8} accessibilityLabel="Retirer">
                  <X color={t.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              <View style={styles.reglage}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, flex: 1 }}>Séries</Texte>
                <PlusMoins valeur={String(l.series)} libelle={`Séries de ${e.nom}`} onPas={(s) => maj(i, { series: Math.min(10, Math.max(1, l.series + s)) })} />
              </View>
              <View style={styles.reglage}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, flex: 1 }}>{e.mode === "s" ? "Durée" : "Répétitions"}</Texte>
                <PlusMoins
                  valeur={`${l.cible} ${unite}`}
                  libelle={`Cible de ${e.nom}`}
                  onPas={(s) => maj(i, { cible: Math.min(600, Math.max(1, l.cible + s * pasDeSaisie(e.mode, l.cible))) })}
                />
              </View>
              {e.mode === "reps_poids" && (
                <View>
                  <View style={styles.reglage}>
                    <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, flex: 1 }}>Poids</Texte>
                    <PlusMoins
                      valeur={l.poids ? libellePoids(l.poids) : "—"}
                      libelle={`Poids de ${e.nom}`}
                      onPas={(s) => maj(i, { poids: Math.max(0, (l.poids ?? 0) + s * 0.5) || null })}
                    />
                  </View>
                  {materiel.poids.length > 0 && (
                    <View style={styles.puces}>
                      {materiel.poids.map((p) => (
                        <TouchableOpacity
                          key={p}
                          onPress={() => maj(i, { poids: p })}
                          style={[styles.puce, { borderColor: l.poids === p ? t.accent : t.border }, l.poids === p && { backgroundColor: t.accent }]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: l.poids === p }}
                        >
                          <Texte style={{ color: l.poids === p ? t.textOnAccent : t.textSecondary, fontSize: typography.small }}>{libellePoids(p)}</Texte>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
              <View style={styles.reglage}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, flex: 1 }}>Repos</Texte>
                <PlusMoins valeur={`${l.repos_s} s`} libelle={`Repos après ${e.nom}`} onPas={(s) => maj(i, { repos_s: Math.min(600, Math.max(0, l.repos_s + 5 * s)) })} />
              </View>
            </View>
          );
        })}

        <TouchableOpacity onPress={() => setChoix(true)} style={[styles.ajout, { borderColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontSize: typography.body, fontWeight: "600" }}>＋ Ajouter un exercice</Texte>
        </TouchableOpacity>

        <TouchableOpacity onPress={enregistrer} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer la séance</Texte>
        </TouchableOpacity>
        {idSeance !== null && (
          <TouchableOpacity onPress={supprimer} style={{ alignSelf: "center", marginTop: spacing.xl }} hitSlop={8}>
            <Texte style={{ color: t.danger, fontSize: typography.body }}>Supprimer cette séance</Texte>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ChoixExercices
        visible={choix}
        materiel={materiel}
        onChoisir={(ex) => {
          setLignes((l) => [...l, ligneParDefaut(ex, materiel)]);
          setChoix(false);
        }}
        onFermer={() => setChoix(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.md },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  carte: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  entete: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reglage: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  ajout: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.lg, marginTop: spacing.lg },
  valider: { alignItems: "center", borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
});
