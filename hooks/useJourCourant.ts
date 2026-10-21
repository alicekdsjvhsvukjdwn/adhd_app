import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { dateLocale } from "../lib/dates";
import { getAujourdhui } from "../lib/db/completions";

/**
 * Date du jour qui suit le passage de minuit, appli ouverte : vérifiée au
 * retour au premier plan et chaque minute. Les écrans la mettent dans les
 * dépendances de leur chargement pour se recharger quand elle change.
 */
export function useJourCourant(): string {
  const [jour, setJour] = useState(getAujourdhui);

  useEffect(() => {
    const verifier = () => setJour(getAujourdhui());
    const minute = setInterval(verifier, 60_000);
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") verifier();
    });
    return () => {
      clearInterval(minute);
      abonnement.remove();
    };
  }, []);

  return jour;
}

/** Date du calendrier (change à minuit, pas à l'heure de début de journée) : pour marquer « aujourd'hui » dans la bande des jours. */
export function useJourReel(): string {
  const [jour, setJour] = useState(() => dateLocale());

  useEffect(() => {
    const verifier = () => setJour(dateLocale());
    const minute = setInterval(verifier, 60_000);
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") verifier();
    });
    return () => {
      clearInterval(minute);
      abonnement.remove();
    };
  }, []);

  return jour;
}
