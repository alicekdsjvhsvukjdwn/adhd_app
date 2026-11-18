import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PanResponder, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Bonhomme } from "../components/Bonhomme";
import { JOURS_LONGS } from "../components/CalendrierMois";
import { ChampTexte, Texte } from "../components/Texte";
import { VisageHumeur } from "../components/VisageHumeur";
import { synchroniserJournal } from "../lib/db/journal-auto";
import { ajouterIdee, donneesRecap, ecrireFierte, marquerVu, recapDisponible } from "../lib/db/recap";
import { compterParZone, type CleZone } from "../lib/journee-regles";
import { carteChaleur, journeeEnAvant, momentsForts, phrasePiste, titreSemaine, tuiles } from "../lib/recap-regles";
import { semaineDe } from "../lib/regles-taches";
import { radius, spacing, typography } from "../lib/theme";

const FOND = "#05080A";
const TEXTE = "#E6F4F1";
const SECONDAIRE = "#8FA8A6";
const CARTE = "#0E1517";
const ACCENT = "#5EEAD4";
const LETTRES = ["L", "M", "M", "J", "V", "S", "D"];
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Donnees = Awaited<ReturnType<typeof donneesRecap>>;
type Carte = { cle: string; titre: string; corps: React.ReactNode };

/**
 * Récap du dimanche, en plein écran façon story : 6 cartes (3 si la semaine a moins de 5 entrées).
 * Retour / Suivant, balayage gauche-droite, croix pour fermer. ?semaine=AAAA-MM-JJ (lundi) rouvre une semaine passée.
 */
export default function Recap() {
  const router = useRouter();
  const { semaine } = useLocalSearchParams<{ semaine?: string }>();
  const [d, setD] = useState<Donnees | null>(null);
  const [i, setI] = useState(0);
  const [fierte, setFierte] = useState("");
  const [ajoutee, setAjoutee] = useState(false);

  useEffect(() => {
    (async () => {
      await synchroniserJournal().catch(() => false);
      const lundi = semaine ?? (await recapDisponible()).lundi;
      const x = await donneesRecap(lundi);
      await marquerVu(lundi, x.piste);
      setD(x);
      setFierte(x.fierte);
      setAjoutee(!!x.piste?.ajoutee);
    })();
  }, [semaine]);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace("/" as never));

  const cartes: Carte[] = d ? construire(d) : [];
  const n = cartes.length;
  const suivant = () => (i < n - 1 ? setI(i + 1) : fermer());
  const retour = () => setI(Math.max(0, i - 1));

  // Balayage : à gauche = suivante, à droite = précédente.
  const nav = useRef({ suivant, retour });
  useEffect(() => {
    nav.current = { suivant, retour };
  });
  const [balayage] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) nav.current.suivant();
        else if (g.dx > 50) nav.current.retour();
      },
    }),
  );

  function construire(x: Donnees): Carte[] {
    const actives = x.zones.filter((z) => z.active);
    const parCle = Object.fromEntries(x.zones.map((z) => [z.cle, z]));
    const jours = semaineDe(x.lundi);
    const enAvant = journeeEnAvant(x.entrees, jours);
    const ligne = (e: { id: number; zone: string; texte: string; ressenti: number | null }) => (
      <View key={e.id} style={styles.ligne}>
        <View style={[styles.point, { backgroundColor: parCle[e.zone]?.couleur ?? SECONDAIRE }]} />
        <Texte style={styles.ligneTexte} numberOfLines={2}>
          {e.texte}
        </Texte>
        {e.ressenti ? <VisageHumeur niveau={e.ressenti} taille={22} /> : null}
      </View>
    );

    const c1: Carte = {
      cle: "semaine",
      titre: "Ta semaine",
      corps: (
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Texte style={styles.sous}>{titreSemaine(x.lundi)}</Texte>
          <Texte style={styles.grand}>{x.entrees.length}</Texte>
          <Texte style={styles.sous}>{x.entrees.length > 1 ? "choses notées dans ton journal" : "chose notée dans ton journal"}</Texte>
          <Bonhomme zones={x.zones} comptes={x.comptes} largeur={180} teintes={carteChaleur(x.zones, x.comptes)} />
          {x.court && <Texte style={[styles.sous, { textAlign: "center" }]}>Une semaine plus discrète dans le journal : le récap reste court.</Texte>}
        </View>
      ),
    };

    const c2: Carte = {
      cle: "jours",
      titre: "Jour par jour",
      corps: (
        <View style={{ gap: spacing.lg }}>
          <View style={styles.jours}>
            {jours.map((j, k) => {
              const actif = enAvant?.jour === j;
              return (
                <View key={j} style={[styles.jour, actif && { borderColor: ACCENT }]}>
                  <Bonhomme zones={x.zones} comptes={compterParZone(x.entrees.filter((e) => e.jour === j))} largeur={30} plein />
                  <Texte style={[styles.lettre, actif && { color: TEXTE }]}>{LETTRES[k]}</Texte>
                </View>
              );
            })}
          </View>
          {enAvant && (
            <View style={{ gap: spacing.sm }}>
              <Texte style={styles.intertitre}>
                {majuscule(JOURS_LONGS[new Date(enAvant.jour + "T00:00:00Z").getUTCDay()])}, ta journée la plus remplie
              </Texte>
              {enAvant.entrees.map(ligne)}
            </View>
          )}
        </View>
      ),
    };

    const t3 = tuiles(x.cette, x.avant);
    const c3: Carte = {
      cle: "chiffres",
      titre: "En chiffres",
      corps: t3.length ? (
        <View style={styles.tuiles}>
          {t3.map((t) => (
            <View key={t.cle} style={styles.tuile}>
              <Texte style={styles.tuileTitre}>{t.titre}</Texte>
              <Texte style={styles.tuileValeur}>{t.valeur}</Texte>
              {t.ecart && <Texte style={styles.tuileEcart}>{t.ecart} vs la semaine d&apos;avant</Texte>}
            </View>
          ))}
        </View>
      ) : (
        <Texte style={styles.sous}>Pas encore de chiffres cette semaine.</Texte>
      ),
    };

    const forts = momentsForts(x.entrees);
    const c4: Carte = {
      cle: "forts",
      titre: "Moments forts",
      corps: (
        <View style={{ gap: spacing.sm }}>
          {forts.map(ligne)}
          {x.premieres.length > 0 && (
            <>
              <Texte style={[styles.intertitre, { marginTop: spacing.lg }]}>Première fois</Texte>
              {x.premieres.map((p) => (
                <Texte key={p} style={styles.ligneTexte}>
                  ✦ {p}
                </Texte>
              ))}
            </>
          )}
        </View>
      ),
    };

    const piste = x.piste;
    const zonePiste = piste ? parCle[piste.zone] : null;
    const c5: Carte | null =
      piste && zonePiste
        ? {
            cle: "piste",
            titre: "Piste pour la semaine",
            corps: (
              <View style={{ alignItems: "center", gap: spacing.lg }}>
                <Bonhomme
                  zones={x.zones}
                  comptes={{}}
                  largeur={120}
                  teintes={Object.fromEntries(actives.map((z) => [z.cle, z.cle === piste.zone ? z.couleur : "#141C1B"]))}
                />
                <Texte style={[styles.sous, { textAlign: "center", color: TEXTE }]}>{phrasePiste(piste.zone as CleZone)}</Texte>
                <Texte style={[styles.idee, { borderColor: zonePiste.couleur }]}>{piste.texte}</Texte>
                <TouchableOpacity
                  disabled={ajoutee}
                  onPress={async () => {
                    await ajouterIdee(x.lundi, piste.texte);
                    setAjoutee(true);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[styles.bouton, { borderColor: ACCENT, opacity: ajoutee ? 0.6 : 1 }]}
                  accessibilityRole="button"
                >
                  <Texte style={styles.boutonTexte}>{ajoutee ? "Ajoutée à « À ne pas oublier »" : "Ajouter cette idée"}</Texte>
                </TouchableOpacity>
              </View>
            ),
          }
        : null;

    const o = x.objectif;
    const c6: Carte = {
      cle: "fin",
      titre: "Pour finir",
      corps: (
        <View style={{ gap: spacing.lg }}>
          {x.points !== null && (
            <View style={{ alignItems: "center" }}>
              <Texte style={styles.grand}>+{x.points}</Texte>
              <Texte style={styles.sous}>points gagnés cette semaine</Texte>
            </View>
          )}
          {o && (
            <Texte style={[styles.sous, { textAlign: "center", color: TEXTE }]}>
              {o.manque > 0 ? `Plus que ${o.manque} points pour « ${o.recompense.nom} »` : `« ${o.recompense.nom} » est prête à être utilisée`}
            </Texte>
          )}
          <View style={{ gap: spacing.sm }}>
            <Texte style={styles.intertitre}>De quoi je suis fière cette semaine</Texte>
            <ChampTexte
              style={styles.champ}
              value={fierte}
              onChangeText={setFierte}
              onBlur={() => ecrireFierte(x.lundi, fierte)}
              onSubmitEditing={() => ecrireFierte(x.lundi, fierte)}
              placeholder="Une phrase, si tu veux"
              placeholderTextColor={SECONDAIRE}
              returnKeyType="done"
              maxLength={200}
              accessibilityLabel="De quoi je suis fière cette semaine"
            />
          </View>
        </View>
      ),
    };

    return x.court ? [c1, c2, c6] : [c1, c2, c3, c4, ...(c5 ? [c5] : []), c6];
  }

  const carte = cartes[i];
  return (
    <View style={styles.ecran} {...balayage.panHandlers}>
      <View style={styles.barres}>
        {cartes.map((c, k) => (
          <View key={c.cle} style={[styles.barre, { backgroundColor: k <= i ? TEXTE : "#24302F" }]} />
        ))}
      </View>
      <View style={styles.haut}>
        <Texte style={styles.titre}>{carte?.titre ?? ""}</Texte>
        <TouchableOpacity onPress={fermer} hitSlop={12} style={styles.croix} accessibilityRole="button" accessibilityLabel="Fermer le récap">
          <Texte style={{ color: TEXTE, fontSize: 22 }}>✕</Texte>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.corps} keyboardShouldPersistTaps="handled">
        {carte?.corps}
      </ScrollView>
      <View style={styles.bas}>
        <TouchableOpacity onPress={retour} disabled={i === 0} style={[styles.nav, { opacity: i === 0 ? 0.35 : 1 }]} accessibilityRole="button">
          <Texte style={styles.navTexte}>Retour</Texte>
        </TouchableOpacity>
        <Texte style={styles.compteur}>
          {n ? i + 1 : 0} / {n}
        </Texte>
        <TouchableOpacity onPress={suivant} style={[styles.nav, styles.navPrincipal]} accessibilityRole="button">
          <Texte style={[styles.navTexte, { color: FOND }]}>{i < n - 1 ? "Suivant" : "Fermer"}</Texte>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: FOND, paddingTop: 54, paddingHorizontal: spacing.lg },
  barres: { flexDirection: "row", gap: 4 },
  barre: { flex: 1, height: 3, borderRadius: 2 },
  haut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  titre: { color: TEXTE, fontSize: 26, fontWeight: "700", flex: 1 },
  croix: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  corps: { paddingVertical: spacing.lg, flexGrow: 1 },
  sous: { color: SECONDAIRE, fontSize: typography.body, lineHeight: 21 },
  grand: { color: TEXTE, fontSize: 56, fontWeight: "700", lineHeight: 64 },
  intertitre: { color: TEXTE, fontSize: typography.h3, fontWeight: "600" },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: CARTE, borderRadius: radius.md, padding: spacing.md },
  point: { width: 10, height: 10, borderRadius: 5 },
  ligneTexte: { color: TEXTE, fontSize: typography.body, flex: 1 },
  jours: { flexDirection: "row", justifyContent: "space-between" },
  jour: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 2, borderRadius: radius.sm, borderWidth: 1.5, borderColor: "transparent", minWidth: 40 },
  lettre: { color: SECONDAIRE, fontSize: typography.tiny, fontWeight: "700", marginTop: 4 },
  tuiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tuile: { width: "47%", flexGrow: 1, backgroundColor: CARTE, borderRadius: radius.lg, padding: spacing.lg, gap: 4 },
  tuileTitre: { color: SECONDAIRE, fontSize: typography.small, fontWeight: "600" },
  tuileValeur: { color: TEXTE, fontSize: 30, fontWeight: "700" },
  tuileEcart: { color: SECONDAIRE, fontSize: typography.tiny },
  idee: { color: TEXTE, fontSize: typography.h3, fontWeight: "600", textAlign: "center", borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg, alignSelf: "stretch" },
  bouton: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: "center" },
  boutonTexte: { color: ACCENT, fontWeight: "700", fontSize: typography.body },
  champ: { borderWidth: 1, borderColor: "#24302F", backgroundColor: CARTE, color: TEXTE, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, minHeight: 44 },
  bas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.lg, gap: spacing.md },
  nav: { minHeight: 44, minWidth: 100, borderRadius: radius.pill, borderWidth: 1, borderColor: "#24302F", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  navPrincipal: { backgroundColor: TEXTE, borderColor: TEXTE },
  navTexte: { color: TEXTE, fontWeight: "700", fontSize: typography.body },
  compteur: { color: SECONDAIRE, fontSize: typography.small },
});
