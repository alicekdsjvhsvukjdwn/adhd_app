import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Curseur } from "../components/Curseur";
import { MenuOptions } from "../components/MenuOptions";
import { ChampTexte, Texte } from "../components/Texte";
import type { Option } from "../components/Options";
import {
  ajouterSituation,
  archiverSituation,
  echelle,
  expositionsDeSituation,
  modifierSituation,
  supprimerExposition,
  type ExpositionDb,
  type SituationDb,
} from "../lib/db/tcc";
import { dateCourte } from "../lib/esprit-regles";
import { REUSSITES_POUR_FRANCHIR, expositionReussie, IDEES_ECHELLE, type Marche } from "../lib/tcc-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const VERT = "#4ADE80";

/** Mon échelle d'exposition : mes situations sociales, de la plus facile (en bas) à la plus dure (en haut). */
export default function Echelle() {
  const router = useRouter();
  const t = useTheme();
  const [liste, setListe] = useState<Marche<SituationDb>[]>([]);
  const [nom, setNom] = useState("");
  const [anx, setAnx] = useState(50);
  const [menu, setMenu] = useState<{ titre: string; options: Option[] }>({ titre: "", options: [] });
  const [edition, setEdition] = useState<{ id: number; nom: string; anxiete: number } | null>(null);
  const [historique, setHistorique] = useState<{ nom: string; id: number; expositions: ExpositionDb[] } | null>(null);

  const charger = useCallback(async () => setListe(await echelle()), []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const ajouter = async (n: string, a: number) => {
    if (!n.trim()) return;
    await ajouterSituation(n, a);
    setNom("");
    await charger();
  };

  const faire = (id: number) => router.push(`/exposition?situation=${id}` as never);

  const ouvrirHistorique = async (m: Marche<SituationDb>) =>
    setHistorique({ id: m.situation.id, nom: m.situation.nom, expositions: await expositionsDeSituation(m.situation.id) });

  const retirer = (m: Marche<SituationDb>) =>
    Alert.alert(`Retirer « ${m.situation.nom} » de l'échelle ?`, "Ce que tu as déjà fait reste dans tes statistiques.", [
      { text: "Garder", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          await archiverSituation(m.situation.id);
          await charger();
        },
      },
    ]);

  const options = (m: Marche<SituationDb>): Option[] => [
    { libelle: "Je le fais", onPress: () => faire(m.situation.id) },
    { libelle: "Voir mes essais", onPress: () => setTimeout(() => ouvrirHistorique(m), 350) },
    { libelle: "Modifier", onPress: () => setTimeout(() => setEdition({ id: m.situation.id, nom: m.situation.nom, anxiete: m.situation.anxiete }), 350) },
    { libelle: "Retirer de l'échelle", danger: true, onPress: () => retirer(m) },
  ];

  const idees = IDEES_ECHELLE.filter((i) => !liste.some((m) => m.situation.nom.trim().toLowerCase() === i.nom.toLowerCase()));
  const n = liste.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Mon échelle</Texte>
        <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg }}>
          Des situations sociales, de la plus facile à la plus dure. On monte une marche à la fois : elle est franchie quand l&apos;anxiété
          réelle a été nettement plus basse que prévu {REUSSITES_POUR_FRANCHIR} fois.
        </Texte>

        {n === 0 && (
          <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginBottom: spacing.md }}>
            Ton échelle est vide. Ajoute une situation ci-dessous, ou prends une idée.
          </Texte>
        )}
        {/* La plus dure en haut, la plus facile en bas : on monte. */}
        {[...liste].reverse().map((m, i) => {
          const rangDepuisLeBas = n - 1 - i;
          const couleur = m.franchie ? VERT : m.prochaine ? t.accent : t.border;
          return (
            <View key={m.situation.id} style={{ marginLeft: n > 1 ? Math.round((rangDepuisLeBas / (n - 1)) * 28) : 0 }}>
              <TouchableOpacity
                onPress={() => setMenu({ titre: m.situation.nom, options: options(m) })}
                style={[
                  styles.marche,
                  { backgroundColor: m.franchie ? "rgba(74,222,128,0.12)" : t.bgCard, borderColor: m.prochaine ? t.accent : t.border, borderLeftColor: couleur },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${m.situation.nom}${m.franchie ? ", franchie" : m.prochaine ? ", prochaine marche" : ""}`}
              >
                <View style={{ flex: 1 }}>
                  {m.prochaine && <Texte style={[styles.badge, { color: t.accentText }]}>PROCHAINE MARCHE</Texte>}
                  <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>
                    {m.franchie ? "✓ " : ""}
                    {m.situation.nom}
                  </Texte>
                  <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                    anxiété imaginée {m.situation.anxiete} ·{" "}
                    {m.franchie ? "franchie" : m.faites === 0 ? "pas encore essayée" : `${Math.min(m.reussites, REUSSITES_POUR_FRANCHIR)} réussite${m.reussites > 1 ? "s" : ""} sur ${REUSSITES_POUR_FRANCHIR}`}
                  </Texte>
                </View>
                {m.prochaine && (
                  <TouchableOpacity onPress={() => faire(m.situation.id)} style={[styles.faire, { backgroundColor: t.accent }]} accessibilityRole="button">
                    <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.small }}>Je le fais</Texte>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <Texte style={[styles.etiquette, { color: t.textMuted }]}>AJOUTER UNE SITUATION</Texte>
        <ChampTexte
          value={nom}
          onChangeText={setNom}
          placeholder="Ex : demander mon chemin à quelqu'un"
          placeholderTextColor={t.textMuted}
          style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
        />
        <Texte style={{ color: t.textSecondary, fontSize: typography.small, marginTop: spacing.md }}>
          Quelle anxiété j&apos;imagine, de 0 à 100 ?
        </Texte>
        <Curseur valeur={anx} onChange={setAnx} libelle="Anxiété imaginée, sur 100" />
        <TouchableOpacity
          onPress={() => ajouter(nom, anx)}
          disabled={!nom.trim()}
          style={[styles.ajouter, { backgroundColor: nom.trim() ? t.accent : t.bgCard, borderColor: t.border }]}
          accessibilityRole="button"
        >
          <Texte style={{ color: nom.trim() ? t.textOnAccent : t.textMuted, fontWeight: "700" }}>Ajouter à l&apos;échelle</Texte>
        </TouchableOpacity>

        {idees.length > 0 && (
          <>
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>DES IDÉES POUR DÉMARRER</Texte>
            <View style={styles.puces}>
              {idees.map((i) => (
                <TouchableOpacity
                  key={i.nom}
                  onPress={() => ajouter(i.nom, i.anxiete)}
                  style={[styles.puce, { borderColor: t.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${i.nom}`}
                >
                  <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>＋ {i.nom}</Texte>
                </TouchableOpacity>
              ))}
            </View>
            <Texte style={{ color: t.textMuted, fontSize: typography.tiny, marginTop: spacing.sm }}>
              L&apos;anxiété de départ est une proposition : tu peux la changer en touchant la marche.
            </Texte>
          </>
        )}
      </ScrollView>

      <MenuOptions titre={menu.titre} options={menu.options} onFermer={() => setMenu({ titre: "", options: [] })} />

      <Modal visible={edition !== null} transparent animationType="slide" onRequestClose={() => setEdition(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.fond} onPress={() => setEdition(null)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {edition && (
                <>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>Modifier la marche</Texte>
                  <ChampTexte
                    value={edition.nom}
                    onChangeText={(v) => setEdition({ ...edition, nom: v })}
                    style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
                  />
                  <Curseur valeur={edition.anxiete} onChange={(v) => setEdition({ ...edition, anxiete: v })} libelle="Anxiété imaginée, sur 100" />
                  <View style={styles.boutons}>
                    <TouchableOpacity onPress={() => setEdition(null)} hitSlop={8}>
                      <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (edition.nom.trim()) await modifierSituation(edition.id, edition.nom, edition.anxiete);
                        setEdition(null);
                        await charger();
                      }}
                      style={[styles.valider, { backgroundColor: t.accent }]}
                      accessibilityRole="button"
                    >
                      <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer</Texte>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={historique !== null} transparent animationType="slide" onRequestClose={() => setHistorique(null)}>
        <Pressable style={styles.fond} onPress={() => setHistorique(null)}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border, maxHeight: "80%" }]}>
            {historique && (
              <>
                <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>{historique.nom}</Texte>
                <ScrollView>
                  {historique.expositions.length === 0 && (
                    <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Pas encore d&apos;essai.</Texte>
                  )}
                  {historique.expositions.map((e) => (
                    <View key={e.id} style={[styles.essai, { borderColor: t.border }]}>
                      <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                        {dateCourte(e.jour)}
                        {e.anx_reelle === null ? " · en cours" : ""}
                      </Texte>
                      <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>
                        prévue {e.anx_prevue ?? "?"} → réelle {e.anx_reelle ?? "?"}
                        {expositionReussie(e) ? "  ✓" : ""}
                      </Texte>
                      {e.crainte ? <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>Je craignais : {e.crainte}</Texte> : null}
                      {e.vecu ? <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>Ce qui s&apos;est passé : {e.vecu}</Texte> : null}
                      {e.retenu ? <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>J&apos;en retiens : {e.retenu}</Texte> : null}
                      {e.securite ? <Texte style={{ color: t.textMuted, fontSize: typography.tiny }}>Comportements de sécurité : {e.securite.split("|").join(", ")}</Texte> : null}
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert("Supprimer cet essai ?", "Il ne comptera plus dans ta marche.", [
                            { text: "Garder", style: "cancel" },
                            {
                              text: "Supprimer",
                              style: "destructive",
                              onPress: async () => {
                                await supprimerExposition(e.id);
                                setHistorique({ ...historique, expositions: await expositionsDeSituation(historique.id) });
                                await charger();
                              },
                            },
                          ])
                        }
                        hitSlop={8}
                      >
                        <Texte style={{ color: t.danger, fontSize: typography.small, marginTop: 4 }}>Supprimer</Texte>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setHistorique(null)} style={{ alignSelf: "center", marginTop: spacing.lg }} hitSlop={8}>
                  <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Fermer</Texte>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  marche: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderLeftWidth: 5, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  badge: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 },
  faire: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  ajouter: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.md },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  essai: { borderTopWidth: 1, paddingVertical: spacing.md },
});
