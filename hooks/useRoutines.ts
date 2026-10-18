import { useCallback, useEffect, useState } from "react";
import {
  deleteItem,
  getRoutinesAvecStatutDuJour,
  getStats,
  type RoutineAvecStatut,
  type Stats,
} from "../lib/db";

/** Routines du jour et statistiques de l'onglet Routines. */
export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const charger = useCallback(async () => {
    setRoutines(await getRoutinesAvecStatutDuJour());
    setStats(await getStats());
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

  return { routines, stats, supprimer, recharger: charger };
}
