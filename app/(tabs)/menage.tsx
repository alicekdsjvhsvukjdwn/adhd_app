import { Cuisine } from "../../components/Cuisine";
import { useCleReset } from "../../lib/reset-onglet";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FeuilleMenage, type SaisieMenage } from "../../components/FeuilleMenage";
import { IconePiece } from "../../components/IconePiece";
import { MenuOptions } from "../../components/MenuOptions";
import { Glissable, type Option } from "../../components/Options";
import { Texte } from "../../components/Texte";
import { useJourCourant } from "../../hooks/useJourCourant";
import {
  ajouterPiece,
  ajouterTacheMenage,
  cocherTacheMenage,
  colorierPiece,
  decocherTacheMenage,
  deplacerPiece,
  getMenage,
  modifierTacheMenage,
  renommerPiece,
  supprimerPiece,
  supprimerTacheMenage,
  type Piece,
} from "../../lib/db/menage";
import {
  aFaireAujourdhui,
  CLES_MENAGE,
  COULEURS_MENAGE,
  estDue,
  jauge,
  joursEntre,
  libelleFrequence,
  retardJours,
  type TacheMenage,
} from "../../lib/menage-regles";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

/** Quand un menu se ferme, une modale ouverte dans la foulée doit attendre (iOS). */
const apres = (f: () => void) => setTimeout(f, 350);

/** Ce qu'il reste à dire d'une tâche, sans chiffres de score : où elle en est. */
function etat(t: TacheMenage, auj: string): string {
  if (t.fait_le === auj) return "fait";
  const r = retardJours(t, auj);
  if (r > 0) return r === 1 ? "en retard d'un jour" : `en retard de ${r} jours`;
  if (estDue(t, auj)) return "à faire aujourd'hui";
  const d = joursEntre(auj, t.prochaine_le);
  return d === 1 ? "demain" : `dans ${d} jours`;
}

function MenageContenu() {
  const t = useTheme();
  const auj = useJourCourant();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [taches, setTaches] = useState<TacheMenage[]>([]);
  const [jourDifficile, setJourDifficile] = useState(false);
  const [ouverte, setOuverte] = useState<number | null>(null);
  /** Mode « Modifier la pièce » : croix rouge sur chaque tâche, couleur, renommer, supprimer. */
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState<SaisieMenage>(null);
  const [menu, setMenu] = useState<{ titre: string; options: Option[] }>({ titre: "", options: [] });
  const [bravo, setBravo] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charger = useCallback(async () => {
    const m = await getMenage();
    setPieces(m.pieces);
    setTaches(m.taches);
    setJourDifficile(m.jourDifficile);
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger, auj]),
  );

  const basculer = async (x: TacheMenage) => {
    if (x.fait_le === auj) {
      await decocherTacheMenage(x.id);
    } else {
      const pts = await cocherTacheMenage(x.id);
      if (pts > 0) {
        setBravo(`+${pts} pts`);
        if (minuteur.current) clearTimeout(minuteur.current);
        minuteur.current = setTimeout(() => setBravo(null), 2500);
      }
    }
    await charger();
  };

  const { visibles, autres } = aFaireAujourdhui(taches, auj, { jourDifficile });
  const nomPiece = (id: number) => pieces.find((p) => p.id === id)?.nom ?? "";
  const piece = pieces.find((p) => p.id === ouverte) ?? null;
  const dansPiece = taches.filter((x) => x.piece_id === ouverte);

  const couleurDe = (id: number) => pieces.find((p) => p.id === id)?.couleur ?? t.accent;
  const fermerPiece = () => {
    setOuverte(null);
    setEdition(false);
  };

  /** Confirmation avant suppression : l'historique est gardé pour les stats. */
  const confirmerTache = (x: TacheMenage) =>
    Alert.alert(`Supprimer « ${x.nom} » ?`, "Elle ne sera plus proposée. Ce que tu as déjà fait reste dans tes statistiques.", [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimerTacheMenage(x.id);
          await charger();
        },
      },
    ]);
  const confirmerPiece = (p: Piece) =>
    Alert.alert(`Supprimer la pièce « ${p.nom} » ?`, "Ses tâches ne seront plus proposées. Ce que tu as déjà fait reste dans tes statistiques.", [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supprimerPiece(p.id);
          fermerPiece();
          await charger();
        },
      },
    ]);

  const optionsPiece = (p: Piece): Option[] => [
    { libelle: "Modifier la pièce", onPress: () => { setOuverte(p.id); setEdition(true); } },
    { libelle: "Renommer", onPress: () => apres(() => setSaisie({ type: "piece", id: p.id, nom: p.nom, freq: 7 })) },
    { libelle: "Monter", onPress: async () => { await deplacerPiece(p.id, -1); await charger(); } },
    { libelle: "Descendre", onPress: async () => { await deplacerPiece(p.id, 1); await charger(); } },
    { libelle: "Supprimer la pièce", danger: true, onPress: () => confirmerPiece(p) },
  ];
  const optionsTache = (x: TacheMenage): Option[] => [
    { libelle: "Modifier", onPress: () => apres(() => setSaisie({ type: "tache", id: x.id, nom: x.nom, freq: x.freq_jours })) },
    { libelle: "Supprimer", danger: true, onPress: () => confirmerTache(x) },
  ];
  /** Glisser vers la gauche (Expo Go) : modifier ou supprimer. */
  const actions = (x: TacheMenage) => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: t.accentText }]}
        onPress={() => setSaisie({ type: "tache", id: x.id, nom: x.nom, freq: x.freq_jours })}
      >
        <Texte style={{ color: t.textOnAccent, fontWeight: "600" }}>Modifier</Texte>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.action, { backgroundColor: t.danger }]} onPress={() => confirmerTache(x)}>
        <Texte style={{ color: t.textOnAccent, fontWeight: "600" }}>Supprimer</Texte>
      </TouchableOpacity>
    </View>
  );
  /** « ⋯ » sur chaque tâche : sur le web, Glissable le fournit déjà. */
  const boutonPlus = (x: TacheMenage) =>
    Platform.OS === "web" ? null : (
      <TouchableOpacity
        onPress={() => setMenu({ titre: x.nom, options: optionsTache(x) })}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Plus d'actions pour ${x.nom}`}
      >
        <Texte style={{ color: t.textMuted, fontSize: 22 }}>⋯</Texte>
      </TouchableOpacity>
    );

  const enregistrer = async (s: NonNullable<SaisieMenage>) => {
    setSaisie(null);
    if (s.type === "piece") {
      if (s.id) await renommerPiece(s.id, s.nom);
      else setOuverte(await ajouterPiece(s.nom));
    } else if (s.id) {
      await modifierTacheMenage(s.id, s.nom, s.freq);
    } else if (ouverte !== null) {
      await ajouterTacheMenage(ouverte, s.nom, s.freq);
    }
    await charger();
  };

  const case_ = (x: TacheMenage, couleur: string) => {
    const fait = x.fait_le === auj;
    return (
      <TouchableOpacity
        onPress={() => basculer(x)}
        hitSlop={8}
        style={[styles.case, { borderColor: couleur, backgroundColor: fait ? couleur : "transparent" }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: fait }}
        accessibilityLabel={x.nom}
      >
        {fait && <Texte style={{ color: t.bgApp, fontSize: 14, fontWeight: "700" }}>✓</Texte>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={styles.conteneurMaison}>
        <View style={styles.entete}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Ménage</Texte>
          {bravo && <Texte style={{ color: t.accent, fontWeight: "700" }}>{bravo}</Texte>}
        </View>

        <Texte style={[styles.surtitre, { color: t.textMuted }]}>À FAIRE AUJOURD&apos;HUI</Texte>
        {jourDifficile && (
          <Texte style={[styles.note, { color: t.textMuted }]}>Jour difficile : seulement ce qui revient chaque jour.</Texte>
        )}
        {visibles.length === 0 ? (
          <Texte style={[styles.note, { color: t.textSecondary }]}>Tout est à jour. Rien d&apos;urgent.</Texte>
        ) : (
          visibles.map((x) => (
            <Glissable key={x.id} renderRightActions={() => actions(x)} options={optionsTache(x)} titre={x.nom}>
              <View style={[styles.ligne, styles.liseré, { backgroundColor: t.bgCard, borderLeftColor: couleurDe(x.piece_id) }]}>
                {case_(x, couleurDe(x.piece_id))}
                <View style={{ flex: 1 }}>
                  <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={1}>
                    {x.nom}
                  </Texte>
                  <Texte style={[styles.sous, { color: t.textMuted }]}>
                    {nomPiece(x.piece_id)} · {etat(x, auj)}
                  </Texte>
                </View>
                {boutonPlus(x)}
              </View>
            </Glissable>
          ))
        )}
        {autres > 0 && (
          <Texte style={[styles.note, { color: t.textMuted }]}>
            + {autres} autre{autres > 1 ? "s" : ""} ensuite
          </Texte>
        )}

        <Texte style={[styles.surtitre, { color: t.textMuted, marginTop: spacing.xl }]}>PAR PIÈCE</Texte>
        <View style={styles.grille}>
          {pieces.map((p) => {
            const part = jauge(taches.filter((x) => x.piece_id === p.id), auj);
            const c = p.couleur;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setOuverte(p.id)}
                onLongPress={() => setMenu({ titre: p.nom, options: optionsPiece(p) })}
                style={[styles.tuile, { backgroundColor: t.bgCard, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: c }]}
                accessibilityRole="button"
                accessibilityLabel={p.nom}
                accessibilityHint="Toucher : ses tâches · appui long : modifier, déplacer, supprimer"
              >
                <IconePiece icone={p.icone} couleur={c} taille={26} />
                <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={1}>
                  {p.nom}
                </Texte>
                <View style={[styles.jauge, { backgroundColor: t.bgApp }]}>
                  <View style={{ width: `${Math.round(part * 100)}%`, height: "100%", backgroundColor: c, borderRadius: 3 }} />
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setSaisie({ type: "piece", nom: "", freq: 7 })}
            style={[styles.tuile, styles.nouvelle, { borderColor: t.border }]}
            accessibilityRole="button"
          >
            <Texte style={{ color: t.textMuted, fontSize: typography.small }}>+ Nouvelle pièce</Texte>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Les tâches d'une pièce : posées sur l'écran (pas une modale) pour que les menus s'ouvrent par-dessus */}
      {piece && (
        <View style={[styles.feuille, { backgroundColor: t.bgApp }]}>
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.entete}>
              <TouchableOpacity onPress={fermerPiece} hitSlop={12} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.body }}>‹ Ménage</Texte>
              </TouchableOpacity>
              <View style={styles.enteteDroite}>
                <TouchableOpacity
                  onPress={() => setEdition(!edition)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={edition ? "Terminer la modification de la pièce" : "Modifier la pièce"}
                >
                  <Texte style={{ color: edition ? t.accentText : t.textMuted, fontSize: edition ? typography.body : 22, fontWeight: edition ? "600" : "400" }}>
                    {edition ? "Terminé" : "✎"}
                  </Texte>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMenu({ titre: piece.nom, options: optionsPiece(piece) })}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Plus d'actions"
                >
                  <Texte style={{ color: t.textMuted, fontSize: 24 }}>⋯</Texte>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.titrePiece}>
              <IconePiece icone={piece.icone} couleur={piece.couleur} taille={30} />
              <Texte style={[styles.titre, { color: t.textPrimary }]}>{piece.nom}</Texte>
            </View>
            {edition && (
              <View style={[styles.panneau, { backgroundColor: t.bgCard, borderColor: piece.couleur }]}>
                <Texte style={[styles.surtitre, { color: t.textMuted }]}>COULEUR DE LA PIÈCE</Texte>
                <View style={styles.couleurs}>
                  {CLES_MENAGE.map((cle) => {
                    const choisie = piece.couleur === COULEURS_MENAGE[cle];
                    return (
                      <TouchableOpacity
                        key={cle}
                        onPress={async () => {
                          await colorierPiece(piece.id, cle);
                          await charger();
                        }}
                        style={[styles.pastille, { backgroundColor: COULEURS_MENAGE[cle], borderColor: choisie ? t.textPrimary : "transparent" }]}
                        hitSlop={4}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: choisie }}
                        accessibilityLabel={`Couleur ${cle}`}
                      />
                    );
                  })}
                </View>
                <View style={styles.panneauLiens}>
                  <TouchableOpacity
                    onPress={() => setSaisie({ type: "piece", id: piece.id, nom: piece.nom, freq: 7 })}
                    accessibilityRole="button"
                  >
                    <Texte style={{ color: t.accentText, fontSize: typography.body }}>Renommer</Texte>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmerPiece(piece)} accessibilityRole="button">
                    <Texte style={{ color: t.danger, fontSize: typography.body }}>Supprimer la pièce</Texte>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {dansPiece.length === 0 && (
              <Texte style={[styles.note, { color: t.textMuted }]}>Aucune tâche ici pour l&apos;instant.</Texte>
            )}
            {dansPiece.map((x) =>
              edition ? (
                // Mode « Modifier la pièce » : croix rouge pour retirer, toucher pour modifier.
                <View key={x.id} style={[styles.ligne, styles.liseré, { backgroundColor: t.bgCard, borderLeftColor: piece.couleur }]}>
                  <TouchableOpacity
                    onPress={() => confirmerTache(x)}
                    hitSlop={8}
                    style={[styles.croix, { backgroundColor: t.danger }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${x.nom}`}
                  >
                    <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: 14 }}>✕</Texte>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => setSaisie({ type: "tache", id: x.id, nom: x.nom, freq: x.freq_jours })}
                    accessibilityRole="button"
                    accessibilityLabel={`Modifier ${x.nom}`}
                  >
                    <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={2}>
                      {x.nom}
                    </Texte>
                    <Texte style={[styles.sous, { color: t.textMuted }]}>{libelleFrequence(x.freq_jours)}</Texte>
                  </TouchableOpacity>
                </View>
              ) : (
                <Glissable key={x.id} renderRightActions={() => actions(x)} options={optionsTache(x)} titre={x.nom}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => basculer(x)}
                    onLongPress={() => setMenu({ titre: x.nom, options: optionsTache(x) })}
                    style={[styles.ligne, styles.liseré, { backgroundColor: t.bgCard, borderLeftColor: piece.couleur }]}
                    accessibilityHint="Toucher : cocher · ⋯ ou glisser : modifier ou supprimer"
                  >
                    {case_(x, piece.couleur)}
                    <View style={{ flex: 1 }}>
                      <Texte
                        style={[styles.nom, { color: x.fait_le === auj ? t.textMuted : t.textPrimary }, x.fait_le === auj && { textDecorationLine: "line-through" }]}
                        numberOfLines={2}
                      >
                        {x.nom}
                      </Texte>
                      <Texte style={[styles.sous, { color: t.textMuted }]}>
                        {libelleFrequence(x.freq_jours)} · {etat(x, auj)}
                      </Texte>
                    </View>
                    {boutonPlus(x)}
                  </TouchableOpacity>
                </Glissable>
              ),
            )}
            <TouchableOpacity
              onPress={() => setSaisie({ type: "tache", nom: "", freq: 7 })}
              style={styles.ajout}
              accessibilityRole="button"
            >
              <Texte style={{ color: t.accentText, fontSize: typography.body }}>+ Ajouter une tâche</Texte>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <MenuOptions titre={menu.titre} options={menu.options} onFermer={() => setMenu({ titre: "", options: [] })} />
      <FeuilleMenage saisie={saisie} onEnregistrer={enregistrer} onFermer={() => setSaisie(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  conteneurMaison: { paddingTop: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  selecteur: { flexDirection: "row", marginTop: 60, marginHorizontal: spacing.xl, borderWidth: 1, borderRadius: radius.pill, padding: 3 },
  segmentVue: { flex: 1, alignItems: "center", borderRadius: radius.pill, paddingVertical: spacing.sm },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  titrePiece: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  surtitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm },
  note: { fontSize: typography.small, marginBottom: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  case: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  nom: { fontSize: typography.body, fontWeight: "600" },
  sous: { fontSize: typography.small, marginTop: 2 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tuile: { width: "47.5%", borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 8, minHeight: 112 },
  nouvelle: { borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  jauge: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  feuille: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  ajout: { paddingVertical: spacing.md },
  liseré: { borderLeftWidth: 4 },
  enteteDroite: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  panneau: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg },
  couleurs: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pastille: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  panneauLiens: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  croix: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", marginBottom: spacing.sm },
  action: { justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.lg, marginLeft: spacing.sm },
});

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à son accueil (voir lib/reset-onglet.ts). */
export default function Menage() {
  return <MaisonEtCuisine key={useCleReset("menage")} />;
}

/** En haut de l'onglet : « Maison » (le ménage) ou « Cuisine ». Le re-tap de l'onglet revient à « Maison ». */
function MaisonEtCuisine() {
  const t = useTheme();
  const [vue, setVue] = useState<"maison" | "cuisine">("maison");
  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <View style={[styles.selecteur, { backgroundColor: t.bgCard, borderColor: t.border }]} accessibilityRole="tablist">
        {(
          [
            ["maison", "Maison"],
            ["cuisine", "Cuisine"],
          ] as const
        ).map(([cle, libelle]) => (
          <TouchableOpacity
            key={cle}
            onPress={() => setVue(cle)}
            style={[styles.segmentVue, vue === cle && { backgroundColor: t.accent }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: vue === cle }}
          >
            <Texte style={{ color: vue === cle ? t.textOnAccent : t.textSecondary, fontSize: typography.bodySmall, fontWeight: "700" }}>{libelle}</Texte>
          </TouchableOpacity>
        ))}
      </View>
      {vue === "maison" ? <MenageContenu /> : <Cuisine />}
    </View>
  );
}
