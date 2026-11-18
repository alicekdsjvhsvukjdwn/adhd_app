import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { FeuilleAjoutRecompense } from "../../components/FeuilleAjoutRecompense";
import { IconeRecompense } from "../../components/IconeRecompense";
import { ChampTexte, Texte } from "../../components/Texte";
import { VisageHumeur } from "../../components/VisageHumeur";
import { useJourCourant } from "../../hooks/useJourCourant";
import { synchroniserJournal } from "../../lib/db/journal-auto";
import { entreesEntre } from "../../lib/db/journee";
import { moyennePoints14 } from "../../lib/db/recap";
import {
  REGLES_POINTS,
  ajouterRecompense,
  annulerAchat,
  compterPioche,
  ecrireObjectif,
  ecrireSeuilPioche,
  enregistrerSouvenir,
  getRecompenses,
  lireObjectif,
  lireSeuilPioche,
  modifierRecompense,
  piochesDuJour,
  pointsGagnes,
  soldePoints,
  souvenirs as lireSouvenirs,
  supprimerRecompense,
  utiliser,
  type Recompense,
  type SouvenirAchat,
} from "../../lib/db/recompenses";
import { compterParZone } from "../../lib/journee-regles";
import { choisirPhotos } from "../../lib/photos";
import {
  CATEGORIES_RECOMPENSES,
  ICONE_CATEGORIE,
  ICONES_RECOMPENSES,
  PIOCHES_PAR_JOUR,
  PRIX_SUGGERES,
  categorieRecompense,
  etageres,
  etatRecompense,
  piocher,
  progressionObjectif,
  suggestionRepos,
  type CategorieRecompense,
} from "../../lib/recompenses-regles";
import { niveauDePoints, semaineDe, totalAffiche } from "../../lib/regles-taches";
import { useCleReset } from "../../lib/reset-onglet";
import { avecAlpha, radius, spacing, typography, useTheme } from "../../lib/theme";

const SEUILS = [40, 60, 100];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateCourte = (d: string, auj: string) => {
  if (d === auj) return "Aujourd'hui";
  const x = new Date(d + "T00:00:00Z");
  return `${x.getUTCDate()} ${MOIS_COURTS[x.getUTCMonth()]}`;
};

type Formulaire = { id?: number; nom: string; icone: string | null; prix: string; categorie: CategorieRecompense };
type Souvenir = { achatId: number; nom: string; texte: string; photo: string | null; ressenti: number | null };

/** Anneau de progression vers l'objectif, dans la couleur de sa catégorie. */
function Anneau({ part, couleur, fond, taille = 96 }: { part: number; couleur: string; fond: string; taille?: number }) {
  const r = taille / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={taille} height={taille} accessible={false}>
      <Circle cx={taille / 2} cy={taille / 2} r={r} stroke={fond} strokeWidth={8} fill="none" />
      <Circle
        cx={taille / 2}
        cy={taille / 2}
        r={r}
        stroke={couleur}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - part)}
        transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
      />
    </Svg>
  );
}

/**
 * Récompenses : le solde, mon objectif (anneau, ~N jours), la pioche d'une petite récompense,
 * la vitrine par catégorie, et « Mes souvenirs ». Les règles de gain sont repliées en bas.
 */
function RecompensesContenu() {
  const t = useTheme();
  const aujourdhui = useJourCourant();
  const [onglet, setOnglet] = useState<"vitrine" | "souvenirs">("vitrine");
  const [solde, setSolde] = useState(0);
  const [total, setTotal] = useState(0);
  const [liste, setListe] = useState<Recompense[]>([]);
  const [objectifId, setObjectifId] = useState<number | null>(null);
  const [moyenne, setMoyenne] = useState<number | null>(null);
  const [seuil, setSeuil] = useState(60);
  const [pioches, setPioches] = useState(0);
  const [piochee, setPiochee] = useState<Recompense | null>(null);
  const [rienAPiocher, setRienAPiocher] = useState(false);
  const [comptesSemaine, setComptesSemaine] = useState<Record<string, number>>({});
  const [mesSouvenirs, setMesSouvenirs] = useState<SouvenirAchat[]>([]);
  const [detail, setDetail] = useState<Recompense | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [ajoutDe, setAjoutDe] = useState<CategorieRecompense | null>(null);
  const [souvenir, setSouvenir] = useState<Souvenir | null>(null);
  const [voirRegles, setVoirRegles] = useState(false);
  const [bravo, setBravo] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  const charger = useCallback(async () => {
    const semaine = semaineDe(aujourdhui);
    const [s, g, l, o, m, se, p, e, so] = await Promise.all([
      soldePoints(),
      pointsGagnes(),
      getRecompenses(),
      lireObjectif(),
      moyennePoints14(),
      lireSeuilPioche(),
      piochesDuJour(),
      entreesEntre(semaine[0], semaine[6]),
      lireSouvenirs(),
    ]);
    setSolde(s);
    setTotal(g);
    setListe(l);
    setObjectifId(o);
    setMoyenne(m);
    setSeuil(se);
    setPioches(p);
    setComptesSemaine(compterParZone(e));
    setMesSouvenirs(so);
  }, [aujourdhui]);

  useFocusEffect(
    useCallback(() => {
      // Les points du jour et les entrées auto d'abord (bonus des 4 zones compris), puis la page.
      synchroniserJournal()
        .catch(() => false)
        .then(charger);
    }, [charger]),
  );

  const feter = (texte: string) => {
    setBravo(texte);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setBravo(null), 4000);
  };

  /** Utiliser : confirmation, les points baissent (pas le niveau), petite fête, puis le souvenir (facultatif). */
  const onUtiliser = (r: Recompense) => {
    if (solde < r.prix) {
      Alert.alert("Pas encore", `Il te manque ${r.prix - solde} points pour « ${r.nom} ».`);
      return;
    }
    Alert.alert(r.nom, `Utiliser ${r.prix} points ? Il t'en restera ${solde - r.prix}. Ton niveau ne baisse pas.`, [
      { text: "Pas maintenant", style: "cancel" },
      {
        text: "Je l'utilise",
        onPress: async () => {
          const achatId = await utiliser(r);
          setDetail(null);
          setPiochee(null);
          if (achatId) {
            feter(`🎉 Profite bien : ${r.nom.toLowerCase()} !`);
            // iOS n'ouvre pas une modale pendant qu'une autre se ferme.
            setTimeout(() => setSouvenir({ achatId, nom: r.nom, texte: "", photo: null, ressenti: null }), 400);
          }
          await charger();
        },
      },
    ]);
  };

  const devenirObjectif = async (r: Recompense) => {
    const nouveau = objectifId === r.id ? null : r.id;
    await ecrireObjectif(nouveau);
    setObjectifId(nouveau);
    Haptics.selectionAsync().catch(() => {});
  };

  /** Piocher (ou repiocher) : 3 tirages par jour au plus. */
  const onPiocher = async () => {
    const r = piocher(liste, solde, seuil, piochee?.id ?? null);
    if (!r) {
      setRienAPiocher(true);
      return;
    }
    if (!(await compterPioche())) return;
    setRienAPiocher(false);
    setPiochee(r);
    setPioches(await piochesDuJour());
    Haptics.selectionAsync().catch(() => {});
  };

  const changerSeuil = async () => {
    const n = SEUILS[(SEUILS.indexOf(seuil) + 1) % SEUILS.length];
    await ecrireSeuilPioche(n);
    setSeuil(n);
  };

  const enregistrerSouvenirSaisi = async () => {
    if (!souvenir) return;
    const s = souvenir;
    setSouvenir(null);
    if (s.texte.trim() || s.photo || s.ressenti) await enregistrerSouvenir(s.achatId, { texte: s.texte, photo: s.photo, ressenti: s.ressenti });
    await charger();
  };

  const prixSaisi = formulaire ? parseInt(formulaire.prix, 10) : NaN;
  const formulaireValide = !!formulaire && formulaire.nom.trim().length > 0 && prixSaisi > 0;
  const enregistrer = async () => {
    if (!formulaire || !formulaireValide) return;
    const r = { nom: formulaire.nom, icone: formulaire.icone, prix: prixSaisi, categorie: formulaire.categorie };
    if (formulaire.id) await modifierRecompense({ id: formulaire.id, ...r });
    else await ajouterRecompense(r);
    setFormulaire(null);
    await charger();
  };

  const modifier = (r: Recompense) => {
    setDetail(null);
    setTimeout(() => setFormulaire({ id: r.id, nom: r.nom, icone: r.icone, prix: String(r.prix), categorie: categorieRecompense(r.categorie).cle }), 350);
  };

  const objectif = liste.find((r) => r.id === objectifId) ?? null;
  const suggestion = suggestionRepos(comptesSemaine, liste, solde);
  const restantes = PIOCHES_PAR_JOUR - pioches;

  // ─── Une carte de la vitrine ───
  const carte = (r: Recompense, couleur: string) => {
    const { accessible, part } = etatRecompense(r.prix, solde);
    const estObjectif = r.id === objectifId;
    return (
      <Pressable
        key={r.id}
        onPress={() => setDetail(r)}
        onLongPress={() => devenirObjectif(r)}
        style={[styles.carte, { backgroundColor: t.bgCard, borderColor: estObjectif ? couleur : accessible ? avecAlpha(couleur, 0.5) : t.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${r.nom}, ${accessible ? "disponible" : `${r.prix} points`}${estObjectif ? ", mon objectif" : ""}`}
        accessibilityHint="Touche pour le détail, appui long pour en faire ton objectif"
      >
        <IconeRecompense icone={r.icone ?? ICONE_CATEGORIE[categorieRecompense(r.categorie).cle]} couleur={couleur} taille={22} />
        <Texte style={[styles.carteNom, { color: t.textPrimary }]} numberOfLines={2}>
          {r.nom}
        </Texte>
        <View style={[styles.barre, { backgroundColor: t.bgApp }]}>
          <View style={{ flex: part, backgroundColor: couleur, borderRadius: 2 }} />
          <View style={{ flex: 1 - part }} />
        </View>
        <Texte style={[styles.cartePrix, { color: accessible ? couleur : t.textMuted }]}>{accessible ? "Disponible" : `${r.prix} pts`}</Texte>
      </Pressable>
    );
  };

  const vitrine = (
    <>
      {/* Mon objectif */}
      {objectif ? (
        (() => {
          const cat = categorieRecompense(objectif.categorie);
          const p = progressionObjectif(objectif.prix, solde, moyenne);
          return (
            <Pressable onPress={() => setDetail(objectif)} style={[styles.objectif, { backgroundColor: t.bgCard, borderColor: avecAlpha(cat.couleur, 0.5) }]} accessibilityRole="button">
              <View style={styles.anneau}>
                <Anneau part={p.part} couleur={cat.couleur} fond={t.bgApp} />
                <Texte style={[styles.pourcent, { color: t.textPrimary }]}>{p.pourcent} %</Texte>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Texte style={[styles.petit, { color: cat.couleur }]}>Mon objectif</Texte>
                <Texte style={[styles.objectifNom, { color: t.textPrimary }]} numberOfLines={2}>
                  {objectif.nom}
                </Texte>
                {p.atteint ? (
                  <>
                    <Texte style={[styles.petit, { color: t.textSecondary }]}>Prête à être utilisée</Texte>
                    <TouchableOpacity onPress={() => onUtiliser(objectif)} style={[styles.boutonPlein, { backgroundColor: cat.couleur }]} accessibilityRole="button">
                      <Texte style={{ color: "#05080A", fontWeight: "700" }}>Utiliser</Texte>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Texte style={[styles.petit, { color: t.textSecondary }]}>
                    Encore {p.reste} pts{p.jours ? ` · ~${p.jours} jour${p.jours > 1 ? "s" : ""}` : ""}
                  </Texte>
                )}
              </View>
            </Pressable>
          );
        })()
      ) : (
        <View style={[styles.objectif, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Texte style={[styles.petit, { color: t.textSecondary, flex: 1 }]}>
            Pas encore d&apos;objectif : fais un appui long sur une récompense, ou « En faire mon objectif » dans son détail.
          </Texte>
        </View>
      )}

      {/* Piocher une petite récompense */}
      <View style={[styles.pioche, { backgroundColor: t.bgCard }]}>
        {piochee ? (
          <>
            <Texte style={[styles.petit, { color: t.textSecondary }]}>Tirée au hasard :</Texte>
            <View style={styles.piocheLigne}>
              <IconeRecompense icone={piochee.icone} couleur={categorieRecompense(piochee.categorie).couleur} taille={26} />
              <Texte style={[styles.objectifNom, { color: t.textPrimary, flex: 1 }]}>{piochee.nom}</Texte>
              <Texte style={[styles.petit, { color: t.textMuted }]}>{piochee.prix} pts</Texte>
            </View>
            <View style={styles.piocheLigne}>
              <TouchableOpacity onPress={() => onUtiliser(piochee)} style={[styles.boutonPlein, { backgroundColor: t.accent, flex: 1 }]} accessibilityRole="button">
                <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Je la prends</Texte>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onPiocher}
                disabled={restantes <= 0}
                style={[styles.boutonContour, { borderColor: t.border, flex: 1, opacity: restantes <= 0 ? 0.5 : 1 }]}
                accessibilityRole="button"
              >
                <Texte style={{ color: t.textSecondary, fontWeight: "600" }}>{restantes > 0 ? `Repiocher (${restantes})` : "Plus de pioche aujourd'hui"}</Texte>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={onPiocher}
              disabled={restantes <= 0}
              style={[styles.boutonContour, { borderColor: t.accent, opacity: restantes <= 0 ? 0.5 : 1 }]}
              accessibilityRole="button"
            >
              <Texte style={{ color: t.accentText, fontWeight: "700" }}>{restantes > 0 ? "Piocher une petite récompense" : "Plus de pioche aujourd'hui"}</Texte>
            </TouchableOpacity>
            <TouchableOpacity onPress={changerSeuil} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Seuil : ${seuil} points au plus, toucher pour changer`}>
              <Texte style={[styles.petit, { color: t.textMuted, textAlign: "center" }]}>Jusqu&apos;à {seuil} pts · changer</Texte>
            </TouchableOpacity>
            {rienAPiocher && <Texte style={[styles.petit, { color: t.textMuted, textAlign: "center" }]}>Aucune petite récompense disponible pour l&apos;instant.</Texte>}
          </>
        )}
      </View>

      {/* Suggestion liée au bonhomme : une seule à la fois. */}
      {suggestion && (
        <View style={[styles.suggestion, { backgroundColor: avecAlpha(categorieRecompense("temps").couleur, 0.08), borderColor: avecAlpha(categorieRecompense("temps").couleur, 0.4) }]}>
          <Texte style={[styles.petit, { color: t.textPrimary }]}>{suggestion.message} : un peu de temps pour toi ?</Texte>
          {carte(suggestion.recompense, categorieRecompense("temps").couleur)}
        </View>
      )}

      {/* La vitrine : une étagère par catégorie. */}
      {liste.length === 0 && (
        <Texte style={[styles.petit, { color: t.textMuted, marginTop: spacing.md }]}>Pas encore de récompense : « + » en ajoute une, ou propose des idées toutes prêtes.</Texte>
      )}
      {etageres(liste).map((e) => (
        <View key={e.cle} style={{ marginTop: spacing.lg }}>
          <View style={styles.etagereTitre}>
            <IconeRecompense icone={ICONE_CATEGORIE[e.cle]} couleur={e.couleur} taille={18} />
            <Texte style={[styles.etagereNom, { color: e.couleur }]}>{e.nom}</Texte>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}>
            {e.recompenses.map((r) => carte(r, e.couleur))}
          </ScrollView>
        </View>
      ))}

      {/* Comment je gagne des points : replié */}
      <TouchableOpacity onPress={() => setVoirRegles(!voirRegles)} style={[styles.repliable, { backgroundColor: t.bgCard }]} accessibilityRole="button" accessibilityState={{ expanded: voirRegles }}>
        <View style={styles.piocheLigne}>
          <Texte style={[styles.objectifNom, { color: t.textPrimary, flex: 1 }]}>Comment je gagne des points</Texte>
          <Texte style={{ color: t.textMuted, fontSize: 20 }}>{voirRegles ? "−" : "+"}</Texte>
        </View>
        {voirRegles && (
          <>
            <Texte style={[styles.petit, { color: t.textSecondary, marginTop: spacing.sm }]}>
              Niveau {niveauDePoints(total)} · {totalAffiche(total)} points gagnés au total. Utiliser une récompense ne fait pas baisser le niveau.
            </Texte>
            {REGLES_POINTS.map((r) => (
              <View key={r.action} style={styles.regle}>
                <Texte style={[styles.petit, { color: t.textSecondary, flex: 1 }]}>{r.action}</Texte>
                <Texte style={[styles.petit, { color: t.accentText, fontWeight: "700" }]}>{r.points}</Texte>
              </View>
            ))}
          </>
        )}
      </TouchableOpacity>
    </>
  );

  const galerie = (
    <View style={styles.galerie}>
      {mesSouvenirs.length === 0 && <Texte style={[styles.petit, { color: t.textMuted }]}>Les récompenses utilisées apparaîtront ici, avec leur souvenir.</Texte>}
      {mesSouvenirs.map((s) => {
        const cat = categorieRecompense(s.categorie ?? "temps");
        return (
          <Pressable
            key={s.id}
            onPress={() => setSouvenir({ achatId: s.id, nom: s.nom, texte: s.souvenir_texte ?? "", photo: s.souvenir_photo_uri, ressenti: s.souvenir_ressenti })}
            style={[styles.souvenir, { backgroundColor: t.bgCard }]}
            accessibilityRole="button"
            accessibilityLabel={`${s.nom}, ${dateCourte(s.date, aujourdhui)}${s.souvenir_texte ? ` : ${s.souvenir_texte}` : ""}`}
          >
            {s.souvenir_photo_uri ? (
              <Image source={{ uri: s.souvenir_photo_uri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, { backgroundColor: avecAlpha(cat.couleur, 0.12), alignItems: "center", justifyContent: "center" }]}>
                <IconeRecompense icone={s.icone ?? ICONE_CATEGORIE[cat.cle]} couleur={cat.couleur} taille={30} />
              </View>
            )}
            <View style={{ padding: spacing.sm, gap: 2 }}>
              <Texte style={[styles.carteNom, { color: t.textPrimary }]} numberOfLines={1}>
                {s.nom}
              </Texte>
              <Texte style={[styles.petit, { color: t.textMuted }]}>{dateCourte(s.date, aujourdhui)}</Texte>
              {s.souvenir_texte ? (
                <Texte style={[styles.petit, { color: t.textSecondary }]} numberOfLines={2}>
                  {s.souvenir_texte}
                </Texte>
              ) : null}
              {s.date === aujourdhui && (
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Annuler cette récompense ?", `Les ${s.prix} points de « ${s.nom} » te seront rendus.`, [
                      { text: "Garder", style: "cancel" },
                      {
                        text: "Annuler",
                        onPress: async () => {
                          await annulerAchat(s.id);
                          await charger();
                        },
                      },
                    ])
                  }
                  hitSlop={8}
                >
                  <Texte style={[styles.petit, { color: t.textMuted, textDecorationLine: "underline" }]}>Par erreur ? Annuler</Texte>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.entete}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>Récompenses</Texte>
          <TouchableOpacity
            onPress={() => setFormulaire({ nom: "", icone: null, prix: "60", categorie: "mer" })}
            style={[styles.plus, { backgroundColor: t.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une récompense"
          >
            <Texte style={{ color: t.textOnAccent, fontSize: 24, lineHeight: 28, fontWeight: "600" }}>+</Texte>
          </TouchableOpacity>
        </View>
        <View style={[styles.solde, { backgroundColor: t.bgCard }]}>
          <Texte style={[styles.soldeChiffre, { color: t.accent }]}>{solde}</Texte>
          <Texte style={[styles.petit, { color: t.textSecondary }]}>points à utiliser</Texte>
        </View>

        <View style={[styles.onglets, { borderColor: t.border, backgroundColor: t.bgCard }]}>
          {(
            [
              ["vitrine", "Vitrine"],
              ["souvenirs", "Mes souvenirs"],
            ] as const
          ).map(([cle, libelle]) => (
            <TouchableOpacity
              key={cle}
              onPress={() => setOnglet(cle)}
              style={[styles.onglet, onglet === cle && { backgroundColor: t.accentFonce }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: onglet === cle }}
            >
              <Texte style={{ color: onglet === cle ? t.textOnAccentFonce : t.textSecondary, fontWeight: "600", fontSize: typography.small }}>{libelle}</Texte>
            </TouchableOpacity>
          ))}
        </View>

        {onglet === "vitrine" ? vitrine : galerie}
      </ScrollView>

      {bravo && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Texte style={{ color: t.bgApp, fontWeight: "600", fontSize: typography.bodySmall }}>{bravo}</Texte>
        </View>
      )}

      {/* Détail d'une récompense */}
      <Modal visible={detail !== null} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.fond} onPress={() => setDetail(null)}>
          <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            {detail &&
              (() => {
                const cat = categorieRecompense(detail.categorie);
                const { accessible, part } = etatRecompense(detail.prix, solde);
                return (
                  <>
                    <View style={styles.piocheLigne}>
                      <IconeRecompense icone={detail.icone ?? ICONE_CATEGORIE[cat.cle]} couleur={cat.couleur} taille={30} />
                      <View style={{ flex: 1 }}>
                        <Texte style={[styles.objectifNom, { color: t.textPrimary }]}>{detail.nom}</Texte>
                        <Texte style={[styles.petit, { color: cat.couleur }]}>{cat.nom}</Texte>
                      </View>
                      <Texte style={[styles.objectifNom, { color: t.textSecondary }]}>{detail.prix} pts</Texte>
                    </View>
                    <View style={[styles.barre, { backgroundColor: t.bgApp, marginVertical: spacing.md }]}>
                      <View style={{ flex: part, backgroundColor: cat.couleur, borderRadius: 2 }} />
                      <View style={{ flex: 1 - part }} />
                    </View>
                    <TouchableOpacity
                      onPress={() => onUtiliser(detail)}
                      style={[styles.boutonPlein, { backgroundColor: accessible ? cat.couleur : t.bgApp }]}
                      accessibilityRole="button"
                    >
                      <Texte style={{ color: accessible ? "#05080A" : t.textMuted, fontWeight: "700" }}>{accessible ? "Utiliser" : `Encore ${detail.prix - solde} pts`}</Texte>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => devenirObjectif(detail)} style={[styles.boutonContour, { borderColor: t.border }]} accessibilityRole="button">
                      <Texte style={{ color: t.textPrimary, fontWeight: "600" }}>{objectifId === detail.id ? "Ce n'est plus mon objectif" : "En faire mon objectif"}</Texte>
                    </TouchableOpacity>
                    <View style={styles.piocheLigne}>
                      <TouchableOpacity onPress={() => modifier(detail)} style={[styles.boutonContour, { borderColor: t.border, flex: 1 }]} accessibilityRole="button">
                        <Texte style={{ color: t.textSecondary, fontWeight: "600" }}>Modifier</Texte>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert("Supprimer cette récompense ?", "Les souvenirs déjà enregistrés restent.", [
                            { text: "Garder", style: "cancel" },
                            {
                              text: "Supprimer",
                              style: "destructive",
                              onPress: async () => {
                                if (objectifId === detail.id) await ecrireObjectif(null);
                                await supprimerRecompense(detail.id);
                                setDetail(null);
                                await charger();
                              },
                            },
                          ])
                        }
                        style={[styles.boutonContour, { borderColor: t.border, flex: 1 }]}
                        accessibilityRole="button"
                      >
                        <Texte style={{ color: t.danger, fontWeight: "600" }}>Supprimer</Texte>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Un souvenir (facultatif) : une phrase, une photo, un ressenti. */}
      <Modal visible={souvenir !== null} transparent animationType="fade" onRequestClose={() => setSouvenir(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.fond} onPress={() => setSouvenir(null)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {souvenir && (
                <>
                  <Texte style={[styles.objectifNom, { color: t.textPrimary }]}>Un souvenir de « {souvenir.nom} » ?</Texte>
                  <Texte style={[styles.petit, { color: t.textMuted }]}>Facultatif. Il rejoint ton journal du jour.</Texte>
                  <ChampTexte
                    style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
                    placeholder="Une phrase"
                    placeholderTextColor={t.textMuted}
                    value={souvenir.texte}
                    onChangeText={(texte) => setSouvenir({ ...souvenir, texte })}
                    maxLength={200}
                  />
                  {souvenir.photo ? (
                    <Pressable onPress={() => setSouvenir({ ...souvenir, photo: null })} accessibilityLabel="Retirer la photo">
                      <Image source={{ uri: souvenir.photo }} style={styles.photoGrande} contentFit="cover" />
                      <Texte style={[styles.petit, { color: t.textMuted, textAlign: "center" }]}>Toucher pour retirer</Texte>
                    </Pressable>
                  ) : (
                    <TouchableOpacity
                      onPress={async () => {
                        const [p] = await choisirPhotos(1);
                        if (p) setSouvenir((s) => (s ? { ...s, photo: p } : s));
                      }}
                      style={[styles.boutonContour, { borderColor: t.border }]}
                      accessibilityRole="button"
                    >
                      <Texte style={{ color: t.textSecondary, fontWeight: "600" }}>+ Une photo</Texte>
                    </TouchableOpacity>
                  )}
                  <View style={[styles.piocheLigne, { justifyContent: "space-between" }]}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setSouvenir({ ...souvenir, ressenti: souvenir.ressenti === n ? null : n })}
                        style={{ opacity: souvenir.ressenti === null || souvenir.ressenti === n ? 1 : 0.4 }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: souvenir.ressenti === n }}
                        accessibilityLabel={`Ressenti ${n} sur 5`}
                      >
                        <VisageHumeur niveau={n} taille={40} contour={souvenir.ressenti === n ? t.textPrimary : undefined} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={enregistrerSouvenirSaisi} style={[styles.boutonPlein, { backgroundColor: t.accent }]} accessibilityRole="button">
                    <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Enregistrer</Texte>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSouvenir(null)} hitSlop={8} style={{ alignItems: "center" }}>
                    <Texte style={[styles.petit, { color: t.textSecondary }]}>Plus tard</Texte>
                  </TouchableOpacity>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ajouter ou modifier : titre, catégorie en pastilles, prix, icône facultative. */}
      <Modal visible={formulaire !== null} transparent animationType="fade" onRequestClose={() => setFormulaire(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.fond} onPress={() => setFormulaire(null)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {formulaire && (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
                  <Texte style={[styles.objectifNom, { color: t.textPrimary }]}>{formulaire.id ? "Modifier la récompense" : "Nouvelle récompense"}</Texte>
                  <ChampTexte
                    style={[styles.champ, { backgroundColor: t.bgApp, borderColor: t.border, color: t.textPrimary }]}
                    placeholder="Ex : un café face à la mer"
                    placeholderTextColor={t.textMuted}
                    value={formulaire.nom}
                    onChangeText={(nom) => setFormulaire({ ...formulaire, nom })}
                    autoFocus={!formulaire.id}
                  />
                  <View style={styles.pastilles}>
                    {CATEGORIES_RECOMPENSES.map((c) => {
                      const actif = formulaire.categorie === c.cle;
                      return (
                        <TouchableOpacity
                          key={c.cle}
                          onPress={() => setFormulaire({ ...formulaire, categorie: c.cle })}
                          style={[styles.pastille, { borderColor: actif ? c.couleur : t.border, backgroundColor: actif ? avecAlpha(c.couleur, 0.15) : "transparent" }]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: actif }}
                        >
                          <IconeRecompense icone={ICONE_CATEGORIE[c.cle]} couleur={actif ? c.couleur : t.textMuted} taille={14} />
                          <Texte style={{ color: actif ? c.couleur : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{c.nom}</Texte>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.pastilles}>
                    {PRIX_SUGGERES.map((p) => {
                      const actif = formulaire.prix === String(p);
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setFormulaire({ ...formulaire, prix: String(p) })}
                          style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accentFonce : "transparent" }]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: actif }}
                        >
                          <Texte style={{ color: actif ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{p}</Texte>
                        </TouchableOpacity>
                      );
                    })}
                    <ChampTexte
                      style={[styles.pastille, styles.autrePrix, { borderColor: t.border, color: t.textPrimary }]}
                      placeholder="autre"
                      placeholderTextColor={t.textMuted}
                      keyboardType="number-pad"
                      value={PRIX_SUGGERES.includes(Number(formulaire.prix)) ? "" : formulaire.prix}
                      onChangeText={(prix) => setFormulaire({ ...formulaire, prix: prix.replace(/[^0-9]/g, "") })}
                      accessibilityLabel="Autre prix, en points"
                    />
                  </View>
                  <Texte style={[styles.petit, { color: t.textMuted }]}>Icône (facultatif)</Texte>
                  <View style={styles.icones}>
                    {ICONES_RECOMPENSES.map((i) => {
                      const actif = formulaire.icone === i;
                      const c = categorieRecompense(formulaire.categorie).couleur;
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setFormulaire({ ...formulaire, icone: actif ? null : i })}
                          style={[styles.iconeChoix, { borderColor: actif ? c : "transparent", backgroundColor: actif ? avecAlpha(c, 0.15) : "transparent" }]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: actif }}
                          accessibilityLabel={`Icône ${i}`}
                        >
                          <IconeRecompense icone={i} couleur={actif ? c : t.textSecondary} taille={20} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    onPress={enregistrer}
                    style={[styles.boutonPlein, { backgroundColor: formulaireValide ? t.accent : t.bgApp }]}
                    accessibilityRole="button"
                  >
                    <Texte style={{ color: formulaireValide ? t.textOnAccent : t.textMuted, fontWeight: "700" }}>{formulaireValide ? "Enregistrer" : "Un titre et un prix"}</Texte>
                  </TouchableOpacity>
                  {!formulaire.id && (
                    <TouchableOpacity
                      onPress={() => {
                        const cat = formulaire.categorie;
                        setFormulaire(null);
                        setTimeout(() => setAjoutDe(cat), 350);
                      }}
                      hitSlop={8}
                      style={{ alignItems: "center" }}
                    >
                      <Texte style={[styles.petit, { color: t.accentText, fontWeight: "600" }]}>Ou choisir parmi des idées toutes prêtes</Texte>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <FeuilleAjoutRecompense
        categorie={ajoutDe}
        existantes={liste.map((r) => r.nom)}
        onCreer={(cat) => {
          setAjoutDe(null);
          setTimeout(() => setFormulaire({ nom: "", icone: null, prix: "60", categorie: cat }), 350);
        }}
        onAjouter={async (i, cat) => {
          await ajouterRecompense({ nom: i.nom, icone: i.icone, prix: i.prix, categorie: cat });
          await charger();
        }}
        onFermer={() => setAjoutDe(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  solde: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  soldeChiffre: { fontSize: 34, fontWeight: "700" },
  petit: { fontSize: typography.small, lineHeight: 18 },
  onglets: { flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, padding: 3, marginVertical: spacing.lg },
  onglet: { paddingHorizontal: spacing.lg, minHeight: 36, justifyContent: "center", borderRadius: radius.pill },

  objectif: { flexDirection: "row", alignItems: "center", gap: spacing.lg, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  anneau: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  pourcent: { position: "absolute", fontSize: typography.h3, fontWeight: "700" },
  objectifNom: { fontSize: typography.body, fontWeight: "700" },
  boutonPlein: { minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  boutonContour: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, marginTop: spacing.sm },

  pioche: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
  piocheLigne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  suggestion: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginTop: spacing.md, gap: spacing.sm },

  etagereTitre: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  etagereNom: { fontSize: typography.body, fontWeight: "700" },
  carte: { width: 148, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: 8, minHeight: 132 },
  carteNom: { fontSize: typography.bodySmall, fontWeight: "600", minHeight: 36 },
  cartePrix: { fontSize: typography.small, fontWeight: "700" },
  barre: { height: 4, borderRadius: 2, flexDirection: "row", overflow: "hidden" },

  repliable: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
  regle: { flexDirection: "row", gap: spacing.md, paddingVertical: 6 },

  galerie: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  souvenir: { width: "47%", flexGrow: 1, borderRadius: radius.lg, overflow: "hidden" },
  photo: { width: "100%", aspectRatio: 1 },
  photoGrande: { width: "100%", height: 180, borderRadius: radius.md },

  bandeau: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.lg, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl },
  feuille: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, gap: spacing.sm, maxWidth: 420, width: "100%", alignSelf: "center", maxHeight: "90%" },
  champ: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, minHeight: 44 },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pastille: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 36 },
  autrePrix: { minWidth: 70, fontSize: 16 },
  icones: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  iconeChoix: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à son accueil (voir lib/reset-onglet.ts). */
export default function Recompenses() {
  return <RecompensesContenu key={useCleReset("recompenses")} />;
}
