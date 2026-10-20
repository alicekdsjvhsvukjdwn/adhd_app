import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { SelecteurHeure } from "../components/SelecteurHeure";
import { Texte } from "../components/Texte";
import {
  activer,
  desactiver,
  etatRappels,
  lireReglages,
  synchroniser,
  tester,
  type EtatRappels,
} from "../lib/push-web";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import type { Reglages, TypeRappel } from "../push-worker/src/rappels";

const MESSAGES: Partial<Record<EtatRappels, string>> = {
  "pas-installee":
    "Pour recevoir des rappels sur iPhone, ajoute d'abord l'appli à l'écran d'accueil : dans Safari, Partager › « Sur l'écran d'accueil ». Ouvre-la ensuite depuis son icône, et reviens ici.",
  indisponible: "Ce navigateur ne sait pas envoyer de rappels. L'appli fonctionne normalement sans.",
  "non-configure":
    "Le serveur de rappels n'est pas encore publié (voir DEPLOIEMENT-WEB.md). L'appli fonctionne normalement sans.",
  refuse:
    "Les notifications sont refusées. Tu peux les autoriser dans Réglages › Notifications › Routines, puis revenir ici.",
};

const LIBELLES: Record<TypeRappel, { titre: string; aide: string }> = {
  quotidien: { titre: "Rappel quotidien", aide: "« Un coup d'œil à tes routines ? »" },
  soir: { titre: "Rappel du soir", aide: "« C'est l'heure de Je vais dormir ? »" },
};

export default function RappelsWeb() {
  const router = useRouter();
  const t = useTheme();
  const [etat, setEtat] = useState<EtatRappels | null>(null);
  const [reglages, setReglages] = useState<Reglages>(lireReglages);
  const [choixHeure, setChoixHeure] = useState<TypeRappel | null>(null);

  useFocusEffect(
    useCallback(() => {
      etatRappels().then(setEtat);
    }, []),
  );

  const erreur = (e: unknown) => Alert.alert("Les rappels n'ont pas pu être mis à jour", String(e));

  /** Enregistre les réglages ; le serveur les reçoit si les rappels sont actifs. */
  const changer = async (r: Reglages) => {
    setReglages(r);
    try {
      await synchroniser(r);
    } catch (e) {
      erreur(e);
    }
  };

  const activerRappels = async () => {
    try {
      const r = { ...reglages, quotidien: { ...reglages.quotidien, actif: true } };
      if (await activer(r)) setReglages(r);
      setEtat(await etatRappels());
    } catch (e) {
      erreur(e);
    }
  };

  const desactiverRappels = async () => {
    await desactiver().catch(erreur);
    setEtat(await etatRappels());
  };

  const message = etat ? MESSAGES[etat] : undefined;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Rappels</Texte>

      {message && (
        <View style={[styles.boite, { backgroundColor: t.bgHighlight }]}>
          <Texte style={[styles.boiteTexte, { color: t.textSecondary }]}>{message}</Texte>
        </View>
      )}

      {etat === "inactif" && (
        <>
          <Texte style={[styles.intro, { color: t.textSecondary }]}>
            Un rappel par jour au maximum, à l&apos;heure que tu choisis. Seuls l&apos;abonnement et les heures
            sont envoyés au serveur, jamais tes données.
          </Texte>
          <TouchableOpacity style={[styles.bouton, { backgroundColor: t.accent }]} onPress={activerRappels}>
            <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Activer les rappels</Texte>
          </TouchableOpacity>
        </>
      )}

      {etat === "actif" &&
        (["quotidien", "soir"] as const).map((type) => (
          <View key={type} style={[styles.carte, { backgroundColor: t.bgCard }]}>
            <View style={styles.ligne}>
              <View style={{ flex: 1 }}>
                <Texte style={[styles.carteTitre, { color: t.textPrimary }]}>{LIBELLES[type].titre}</Texte>
                <Texte style={[styles.aide, { color: t.textMuted }]}>{LIBELLES[type].aide}</Texte>
              </View>
              <Switch
                value={reglages[type].actif}
                onValueChange={(actif) => changer({ ...reglages, [type]: { ...reglages[type], actif } })}
                trackColor={{ false: t.border, true: t.accent }}
              />
            </View>
            {reglages[type].actif && (
              <TouchableOpacity
                style={[styles.heure, { borderColor: t.border }]}
                onPress={() => setChoixHeure(type)}
                accessibilityLabel={`Changer l'heure, ${reglages[type].heure}`}
              >
                <Texte style={[styles.heureTexte, { color: t.textPrimary }]}>{reglages[type].heure}</Texte>
                <Texte style={[styles.aide, { color: t.accentText }]}>Changer l&apos;heure</Texte>
              </TouchableOpacity>
            )}
          </View>
        ))}

      {etat === "actif" && (
        <>
          <TouchableOpacity
            style={[styles.bouton, { backgroundColor: t.bgCard }]}
            onPress={() => tester().catch(erreur)}
          >
            <Texte style={[styles.boutonTexte, { color: t.textSecondary }]}>Tester une notification</Texte>
          </TouchableOpacity>
          <TouchableOpacity onPress={desactiverRappels} style={{ marginTop: spacing.xl }} hitSlop={8}>
            <Texte style={[styles.aide, { color: t.textMuted, textAlign: "center" }]}>
              Désactiver les rappels sur cet appareil
            </Texte>
          </TouchableOpacity>
        </>
      )}

      <SelecteurHeure
        visible={choixHeure !== null}
        titre={choixHeure ? LIBELLES[choixHeure].titre : ""}
        heure={choixHeure ? reglages[choixHeure].heure : "20:00"}
        onValider={(hhmm) => {
          if (choixHeure) changer({ ...reglages, [choixHeure]: { ...reglages[choixHeure], heure: hhmm } });
          setChoixHeure(null);
        }}
        onFermer={() => setChoixHeure(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.lg },
  intro: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.xl },
  boite: { borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl },
  boiteTexte: { fontSize: typography.bodySmall, lineHeight: 20 },
  bouton: { padding: 14, borderRadius: radius.md, alignItems: "center", marginTop: spacing.sm },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  carteTitre: { fontSize: typography.h3, fontWeight: "600" },
  aide: { fontSize: typography.small, marginTop: 2 },
  heure: { borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md, alignItems: "center" },
  heureTexte: { fontSize: 36, fontWeight: "600" },
});
