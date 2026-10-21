import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ChampTexte, Texte } from "../components/Texte";
import { agendaActif, agendaDisponible, chargerAgenda, connecterAgenda, deconnecterAgenda } from "../lib/agenda";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/** Profil › Agenda : l'adresse secrète iCal de Google Agenda, envoyée une seule fois au serveur de rappels. */
export default function Agenda() {
  const router = useRouter();
  const t = useTheme();
  const [actif, setActif] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    agendaActif().then(setActif);
  }, []);

  const connecter = async () => {
    setEnvoi(true);
    setMessage(null);
    try {
      await connecterAgenda(adresse);
      setAdresse(""); // l'adresse n'est pas gardée dans l'appli
      setActif(true);
      const a = await chargerAgenda();
      setMessage(a ? `Connecté · ${a.evenements.length} rendez-vous dans les 60 prochains jours.` : "Connecté.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  const deconnecter = async () => {
    await deconnecterAgenda();
    setActif(false);
    setMessage("Agenda déconnecté.");
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>Agenda</Texte>
      <Texte style={[styles.texte, { color: t.textSecondary }]}>
        Tes rendez-vous Google Agenda s&apos;affichent en haut de Tâches (lecture seule). Un jour chargé, l&apos;appli te propose des tâches plus courtes.
      </Texte>

      {!agendaDisponible() ? (
        <Texte style={[styles.texte, { color: t.textMuted }]}>
          Le serveur de rappels n&apos;est pas configuré : l&apos;agenda passe par lui (voir DEPLOIEMENT-WEB.md).
        </Texte>
      ) : actif ? (
        <>
          <Texte style={[styles.texte, { color: t.textPrimary }]}>✓ Agenda connecté.</Texte>
          <TouchableOpacity onPress={deconnecter} style={[styles.bouton, { borderColor: t.danger }]} accessibilityRole="button">
            <Texte style={{ color: t.danger, fontWeight: "600" }}>Déconnecter</Texte>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Texte style={[styles.texte, { color: t.textSecondary }]}>
            Dans Google Agenda (sur ordinateur) : Paramètres › ton agenda › « Intégrer l&apos;agenda » › « Adresse secrète au format iCal ». Copie-la et colle-la ici. Elle part une seule fois vers ton serveur de rappels et n&apos;est pas gardée dans l&apos;appli.
          </Texte>
          <ChampTexte
            value={adresse}
            onChangeText={setAdresse}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            placeholderTextColor={t.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }]}
          />
          <TouchableOpacity
            onPress={connecter}
            disabled={envoi || adresse.trim().length < 10}
            style={[styles.bouton, { backgroundColor: t.accent, borderColor: t.accent, opacity: envoi || adresse.trim().length < 10 ? 0.5 : 1 }]}
            accessibilityRole="button"
          >
            {envoi ? <ActivityIndicator color={t.textOnAccent} /> : <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Connecter</Texte>}
          </TouchableOpacity>
        </>
      )}
      {message && <Texte style={[styles.texte, { color: t.textSecondary, marginTop: spacing.md }]}>{message}</Texte>}
      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.md },
  texte: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, marginBottom: spacing.md },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
