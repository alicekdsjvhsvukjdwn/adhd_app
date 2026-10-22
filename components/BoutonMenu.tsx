import { useState } from "react";
import { TouchableOpacity } from "react-native";
import { useTheme } from "../lib/theme";
import { MenuOptions } from "./MenuOptions";
import type { Option } from "./Options";
import { Texte } from "./Texte";

/** Bouton « ⋯ » qui ouvre un menu d'actions, sur iPhone comme sur le web (BoutonOptions n'existe que sur le web). */
export function BoutonMenu({ options, titre }: { options: Option[]; titre: string }) {
  const t = useTheme();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setOuvert(true)} hitSlop={8} style={{ paddingHorizontal: 6 }} accessibilityRole="button" accessibilityLabel={`Plus d'actions : ${titre}`}>
        <Texte style={{ color: t.textMuted, fontSize: 22, lineHeight: 24 }}>⋯</Texte>
      </TouchableOpacity>
      <MenuOptions titre={titre} options={ouvert ? options : []} onFermer={() => setOuvert(false)} />
    </>
  );
}
