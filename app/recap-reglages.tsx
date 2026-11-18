import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { SelecteurHeure } from "../components/SelecteurHeure";
import { ChampTexte, Texte } from "../components/Texte";
import { getZones } from "../lib/db/journee";
import { ecrireReglagesRecap, getReglagesRecap } from "../lib/db/recap";
import { PARTIES, type CleZone, type Zone } from "../lib/journee-regles";
import { programmerRappelRecap } from "../lib/rappel-recap";
import { IDEES_PISTE, type ReglagesRecap } from "../lib/recap-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Profil › Récap du dimanche : l'heure, la notification, la piste et ses idées par zone. */
export default function RecapReglages() {
  const router = useRouter();
  const t = useTheme();
  const [r, setR] = useState<ReglagesRecap | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [heure, setHeure] = useState(false);
  const [idees, setIdees] = useState<Partial<Record<CleZone, string>>>({});

  useEffect(() => {
    Promise.all([getReglagesRecap(), getZones()]).then(([x, z]) => {
      setR(x);
      setZones(z.filter((y) => y.active));
      setIdees(Object.fromEntries(z.map((y) => [y.cle, (x.idees[y.cle] ?? IDEES_PISTE[y.cle]).join("\n")])));
    });
  }, []);

  const changer = async (x: ReglagesRecap, notif = false) => {
    if (notif || x.heure !== r?.heure) {
      const ok = await programmerRappelRecap({ actif: x.notif, heure: x.heure }).catch((e) => {
        Alert.alert("La notification n'a pas pu être réglée", String(e));
        return false;
      });
      if (!ok && x.notif) x = { ...x, notif: false };
    }
    setR(x);
    await ecrireReglagesRecap(x);
  };

  const enregistrerIdees = (cle: CleZone) => {
    if (!r) return;
    const liste = (idees[cle] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    changer({ ...r, idees: { ...r.idees, [cle]: liste.length ? liste : undefined } });
  };

  if (!r) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Récap du dimanche</Texte>
      <Texte style={[styles.intro, { color: t.textSecondary }]}>
        Chaque dimanche, ta semaine en 6 cartes, du lundi au dimanche. Les anciens récaps sont dans Suivi › Ma journée › Mes semaines.
      </Texte>

      <TouchableOpacity onPress={() => setHeure(true)} style={[styles.bloc, styles.ligne, { backgroundColor: t.bgCard }]} accessibilityRole="button">
        <Texte style={[styles.libelle, { color: t.textPrimary }]}>Disponible à partir de</Texte>
        <Texte style={[styles.valeur, { color: t.accentText }]}>{r.heure.replace(":", " h ")}</Texte>
      </TouchableOpacity>

      <View style={[styles.bloc, styles.ligne, { backgroundColor: t.bgCard }]}>
        <View style={{ flex: 1 }}>
          <Texte style={[styles.libelle, { color: t.textPrimary }]}>Notification</Texte>
          <Texte style={[styles.aide, { color: t.textMuted }]}>« Ton récap de la semaine est prêt », à cette heure-là.</Texte>
        </View>
        <Switch value={r.notif} onValueChange={(v) => changer({ ...r, notif: v }, true)} accessibilityLabel="Notification du récap" />
      </View>

      <View style={[styles.bloc, styles.ligne, { backgroundColor: t.bgCard }]}>
        <View style={{ flex: 1 }}>
          <Texte style={[styles.libelle, { color: t.textPrimary }]}>Piste pour la semaine</Texte>
          <Texte style={[styles.aide, { color: t.textMuted }]}>La zone la plus calme, avec une idée simple.</Texte>
        </View>
        <Switch value={r.piste} onValueChange={(v) => changer({ ...r, piste: v })} accessibilityLabel="Piste pour la semaine" />
      </View>

      {r.piste && (
        <>
          <Texte style={[styles.sousTitre, { color: t.textSecondary }]}>Idées par zone (une par ligne)</Texte>
          {zones.map((z) => (
            <View key={z.cle} style={[styles.bloc, { backgroundColor: t.bgCard, gap: spacing.sm }]}>
              <View style={styles.ligne}>
                <View style={[styles.point, { backgroundColor: z.couleur }]} />
                <Texte style={[styles.libelle, { color: t.textPrimary, flex: 1 }]}>{PARTIES[z.cle]}</Texte>
              </View>
              <ChampTexte
                style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
                value={idees[z.cle] ?? ""}
                onChangeText={(v) => setIdees({ ...idees, [z.cle]: v })}
                onBlur={() => enregistrerIdees(z.cle)}
                multiline
                accessibilityLabel={`Idées pour ${PARTIES[z.cle]}`}
              />
            </View>
          ))}
        </>
      )}

      <SelecteurHeure
        visible={heure}
        titre="Récap disponible à partir de"
        heure={r.heure}
        onValider={(hhmm) => {
          setHeure(false);
          changer({ ...r, heure: hhmm });
        }}
        onFermer={() => setHeure(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  intro: { fontSize: typography.small, lineHeight: 19, marginBottom: spacing.lg },
  sousTitre: { fontSize: typography.small, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  bloc: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  libelle: { fontSize: typography.body, fontWeight: "600" },
  valeur: { fontSize: typography.body, fontWeight: "700" },
  aide: { fontSize: typography.small, lineHeight: 18, marginTop: 2 },
  point: { width: 12, height: 12, borderRadius: 6 },
  champ: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, minHeight: 80, textAlignVertical: "top" },
});
