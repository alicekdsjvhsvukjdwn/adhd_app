import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useJourCourant } from "../hooks/useJourCourant";
import { enregistrerHumeur, humeursEntre, majHumeur, supprimerHumeur } from "../lib/db/esprit";
import {
  couleurHumeur,
  EMOTIONS,
  emotionsDe,
  estLeSoir,
  HUMEURS,
  MAX_EMOTIONS_HUMEUR,
  moyennesParJour,
  type HumeurNotee,
} from "../lib/esprit-regles";
import { semaineDe } from "../lib/regles-taches";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { ChampTexte, Texte } from "./Texte";
import { VisageHumeur } from "./VisageHumeur";

const INITIALES = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Humeur en un ou deux taps, plusieurs fois par jour : le visage, puis (si on veut) 0 à 3 émotions
 * et une ligne de note. Dessous : la journée en points de couleur et la semaine en mini-barres.
 * Le soir, la même carte demande « Comment était ta journée ? » : une seule question.
 */
export function HumeurRapide() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [semaine, setSemaine] = useState<HumeurNotee[]>([]);
  /** L'humeur dont on complète les émotions et la note. */
  const [choisie, setChoisie] = useState<number | null>(null);

  const charger = useCallback(async () => {
    const jours = semaineDe(aujourdhui);
    setSemaine(await humeursEntre(jours[0], jours[6]));
  }, [aujourdhui]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const duJour = semaine.filter((h) => h.jour === aujourdhui);
  const humeur = semaine.find((h) => h.id === choisie) ?? null;
  const soir = estLeSoir(new Date().getHours());

  const onNiveau = async (niveau: number) => {
    if (humeur) {
      await majHumeur(humeur.id, { niveau }); // un deuxième tap corrige le visage choisi
    } else {
      setChoisie(await enregistrerHumeur(niveau));
    }
    await charger();
  };

  const basculerEmotion = async (e: string) => {
    if (!humeur) return;
    const actuelles = emotionsDe(humeur.emotions);
    const suivantes = actuelles.includes(e)
      ? actuelles.filter((x) => x !== e)
      : actuelles.length < MAX_EMOTIONS_HUMEUR
        ? [...actuelles, e]
        : actuelles;
    await majHumeur(humeur.id, { emotions: suivantes });
    await charger();
  };

  // Note : gardée à chaque frappe (la ligne se complète sans bouton « enregistrer »).
  const onNote = async (note: string) => {
    if (!humeur) return;
    setSemaine((s) => s.map((h) => (h.id === humeur.id ? { ...h, note } : h)));
    await majHumeur(humeur.id, { note });
  };

  const onSupprimer = async () => {
    if (!humeur) return;
    await supprimerHumeur(humeur.id);
    setChoisie(null);
    await charger();
  };

  const barres = moyennesParJour(semaine, semaineDe(aujourdhui));

  return (
    <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>{soir ? "Comment était ta journée ?" : "Comment ça va ?"}</Texte>
      <View style={styles.visages}>
        {HUMEURS.map((h) => (
          <TouchableOpacity
            key={h.niveau}
            onPress={() => onNiveau(h.niveau)}
            hitSlop={4}
            style={styles.visage}
            accessibilityRole="button"
            accessibilityLabel={`Humeur : ${h.libelle.toLowerCase()}`}
            accessibilityState={{ selected: humeur?.niveau === h.niveau }}
          >
            <VisageHumeur niveau={h.niveau} taille={54} contour={humeur?.niveau === h.niveau ? t.textPrimary : undefined} />
          </TouchableOpacity>
        ))}
      </View>

      {humeur && (
        <View style={styles.suite}>
          <Texte style={[styles.etiquette, { color: t.textMuted }]}>
            NOTÉ À {humeur.heure} · {HUMEURS[humeur.niveau - 1].libelle.toUpperCase()} · LES ÉMOTIONS SONT FACULTATIVES
          </Texte>
          <View style={styles.puces}>
            {EMOTIONS.map((e) => {
              const actif = emotionsDe(humeur.emotions).includes(e);
              return (
                <TouchableOpacity
                  key={e}
                  onPress={() => basculerEmotion(e)}
                  style={[styles.puce, { borderColor: actif ? couleurHumeur(humeur.niveau) : t.border }, actif && { backgroundColor: couleurHumeur(humeur.niveau) }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: actif }}
                >
                  <Texte style={{ color: actif ? "#05080A" : t.textSecondary, fontSize: typography.small }}>{e}</Texte>
                </TouchableOpacity>
              );
            })}
          </View>
          <ChampTexte
            value={humeur.note}
            onChangeText={onNote}
            placeholder="Une ligne si tu veux"
            placeholderTextColor={t.textMuted}
            maxLength={200}
            style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
          />
          <View style={styles.actions}>
            <View />
            <View style={styles.actions}>
              <TouchableOpacity onPress={onSupprimer} hitSlop={8}>
                <Texte style={{ color: t.danger, fontSize: typography.small }}>Supprimer</Texte>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setChoisie(null)} hitSlop={8}>
                <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>Fermer</Texte>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* La journée : un point par humeur notée */}
      <View style={styles.journee}>
        {duJour.length === 0 ? (
          <Texte style={{ color: t.textMuted, fontSize: typography.small }}>Rien de noté aujourd&apos;hui. Un tap suffit.</Texte>
        ) : (
          duJour.map((h) => (
            <TouchableOpacity
              key={h.id}
              onPress={() => setChoisie(h.id === choisie ? null : h.id)}
              hitSlop={6}
              style={[styles.point, { backgroundColor: couleurHumeur(h.niveau), borderColor: h.id === choisie ? t.textPrimary : "transparent" }]}
              accessibilityRole="button"
              accessibilityLabel={`Humeur de ${h.heure}, ${HUMEURS[h.niveau - 1].libelle.toLowerCase()}`}
            />
          ))
        )}
      </View>

      {/* La semaine : une barre par jour (moyenne des humeurs du jour) */}
      <View style={styles.semaine}>
        {barres.map((b) => {
          const d = new Date(b.jour + "T00:00:00Z");
          return (
            <View key={b.jour} style={styles.colonne}>
              <View style={[styles.piste, { backgroundColor: t.bgApp }]}>
                {b.moy !== null && (
                  <View style={{ height: `${(b.moy / 5) * 100}%`, backgroundColor: couleurHumeur(b.moy), borderRadius: 3 }} />
                )}
              </View>
              <Texte style={{ color: b.jour === aujourdhui ? t.textPrimary : t.textMuted, fontSize: 11, fontWeight: b.jour === aujourdhui ? "700" : "400" }}>
                {INITIALES[d.getUTCDay()]}
              </Texte>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  titre: { fontSize: typography.h3, fontWeight: "600", marginBottom: spacing.md },
  visages: { flexDirection: "row", justifyContent: "space-between" },
  visage: { padding: 2 },
  suite: { marginTop: spacing.lg },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: spacing.sm },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, marginTop: spacing.md },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.lg, marginTop: spacing.md },
  journee: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, minHeight: 22 },
  point: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  semaine: { flexDirection: "row", gap: 6, marginTop: spacing.lg },
  colonne: { flex: 1, alignItems: "center", gap: 4 },
  piste: { width: "100%", height: 44, borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" },
});
