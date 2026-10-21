import { useFocusEffect, useRouter } from "expo-router";
import { Check, Lock, Settings } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FigureSkill, GRIS, Segments, VERT } from "../components/FigureSkill";
import { CarteRoutineLiee, FeuilleEssai } from "../components/FeuillesSport";
import { BoutonOptions } from "../components/Options";
import { MaterielEditeur } from "../components/MaterielEditeur";
import { OngletExercices } from "../components/OngletExercices";
import { OngletPlan } from "../components/OngletPlan";
import { OngletSeances } from "../components/OngletSeances";
import { Texte } from "../components/Texte";
import {
  configurerSport,
  ficheSkill,
  getEtats,
  getReglages,
  mettreAJourNiveau,
  refuserValidation,
  validerEtape,
  type Reglages,
} from "../lib/db/sport";
import { ecrireMateriel, getMateriel, materielConfigure } from "../lib/db/sport-materiel";
import { MATERIEL_DEFAUT, type Materiel } from "../lib/materiel";
import { critere, NIVEAUX, SKILLS, statut, type EtatSkill, type Statut } from "../lib/skills";
import { radius, spacing, typography, useTheme } from "../lib/theme";

/**
 * Sport, quatre parties. Skills : l'arbre par niveau, où j'en suis sur chacun, et les étapes prêtes à valider
 * (premier lancement : mon matériel, puis « où tu en es ? »). Workout : séances guidées (components/OngletSeances).
 * Exercices : la bibliothèque (components/OngletExercices). Plan : le coach (à venir). ⚙️ : mon matériel.
 */
export default function Skills() {
  const router = useRouter();
  const t = useTheme();
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [etats, setEtats] = useState<Record<string, EtatSkill>>({});
  const [aValider, setAValider] = useState<string[]>([]);
  /** Skill dont on note un essai (appui long ou « ⋯ » sur sa carte). */
  const [essaiPour, setEssaiPour] = useState<string | null>(null);
  /** « Mettre à jour mon niveau » : l'étape choisie pour chaque skill, null = fermé. */
  const [niveau, setNiveau] = useState<Record<string, number> | null>(null);
  const [onglet, setOnglet] = useState<"skills" | "workout" | "exercices" | "plan">("skills");
  /** Mon matériel : celui qui filtre tout le sport, et le brouillon en cours de réglage (⚙️ ou premier lancement). */
  const [materiel, setMateriel] = useState<Materiel>(MATERIEL_DEFAUT);
  const [materielOk, setMaterielOk] = useState(true);
  const [brouillon, setBrouillon] = useState<Materiel | null>(null);
  const [reglageOuvert, setReglageOuvert] = useState(false);

  // Premier lancement
  const [depart, setDepart] = useState<Record<string, number | "inconnu">>({});

  const charger = useCallback(async () => {
    const r = await getReglages();
    const e = await getEtats();
    setReglages(r);
    setEtats(e);
    const m = await getMateriel();
    setMateriel(m);
    setBrouillon((b) => b ?? m);
    setMaterielOk(await materielConfigure());
    const prets: string[] = [];
    for (const s of SKILLS) {
      if (statut(s, e, r.barre) === "en_cours" && (await ficheSkill(s.id)).proposition) prets.push(s.id);
    }
    setAValider(prets);
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const puce = (actif: boolean, libelle: string, onPress: () => void) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[
        styles.puce,
        { backgroundColor: actif ? t.accent : t.bgApp, borderColor: actif ? t.accent : t.border },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={[styles.puceTexte, { color: actif ? t.textOnAccent : t.textSecondary }]}>
        {libelle}
      </Texte>
    </TouchableOpacity>
  );

  const entete = (
    <>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <View style={styles.entete}>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Sport</Texte>
        <View style={styles.enteteDroite}>
          {reglages?.configure && onglet === "skills" && (
            <TouchableOpacity
              onPress={() => router.push("/seance")}
              style={[styles.seance, { backgroundColor: t.accent }]}
            >
              <Texte style={[styles.seanceTexte, { color: t.textOnAccent }]}>Séance</Texte>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setBrouillon(materiel);
              setReglageOuvert(true);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Mon matériel"
          >
            <Settings color={t.textSecondary} size={22} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.onglets, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        {(
          [
            ["skills", "Skills"],
            ["workout", "Workout"],
            ["exercices", "Exercices"],
            ["plan", "Plan"],
          ] as const
        ).map(([cle, libelle]) => (
          <TouchableOpacity
            key={cle}
            onPress={() => setOnglet(cle)}
            style={[styles.onglet, onglet === cle && { backgroundColor: t.accent }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: onglet === cle }}
          >
            <Texte style={[styles.ongletTexte, { color: onglet === cle ? t.textOnAccent : t.textSecondary }]}>
              {libelle}
            </Texte>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const feuilleMateriel = (
    <Modal visible={reglageOuvert} transparent animationType="slide" onRequestClose={() => setReglageOuvert(false)}>
      <Pressable style={styles.fond} onPress={() => setReglageOuvert(false)}>
        <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.question, { color: t.textPrimary }]}>Mon matériel</Texte>
          <Texte style={[styles.aide, { color: t.textMuted }]}>Les exercices, skills et séances se règlent sur ce que tu as.</Texte>
          <ScrollView style={{ maxHeight: 460 }}>{brouillon && <MaterielEditeur materiel={brouillon} onChange={setBrouillon} />}</ScrollView>
          <TouchableOpacity
            style={[styles.bouton, { backgroundColor: t.accent }]}
            onPress={async () => {
              if (brouillon) await ecrireMateriel(brouillon);
              setReglageOuvert(false);
              await charger();
            }}
          >
            <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Enregistrer</Texte>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (onglet === "workout") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
        {entete}
        <OngletSeances />
        <CarteRoutineLiee />
        {feuilleMateriel}
      </ScrollView>
    );
  }

  if (onglet === "exercices") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {entete}
        {!materielOk && (
          <TouchableOpacity
            onPress={() => {
              setBrouillon(materiel);
              setReglageOuvert(true);
            }}
            style={[styles.carte, { backgroundColor: t.bgCardActive, borderColor: t.accent }]}
            accessibilityRole="button"
          >
            <Texte style={[styles.question, { color: t.textPrimary }]}>Règle ton matériel</Texte>
            <Texte style={[styles.aide, { color: t.textMuted, marginTop: 0 }]}>
              Haltères, parallettes, barre… Les exercices dont il manque le matériel sont grisés, avec une alternative.
            </Texte>
          </TouchableOpacity>
        )}
        <OngletExercices materiel={materiel} />
        {feuilleMateriel}
      </ScrollView>
    );
  }

  if (onglet === "plan") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
        {entete}
        <OngletPlan />
        {feuilleMateriel}
      </ScrollView>
    );
  }

  // Mettre à jour mon niveau : l'étape de chaque skill débloqué, plusieurs à la fois.
  if (niveau && reglages) {
    const modifiables = SKILLS.filter((s) => statut(s, etats, reglages.barre) !== "verrouille");
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
        <TouchableOpacity onPress={() => setNiveau(null)} hitSlop={12}>
          <Texte style={[styles.retour, { color: t.accentText }]}>← Annuler</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Mettre à jour mon niveau</Texte>
        <Texte style={[styles.aide, { color: t.textMuted }]}>
          Choisis l&apos;étape que tu ne réussis pas encore, pour chaque skill. Aucun point n&apos;est donné.
        </Texte>
        {NIVEAUX.map((niv) => {
          const liste = modifiables.filter((s) => s.niveau === niv.cle);
          if (liste.length === 0) return null;
          return (
            <View key={niv.cle}>
              <Texte style={[styles.surtitre, { color: t.textMuted }]}>{niv.nom.toUpperCase()}</Texte>
              {liste.map((s) => (
                <View key={s.id} style={{ marginTop: spacing.md }}>
                  <Texte style={[styles.nomFondation, { color: t.textSecondary }]}>{s.nom}</Texte>
                  <View style={styles.puces}>
                    {s.etapes.map((e, i) =>
                      puce(niveau[s.id] === i + 1, `${i + 1}. ${e.nom} · ${critere(e)}`, () =>
                        setNiveau({ ...niveau, [s.id]: i + 1 }),
                      ),
                    )}
                    {puce(niveau[s.id] === s.etapes.length + 1, "Maîtrisé", () =>
                      setNiveau({ ...niveau, [s.id]: s.etapes.length + 1 }),
                    )}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        <TouchableOpacity
          style={[styles.bouton, { backgroundColor: t.accent }]}
          onPress={async () => {
            await mettreAJourNiveau(niveau);
            setNiveau(null);
            await charger();
          }}
        >
          <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Enregistrer</Texte>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (reglages && !reglages.configure) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
        {entete}
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {!materielOk ? (
            <>
              <Texte style={[styles.question, { color: t.textPrimary }]}>Quel matériel as-tu ?</Texte>
              <Texte style={[styles.aide, { color: t.textMuted, marginTop: 0, marginBottom: spacing.md }]}>
                Tu pourras le changer quand tu veux avec ⚙️. Les skills qui demandent une barre restent visibles, grisés.
              </Texte>
              {brouillon && <MaterielEditeur materiel={brouillon} onChange={setBrouillon} />}
              <TouchableOpacity
                style={[styles.bouton, { backgroundColor: t.accent }]}
                onPress={async () => {
                  if (brouillon) await ecrireMateriel(brouillon);
                  await charger();
                }}
              >
                <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Continuer</Texte>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Texte style={[styles.question, { color: t.textPrimary }]}>Où en es-tu ?</Texte>
              {SKILLS.filter((s) => s.niveau === "fondation" && (materiel.dispo.barre || !s.barre)).map((s) => (
                <View key={s.id} style={{ marginTop: spacing.md }}>
                  <Texte style={[styles.nomFondation, { color: t.textSecondary }]}>{s.nom}</Texte>
                  <View style={styles.puces}>
                    {puce((depart[s.id] ?? "inconnu") === "inconnu", "Je ne sais pas", () =>
                      setDepart({ ...depart, [s.id]: "inconnu" }),
                    )}
                    {s.etapes.map((e, i) =>
                      puce(depart[s.id] === i + 1, `${i + 1}. ${e.nom} · ${critere(e)}`, () =>
                        setDepart({ ...depart, [s.id]: i + 1 }),
                      ),
                    )}
                    {puce(depart[s.id] === s.etapes.length + 1, "Déjà maîtrisé", () =>
                      setDepart({ ...depart, [s.id]: s.etapes.length + 1 }),
                    )}
                  </View>
                </View>
              ))}
              <Texte style={[styles.aide, { color: t.textMuted }]}>
                Choisis l&apos;étape que tu ne réussis pas encore.
              </Texte>
              <TouchableOpacity
                style={[styles.bouton, { backgroundColor: t.accent }]}
                onPress={async () => {
                  await configurerSport(materiel.dispo.barre, depart);
                  await charger();
                }}
              >
                <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>C&apos;est parti</Texte>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  if (!reglages) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;

  const statuts = Object.fromEntries(SKILLS.map((s) => [s.id, statut(s, etats, reglages.barre)]));
  const compte = (st: Statut) => SKILLS.filter((s) => statuts[s.id] === st).length;

  const valider = async (id: string) => {
    const r = await validerEtape(id);
    const s = SKILLS.find((x) => x.id === id)!;
    if (r.maitrise) Alert.alert(`${s.nom} maîtrisé !`, r.points ? `+${r.points} pts` : undefined);
    await charger();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgApp }} contentContainerStyle={styles.contenu}>
      {entete}

      <View style={styles.pastilles}>
        {[
          { n: compte("maitrise"), libelle: "maîtrisés", couleur: VERT },
          { n: compte("en_cours"), libelle: "en cours", couleur: t.accent },
          { n: compte("verrouille"), libelle: "à débloquer", couleur: GRIS },
        ].map((p) => (
          <View key={p.libelle} style={[styles.pastille, { borderColor: p.couleur }]}>
            <Texte style={[styles.pastilleTexte, { color: p.couleur === GRIS ? t.textSecondary : p.couleur }]}>
              {p.n} {p.libelle}
            </Texte>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={() =>
          setNiveau(Object.fromEntries(SKILLS.map((s) => [s.id, etats[s.id]?.etape ?? 1])))
        }
        hitSlop={8}
        style={{ marginTop: spacing.md }}
        accessibilityRole="button"
      >
        <Texte style={[styles.lienNiveau, { color: t.accentText }]}>Mettre à jour mon niveau</Texte>
      </TouchableOpacity>

      {/* Étapes prêtes : objectif atteint 2 séances de suite */}
      {aValider.map((id) => {
        const s = SKILLS.find((x) => x.id === id)!;
        const e = s.etapes[(etats[id]?.etape ?? 1) - 1];
        return (
          <View key={id} style={[styles.carte, { backgroundColor: t.bgCardActive, borderColor: t.accent }]}>
            <Texte style={[styles.question, { color: t.textPrimary }]}>
              {s.nom} : « {e.nom} » réussie 2 séances de suite. Valider l&apos;étape ?
            </Texte>
            <View style={styles.puces}>
              {puce(true, "Valider", () => valider(id))}
              {puce(false, "Pas encore", async () => {
                await refuserValidation(id);
                await charger();
              })}
            </View>
          </View>
        );
      })}

      {NIVEAUX.map((niv) => (
        <View key={niv.cle}>
          <Texte style={[styles.surtitre, { color: t.textMuted }]}>{niv.nom.toUpperCase()}</Texte>
          <View style={styles.grille}>
            {SKILLS.filter((s) => s.niveau === niv.cle).map((s) => {
              const st = statuts[s.id];
              const e = etats[s.id] ?? { etape: 1, actif: false };
              const couleur = st === "maitrise" ? VERT : st === "verrouille" ? GRIS : t.accent;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => router.push(`/skill?id=${s.id}`)}
                  // Téléphone : appui long. Web : le « ⋯ » plus bas (l'appui long y est peu fiable).
                  onLongPress={st === "en_cours" && Platform.OS !== "web" ? () => setEssaiPour(s.id) : undefined}
                  accessibilityHint={st === "en_cours" ? "Appui long : noter un essai" : undefined}
                  style={[
                    styles.case,
                    st === "maitrise"
                      ? { backgroundColor: "#0B1A12", borderColor: "#1F4A30" }
                      : {
                          backgroundColor: t.bgCard,
                          borderColor: st === "en_cours" && e.actif ? t.accent : t.border,
                          opacity: st === "verrouille" ? 0.6 : 1,
                        },
                  ]}
                  accessibilityLabel={`${s.nom}, ${st === "maitrise" ? "maîtrisé" : st === "verrouille" ? "verrouillé" : `étape ${e.etape} sur ${s.etapes.length}`}`}
                >
                  {st === "maitrise" && (
                    <View style={[styles.badge, { backgroundColor: VERT }]}>
                      <Check color="#0B1A12" size={10} strokeWidth={3} />
                    </View>
                  )}
                  {st === "verrouille" && (
                    <View style={styles.badge}>
                      <Lock color={GRIS} size={12} strokeWidth={2.4} />
                    </View>
                  )}
                  {st === "en_cours" && (
                    <BoutonOptions
                      titre={s.nom}
                      style={styles.optionsCase}
                      options={[
                        { libelle: "Noter un essai", onPress: () => setEssaiPour(s.id) },
                        { libelle: "Ouvrir la fiche", onPress: () => router.push(`/skill?id=${s.id}`) },
                      ]}
                    />
                  )}
                  <FigureSkill skill={s.id} couleur={couleur} taille={42} />
                  <Texte style={[styles.caseNom, { color: t.textPrimary }]} numberOfLines={1}>
                    {s.nom}
                  </Texte>
                  <Segments skill={s} etape={e.etape} st={st} accent={t.accent} accentFonce={t.accentFonce} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      <Texte style={[styles.aide, { color: t.textMuted }]}>
        Liseré en couleur : les skills travaillés en séance (3 ou 4).
      </Texte>
      <CarteRoutineLiee />
      <FeuilleEssai skillId={essaiPour} onFermer={() => setEssaiPour(null)} onFini={charger} />
      {feuilleMateriel}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  enteteDroite: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  onglets: { flexDirection: "row", borderRadius: radius.pill, borderWidth: 1, padding: 3, marginTop: spacing.lg },
  onglet: { flex: 1, borderRadius: radius.pill, paddingVertical: spacing.sm, alignItems: "center" },
  ongletTexte: { fontSize: typography.bodySmall, fontWeight: "700" },
  seance: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  seanceTexte: { fontSize: typography.bodySmall, fontWeight: "700" },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  pastille: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pastilleTexte: { fontSize: typography.small, fontWeight: "700" },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.md },
  question: { fontSize: typography.body, fontWeight: "600" },
  nomFondation: { fontSize: typography.small, fontWeight: "700" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  puceTexte: { fontSize: typography.small, fontWeight: "600" },
  aide: { fontSize: typography.tiny, marginTop: spacing.md },
  bouton: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
  surtitre: {
    fontSize: typography.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  case: {
    width: "23%",
    height: 104,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  caseNom: { fontSize: 11, fontWeight: "600" },
  optionsCase: { position: "absolute", top: -4, right: -4, zIndex: 2 },
  lienNiveau: { fontSize: typography.small, fontWeight: "600" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
