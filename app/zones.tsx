import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { Bonhomme } from "../components/Bonhomme";
import { ChampTexte, Texte } from "../components/Texte";
import { getZones, modifierZone } from "../lib/db/journee";
import { CLE_RETRO, ecrireLiens, getLiens, remplirDepuis } from "../lib/db/journal-auto";
import { lireMeta } from "../lib/db/meta";
import { LIENS_DEFAUT, SOURCES, type Liens } from "../lib/journal-auto-regles";
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

      <LiensAutomatiques zones={zones} />
    </ScrollView>
  );
}

/** Ce que les autres parties de l'appli colorent toutes seules, modifiable ; un interrupteur par source. */
function LiensAutomatiques({ zones }: { zones: Zone[] }) {
  const t = useTheme();
  const [liens, setLiens] = useState<Liens | null>(null);
  const [retro, setRetro] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    getLiens().then(setLiens);
    lireMeta(CLE_RETRO).then(setRetro);
  }, []);

  const changer = async (l: Liens) => {
    setLiens(l);
    await ecrireLiens(l);
  };

  const remplir = async () => {
    setEnCours(true);
    const n = await remplirDepuis(30);
    setEnCours(false);
    setRetro(await lireMeta(CLE_RETRO));
    setMessage(n > 0 ? `${n} entrée${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}, sans points.` : "Rien de nouveau à ajouter.");
  };

  if (!liens) return null;
  const actives = zones.filter((z) => z.active);
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Texte style={[styles.titre2, { color: t.textPrimary }]}>Liens automatiques</Texte>
      <Texte style={[styles.intro, { color: t.textSecondary }]}>
        Ce que tu fais ailleurs dans l&apos;appli arrive tout seul dans « Ma journée » (0 point : l&apos;action a déjà rapporté). Les relations, jamais.
      </Texte>
      {SOURCES.map((s) => {
        const on = !liens.off.includes(s.cle);
        const siens = LIENS_DEFAUT.filter((l) => l.source === s.cle);
        return (
          <View key={s.cle} style={[styles.bloc, { backgroundColor: t.bgCard, borderColor: "transparent" }]}>
            <View style={styles.ligne}>
              <Texte style={[styles.source, { color: t.textPrimary }]}>{s.libelle}</Texte>
              <Switch
                value={on}
                onValueChange={(v) => changer({ ...liens, off: v ? liens.off.filter((x) => x !== s.cle) : [...liens.off, s.cle] })}
                accessibilityLabel={`${s.libelle} : entrées automatiques`}
              />
            </View>
            {on && s.cle === "tache" && (
              <Texte style={[styles.aide, { color: t.textMuted }]}>Dans la zone de leur liste (réglable dans Mes listes).</Texte>
            )}
            {on &&
              siens.map((l) => (
                <View key={l.cle} style={{ gap: 6 }}>
                  {siens.length > 1 || l.libelle !== s.libelle ? <Texte style={[styles.aide, { color: t.textSecondary }]}>{l.libelle}</Texte> : null}
                  <View style={styles.couleurs}>
                    {actives.map((z) => {
                      const actif = liens.zones[l.cle] === z.cle;
                      return (
                        <TouchableOpacity
                          key={z.cle}
                          onPress={() => changer({ ...liens, zones: { ...liens.zones, [l.cle]: z.cle } })}
                          style={[styles.choixZone, { borderColor: actif ? z.couleur : t.border, backgroundColor: actif ? z.couleur : "transparent" }]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: actif }}
                          accessibilityLabel={`${l.libelle} → ${PARTIES[z.cle]}`}
                        >
                          <Texte style={{ fontSize: typography.tiny, fontWeight: "700", color: actif ? "#05080A" : t.textSecondary }}>{PARTIES[z.cle]}</Texte>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      onPress={() => changer({ ...liens, zones: { ...liens.zones, [l.cle]: null } })}
                      style={[styles.choixZone, { borderColor: liens.zones[l.cle] ? t.border : t.textPrimary }]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: !liens.zones[l.cle] }}
                    >
                      <Texte style={{ fontSize: typography.tiny, fontWeight: "700", color: t.textSecondary }}>Aucune</Texte>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </View>
        );
      })}

      <TouchableOpacity
        onPress={remplir}
        disabled={enCours}
        style={[styles.bouton, { borderColor: t.accent, opacity: enCours ? 0.5 : 1 }]}
        accessibilityRole="button"
      >
        <Texte style={{ color: t.accentText, fontWeight: "700", textAlign: "center" }}>
          {enCours ? "Remplissage…" : "Remplir le journal depuis mes données des 30 derniers jours"}
        </Texte>
      </TouchableOpacity>
      <Texte style={[styles.aide, { color: t.textMuted, textAlign: "center" }]}>
        {message ?? (retro ? `Déjà fait le ${retro.split("-").reverse().join("/")} : le relancer n'ajoute pas de doublon.` : "Sans points, pour que la semaine, le récap et Progrès aient déjà de la matière.")}
      </Texte>
    </View>
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
  titre2: { fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.sm },
  source: { fontSize: typography.body, fontWeight: "700" },
  aide: { fontSize: typography.small, lineHeight: 18 },
  choixZone: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, minHeight: 32, justifyContent: "center" },
  bouton: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm, minHeight: 44, justifyContent: "center" },
});
