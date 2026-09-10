import { useCallback, useEffect, useState } from "react";
import {
    addRoutine,
    deleteRoutine,
    getRoutinesAvecStatutDuJour,
    getStats,
    RoutineAvecStatut,
    Stats,
    toggleCompletionAujourdhui,
} from "../lib/db";

export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chargement, setChargement] = useState(true);

  const rafraichirStats = useCallback(async () => {
    const statsData = await getStats();
    setStats(statsData);
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await getRoutinesAvecStatutDuJour();
      setRoutines(data);
      await rafraichirStats();
    } finally {
      setChargement(false);
    }
  }, [rafraichirStats]);

  useEffect(() => {
    charger();
  }, [charger]);

  const toggle = useCallback(
    async (id: number, faitActuel: boolean) => {
      await toggleCompletionAujourdhui(id, faitActuel);
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, faitAujourdhui: !faitActuel } : r,
        ),
      );
      await rafraichirStats();
    },
    [rafraichirStats],
  );

  const ajouter = useCallback(
    async (nom: string) => {
      const nomNettoye = nom.trim();
      if (nomNettoye.length === 0) return;
      await addRoutine(nomNettoye);
      await charger();
    },
    [charger],
  );

  const supprimer = useCallback(async (id: number) => {
    await deleteRoutine(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { routines, stats, chargement, toggle, ajouter, supprimer };
}
