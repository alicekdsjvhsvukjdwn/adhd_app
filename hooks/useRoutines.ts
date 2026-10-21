import { useCallback, useEffect, useState } from "react";
import {
  deleteItem,
  getRoutinesAvecStatutDuJour,
  type RoutineAvecStatut,
} from "../lib/db";

/** Routines du jour de l'onglet Routines (ou d'un jour passé, pour cocher après coup). */
export function useRoutines(jour?: string) {
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);

  const charger = useCallback(async () => {
    setRoutines(await getRoutinesAvecStatutDuJour(jour));
  }, [jour]);

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
