import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    SafeAreaView,
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
    getRoutinesAvecStatutDuJour,
    setConfigRappel,
} from "../lib/db";
import {
    annulerRappelQuotidien,
    construireContenuRappel,
    demanderPermissionNotifications,
    envoyerNotificationTest,
    permissionAccordee,
    programmerRappelQuotidien,
} from "../lib/notifications";

const HEURES_PROPOSEES = [7, 8, 9, 12, 14, 17, 18, 19, 20, 21, 22];

export default function RappelsScreen() {
  const [config, setConfigLocal] = useState<ConfigRappel | null>(null);
  const [permission, setPermission] = useState<boolean>(false);
  const [expliquePermission, setExpliquePermission] = useState<boolean>(false);
  const router = useRouter();

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

  const reprogrammerSiActif = async (nouvConfig: ConfigRappel) => {
    if (!nouvConfig.actif) {
      await annulerRappelQuotidien();
      return;
    }
    const routines = await getRoutinesAvecStatutDuJour();
    const contenu = construireContenuRappel(routines) ?? {
      title: "Rappel de tes routines",
      body: "C'est le moment de faire le point sur ta journée.",
    };
    await programmerRappelQuotidien(
      nouvConfig.heure,
      nouvConfig.minute,
      contenu,
    );
  };

  const onToggleActif = async (nouveauEtat: boolean) => {
    if (nouveauEtat && !permission) {
      // On demande la permission avant de pouvoir activer
      setExpliquePermission(true);
      return;
    }
    const nouvConfig = { ...config!, actif: nouveauEtat };
    await setConfigRappel(nouvConfig);
    setConfigLocal(nouvConfig);
    await reprogrammerSiActif(nouvConfig);
  };

  const onConfirmerPermission = async () => {
    setExpliquePermission(false);
    const accordee = await demanderPermissionNotifications();
    setPermission(accordee);
    if (accordee && config) {
      const nouvConfig = { ...config, actif: true };
      await setConfigRappel(nouvConfig);
      setConfigLocal(nouvConfig);
      await reprogrammerSiActif(nouvConfig);
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
    await reprogrammerSiActif(nouvConfig);
  };

  const onTester = async () => {
    if (!permission) {
      Alert.alert(
        "Permission nécessaire",
        "Active d'abord les rappels pour pouvoir tester.",
      );
      return;
    }
    const routines = await getRoutinesAvecStatutDuJour();
    const contenu = construireContenuRappel(routines) ?? {
      title: "Tout est fait pour aujourd'hui",
      body: "Bravo, tu peux souffler.",
    };
    await envoyerNotificationTest(contenu);
    Alert.alert(
      "Notification envoyée",
      "Elle devrait apparaître dans quelques secondes.",
    );
  };

  if (!config) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Chargement...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.retour}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>Rappels quotidiens</Text>
      </View>

      <Text style={styles.intro}>
        Un seul rappel par jour, à l'heure qui te convient. Il te listera les
        routines que tu n'as pas encore faites, formulées avec tes moments
        repères.
      </Text>

      {expliquePermission && (
        <View style={styles.explicationBox}>
          <Text style={styles.explicationTitre}>Avant d'activer</Text>
          <Text style={styles.explicationTexte}>
            L'appli va demander la permission d'envoyer des notifications à ton
            téléphone. Un seul rappel par jour sera envoyé — pas de spam.
          </Text>
          <View style={styles.explicationBoutons}>
            <TouchableOpacity
              style={styles.boutonAnnuler}
              onPress={() => setExpliquePermission(false)}
            >
              <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boutonConfirmer}
              onPress={onConfirmerPermission}
            >
              <Text style={styles.boutonConfirmerTexte}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.ligneToggle}>
          <Text style={styles.ligneTexte}>Activer le rappel quotidien</Text>
          <Switch
            value={config.actif && permission}
            onValueChange={onToggleActif}
            trackColor={{ false: "#ccc", true: "#4a90d9" }}
          />
        </View>
        {!permission && config.actif && (
          <Text style={styles.avertissement}>
            Permission non accordée. Réactive-la dans les réglages de ton
            téléphone.
          </Text>
        )}
      </View>

      {config.actif && permission && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>Heure du rappel</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {HEURES_PROPOSEES.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.pastilleHeure,
                    config.heure === h ? styles.pastilleActive : null,
                  ]}
                  onPress={() => onChoisirHeure(h)}
                >
                  <Text
                    style={[
                      styles.pastilleTexte,
                      config.heure === h ? styles.pastilleTexteActif : null,
                    ]}
                  >
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.boutonTester} onPress={onTester}>
            <Text style={styles.boutonTesterTexte}>
              Tester une notification
            </Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  retour: { fontSize: 15, color: "#4a90d9", marginBottom: 8 },
  titre: { fontSize: 22, fontWeight: "600" },
  intro: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 24,
  },
  explicationBox: {
    backgroundColor: "#fef3e0",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  explicationTitre: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8a5a1a",
    marginBottom: 8,
  },
  explicationTexte: {
    fontSize: 14,
    color: "#555",
    lineHeight: 19,
    marginBottom: 12,
  },
  explicationBoutons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  boutonAnnuler: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  boutonAnnulerTexte: { color: "#666", fontSize: 14 },
  boutonConfirmer: {
    backgroundColor: "#4a90d9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  boutonConfirmerTexte: { color: "#fff", fontSize: 14, fontWeight: "600" },
  section: { marginBottom: 24 },
  ligneToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ligneTexte: { fontSize: 15 },
  avertissement: {
    fontSize: 13,
    color: "#e05c5c",
    marginTop: 8,
  },
  sectionTitre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8a5a1a",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  pastilleHeure: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
    minWidth: 50,
    alignItems: "center",
  },
  pastilleActive: { backgroundColor: "#4a90d9" },
  pastilleTexte: { fontSize: 14, color: "#555" },
  pastilleTexteActif: { color: "#fff", fontWeight: "600" },
  boutonTester: {
    backgroundColor: "#f0f0f0",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  boutonTesterTexte: { fontSize: 14, color: "#555", fontWeight: "500" },
});
