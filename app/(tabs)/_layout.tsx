import { Tabs } from "expo-router";
import { Texte } from "../../components/Texte";
import { policeDe, typography, useTheme } from "../../lib/theme";

/** Emoji plutôt qu'une police d'icônes : aucune dépendance en plus. */
function Icone({ symbole, actif }: { symbole: string; actif: boolean }) {
  return (
    <Texte style={{ fontSize: 20, opacity: actif ? 1 : 0.45 }}>{symbole}</Texte>
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
        tabBarLabelStyle: { fontSize: typography.tiny, fontFamily: policeDe("600", false) },
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
