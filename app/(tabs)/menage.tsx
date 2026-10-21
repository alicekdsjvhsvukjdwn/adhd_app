import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { FeuilleMenage, type SaisieMenage } from "../../components/FeuilleMenage";
import { IconePiece } from "../../components/IconePiece";
import { MenuOptions } from "../../components/MenuOptions";
import type { Option } from "../../components/Options";
import { Texte } from "../../components/Texte";
import { useJourCourant } from "../../hooks/useJourCourant";
import {
  ajouterPiece,
  ajouterTacheMenage,
  cocherTacheMenage,
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
  couleurJauge,
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

export default function Menage() {
  const t = useTheme();
  const auj = useJourCourant();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [taches, setTaches] = useState<TacheMenage[]>([]);
  const [jourDifficile, setJourDifficile] = useState(false);
  const [ouverte, setOuverte] = useState<number | null>(null);
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

  const optionsPiece = (p: Piece): Option[] => [
    { libelle: "Renommer", onPress: () => apres(() => setSaisie({ type: "piece", id: p.id, nom: p.nom, freq: 7 })) },
    { libelle: "Monter", onPress: async () => { await deplacerPiece(p.id, -1); await charger(); } },
    { libelle: "Descendre", onPress: async () => { await deplacerPiece(p.id, 1); await charger(); } },
    {
      libelle: "Supprimer la pièce",
      danger: true,
      onPress: async () => {
        await supprimerPiece(p.id);
        setOuverte(null);
        await charger();
      },
    },
  ];
  const optionsTache = (x: TacheMenage): Option[] => [
    { libelle: "Modifier", onPress: () => apres(() => setSaisie({ type: "tache", id: x.id, nom: x.nom, freq: x.freq_jours })) },
    {
      libelle: "Supprimer",
      danger: true,
      onPress: async () => {
        await supprimerTacheMenage(x.id);
        await charger();
      },
    },
  ];

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
      <ScrollView contentContainerStyle={styles.container}>
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
            <View key={x.id} style={[styles.ligne, { backgroundColor: t.bgCard }]}>
              {case_(x, t.accent)}
              <View style={{ flex: 1 }}>
                <Texte style={[styles.nom, { color: t.textPrimary }]} numberOfLines={1}>
                  {x.nom}
                </Texte>
                <Texte style={[styles.sous, { color: t.textMuted }]}>
                  {nomPiece(x.piece_id)} · {etat(x, auj)}
                </Texte>
              </View>
            </View>
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
            const c = couleurJauge(part);
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setOuverte(p.id)}
                onLongPress={() => setMenu({ titre: p.nom, options: optionsPiece(p) })}
                style={[styles.tuile, { backgroundColor: t.bgCard, borderColor: t.border }]}
                accessibilityRole="button"
                accessibilityLabel={p.nom}
                accessibilityHint="Toucher : ses tâches · appui long : renommer, déplacer, supprimer"
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
              <TouchableOpacity onPress={() => setOuverte(null)} hitSlop={12} accessibilityRole="button">
                <Texte style={{ color: t.accentText, fontSize: typography.body }}>‹ Ménage</Texte>
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
            <View style={styles.titrePiece}>
              <IconePiece icone={piece.icone} couleur={couleurJauge(jauge(dansPiece, auj))} taille={30} />
              <Texte style={[styles.titre, { color: t.textPrimary }]}>{piece.nom}</Texte>
            </View>
            {dansPiece.length === 0 && (
              <Texte style={[styles.note, { color: t.textMuted }]}>Aucune tâche ici pour l&apos;instant.</Texte>
            )}
            {dansPiece.map((x) => (
              <TouchableOpacity
                key={x.id}
                activeOpacity={0.8}
                onPress={() => basculer(x)}
                onLongPress={() => setMenu({ titre: x.nom, options: optionsTache(x) })}
                style={[styles.ligne, { backgroundColor: t.bgCard }]}
                accessibilityHint="Toucher : cocher · appui long : modifier ou supprimer"
              >
                {case_(x, couleurJauge(1 - Math.min(1, retardJours(x, auj) / 3)))}
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
              </TouchableOpacity>
            ))}
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
});
