import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Keyboard, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ChampTexte, Texte } from "../components/Texte";
import {
  ajouterListe,
  compterTaches,
  getListes,
  listeDeRepli,
  modifierListe,
  supprimerListe,
  type Liste,
} from "../lib/db/listes";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { CLES_COULEURS, useCouleurListe } from "../lib/theme-listes";

/**
 * Mes listes (les catégories de tâches) : nom, icône, couleur, ajout, suppression.
 * C'est ici, et nulle part ailleurs, qu'on change une couleur : l'écran Tâches ne fait que les afficher.
 */
export default function ListesScreen() {
  const router = useRouter();
  const t = useTheme();
  const couleurListe = useCouleurListe();
  const [listes, setListes] = useState<Liste[]>([]);
  const [noms, setNoms] = useState<Record<number, string>>({});
  const [icones, setIcones] = useState<Record<number, string>>({});
  const [nouvelle, setNouvelle] = useState("");

  const charger = useCallback(async () => {
    const l = await getListes();
    setListes(l);
    setNoms(Object.fromEntries(l.map((x) => [x.id, x.nom])));
    setIcones(Object.fromEntries(l.map((x) => [x.id, x.icone ?? ""])));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const ajouter = async () => {
    if (!nouvelle.trim()) return;
    await ajouterListe(nouvelle, "📁");
    setNouvelle("");
    Keyboard.dismiss();
    await charger();
  };

  const supprimer = async (l: Liste) => {
    if (listes.length <= 1) {
      Alert.alert("Il faut garder au moins une liste.");
      return;
    }
    const n = await compterTaches(l.id);
    const repli = await listeDeRepli(l.id);
    Alert.alert(
      `Supprimer « ${l.nom} » ?`,
      n > 0 ? `Ses ${n} tâche${n > 1 ? "s" : ""} passeront dans « ${repli?.nom} ».` : "Elle est vide.",
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await supprimerListe(l.id);
            await charger();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Mes listes</Texte>
      <Texte style={[styles.intro, { color: t.textSecondary }]}>
        Les catégories de tes tâches. Leur couleur se règle ici seulement ; dans Tâches, elles s&apos;affichent telles quelles.
      </Texte>

      {listes.map((l) => (
        <View key={l.id} style={[styles.bloc, { backgroundColor: t.bgCard }]}>
          <View style={styles.ligne}>
            <ChampTexte
              style={[styles.icone, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
              value={icones[l.id] ?? ""}
              onChangeText={(v) => setIcones({ ...icones, [l.id]: v })}
              onEndEditing={async () => {
                const v = (icones[l.id] ?? "").trim();
                if (v !== (l.icone ?? "")) await modifierListe(l.id, l.nom, v || null, l.couleur);
                await charger();
              }}
              placeholder="•"
              placeholderTextColor={t.textMuted}
              maxLength={8}
              accessibilityLabel={`Icône de ${l.nom}`}
            />
            <ChampTexte
              style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
              value={noms[l.id] ?? l.nom}
              onChangeText={(v) => setNoms({ ...noms, [l.id]: v })}
              onEndEditing={async () => {
                const v = (noms[l.id] ?? "").trim();
                if (v && v !== l.nom) await modifierListe(l.id, v, l.icone, l.couleur);
                await charger();
              }}
            />
            <TouchableOpacity hitSlop={10} onPress={() => supprimer(l)} accessibilityLabel={`Supprimer ${l.nom}`}>
              <Texte style={[styles.supprimer, { color: t.danger }]}>✕</Texte>
            </TouchableOpacity>
          </View>
          <View style={styles.couleurs}>
            {CLES_COULEURS.map((cle) => {
              const choisie = l.couleur === cle;
              return (
                <TouchableOpacity
                  key={cle}
                  onPress={async () => {
                    await modifierListe(l.id, l.nom, l.icone, cle);
                    await charger();
                  }}
                  style={[
                    styles.couleur,
                    { backgroundColor: couleurListe(cle).fond, borderColor: choisie ? t.textPrimary : "transparent" },
                  ]}
                  hitSlop={4}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisie }}
                  accessibilityLabel={`Couleur ${cle} pour ${l.nom}`}
                />
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.ligne}>
        <Texte style={{ fontSize: 18, color: t.textMuted }}>＋</Texte>
        <ChampTexte
          style={[styles.champ, { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary }]}
          placeholder="Nouvelle liste (ex : Projet musique)"
          placeholderTextColor={t.textMuted}
          value={nouvelle}
          onChangeText={setNouvelle}
          onSubmitEditing={ajouter}
          returnKeyType="done"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.md },
  intro: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.xl },
  bloc: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  icone: {
    width: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    textAlign: "center",
    fontSize: typography.body,
  },
  champ: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  supprimer: { fontSize: 16, paddingHorizontal: 4 },
  couleurs: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginLeft: 52 },
  couleur: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
