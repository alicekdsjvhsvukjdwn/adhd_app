import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Texte } from "../../components/Texte";
import { policeDe, typography, useTheme } from "../../lib/theme";

/** Emoji plutôt qu'une police d'icônes : aucune dépendance en plus. */
function Icone({ symbole, actif }: { symbole: string; actif: boolean }) {
  return (
    <Texte
      style={{ fontSize: 20, opacity: actif ? 1 : 0.45, ...(Platform.OS === "web" ? { lineHeight: 22 } : {}) }}
    >
      {symbole}
    </Texte>
  );
}

export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: {
          backgroundColor: t.bgApp,
          borderTopColor: t.border,
        },
        tabBarLabelStyle: {
          fontSize: typography.tiny,
          fontFamily: policeDe("600", false),
          ...(Platform.OS === "web" ? { lineHeight: 14 } : {}),
        },
        // Web : le conteneur d'icône fait 28 px ; avec les 5 px de marge de chaque côté de l'onglet
        // (hauteur 49), il ne restait que 10 px au libellé, qui était coupé. La hauteur de la barre
        // et la marge du bas (iPhone) restent celles d'origine : la marge n'est appliquée qu'une fois.
        ...(Platform.OS === "web" ? { tabBarIconStyle: { height: 22 } } : {}),
        sceneStyle: { backgroundColor: t.bgApp },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Routines",
          tabBarIcon: ({ focused }) => <Icone symbole="☀️" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="taches"
        options={{
          title: "Tâches",
          tabBarIcon: ({ focused }) => <Icone symbole="✅" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="recompenses"
        options={{
          title: "Récompenses",
          tabBarIcon: ({ focused }) => <Icone symbole="🎁" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="suivi"
        options={{
          title: "Suivi",
          tabBarIcon: ({ focused }) => <Icone symbole="🌙" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          title: "Progression",
          tabBarIcon: ({ focused }) => <Icone symbole="📈" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => <Icone symbole="⚙️" actif={focused} />,
        }}
      />
    </Tabs>
  );
}
