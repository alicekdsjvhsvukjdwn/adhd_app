import { MiseEnPlace } from "../components/MiseEnPlace";

/**
 * Premier lancement : la mise en place guidée remplace l'ancien choix de profil.
 * Les réglages de points et de séries sont dans Profil → Réglages.
 */
export default function Onboarding() {
  return <MiseEnPlace mode="onboarding" />;
}
