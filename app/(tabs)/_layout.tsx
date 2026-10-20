import { Tabs } from "expo-router";
import { ChartColumn, Gift, Moon, Sun, SquareCheck, User, type LucideIcon } from "lucide-react-native";
import { Platform, type ColorValue } from "react-native";
import { policeDe, typography, useTheme } from "../../lib/theme";

/** Gris des onglets inactifs (icône et libellé). */
const GRIS = "#5E7775";

/** Icône au trait d'un onglet : couleur d'accent du moment si actif, gris sinon (couleur donnée par la barre). */
const icone =
  (Icone: LucideIcon) =>
  ({ color }: { color: ColorValue }) => <Icone color={color} size={Platform.OS === "web" ? 22 : 24} strokeWidth={1.75} />;

export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: GRIS,
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
          tabBarIcon: icone(Sun),
        }}
      />
      <Tabs.Screen
        name="taches"
        options={{
          title: "Tâches",
          tabBarIcon: icone(SquareCheck),
        }}
      />
      <Tabs.Screen
        name="recompenses"
        options={{
          title: "Récompenses",
          tabBarIcon: icone(Gift),
        }}
      />
      <Tabs.Screen
        name="suivi"
        options={{
          title: "Suivi",
          tabBarIcon: icone(Moon),
        }}
      />
      <Tabs.Screen
        name="progression"
        options={{
          title: "Progression",
          tabBarIcon: icone(ChartColumn),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: icone(User),
        }}
      />
    </Tabs>
  );
}
