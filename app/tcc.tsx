import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FeuilleSeance } from "../components/FeuilleSeance";
import { MenuOptions } from "../components/MenuOptions";
import type { Option } from "../components/Options";
import { PlusMoins } from "../components/PlusMoins";
import { ChampTexte, Texte } from "../components/Texte";
import { VisageHumeur } from "../components/VisageHumeur";
import { useJourCourant } from "../hooks/useJourCourant";
import { listerPensees, majPensee, type Pensee } from "../lib/db/esprit";
import {
  ajouterADire,
  ajouterExerciceTcc,
  ajouterSeanceTcc,
  basculerExerciceTcc,
  cocherADire,
  exercicesFaitsEntre,
  exercicesTcc,
  listerADire,
  modifierExerciceTcc,
  resumeAvantSeance,
  retirerExerciceTcc,
  seancesTcc,
  supprimerADire,
  supprimerSeanceTcc,
  type ADire,
} from "../lib/db/tcc";
import {
  bandeauSeance,
  couleurHumeur,
  progressionExercice,
  prochaineSeance,
  type ExerciceTcc,
  type SeanceTcc,
} from "../lib/esprit-regles";
import { partagerTexte } from "../lib/partage-texte";
import { programmerRappelSeance } from "../lib/rappels-esprit";
import { semaineDe } from "../lib/regles-taches";
import { dateCourte, texteResume, type Resume } from "../lib/tcc-resume";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const LIENS: { cle: string; libelle: string; route: string; bouton: string }[] = [
  { cle: "journal", libelle: "Journal", route: "/pensee", bouton: "Noter une pensée" },
  { cle: "respiration", libelle: "Respiration", route: "/mediter?id=carre", bouton: "Respirer" },
  { cle: "meditation", libelle: "Méditation", route: "/mediter", bouton: "Méditer" },
];

const apres = (f: () => void) => setTimeout(f, 350);

type Saisie = { id?: number; nom: string; consigne: string; freq_type: "jour" | "semaine"; freq_n: number; lien: string } | null;

/** Ma TCC : la prochaine séance, les exercices de ma psy, ce que je veux lui dire, et le résumé avant la séance. */
export default function Tcc() {
  const router = useRouter();
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [seances, setSeances] = useState<SeanceTcc[]>([]);
  const [exercices, setExercices] = useState<ExerciceTcc[]>([]);
  const [faits, setFaits] = useState<{ exercice_id: number; jour: string }[]>([]);
  const [aDire, setADire] = useState<ADire[]>([]);
  const [marquees, setMarquees] = useState<Pensee[]>([]);
  const [resume, setResume] = useState<{ seance: SeanceTcc | null; resume: Resume } | null>(null);
  const [nouvelleSeance, setNouvelleSeance] = useState(false);
  const [saisie, setSaisie] = useState<Saisie>(null);
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState<{ titre: string; options: Option[] }>({ titre: "", options: [] });
  const [message, setMessage] = useState<string | null>(null);

  const semaine = semaineDe(aujourdhui);

  const charger = useCallback(async () => {
    const s = await seancesTcc();
    setSeances(s);
    setExercices(await exercicesTcc());
    setFaits(await exercicesFaitsEntre(semaine[0], semaine[6]));
    setADire(await listerADire());
    setMarquees((await listerPensees()).filter((p) => p.a_dire === 1));
    setResume(await resumeAvantSeance());
    await programmerRappelSeance(prochaineSeance(s, aujourdhui)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aujourdhui]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const prochaine = prochaineSeance(seances, aujourdhui);

  const ajouterNote = async () => {
    await ajouterADire(note, "note");
    setNote("");
    await charger();
  };

  const partager = async () => {
    if (!resume) return;
    const r = await partagerTexte(texteResume(resume.resume), "Résumé avant ma séance");
    setMessage(r === "copie" ? "Résumé copié." : null);
  };

  const enregistrerExercice = async (s: NonNullable<Saisie>) => {
    setSaisie(null);
    const e = { nom: s.nom, consigne: s.consigne, freq_type: s.freq_type, freq_n: s.freq_n, lien: s.lien };
    if (s.id) await modifierExerciceTcc(s.id, e);
    else await ajouterExerciceTcc(e);
    await charger();
  };

  const optionsExercice = (e: ExerciceTcc): Option[] => [
    { libelle: "Modifier", onPress: () => apres(() => setSaisie({ ...e })) },
    {
      libelle: "Retirer de ma liste",
      danger: true,
      onPress: async () => {
        await retirerExerciceTcc(e.id);
        await charger();
      },
    },
  ];

  const etiquette = (x: string) => <Texte style={[styles.etiquette, { color: t.textMuted }]}>{x}</Texte>;

  const r = resume?.resume;
  const courbe = r?.courbe ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginBottom: spacing.sm }}>← Retour</Texte>
        </TouchableOpacity>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>Ma TCC</Texte>

        {/* Prochaine séance */}
        {etiquette("PROCHAINE SÉANCE")}
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {prochaine ? (
            <>
              <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>
                {dateCourte(prochaine.date)} · {prochaine.heure}
              </Texte>
              <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 2 }}>
                {bandeauSeance(prochaine, aujourdhui) ?? (Platform.OS === "web" ? "Je te le rappelle ici la veille, à l'ouverture de l'appli." : "Rappel la veille à 18 h.")}
              </Texte>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setNouvelleSeance(true)} hitSlop={8}>
                  <Texte style={{ color: t.accentText, fontSize: typography.small }}>Changer</Texte>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    await supprimerSeanceTcc(prochaine.id);
                    await charger();
                  }}
                  hitSlop={8}
                >
                  <Texte style={{ color: t.danger, fontSize: typography.small }}>Retirer</Texte>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setNouvelleSeance(true)} accessibilityRole="button">
              <Texte style={{ color: t.accentText, fontSize: typography.body }}>＋ Noter ma prochaine séance</Texte>
            </TouchableOpacity>
          )}
        </View>

        {/* Exercices */}
        {etiquette("LES EXERCICES DE MA PSY")}
        {exercices.length === 0 && (
          <Texte style={{ color: t.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
            Ajoute ici ce qu&apos;elle t&apos;a demandé de faire entre les séances.
          </Texte>
        )}
        {exercices.map((e) => {
          const mesFaits = faits.filter((f) => f.exercice_id === e.id).map((f) => f.jour);
          const p = progressionExercice(e, mesFaits, semaine);
          const faitAujourdhui = mesFaits.includes(aujourdhui);
          const lien = LIENS.find((l) => l.cle === e.lien);
          return (
            <TouchableOpacity
              key={e.id}
              activeOpacity={0.85}
              onLongPress={() => setMenu({ titre: e.nom, options: optionsExercice(e) })}
              style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}
              accessibilityHint="Appui long : modifier ou retirer"
            >
              <View style={styles.ligne}>
                <TouchableOpacity
                  onPress={async () => {
                    await basculerExerciceTcc(e.id, aujourdhui);
                    await charger();
                  }}
                  hitSlop={8}
                  style={[styles.case, { borderColor: t.accent, backgroundColor: faitAujourdhui ? t.accent : "transparent" }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: faitAujourdhui }}
                  accessibilityLabel={e.nom}
                >
                  {faitAujourdhui && <Texte style={{ color: t.bgApp, fontWeight: "700" }}>✓</Texte>}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>{e.nom}</Texte>
                  {e.consigne ? <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>{e.consigne}</Texte> : null}
                </View>
              </View>
              <View style={[styles.ligne, { marginTop: spacing.sm }]}>
                <View style={styles.pastilles} accessibilityLabel="Progression de la semaine">
                  {Array.from({ length: p.cible }, (_, k) => (
                    <View key={k} style={[styles.pastille, { backgroundColor: k < p.faits ? t.accent : "transparent", borderColor: k < p.faits ? t.accent : t.border }]} />
                  ))}
                </View>
                {lien && (
                  <TouchableOpacity onPress={() => router.push(lien.route as never)} hitSlop={8} accessibilityRole="button">
                    <Texte style={{ color: t.accentText, fontSize: typography.small }}>{lien.bouton} ›</Texte>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => setSaisie({ nom: "", consigne: "", freq_type: "jour", freq_n: 3, lien: "" })} hitSlop={8} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontSize: typography.body, marginVertical: spacing.sm }}>＋ Un exercice</Texte>
        </TouchableOpacity>

        {/* À dire en séance */}
        {etiquette("À DIRE EN SÉANCE")}
        <View style={styles.ligne}>
          <ChampTexte
            value={note}
            onChangeText={setNote}
            onSubmitEditing={ajouterNote}
            returnKeyType="done"
            placeholder="Une note rapide"
            placeholderTextColor={t.textMuted}
            style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard, flex: 1 }]}
          />
          <TouchableOpacity onPress={ajouterNote} disabled={!note.trim()} style={[styles.ajout, { backgroundColor: t.accent, opacity: note.trim() ? 1 : 0.4 }]} accessibilityRole="button" accessibilityLabel="Ajouter la note">
            <Texte style={{ color: t.textOnAccent, fontSize: 22, lineHeight: 26 }}>+</Texte>
          </TouchableOpacity>
        </View>
        {marquees.map((p) => (
          <View key={`p${p.id}`} style={[styles.note, { borderColor: t.border }]}>
            <TouchableOpacity
              onPress={async () => {
                await majPensee(p.id, { a_dire: 2 });
                await charger();
              }}
              hitSlop={8}
              style={[styles.case, { borderColor: t.textMuted }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel="Abordé en séance"
            />
            <Texte style={{ color: t.textPrimary, fontSize: typography.bodySmall, flex: 1 }} numberOfLines={2}>
              Journal · {p.pensee || p.situation || dateCourte(p.jour)}
            </Texte>
          </View>
        ))}
        {aDire.map((a) => (
          <View key={a.id} style={[styles.note, { borderColor: t.border }]}>
            <TouchableOpacity
              onPress={async () => {
                await cocherADire(a.id, !a.fait);
                await charger();
              }}
              hitSlop={8}
              style={[styles.case, { borderColor: t.textMuted, backgroundColor: a.fait ? t.textMuted : "transparent" }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!a.fait }}
              accessibilityLabel="Abordé en séance"
            >
              {!!a.fait && <Texte style={{ color: t.bgApp, fontWeight: "700" }}>✓</Texte>}
            </TouchableOpacity>
            <Texte
              style={{ color: a.fait ? t.textMuted : t.textPrimary, fontSize: typography.bodySmall, flex: 1, textDecorationLine: a.fait ? "line-through" : "none" }}
              numberOfLines={3}
            >
              {a.texte}
            </Texte>
            <TouchableOpacity
              onPress={() =>
                Alert.alert("Supprimer cette note ?", undefined, [
                  { text: "Garder", style: "cancel" },
                  {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                      await supprimerADire(a.id);
                      await charger();
                    },
                  },
                ])
              }
              hitSlop={8}
              accessibilityLabel="Supprimer la note"
            >
              <Texte style={{ color: t.textMuted, fontSize: 18 }}>✕</Texte>
            </TouchableOpacity>
          </View>
        ))}

        {/* Résumé avant la séance */}
        {r && (
          <>
            {etiquette(resume?.seance ? `AVANT MA SÉANCE DU ${dateCourte(resume.seance.date).toUpperCase()}` : "DEPUIS MA DERNIÈRE SÉANCE")}
            <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Texte style={{ color: t.textMuted, fontSize: typography.small }}>
                Du {dateCourte(r.debut)} au {dateCourte(r.fin)}
              </Texte>
              {r.moyenneHumeur === null ? (
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.sm }}>Aucune humeur notée sur cette période.</Texte>
              ) : (
                <>
                  <View style={[styles.ligne, { marginTop: spacing.sm }]}>
                    <VisageHumeur niveau={r.moyenneHumeur} taille={40} />
                    <Texte style={{ color: t.textPrimary, fontSize: typography.body, flex: 1 }}>
                      Humeur moyenne : {String(r.moyenneHumeur).replace(".", ",")} sur 5 ({r.humeurs.length} notes)
                    </Texte>
                  </View>
                  <View style={styles.courbe}>
                    {courbe.map((c) => (
                      <View key={c.jour} style={styles.barre}>
                        {c.moy !== null && <View style={{ height: `${(c.moy / 5) * 100}%`, backgroundColor: couleurHumeur(c.moy), borderRadius: 2 }} />}
                      </View>
                    ))}
                  </View>
                </>
              )}
              {r.emotions.length > 0 && (
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.sm }}>
                  Émotions les plus fréquentes : {r.emotions.map(([e, n]) => `${e} (${n})`).join(", ")}
                </Texte>
              )}
              {r.pensees.length > 0 && (
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.sm }}>
                  À voir ensemble ({r.pensees.length}) : {r.pensees.map((p) => p.pensee || "entrée sans texte").join(" · ")}
                </Texte>
              )}
              {r.exercices.length > 0 && (
                <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.sm }}>
                  Exercices faits : {r.exercices.map((x) => `${x.nom} (${x.faits})`).join(", ")}
                </Texte>
              )}
              <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>
                Sommeil : {r.sommeil.nuits === 0 ? "rien de noté" : `${r.sommeil.nuits} nuits, ${Math.floor((r.sommeil.moyenneMin ?? 0) / 60)} h ${String((r.sommeil.moyenneMin ?? 0) % 60).padStart(2, "0")} en moyenne`} · Sport : {r.sport.jours} jour{r.sport.jours > 1 ? "s" : ""}
              </Texte>
              <TouchableOpacity onPress={partager} style={[styles.partager, { borderColor: t.accent }]} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontWeight: "600" }}>Partager ce résumé</Texte>
              </TouchableOpacity>
              {message && <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>{message}</Texte>}
            </View>
          </>
        )}
      </ScrollView>

      <FeuilleSeance
        visible={nouvelleSeance}
        aujourdhui={aujourdhui}
        onFermer={() => setNouvelleSeance(false)}
        onValider={async (date, heure) => {
          setNouvelleSeance(false);
          if (prochaine) await supprimerSeanceTcc(prochaine.id); // « Changer » remplace la prochaine
          await ajouterSeanceTcc(date, heure);
          await charger();
        }}
      />
      <MenuOptions titre={menu.titre} options={menu.options} onFermer={() => setMenu({ titre: "", options: [] })} />
      <FormulaireExercice saisie={saisie} onEnregistrer={enregistrerExercice} onFermer={() => setSaisie(null)} />
    </View>
  );
}

function FormulaireExercice({ saisie, onEnregistrer, onFermer }: { saisie: Saisie; onEnregistrer: (s: NonNullable<Saisie>) => void; onFermer: () => void }) {
  return saisie ? <Formulaire saisie={saisie} onEnregistrer={onEnregistrer} onFermer={onFermer} /> : null;
}

function Formulaire({ saisie, onEnregistrer, onFermer }: { saisie: NonNullable<Saisie>; onEnregistrer: (s: NonNullable<Saisie>) => void; onFermer: () => void }) {
  const t = useTheme();
  const [s, setS] = useState(saisie);
  const valide = s.nom.trim().length > 0;
  const puce = (actif: boolean, libelle: string, onPress: () => void) => (
    <TouchableOpacity key={libelle} onPress={onPress} style={[styles.puce, { borderColor: t.border }, actif && { backgroundColor: t.accentFonce }]} accessibilityRole="radio" accessibilityState={{ selected: actif }}>
      <Texte style={{ color: actif ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small }}>{libelle}</Texte>
    </TouchableOpacity>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.fond} onPress={onFermer}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>{s.id ? "Modifier l'exercice" : "Un exercice"}</Texte>
            <ChampTexte value={s.nom} onChangeText={(nom) => setS({ ...s, nom })} placeholder="Nom (ex : respiration)" placeholderTextColor={t.textMuted} autoFocus style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]} />
            <ChampTexte value={s.consigne} onChangeText={(consigne) => setS({ ...s, consigne })} placeholder="Consigne (ce qu'elle a demandé)" placeholderTextColor={t.textMuted} multiline style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp, marginTop: spacing.sm, minHeight: 64 }]} />
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>FRÉQUENCE</Texte>
            <View style={styles.puces}>
              {puce(s.freq_type === "jour", "Chaque jour", () => setS({ ...s, freq_type: "jour" }))}
              {puce(s.freq_type === "semaine", "Plusieurs fois par semaine", () => setS({ ...s, freq_type: "semaine" }))}
            </View>
            {s.freq_type === "semaine" && (
              <View style={[styles.ligne, { marginTop: spacing.md }]}>
                <PlusMoins valeur={`${s.freq_n} fois`} libelle="Fois par semaine" onPas={(sens) => setS((x) => ({ ...x, freq_n: Math.min(7, Math.max(1, x.freq_n + sens)) }))} />
              </View>
            )}
            <Texte style={[styles.etiquette, { color: t.textMuted }]}>RENVOIE VERS</Texte>
            <View style={styles.puces}>
              {puce(s.lien === "", "Rien", () => setS({ ...s, lien: "" }))}
              {LIENS.map((l) => puce(s.lien === l.cle, l.libelle, () => setS({ ...s, lien: l.cle })))}
            </View>
            <View style={[styles.ligne, { justifyContent: "space-between", marginTop: spacing.xl }]}>
              <TouchableOpacity onPress={onFermer} hitSlop={8}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => valide && onEnregistrer({ ...s, nom: s.nom.trim() })} disabled={!valide} style={[styles.valider, { backgroundColor: t.accent, opacity: valide ? 1 : 0.4 }]} accessibilityRole="button">
                <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: typography.body }}>Enregistrer</Texte>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titre: { fontSize: typography.h1, fontWeight: "600", marginBottom: spacing.sm },
  etiquette: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actions: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  case: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pastilles: { flexDirection: "row", gap: 5, flex: 1, flexWrap: "wrap" },
  pastille: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  ajout: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, paddingVertical: spacing.md },
  courbe: { flexDirection: "row", gap: 2, height: 48, alignItems: "flex-end", marginTop: spacing.md },
  barre: { flex: 1, height: "100%", justifyContent: "flex-end" },
  partager: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.lg },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
