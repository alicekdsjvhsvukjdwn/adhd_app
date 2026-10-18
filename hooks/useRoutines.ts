import { useCallback, useEffect, useState } from "react";
import {
  deleteItem,
  getRoutinesAvecStatutDuJour,
  type RoutineAvecStatut,
} from "../lib/db";

/** Routines du jour de l'onglet Routines. */
export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);

  const charger = useCallback(async () => {
    setRoutines(await getRoutinesAvecStatutDuJour());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const supprimer = useCallback(
    async (id: number) => {
      await deleteItem(id);
      await charger();
    },
    [charger],
  );

  return { routines, supprimer, recharger: charger };
}
