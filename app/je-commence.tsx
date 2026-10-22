import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { FeuilleAvance } from "../components/FeuilleAvance";
import { Texte } from "../components/Texte";
import { ZoneNote } from "../components/ZoneNote";
import { completer, getAujourdhui, getItem } from "../lib/db";
import { cocherEtape, getEtapes } from "../lib/db/etapes";
import { rattraperProjets } from "../lib/db/projets";
import { demarrerSession, terminerSession } from "../lib/db/sessions";
import {
  dureeParDefaut,
  dureesProposees,
  finPrevue,
  formatRestant,
  minutesEcoulees,
  prolonger,
  restantMs,
  type Sortie,
} from "../lib/minuteur";
import {
  annulerFinMinuteur,
  programmerFinMinuteur,
} from "../lib/notifications";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * « Je commence » : une seule tâche (ou la prochaine étape) et un minuteur.
 * - ?id=12 : la tâche ; &etape=34 : seulement cette étape ; &projet=5 : la tâche vient d'un projet créatif,
 *   et la séance finit par la feuille « J'ai avancé » (cocher, photo, une ligne).
 * Trois sorties, aucune n'est un échec : C'est fait, Encore un peu, J'arrête là.
 * Quitter l'écran compte comme « J'arrête là » (sortie « retour » dans le journal).
 */

type Cible = {
  itemId: number;
  nom: string;
  etape: { id: number; nom: string } | null;
  premiereAction: string | null;
  dureeMin: number | null;
};

type SessionOuverte = {
  id: number;
  debut: number;
  fin: number;
  prolongations: number;
};

function Bouton({
  libelle,
  onPress,
  principal = false,
}: {
  libelle: string;
  onPress: () => void;
  principal?: boolean;
}) {
  const t = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.bouton,
        principal
          ? { backgroundColor: t.accent }
          : { borderColor: t.border, borderWidth: 1 },
      ]}
      onPress={onPress}
    >
      <Texte
        style={[
          styles.boutonTexte,
          { color: principal ? t.textOnAccent : t.textPrimary },
        ]}
      >
        {libelle}
      </Texte>
    </TouchableOpacity>
  );
}

export default function JeCommence() {
  const router = useRouter();
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string; etape?: string; projet?: string }>();

  const [cible, setCible] = useState<Cible | null>(null);
  const [duree, setDuree] = useState(dureeParDefaut(null));
  const [session, setSession] = useState<SessionOuverte | null>(null);
  const [arrete, setArrete] = useState(false);
  /** Projet créatif : minutes de la séance, pour la feuille « J'ai avancé » ; null = pas ouverte. */
  const [avance, setAvance] = useState<number | null>(null);
  /** Date de la complétion à noter dans le carnet, après « C'est fait ». */
  const [noteOuverte, setNoteOuverte] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  // Copie lue au démontage de l'écran, où l'état React n'est plus à jour.
  const ouverte = useRef<SessionOuverte | null>(null);

  useEffect(() => {
    (async () => {
      const id = Number(params.id);
      const item = await getItem(id);
      if (!item) {
        router.back();
        return;
      }
      let etape: Cible["etape"] = null;
      if (params.etape) {
        const e = (await getEtapes(id)).find(
          (x) => x.id === Number(params.etape) && x.faite === 0,
        );
        if (e) etape = { id: e.id, nom: e.nom };
      }
      setCible({
        itemId: id,
        nom: item.nom,
        etape,
        premiereAction: item.premiere_action,
        dureeMin: item.duree_min,
      });
      setDuree(dureeParDefaut(item.duree_min));
    })();
  }, [params.id, params.etape, router]);

  // Le temps restant se calcule depuis l'heure de fin : l'intervalle ne fait
  // que redessiner, et le retour au premier plan recalcule tout de suite.
  useEffect(() => {
    if (!session) return;
    const redessiner = setInterval(() => setMaintenant(Date.now()), 1000);
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") setMaintenant(Date.now());
    });
    return () => {
      clearInterval(redessiner);
      abonnement.remove();
    };
  }, [session]);

  // Écran quitté pendant le minuteur : on clôt la session (sortie « retour »).
  useEffect(
    () => () => {
      const s = ouverte.current;
      if (!s) return;
      ouverte.current = null;
      const fin = Date.now();
      annulerFinMinuteur();
      terminerSession(s.id, {
        reelleMin: minutesEcoulees(s.debut, fin),
        alleeAuBout: fin >= s.fin,
        sortie: "retour",
        prolongations: s.prolongations,
      }).catch(() => {});
    },
    [],
  );

  /** Clôt la session ouverte ; renvoie les minutes passées. */
  const fermer = async (sortie: Sortie): Promise<number> => {
    const s = ouverte.current;
    if (!s) return 0;
    ouverte.current = null;
    const fin = Date.now();
    const minutes = minutesEcoulees(s.debut, fin);
    await annulerFinMinuteur();
    await terminerSession(s.id, {
      reelleMin: minutes,
      alleeAuBout: fin >= s.fin,
      sortie,
      prolongations: s.prolongations,
    });
    return minutes;
  };

  const commencer = async () => {
    if (!cible) return;
    const id = await demarrerSession({
      type: "creneau",
      itemId: cible.itemId,
      libelle: cible.etape?.nom ?? null,
      estimationMin: duree,
    });
    const debut = Date.now();
    const s = { id, debut, fin: finPrevue(debut, duree), prolongations: 0 };
    ouverte.current = s;
    setSession(s);
    setMaintenant(debut);
    programmerFinMinuteur(new Date(s.fin), duree).catch(() => {});
  };

  const encoreUnPeu = () => {
    if (!session) return;
    const now = Date.now();
    const s = {
      ...session,
      fin: prolonger(session.fin, now),
      prolongations: session.prolongations + 1,
    };
    ouverte.current = s;
    setSession(s);
    setMaintenant(now);
    programmerFinMinuteur(
      new Date(s.fin),
      Math.round((s.fin - now) / 60_000),
    ).catch(() => {});
  };

  const cEstFait = async () => {
    if (!cible) return;
    const minutes = await fermer("fait");
    let tacheFaite = false;
    if (cible.etape) {
      // Sans effet si l'étape a été cochée ailleurs entre-temps.
      tacheFaite = await cocherEtape(cible.etape.id);
    } else {
      const item = await getItem(cible.itemId);
      if (item && item.statut !== "termine") {
        await completer(cible.itemId, "complet", minutes);
        tacheFaite = true;
      }
    }
    if (params.projet) {
      // La tâche faite coche l'étape du projet, puis « J'ai avancé ».
      await rattraperProjets();
      setAvance(minutes);
      return;
    }
    // Tâche faite : la note du carnet est proposée, comme dans Tâches.
    if (tacheFaite) setNoteOuverte(getAujourdhui());
    else router.back();
  };

  const jArreteLa = async () => {
    const minutes = await fermer("arret");
    setArrete(true);
    if (params.projet) setAvance(minutes);
  };

  const restant = session ? restantMs(session.fin, maintenant) : 0;
  const fini = session !== null && restant === 0;
  const avancee = session
    ? 1 - restant / Math.max(1, session.fin - session.debut)
    : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>

      {cible && (
        <>
          {cible.etape && (
            <Texte style={[styles.petit, { color: t.textMuted }]}>
              {cible.nom}
            </Texte>
          )}
          <Texte style={[styles.nom, { color: t.textPrimary }]}>
            {cible.etape ? cible.etape.nom : cible.nom}
          </Texte>
          {!cible.etape && cible.premiereAction && (
            <Texte style={[styles.petit, { color: t.textSecondary }]}>
              Commencer par : {cible.premiereAction}
            </Texte>
          )}

          {noteOuverte ? (
            <View style={styles.bloc}>
              <ZoneNote
                itemId={cible.itemId}
                date={noteOuverte}
                titre={`✓ ${cible.nom} · une note ? (facultatif)`}
                onFerme={() => router.back()}
              />
            </View>
          ) : arrete ? (
            <View style={styles.bloc}>
              <Texte style={[styles.message, { color: t.textPrimary }]}>
                C&apos;est noté. La tâche t&apos;attendra.
              </Texte>
              <Bouton
                libelle="Retour aux tâches"
                onPress={() => router.back()}
                principal
              />
            </View>
          ) : !session ? (
            <View style={styles.bloc}>
              <Texte style={[styles.label, { color: t.textSecondary }]}>
                Combien de temps ?
              </Texte>
              <View style={styles.puces}>
                {dureesProposees(cible.dureeMin).map((d) => {
                  const actif = d === duree;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDuree(d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actif }}
                      style={[
                        styles.puce,
                        {
                          backgroundColor: actif ? t.accent : t.bgCard,
                          borderColor: actif ? t.accent : t.border,
                        },
                      ]}
                    >
                      <Texte
                        style={[
                          styles.puceTexte,
                          { color: actif ? t.textOnAccent : t.textSecondary },
                        ]}
                      >
                        {d} min
                      </Texte>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {cible.dureeMin == null && (
                <Texte style={[styles.petit, { color: t.textMuted }]}>
                  5 minutes, juste pour voir. Tu pourras continuer.
                </Texte>
              )}
              <Bouton libelle="Commencer" onPress={commencer} principal />
            </View>
          ) : (
            <View style={styles.bloc}>
              <Texte
                style={[styles.temps, { color: t.textPrimary }]}
                accessibilityLabel={
                  fini
                    ? "Le temps est passé"
                    : `Il reste ${formatRestant(restant)}`
                }
              >
                {formatRestant(restant)}
              </Texte>
              <View style={[styles.barre, { backgroundColor: t.bgCard }]}>
                <View
                  style={{
                    flex: avancee,
                    backgroundColor: t.accent,
                    borderRadius: 4,
                  }}
                />
                <View style={{ flex: 1 - avancee }} />
              </View>
              {fini && (
                <Texte style={[styles.message, { color: t.textPrimary }]}>
                  Le temps est passé.
                </Texte>
              )}
              <Bouton libelle="C'est fait" onPress={cEstFait} principal />
              {fini && <Bouton libelle="Encore un peu" onPress={encoreUnPeu} />}
              <Bouton libelle="J'arrête là" onPress={jArreteLa} />
            </View>
          )}
        </>
      )}
      {params.projet && (
        <FeuilleAvance
          projetId={Number(params.projet)}
          minutes={avance ?? 0}
          visible={avance !== null}
          onFerme={() => {
            setAvance(null);
            if (!arrete) router.back();
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  retour: {
    fontSize: typography.body,
    fontWeight: "600",
    marginBottom: spacing.xl,
  },
  nom: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  petit: { fontSize: typography.small, lineHeight: 19, marginBottom: spacing.sm },
  bloc: { marginTop: spacing.xl, gap: spacing.md },
  label: { fontSize: typography.body, fontWeight: "600" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  puceTexte: { fontSize: typography.body, fontWeight: "600" },
  temps: {
    fontSize: 64,
    fontWeight: "300",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  barre: { flexDirection: "row", height: 8, borderRadius: 4 },
  message: { fontSize: typography.h3, textAlign: "center" },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "600" },
});
