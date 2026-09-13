import { Tabs } from "expo-router";
import { Text } from "react-native";
import { typography, useTheme } from "../../lib/theme";

/** Emoji plutôt qu'une police d'icônes : aucune dépendance en plus. */
function Icone({ symbole, actif }: { symbole: string; actif: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: actif ? 1 : 0.45 }}>{symbole}</Text>
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
        tabBarLabelStyle: { fontSize: typography.tiny },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Aujourd'hui",
          tabBarIcon: ({ focused }) => <Icone symbole="☀️" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="pause"
        options={{
          title: "Pause",
          tabBarIcon: ({ focused }) => <Icone symbole="⏳" actif={focused} />,
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
        name="jardin"
        options={{
          title: "Jardin",
          tabBarIcon: ({ focused }) => <Icone symbole="🌳" actif={focused} />,
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
