import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { decalerJours } from "../lib/dates";
import { getAujourdhui } from "../lib/db/completions";
import {
  definirRoutineLiee,
  getRoutineLiee,
  routineProposee,
  routinesDisponibles,
} from "../lib/db/routine-liee";
import { enregistrerSeanceNotee } from "../lib/db/seances-guidees";
import { ficheSkill, noterEssai, validerManuellement } from "../lib/db/sport";
import {
  DUREES_NOTEES,
  QUAND,
  RESSENTIS,
  SOURCES,
  dateDeQuand,
  type Quand,
  type SeanceNotee,
  type Zone,
  ZONES,
} from "../lib/seances";
import { critere, skill as skillDe } from "../lib/skills";
import { avecAlpha, radius, spacing, typography, useTheme } from "../lib/theme";
import { FigureSkill } from "./FigureSkill";
import { PlusMoins } from "./PlusMoins";
import { ChampTexte, Texte } from "./Texte";

/** Bonhomme de chaque zone (figures de FigureSkill). */
const FIGURE_ZONE: Record<Zone, string> = {
  haut: "pompe",
  bas: "squat",
  abdos: "gainage",
  mobilite: "chat_vache",
  complet: "pike_taps",
};

/** Feuille du bas commune : fond sombre qui ferme, contenu qui défile, clavier géré. */
function FeuilleBas({
  visible,
  titre,
  onFermer,
  children,
  pied,
}: {
  visible: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  /** Toujours visible sous le contenu qui défile (le bouton Enregistrer). */
  pied?: ReactNode;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.fond} onPress={onFermer}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <View style={[styles.poignee, { backgroundColor: t.border }]} />
            <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {pied}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Pastille({
  actif,
  libelle,
  onPress,
  couleur,
  enfant,
}: {
  actif: boolean;
  libelle: string;
  onPress: () => void;
  couleur?: string;
  enfant?: ReactNode;
}) {
  const t = useTheme();
  const c = couleur ?? t.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pastille,
        { backgroundColor: actif ? avecAlpha(c, 0.18) : t.bgApp, borderColor: actif ? c : t.border },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
    >
      {enfant}
      <Texte style={[styles.pastilleTexte, { color: actif ? t.textPrimary : t.textSecondary }]}>{libelle}</Texte>
    </TouchableOpacity>
  );
}

const Surtitre = ({ children }: { children: string }) => {
  const t = useTheme();
  return <Texte style={[styles.surtitre, { color: t.textMuted }]}>{children}</Texte>;
};

const hier = () => decalerJours(getAujourdhui(), -1);

// ─── Noter une séance faite ailleurs ────────────────────────────────────

/**
 * « J'ai fait une séance » : zones, durée, quand, puis Enregistrer. Source,
 * lien, ressenti et note sont dans « Plus ». `depart` pré-remplit (séance récente).
 */
export function FeuilleSeanceNotee({
  visible,
  depart,
  onFermer,
  onEnregistre,
}: {
  visible: boolean;
  depart?: SeanceNotee | null;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const t = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [duree, setDuree] = useState<number | null>(null);
  const [autre, setAutre] = useState(false);
  const [autreMin, setAutreMin] = useState(25);
  const [quand, setQuand] = useState<Quand>("maintenant");
  const [plus, setPlus] = useState(false);
  const [source, setSource] = useState("");
  const [lien, setLien] = useState("");
  const [ressenti, setRessenti] = useState("");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Chaque ouverture repart de zéro, ou de la séance récente choisie.
  useEffect(() => {
    if (!visible) return;
    setZones(depart?.zones ?? []);
    setDuree(depart?.duree_min ?? null);
    setAutre(!!depart && !(DUREES_NOTEES as readonly number[]).includes(depart.duree_min));
    setAutreMin(depart?.duree_min ?? 25);
    setQuand("maintenant");
    setPlus(!!depart && (!!depart.source || !!depart.lien));
    setSource(depart?.source ?? "");
    setLien(depart?.lien ?? "");
    setRessenti(depart?.ressenti ?? "");
    setNote("");
  }, [visible, depart]);

  const minutes = autre ? autreMin : duree;

  const enregistrer = async () => {
    if (!minutes || enCours) return;
    setEnCours(true);
    try {
      const points = await enregistrerSeanceNotee(
        { zones, duree_min: minutes, source, lien, ressenti, note },
        dateDeQuand(quand, getAujourdhui(), hier()),
      );
      onFermer();
      onEnregistre();
      Alert.alert("Séance notée", points > 0 ? `+${points} pts` : "Les points du sport sont déjà pris ce jour-là.");
    } catch (e) {
      Alert.alert("L'enregistrement a échoué", String(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <FeuilleBas
      visible={visible}
      titre="J'ai fait une séance"
      onFermer={onFermer}
      pied={
        <TouchableOpacity
          onPress={enregistrer}
          disabled={!minutes || enCours}
          style={[styles.bouton, { backgroundColor: t.accent, opacity: minutes ? 1 : 0.4 }]}
          accessibilityRole="button"
        >
          <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Enregistrer</Texte>
        </TouchableOpacity>
      }
    >
      <Surtitre>ZONES</Surtitre>
      <View style={styles.pastilles}>
        {ZONES.map((z) => {
          const actif = zones.includes(z.cle);
          return (
            <Pastille
              key={z.cle}
              actif={actif}
              libelle={z.nom}
              couleur={z.couleur}
              onPress={() => setZones(actif ? zones.filter((x) => x !== z.cle) : [...zones, z.cle])}
              enfant={<FigureSkill skill={FIGURE_ZONE[z.cle]} couleur={z.couleur} taille={22} />}
            />
          );
        })}
      </View>

      <Surtitre>DURÉE</Surtitre>
      <View style={styles.pastilles}>
        {DUREES_NOTEES.map((d) => (
          <Pastille
            key={d}
            actif={!autre && duree === d}
            libelle={`${d} min`}
            onPress={() => {
              setAutre(false);
              setDuree(d);
            }}
          />
        ))}
        <Pastille actif={autre} libelle="Autre" onPress={() => setAutre(true)} />
      </View>
      {autre && (
        <View style={{ alignItems: "center", marginTop: spacing.sm }}>
          <PlusMoins
            valeur={`${autreMin} min`}
            libelle="Durée en minutes"
            onPas={(sens) => setAutreMin((m) => Math.max(1, Math.min(240, m + sens * 5)))}
          />
        </View>
      )}

      <Surtitre>QUAND</Surtitre>
      <View style={styles.pastilles}>
        {QUAND.map((q) => (
          <Pastille key={q.cle} actif={quand === q.cle} libelle={q.nom} onPress={() => setQuand(q.cle)} />
        ))}
      </View>

      <TouchableOpacity onPress={() => setPlus(!plus)} hitSlop={8} style={{ marginTop: spacing.lg }}>
        <Texte style={[styles.lien, { color: t.accentText }]}>{plus ? "− Moins" : "+ Plus (source, lien, ressenti, note)"}</Texte>
      </TouchableOpacity>
      {plus && (
        <View>
          <Surtitre>SOURCE</Surtitre>
          <View style={styles.pastilles}>
            {SOURCES.map((s) => (
              <Pastille
                key={s.cle}
                actif={source === s.cle}
                libelle={s.nom}
                onPress={() => setSource(source === s.cle ? "" : s.cle)}
              />
            ))}
          </View>
          <ChampTexte
            style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
            placeholder="Lien de la vidéo (facultatif)"
            placeholderTextColor={t.textMuted}
            value={lien}
            onChangeText={setLien}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Surtitre>RESSENTI</Surtitre>
          <View style={styles.pastilles}>
            {RESSENTIS.map((r) => (
              <Pastille
                key={r.cle}
                actif={ressenti === r.cle}
                libelle={r.nom}
                onPress={() => setRessenti(ressenti === r.cle ? "" : r.cle)}
              />
            ))}
          </View>
          <ChampTexte
            style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
            placeholder="Une note (facultatif)"
            placeholderTextColor={t.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>
      )}
    </FeuilleBas>
  );
}

// ─── Skills : noter un essai, valider à la main ─────────────────────────

/** Pastilles de date : aujourd'hui, hier, avant-hier. */
function ChoixDate({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const jours = [
    { d: getAujourdhui(), n: "Aujourd'hui" },
    { d: decalerJours(getAujourdhui(), -1), n: "Hier" },
    { d: decalerJours(getAujourdhui(), -2), n: "Avant-hier" },
  ];
  return (
    <View style={styles.pastilles}>
      {jours.map((j) => (
        <Pastille key={j.d} actif={date === j.d} libelle={j.n} onPress={() => onChange(j.d)} />
      ))}
    </View>
  );
}

/**
 * « Noter un essai » : N séries de X répétitions (ou secondes) à l'étape en
 * cours d'un skill. Compte comme une séance pour « 2 séances réussies ».
 */
export function FeuilleEssai({
  skillId,
  onFermer,
  onFini,
}: {
  skillId: string | null;
  onFermer: () => void;
  onFini: () => void;
}) {
  const t = useTheme();
  const s = skillId ? skillDe(skillId) : undefined;
  const [etape, setEtape] = useState<{ numero: number; nom: string; critere: string; series: number; objectif: number; unite: string } | null>(null);
  const [series, setSeries] = useState(3);
  const [valeur, setValeur] = useState(5);
  const [date, setDate] = useState(getAujourdhui());
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!skillId || !s) return;
    let actif = true;
    ficheSkill(skillId).then((f) => {
      if (!actif) return;
      const e = s.etapes[f.etat.etape - 1];
      if (!e) return setEtape(null);
      setEtape({ numero: f.etat.etape, nom: e.nom, critere: critere(e), series: e.series, objectif: e.objectif, unite: e.unite });
      setSeries(e.series);
      setValeur(e.objectif);
      setDate(getAujourdhui());
    });
    return () => {
      actif = false;
    };
  }, [skillId, s]);

  const secondes = etape?.unite === "s";
  const enregistrer = async () => {
    if (!skillId || enCours) return;
    setEnCours(true);
    try {
      const r = await noterEssai(skillId, series, valeur, date);
      onFermer();
      onFini();
      const lignes = [
        r.points > 0 ? `+${r.points} pts` : null,
        r.proposition ? "Réussi 2 fois : tu peux valider l'étape." : null,
      ].filter(Boolean);
      Alert.alert("Essai noté", lignes.length ? lignes.join("\n") : undefined);
    } catch (e) {
      Alert.alert("L'enregistrement a échoué", String(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <FeuilleBas visible={!!skillId && !!etape} titre="Noter un essai" onFermer={onFermer}>
      {etape && s && (
        <>
          <Texte style={[styles.sous, { color: t.textSecondary }]}>
            {s.nom} · {etape.nom} ({etape.critere})
          </Texte>
          <Surtitre>SÉRIES</Surtitre>
          <View style={{ alignItems: "center" }}>
            <PlusMoins
              valeur={`${series}`}
              libelle="Nombre de séries"
              onPas={(sens) => setSeries((n) => Math.max(1, Math.min(6, n + sens)))}
            />
          </View>
          <Surtitre>{secondes ? "SECONDES PAR SÉRIE" : "RÉPÉTITIONS PAR SÉRIE"}</Surtitre>
          <View style={{ alignItems: "center" }}>
            <PlusMoins
              valeur={secondes ? `${valeur} s` : `${valeur}`}
              libelle={secondes ? "Secondes par série" : "Répétitions par série"}
              onPas={(sens) => setValeur((v) => Math.max(1, Math.min(300, v + sens)))}
            />
          </View>
          <View style={[styles.pastilles, { justifyContent: "center" }]}>
            {[...new Set([Math.max(1, etape.objectif - 2), etape.objectif, etape.objectif + 2, etape.objectif + 5])].map((v) => (
              <Pastille key={v} actif={valeur === v} libelle={secondes ? `${v} s` : `${v}`} onPress={() => setValeur(v)} />
            ))}
          </View>
          <Surtitre>QUAND</Surtitre>
          <ChoixDate date={date} onChange={setDate} />
          <TouchableOpacity
            onPress={enregistrer}
            disabled={enCours}
            style={[styles.bouton, { backgroundColor: t.accent }]}
            accessibilityRole="button"
          >
            <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>
              Enregistrer {series} × {secondes ? `${valeur} s` : valeur}
            </Texte>
          </TouchableOpacity>
        </>
      )}
    </FeuilleBas>
  );
}

/** « ✓ C'est acquis » : valide l'étape en cours à la main, avec la date. */
export function FeuilleAcquis({
  skillId,
  onFermer,
  onFini,
}: {
  skillId: string | null;
  onFermer: () => void;
  onFini: () => void;
}) {
  const t = useTheme();
  const s = skillId ? skillDe(skillId) : undefined;
  const [etape, setEtape] = useState<{ numero: number; nom: string } | null>(null);
  const [date, setDate] = useState(getAujourdhui());
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!skillId || !s) return;
    let actif = true;
    ficheSkill(skillId).then((f) => {
      if (!actif) return;
      const e = s.etapes[f.etat.etape - 1];
      setEtape(e ? { numero: f.etat.etape, nom: e.nom } : null);
      setDate(getAujourdhui());
    });
    return () => {
      actif = false;
    };
  }, [skillId, s]);

  const valider = async () => {
    if (!skillId || !s || enCours) return;
    setEnCours(true);
    try {
      const r = await validerManuellement(skillId, date);
      onFermer();
      onFini();
      if (r.maitrise) Alert.alert(`${s.nom} maîtrisé !`, r.points ? `+${r.points} pts` : undefined);
      else if (r.points) Alert.alert("Étape acquise", `+${r.points} pts`);
    } catch (e) {
      Alert.alert("La validation a échoué", String(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <FeuilleBas visible={!!skillId && !!etape} titre="C'est acquis ?" onFermer={onFermer}>
      {etape && s && (
        <>
          <Texte style={[styles.sous, { color: t.textSecondary }]}>
            {s.nom} : l&apos;étape {etape.numero} « {etape.nom} » est validée, et on passe à la suivante.
          </Texte>
          <Surtitre>ACQUISE LE</Surtitre>
          <ChoixDate date={date} onChange={setDate} />
          <TouchableOpacity
            onPress={valider}
            disabled={enCours}
            style={[styles.bouton, { backgroundColor: t.accent }]}
            accessibilityRole="button"
          >
            <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>✓ C&apos;est acquis</Texte>
          </TouchableOpacity>
          <TouchableOpacity onPress={onFermer} style={{ alignItems: "center", marginTop: spacing.md }} hitSlop={8}>
            <Texte style={[styles.lien, { color: t.textMuted }]}>Pas encore</Texte>
          </TouchableOpacity>
        </>
      )}
    </FeuilleBas>
  );
}

// ─── Réglage : routine cochée quand je fais du sport ────────────────────

/**
 * Carte du réglage « Routine cochée quand je fais du sport » : aucune par
 * défaut ; « Callisthenie » est proposée si elle existe, jamais choisie d'office.
 */
export function CarteRoutineLiee() {
  const t = useTheme();
  const [liee, setLiee] = useState<number | null>(null);
  const [routines, setRoutines] = useState<{ id: number; nom: string }[]>([]);
  const [proposee, setProposee] = useState<{ id: number; nom: string } | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const charger = useCallback(async () => {
    setLiee(await getRoutineLiee());
    setRoutines(await routinesDisponibles());
    setProposee(await routineProposee());
  }, []);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const choisir = async (id: number | null) => {
    await definirRoutineLiee(id);
    setOuvert(false);
    await charger();
  };
  const nom = routines.find((r) => r.id === liee)?.nom;

  return (
    <View style={[styles.carteReglage, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: 0 }]}>ROUTINE COCHÉE QUAND JE FAIS DU SPORT</Texte>
      <TouchableOpacity onPress={() => setOuvert(true)} accessibilityRole="button" hitSlop={6}>
        <Texte style={[styles.reglageNom, { color: nom ? t.textPrimary : t.textMuted }]}>{nom ?? "Aucune"} ›</Texte>
      </TouchableOpacity>
      {liee === null && proposee && (
        <TouchableOpacity onPress={() => choisir(proposee.id)} hitSlop={8} style={{ marginTop: spacing.sm }}>
          <Texte style={[styles.lien, { color: t.accentText }]}>Proposée : « {proposee.nom} » · l&apos;utiliser</Texte>
        </TouchableOpacity>
      )}
      <FeuilleBas visible={ouvert} titre="Routine cochée avec le sport" onFermer={() => setOuvert(false)}>
        <Texte style={[styles.sous, { color: t.textSecondary }]}>
          Une séance notée, guidée ou un essai de skill la coche pour le jour de la séance.
        </Texte>
        <View style={{ marginTop: spacing.md }}>
          {[{ id: null, nom: "Aucune" }, ...routines].map((r) => (
            <TouchableOpacity
              key={r.id ?? "aucune"}
              onPress={() => choisir(r.id)}
              style={[styles.ligneChoix, { borderTopColor: t.border }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: r.id === liee }}
            >
              <Texte style={[styles.reglageNom, { color: r.id === liee ? t.accentText : t.textPrimary }]}>
                {r.id === liee ? "✓ " : ""}
                {r.nom}
              </Texte>
            </TouchableOpacity>
          ))}
        </View>
      </FeuilleBas>
    </View>
  );
}

const styles = StyleSheet.create({
  carteReglage: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.xl },
  reglageNom: { fontSize: typography.body, fontWeight: "600" },
  ligneChoix: { borderTopWidth: 1, paddingVertical: spacing.md },
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: {
    maxHeight: "88%",
    borderTopLeftRadius: radius.lg * 2,
    borderTopRightRadius: radius.lg * 2,
    borderWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  poignee: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  titre: { fontSize: typography.h3, fontWeight: "700", textAlign: "center", marginBottom: spacing.sm },
  sous: { fontSize: typography.small, lineHeight: 19, textAlign: "center" },
  surtitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pastille: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  pastilleTexte: { fontSize: typography.small, fontWeight: "600" },
  lien: { fontSize: typography.small, fontWeight: "600" },
  champ: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    marginTop: spacing.sm,
  },
  bouton: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.xl },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
});
