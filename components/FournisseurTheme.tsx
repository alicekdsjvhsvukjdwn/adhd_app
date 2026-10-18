import { useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import {
  ContexteTheme,
  heureDecimale,
  momentDeHeure,
  THEMES,
} from "../lib/theme";

const CINQ_MINUTES = 5 * 60_000;

/**
 * Fournit les couleurs du moment à toute l'appli. Un seul minuteur :
 * le moment est recalculé au retour au premier plan et toutes les 5 minutes.
 */
export function FournisseurTheme({ children }: { children: ReactNode }) {
  const [moment, setMoment] = useState(() => momentDeHeure(heureDecimale()));

  useEffect(() => {
    const verifier = () => setMoment(momentDeHeure(heureDecimale()));
    const minuteur = setInterval(verifier, CINQ_MINUTES);
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") verifier();
    });
    return () => {
      clearInterval(minuteur);
      abonnement.remove();
    };
  }, []);

  return (
    <ContexteTheme.Provider value={THEMES[moment]}>{children}</ContexteTheme.Provider>
  );
}
