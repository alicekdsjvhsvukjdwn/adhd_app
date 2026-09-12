import { useCallback, useEffect, useState } from "react";
import {
  addRoutine,
  Ancre,
  deleteRoutine,
  getAncresActives,
  getConfigRappel,
  getRoutinesAvecStatutDuJour,
  getStats,
  RoutineAvecStatut,
  Stats,
  toggleCompletionAujourdhui,
  updateRoutineAncre,
} from "../lib/db";
import {
  construireContenuRappel,
  permissionAccordee,
  programmerRappelQuotidien,
} from "../lib/notifications";

/**
 * Reprogramme le rappel quotidien avec le contenu à jour,
 * seulement si le rappel est actif ET la permission accordée.
 * Silencieux en cas d'erreur — ne bloque jamais l'UI.
 */
async function reprogrammerRappelSiActif(routines: RoutineAvecStatut[]) {
  try {
    const config = await getConfigRappel();
    if (!config.actif) return;
    const perm = await permissionAccordee();
    if (!perm) return;
    const contenu = construireContenuRappel(routines) ?? {
      title: "Tout est fait pour aujourd'hui",
      body: "Bravo, tu peux souffler.",
    };
    await programmerRappelQuotidien(config.heure, config.minute, contenu);
  } catch {
    // Silencieux : si la reprogrammation échoue, on ne casse pas l'UI
  }
}

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
      const nouvellesRoutines = routines.map((r) =>
        r.id === id ? { ...r, faitAujourdhui: !faitActuel } : r,
      );
      setRoutines(nouvellesRoutines);
      await rafraichirStats();
      // On reprogramme le rappel en tâche de fond, sans bloquer
      reprogrammerRappelSiActif(nouvellesRoutines);
    },
    [routines, rafraichirStats],
  );

  const ajouter = useCallback(
    async (nom: string, ancreId: number | null = null) => {
      const nomNettoye = nom.trim();
      if (nomNettoye.length === 0) return;
      await addRoutine(nomNettoye, ancreId);
      await charger();
      const nouvellesRoutines = await getRoutinesAvecStatutDuJour();
      reprogrammerRappelSiActif(nouvellesRoutines);
    },
    [charger],
  );

  const supprimer = useCallback(
    async (id: number) => {
      await deleteRoutine(id);
      const nouvellesRoutines = routines.filter((r) => r.id !== id);
      setRoutines(nouvellesRoutines);
      reprogrammerRappelSiActif(nouvellesRoutines);
    },
    [routines],
  );

  const changerAncre = useCallback(
    async (id: number, ancreId: number | null, position: "avant" | "apres") => {
      await updateRoutineAncre(id, ancreId, position);
      await charger();
      const nouvellesRoutines = await getRoutinesAvecStatutDuJour();
      reprogrammerRappelSiActif(nouvellesRoutines);
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
