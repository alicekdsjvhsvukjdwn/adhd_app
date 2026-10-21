import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Platform, ScrollView, StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from "react-native";
import { useJourReel } from "../hooks/useJourCourant";
import { decalerJours } from "../lib/dates";
import { moisDeSemaine, SEMAINES_BANDE, semaineDe } from "../lib/regles-taches";
import { radius, spacing, typography, useTheme } from "../lib/theme";
import { JOURS_LONGS } from "./CalendrierMois";
import { Texte } from "./Texte";

/** Semaines affichées de chaque côté de la semaine en cours (un an dans chaque sens). */
const SEMAINES = SEMAINES_BANDE;
const WEB = Platform.OS === "web";
/** Web : la semaine s'arrête net (scroll-snap CSS), jamais entre deux semaines. */
const SNAP_CONTENEUR = { scrollSnapType: "x mandatory" } as object;
const SNAP_PAGE = { scrollSnapAlign: "start", scrollSnapStop: "always" } as object;
/** Vert d'eau fixe du jour réel (la couleur d'accent, elle, change avec l'heure). */
const JOUR_REEL = "#2DD4BF";
const PAGES = Array.from({ length: SEMAINES * 2 + 1 }, (_, i) => i);

type Props = {
  aujourdhui: string;
  /** Jour touché ; null = aujourd'hui. */
  choisi: string | null;
  /** Couleurs des échéances de chaque jour de la semaine demandée. */
  points: (jours: string[]) => Record<string, string[]>;
  /** Jours qui ont au moins un rendez-vous. */
  rdv: Set<string>;
  onChoisir: (jour: string | null) => void;
};

/** La semaine en bande de 7 jours, qui défile de semaine en semaine (passé et futur). */
export function BandeJours({ aujourdhui, choisi, points, rdv, onChoisir }: Props) {
  const t = useTheme();
  const reel = useJourReel();
  const liste = useRef<FlatList<number>>(null);
  const defil = useRef<ScrollView>(null);
  const [largeur, setLargeur] = useState(0);
  const [page, setPage] = useState(SEMAINES);

  const onLayout = (e: LayoutChangeEvent) => setLargeur(Math.round(e.nativeEvent.layout.width));
  /** Web : ScrollView à scroll-snap CSS ; natif : FlatList paginée. */
  const aller = useCallback(
    (index: number, animated: boolean) => {
      if (WEB) defil.current?.scrollTo({ x: index * largeur, animated });
      else liste.current?.scrollToIndex({ index, animated });
    },
    [largeur],
  );
  const revenir = useCallback(() => {
    aller(SEMAINES, true);
    setPage(SEMAINES);
    onChoisir(null);
  }, [aller, onChoisir]);

  // Web : ouverture (et minuit passé) sur la semaine en cours. Natif : initialScrollIndex.
  useEffect(() => {
    if (WEB && largeur > 0) aller(SEMAINES, false);
  }, [largeur, aujourdhui, aller]);

  const semaine = (p: number) => semaineDe(decalerJours(aujourdhui, (p - SEMAINES) * 7));

  const rendreSemaine = (p: number) => {
    const jours = semaine(p);
    const pts = points(jours);
    return (
      <View style={[styles.semaine, { width: largeur }]}>
        {jours.map((d) => {
          const estAujourdhui = d === reel;
          const selectionne = d === (choisi ?? aujourdhui);
          const date = new Date(d + "T00:00:00Z");
          return (
            <TouchableOpacity
              key={d}
              onPress={() => onChoisir(d === aujourdhui || selectionne ? null : d)}
              style={[
                styles.jour,
                estAujourdhui
                  ? { backgroundColor: JOUR_REEL, borderColor: selectionne ? t.textPrimary : JOUR_REEL, borderWidth: selectionne ? 2 : 1 }
                  : { backgroundColor: t.bgCard, borderColor: selectionne ? JOUR_REEL : t.border },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectionne }}
              accessibilityLabel={`${JOURS_LONGS[date.getUTCDay()]} ${date.getUTCDate()}, ${pts[d].length} échéance${
                pts[d].length > 1 ? "s" : ""
              }${rdv.has(d) ? ", rendez-vous" : ""}`}
            >
              <Texte style={[styles.jourNom, { color: estAujourdhui ? "#05080A" : t.textMuted }]}>
                {JOURS_LONGS[date.getUTCDay()].slice(0, 3)}
              </Texte>
              <Texte style={[styles.jourNumero, { color: estAujourdhui ? "#05080A" : t.textPrimary }]}>
                {date.getUTCDate()}
              </Texte>
              <View style={styles.jourPoints}>
                {pts[d].slice(0, 3).map((c, i) => (
                  <View
                    key={i}
                    style={[styles.jourPoint, { backgroundColor: c, borderColor: estAujourdhui ? "#05080A" : c }]}
                  />
                ))}
                {rdv.has(d) && (
                  <View
                    style={[styles.jourPoint, { backgroundColor: "#8A9A98", borderColor: estAujourdhui ? "#05080A" : "#8A9A98" }]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const rendre = ({ item: p }: { item: number }) => rendreSemaine(p);
  const semaineAffichee = semaine(page);
  const horsSemaine = page !== SEMAINES || choisi !== null;

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Texte style={{ color: t.textSecondary, fontSize: typography.small, fontWeight: "600", marginBottom: 6 }}>
        {moisDeSemaine(semaineAffichee)}
      </Texte>
      <View onLayout={onLayout}>
        {largeur > 0 && WEB && (
          <ScrollView
            ref={defil}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / largeur))}
            style={SNAP_CONTENEUR}
          >
            {PAGES.map((p) => (
              <View key={p} style={SNAP_PAGE}>
                {rendreSemaine(p)}
              </View>
            ))}
          </ScrollView>
        )}
        {largeur > 0 && !WEB && (
          <FlatList
            ref={liste}
            data={PAGES}
            keyExtractor={(p) => String(p)}
            renderItem={rendre}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={SEMAINES}
            getItemLayout={(_, i) => ({ length: largeur, offset: largeur * i, index: i })}
            windowSize={5}
            initialNumToRender={3}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / largeur))}
            extraData={[choisi, rdv, points]}
          />
        )}
      </View>
      <View style={styles.pied}>
        <Texte style={{ color: t.textMuted, fontSize: typography.tiny }}>
          {page === SEMAINES
            ? "Glisse pour changer de semaine"
            : `Semaine du ${new Date(semaineAffichee[0] + "T00:00:00Z").getUTCDate()} ${
                ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][
                  new Date(semaineAffichee[0] + "T00:00:00Z").getUTCMonth()
                ]
              }`}
        </Texte>
        {horsSemaine && (
          <TouchableOpacity onPress={revenir} hitSlop={8} accessibilityRole="button">
            <Texte style={{ color: t.accentText, fontSize: typography.small, fontWeight: "600" }}>Aujourd&apos;hui</Texte>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  semaine: { flexDirection: "row", gap: 6 },
  jour: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingVertical: 6 },
  jourNom: { fontSize: 11, fontWeight: "600" },
  jourNumero: { fontSize: typography.body, fontWeight: "700", marginTop: 2 },
  jourPoints: { flexDirection: "row", gap: 2, height: 6, marginTop: 4 },
  jourPoint: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  pied: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
});
