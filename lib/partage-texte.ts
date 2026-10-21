import { Platform, Share } from "react-native";

/**
 * Partage un texte (résumé avant séance). Téléphone : la feuille de partage. Web : le partage du
 * navigateur s'il existe, sinon le texte est copié. Renvoie ce qui s'est passé.
 */
export async function partagerTexte(texte: string, titre: string): Promise<"partage" | "copie" | "annule"> {
  if (Platform.OS === "web") {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: titre, text: texte });
        return "partage";
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return "annule";
      }
    }
    await navigator.clipboard.writeText(texte);
    return "copie";
  }
  const r = await Share.share({ message: texte, title: titre });
  return r.action === Share.dismissedAction ? "annule" : "partage";
}
