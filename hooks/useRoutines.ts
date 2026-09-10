import { useCallback, useEffect, useState } from "react";
import {
    addRoutine,
    Ancre,
    deleteRoutine,
    getAncresActives,
    getRoutinesAvecStatutDuJour,
    getStats,
    RoutineAvecStatut,
    Stats,
    toggleCompletionAujourdhui,
    updateRoutineAncre,
} from "../lib/db";

export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineAvecStatut[]>([]);
  const [ancresActives, setAncresActives] = useState<Ancre[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chargement, setChargement] = useState(true);

  const rafraichirStats = useCallback(async () => {
    const statsData = await getStats();
    setStats(statsData);
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [dataRoutines, dataAncres] = await Promise.all([
        getRoutinesAvecStatutDuJour(),
        getAncresActives(),
      ]);
      setRoutines(dataRoutines);
      setAncresActives(dataAncres);
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
    async (nom: string, ancreId: number | null = null) => {
      const nomNettoye = nom.trim();
      if (nomNettoye.length === 0) return;
      await addRoutine(nomNettoye, ancreId);
      await charger();
    },
    [charger],
  );

  const supprimer = useCallback(async (id: number) => {
    await deleteRoutine(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const changerAncre = useCallback(
    async (id: number, ancreId: number | null, position: "avant" | "apres") => {
      await updateRoutineAncre(id, ancreId, position);
      await charger();
    },
    [charger],
  );

  return {
    routines,
    ancresActives,
    stats,
    chargement,
    toggle,
    ajouter,
    supprimer,
    changerAncre,
    recharger: charger,
  };
}
