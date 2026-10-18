import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    ConfigRappel,
    getConfigRappel,
    setConfigRappel,
} from "../lib/db";
import {
    demanderPermissionNotifications,
    envoyerNotificationTest,
    permissionAccordee,
    reprogrammerRappel,
} from "../lib/notifications";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const HEURES_PROPOSEES = [7, 8, 9, 12, 14, 17, 18, 19, 20, 21, 22];

export default function RappelsScreen() {
  const [config, setConfigLocal] = useState<ConfigRappel | null>(null);
  const [permission, setPermission] = useState<boolean>(false);
  const [expliquePermission, setExpliquePermission] = useState<boolean>(false);
  const router = useRouter();
  const t = useTheme();

  const charger = useCallback(async () => {
    const c = await getConfigRappel();
    setConfigLocal(c);
    const perm = await permissionAccordee();
    setPermission(perm);
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const onToggleActif = async (nouveauEtat: boolean) => {
    if (nouveauEtat && !permission) {
      // On demande la permission avant de pouvoir activer
      setExpliquePermission(true);
      return;
    }
    const nouvConfig = { ...config!, actif: nouveauEtat };
    await setConfigRappel(nouvConfig);
    setConfigLocal(nouvConfig);
    await reprogrammerRappel(nouvConfig);
  };

  const onConfirmerPermission = async () => {
    setExpliquePermission(false);
    const accordee = await demanderPermissionNotifications();
    setPermission(accordee);
    if (accordee && config) {
      const nouvConfig = { ...config, actif: true };
      await setConfigRappel(nouvConfig);
      setConfigLocal(nouvConfig);
      await reprogrammerRappel(nouvConfig);
    } else if (!accordee) {
      Alert.alert(
        "Permission refusée",
        "Sans permission, les rappels ne pourront pas s'afficher. Tu peux l'activer plus tard dans les réglages de ton téléphone.",
      );
    }
  };

  const onChoisirHeure = async (heure: number) => {
    if (!config) return;
    const nouvConfig = { ...config, heure, minute: 0 };
    await setConfigRappel(nouvConfig);
    setConfigLocal(nouvConfig);
    await reprogrammerRappel(nouvConfig);
  };

  const onTester = async () => {
    if (!permission) {
      Alert.alert(
        "Permission nécessaire",
        "Active d'abord les rappels pour pouvoir tester.",
      );
      return;
    }
    await envoyerNotificationTest();
    Alert.alert(
      "Notification envoyée",
      "Elle devrait apparaître dans quelques secondes.",
    );
  };

  if (!config) {
    return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.retour, { color: t.accentText }]}>← Retour</Text>
      </TouchableOpacity>
      <Text style={[styles.titre, { color: t.textPrimary }]}>Rappels quotidiens</Text>

      <Text style={[styles.intro, { color: t.textSecondary }]}>
        Un seul rappel par jour, à l&apos;heure qui te convient, pour jeter un
        coup d&apos;œil à tes routines.
      </Text>

      {expliquePermission && (
        <View style={[styles.explicationBox, { backgroundColor: t.bgHighlight }]}>
          <Text style={[styles.explicationTitre, { color: t.accentText }]}>
            Avant d&apos;activer
          </Text>
          <Text style={[styles.explicationTexte, { color: t.textSecondary }]}>
            L&apos;appli va demander la permission d&apos;envoyer des
            notifications. Un seul rappel par jour, pas plus.
          </Text>
          <View style={styles.explicationBoutons}>
            <TouchableOpacity
              style={styles.boutonAnnuler}
              onPress={() => setExpliquePermission(false)}
            >
              <Text style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>
                Annuler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.boutonConfirmer, { backgroundColor: t.accent }]}
              onPress={onConfirmerPermission}
            >
              <Text style={[styles.boutonConfirmerTexte, { color: t.textOnAccent }]}>
                Continuer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.ligneToggle}>
          <Text style={{ fontSize: typography.body, color: t.textPrimary }}>
            Activer le rappel quotidien
          </Text>
          <Switch
            value={config.actif && permission}
            onValueChange={onToggleActif}
            trackColor={{ false: t.border, true: t.accent }}
          />
        </View>
        {!permission && config.actif && (
          <Text style={[styles.avertissement, { color: t.danger }]}>
            Permission non accordée. Réactive-la dans les réglages de ton
            téléphone.
          </Text>
        )}
      </View>

      {config.actif && permission && (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitre, { color: t.accentText }]}>Heure du rappel</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {HEURES_PROPOSEES.map((h) => {
                const actif = config.heure === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.pastilleHeure,
                      { backgroundColor: actif ? t.accent : t.bgCard },
                    ]}
                    onPress={() => onChoisirHeure(h)}
                  >
                    <Text
                      style={{
                        fontSize: typography.bodySmall,
                        color: actif ? t.textOnAccent : t.textSecondary,
                        fontWeight: actif ? "600" : "400",
                      }}
                    >
                      {h}h
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.boutonTester, { backgroundColor: t.bgCard }]}
            onPress={onTester}
          >
            <Text style={{ fontSize: typography.bodySmall, color: t.textSecondary, fontWeight: "500" }}>
              Tester une notification
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, marginBottom: spacing.sm },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.md },
  intro: { fontSize: typography.bodySmall, lineHeight: 20, marginBottom: spacing.xl },
  explicationBox: { borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl },
  explicationTitre: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.sm },
  explicationTexte: { fontSize: typography.bodySmall, lineHeight: 19, marginBottom: spacing.md },
  explicationBoutons: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
  boutonAnnuler: { paddingHorizontal: 14, paddingVertical: spacing.sm },
  boutonConfirmer: { paddingHorizontal: 14, paddingVertical: spacing.sm, borderRadius: radius.sm },
  boutonConfirmerTexte: { fontSize: typography.bodySmall, fontWeight: "600" },
  section: { marginBottom: spacing.xxl },
  ligneToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avertissement: { fontSize: typography.small, marginTop: spacing.sm },
  sectionTitre: {
    fontSize: typography.small,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  pastilleHeure: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    minWidth: 50,
    alignItems: "center",
  },
  boutonTester: { padding: 14, borderRadius: radius.md, alignItems: "center", marginTop: spacing.sm },
});
