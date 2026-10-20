import { Alert, Platform } from "react-native";

/**
 * Sur le web, Alert.alert de react-native ne fait rien. On le remplace par
 * les boîtes du navigateur : un bouton = alert ; plusieurs = confirm, où OK
 * lance le premier bouton qui n'est pas « annuler » (ponytail : trois choix
 * ou plus ne sont pas proposés, ajouter une vraie feuille si le cas arrive).
 */
if (Platform.OS === "web") {
  Alert.alert = (titre, message, boutons) => {
    const texte = [titre, message].filter(Boolean).join("\n\n");
    if (!boutons || boutons.length <= 1) {
      window.alert(texte);
      boutons?.[0]?.onPress?.();
      return;
    }
    const annuler = boutons.find((b) => b.style === "cancel");
    const action = boutons.find((b) => b !== annuler) ?? boutons[0];
    (window.confirm(texte) ? action : annuler)?.onPress?.();
  };
}
