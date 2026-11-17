import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { BandeJours } from "../../components/BandeJours";
import { Bonhomme, FeuilleZone } from "../../components/Bonhomme";
import { JOURS_LONGS, MOIS } from "../../components/CalendrierMois";
import { MenuOptions } from "../../components/MenuOptions";
import { Glissable, type Option } from "../../components/Options";
import { ChampTexte, Texte } from "../../components/Texte";
import { VisageHumeur } from "../../components/VisageHumeur";
import { useJourCourant } from "../../hooks/useJourCourant";
import { deviner } from "../../lib/catalogue";
import { addItem } from "../../lib/db/items";
import { getListes } from "../../lib/db/listes";
import { lireMeta } from "../../lib/db/meta";
import {
  cocherTache,
  decocherTache,
  definirZoneListe,
  entreesDu,
  entreesEntre,
  getZones,
  joursAvecEntrees,
  lierTache,
  modifierEntree,
  noterEntree,
  restaurerEntree,
  supprimerEntree,
  tachesAFaire,
  textesPasses,
  verifierBonus,
  type Entree,
  type TacheAFaire,
} from "../../lib/db/journee";
import {
  CLE_AFFICHER_TROIS,
  compterParZone,
  couleurZone,
  DUREES,
  libelleDuree,
  modifiable,
  momentDeHeureJournee,
  MOMENTS_JOURNEE,
  PARTIES,
  POINTS_BONUS_ZONES,
  suggestions,
  tacheCorrespondante,
  validerSaisie,
  zoneDeTache,
  ZONES_POUR_BONUS,
  type CleZone,
  type MomentJournee,
  type Zone,
} from "../../lib/journee-regles";
import { NOMS_MOMENT } from "../../lib/moments";
import { semaineDe } from "../../lib/regles-taches";
import { useCleReset } from "../../lib/reset-onglet";
import { radius, spacing, typography, useTheme } from "../../lib/theme";

/** La ligne « + durée · ressenti » reste visible 6 s après une saisie ; « Annuler » une suppression, 5 s. */
const DELAI_DETAILS = 6000;
const DELAI_ANNULER = 5000;
const LETTRES = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Ma journée : le journal de ce que j'ai fait, rangé avec le bonhomme.
 * Toucher une zone → écrire → Entrée ou « + ». Le champ reste ouvert et la zone choisie, pour recopier le carnet d'un trait.
 */
function MaJourneeContenu() {
  const t = useTheme();
  const jour = useJourCourant();
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  const vu = jourChoisi ?? jour;
  const ouvert = modifiable(vu, jour);

  const [zones, setZones] = useState<Zone[]>([]);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [semaine, setSemaine] = useState<Entree[]>([]);
  const [joursPleins, setJoursPleins] = useState<Set<string>>(new Set());
  const [passees, setPassees] = useState<{ texte: string; zone: string; n: number }[]>([]);

  const [zone, setZone] = useState<CleZone | null>(null);
  const [texte, setTexte] = useState("");
  const [moment, setMoment] = useState<MomentJournee>(() => momentDeHeureJournee(new Date().getHours()));
  const [message, setMessage] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<CleZone | null>(null);
  /** L'entrée qui vient d'être saisie : sa ligne « + durée · ressenti ». */
  const [recente, setRecente] = useState<number | null>(null);
  /** L'entrée dont les détails sont ouverts. */
  const [details, setDetails] = useState<number | null>(null);
  const [autreDuree, setAutreDuree] = useState("");
  const [enEdition, setEnEdition] = useState<Entree | null>(null);
  const [menu, setMenu] = useState<Entree | null>(null);
  const [changerZone, setChangerZone] = useState<Entree | null>(null);
  /** « Annuler » pendant 5 s : une suppression, ou une tâche cochée. */
  const [annulable, setAnnulable] = useState<{ texte: string; annuler: () => Promise<void> } | null>(null);
  /** « Cocher aussi … ? » sous l'entrée qui ressemble à une tâche non faite. */
  const [proposition, setProposition] = useState<{ entreeId: number; tache: TacheAFaire } | null>(null);
  /** « À ne pas oublier » : mes tâches, section repliée. */
  const [taches, setTaches] = useState<TacheAFaire[]>([]);
  const [tachesOuvertes, setTachesOuvertes] = useState(false);
  const [nouvelleTache, setNouvelleTache] = useState("");
  /** Tâche d'une liste sans zone : le mini-bonhomme demande la zone. */
  const [zonePour, setZonePour] = useState<TacheAFaire | null>(null);
  const [bravo, setBravo] = useState(false);
  const [afficherTrois, setAfficherTrois] = useState(false);
  const router = useRouter();

  const champ = useRef<TextInput>(null);
  const minuteurRecente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteurAnnuler = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (minuteurRecente.current) clearTimeout(minuteurRecente.current);
      if (minuteurAnnuler.current) clearTimeout(minuteurAnnuler.current);
    },
    [],
  );

  const charger = useCallback(async () => {
    const s = semaineDe(vu);
    const [z, e, sem, j, p, tt, trois] = await Promise.all([
      getZones(),
      entreesDu(vu),
      entreesEntre(s[0], s[6]),
      joursAvecEntrees(),
      textesPasses(),
      tachesAFaire(vu),
      lireMeta(CLE_AFFICHER_TROIS),
    ]);
    setTaches(tt);
    setAfficherTrois(trois === "1");
    setZones(z);
    setEntrees(e);
    setSemaine(sem);
    setJoursPleins(j);
    setPassees(p);
  }, [vu]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  /** Autre jour (null = aujourd'hui) : on repart du moment de l'heure, sans modification en cours. */
  const allerAu = (d: string | null) => {
    setJourChoisi(d);
    setMoment(momentDeHeureJournee(new Date().getHours()));
    setEnEdition(null);
    setDetails(null);
    setMessage(null);
    setProposition(null);
  };

  /** Bonus des 4 zones : petit retour visuel et haptique. */
  const feterBonus = (gagne: boolean) => {
    if (!gagne) return;
    setBravo(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setBravo(false), 4000);
  };

  const proposerAnnulation = (texte: string, annuler: () => Promise<void>) => {
    setAnnulable({ texte, annuler });
    if (minuteurAnnuler.current) clearTimeout(minuteurAnnuler.current);
    minuteurAnnuler.current = setTimeout(() => setAnnulable(null), DELAI_ANNULER);
  };

  const actives = zones.filter((z) => z.active);
  const parCle = Object.fromEntries(zones.map((z) => [z.cle, z])) as Record<CleZone, Zone>;
  const comptes = compterParZone(entrees);
  const visibles = filtre ? entrees.filter((e) => e.zone === filtre) : entrees;
  const proposees = ouvert && !enEdition ? suggestions(texte, zone, passees) : [];

  const choisirZone = (cle: CleZone) => {
    // Le focus d'abord, dans le geste : sinon Safari n'ouvre pas le clavier.
    champ.current?.focus();
    setZone(cle);
    setMessage(null);
    Haptics.selectionAsync().catch(() => {});
  };

  const valider = async () => {
    const erreur = validerSaisie(zone, texte);
    if (erreur || !zone) {
      setMessage(erreur);
      return;
    }
    if (enEdition) {
      await modifierEntree(enEdition.id, { texte, zone, moment });
      setEnEdition(null);
    } else {
      const { id, bonus } = await noterEntree({ jour: vu, moment, zone, texte });
      feterBonus(bonus);
      const tache = tacheCorrespondante(texte, taches);
      setProposition(tache ? { entreeId: id, tache } : null);
      setRecente(id);
      if (minuteurRecente.current) clearTimeout(minuteurRecente.current);
      minuteurRecente.current = setTimeout(() => setRecente(null), DELAI_DETAILS);
    }
    setTexte("");
    setMessage(null);
    await charger();
    champ.current?.focus();
  };

  const modifier = (e: Entree) => {
    setEnEdition(e);
    setZone(e.zone);
    setTexte(e.texte);
    setMoment(e.moment);
    setDetails(null);
    champ.current?.focus();
  };

  const supprimer = async (e: Entree) => {
    const supprimee = await supprimerEntree(e.id);
    if (!supprimee) return;
    proposerAnnulation(`« ${supprimee.texte} » supprimée`, () => restaurerEntree(supprimee));
    await charger();
  };

  const annuler = async () => {
    if (!annulable) return;
    const a = annulable;
    setAnnulable(null);
    await a.annuler();
    await charger();
  };

  /** Toucher une tâche = la cocher ; elle devient une entrée dans la zone de sa liste (demandée une fois si inconnue). */
  const cocher = async (tache: TacheAFaire, zoneChoisie?: CleZone) => {
    const z = zoneChoisie ?? zoneDeTache(tache);
    if (!z) {
      setZonePour(tache);
      return;
    }
    const { id, bonus } = await cocherTache(tache, z, vu, moment);
    feterBonus(bonus);
    Haptics.selectionAsync().catch(() => {});
    proposerAnnulation(`« ${tache.nom} » cochée · ${PARTIES[z]}`, () => decocherTache(id));
    await charger();
  };

  const lier = async () => {
    if (!proposition) return;
    const p = proposition;
    setProposition(null);
    await lierTache(p.entreeId, p.tache.id);
    Haptics.selectionAsync().catch(() => {});
    await charger();
  };

  const ajouterTache = async () => {
    const nom = nouvelleTache.trim();
    if (!nom) return;
    const listes = await getListes();
    await addItem({ nom, type: "tache", categorie: deviner(nom)?.categorie ?? null, liste_id: listes[0]?.id ?? null });
    setNouvelleTache("");
    await charger();
  };

  const majDetails = async (e: Entree, champs: { duree_min?: number | null; ressenti?: number | null }) => {
    await modifierEntree(e.id, champs);
    await charger();
  };

  const options = (e: Entree): Option[] => [
    { libelle: "Modifier", onPress: () => modifier(e) },
    // Le menu se ferme d'abord : la feuille du bonhomme s'ouvre juste après.
    { libelle: "Changer de zone", onPress: () => setTimeout(() => setChangerZone(e), 350) },
    { libelle: "Supprimer", onPress: () => supprimer(e), danger: true },
  ];

  const date = new Date(vu + "T00:00:00Z");

  // ─── Détails facultatifs : durée et ressenti ───
  const panneauDetails = (e: Entree) => (
    <View style={[styles.details, { borderColor: t.border }]}>
      <Texte style={[styles.detailsTitre, { color: t.textMuted }]}>Durée</Texte>
      <View style={styles.pastilles}>
        {DUREES.map((m) => {
          const actif = e.duree_min === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => majDetails(e, { duree_min: actif ? null : m })}
              style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accentFonce : "transparent" }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
            >
              <Texte style={{ color: actif ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{libelleDuree(m)}</Texte>
            </TouchableOpacity>
          );
        })}
        <ChampTexte
          style={[styles.autre, { borderColor: t.border, color: t.textPrimary }]}
          placeholder={e.duree_min && !DUREES.includes(e.duree_min) ? `${e.duree_min} min` : "autre"}
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          value={autreDuree}
          onChangeText={setAutreDuree}
          onSubmitEditing={() => {
            const n = parseInt(autreDuree, 10);
            setAutreDuree("");
            if (n > 0) majDetails(e, { duree_min: n });
          }}
          onBlur={() => {
            const n = parseInt(autreDuree, 10);
            setAutreDuree("");
            if (n > 0) majDetails(e, { duree_min: n });
          }}
          accessibilityLabel="Autre durée, en minutes"
        />
      </View>
      <Texte style={[styles.detailsTitre, { color: t.textMuted }]}>Ressenti</Texte>
      <View style={styles.pastilles}>
        {[1, 2, 3, 4, 5].map((n) => {
          const actif = e.ressenti === n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => majDetails(e, { ressenti: actif ? null : n })}
              style={{ opacity: e.ressenti === null || actif ? 1 : 0.45 }}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={`Ressenti ${n} sur 5`}
            >
              <VisageHumeur niveau={n} taille={36} contour={actif ? t.textPrimary : undefined} />
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity onPress={() => setDetails(null)} hitSlop={8} style={{ alignSelf: "flex-end" }}>
        <Texte style={[styles.lien, { color: t.accentText }]}>OK</Texte>
      </TouchableOpacity>
    </View>
  );

  const ligne = (e: Entree) => {
    const z = parCle[e.zone];
    const infos = [NOMS_MOMENT[e.moment], e.duree_min ? libelleDuree(e.duree_min) : null].filter(Boolean).join(" · ");
    const contenu = (
      <Pressable
        onPress={() => ouvert && setDetails(details === e.id ? null : e.id)}
        onLongPress={() => ouvert && setMenu(e)}
        style={[styles.entree, { backgroundColor: t.bgCard }]}
        accessibilityRole={ouvert ? "button" : undefined}
        accessibilityHint={ouvert ? "Touche pour la durée et le ressenti, appui long pour modifier" : undefined}
      >
        <View style={[styles.point, { backgroundColor: z?.couleur ?? t.textMuted }]} />
        <View style={{ flex: 1 }}>
          <Texte style={[styles.entreeTexte, { color: t.textPrimary }]}>{e.texte}</Texte>
          <Texte style={[styles.entreeInfos, { color: t.textMuted }]}>{infos}</Texte>
        </View>
        {e.ressenti ? <VisageHumeur niveau={e.ressenti} taille={22} /> : null}
      </Pressable>
    );
    return (
      <View key={e.id} style={{ marginBottom: spacing.sm }}>
        {ouvert ? (
          <Glissable
            options={options(e)}
            titre={e.texte}
            renderRightActions={() => (
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => modifier(e)} style={[styles.action, { backgroundColor: t.bgCardActive }]}>
                  <Texte style={{ color: t.textPrimary, fontWeight: "600" }}>Modifier</Texte>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChangerZone(e)} style={[styles.action, { backgroundColor: t.bgCardActive }]}>
                  <Texte style={{ color: t.textPrimary, fontWeight: "600" }}>Zone</Texte>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => supprimer(e)} style={[styles.action, { backgroundColor: t.danger }]}>
                  <Texte style={{ color: t.bgApp, fontWeight: "700" }}>Supprimer</Texte>
                </TouchableOpacity>
              </View>
            )}
          >
            {contenu}
          </Glissable>
        ) : (
          contenu
        )}
        {recente === e.id && details !== e.id && (
          <TouchableOpacity onPress={() => setDetails(e.id)} hitSlop={8} style={styles.plusDetails}>
            <Texte style={[styles.lien, { color: t.accentText }]}>+ durée · ressenti</Texte>
          </TouchableOpacity>
        )}
        {proposition?.entreeId === e.id && (
          <View style={styles.proposition}>
            <TouchableOpacity onPress={lier} hitSlop={6} style={{ flex: 1 }} accessibilityRole="button">
              <Texte style={[styles.lien, { color: t.accentText }]}>Cocher aussi « {proposition.tache.nom} » ?</Texte>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProposition(null)} hitSlop={10} accessibilityLabel="Non merci">
              <Texte style={{ color: t.textMuted, fontSize: typography.body }}>✕</Texte>
            </TouchableOpacity>
          </View>
        )}
        {details === e.id && panneauDetails(e)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bgApp }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}>
        <Texte style={[styles.jourSemaine, { color: t.accent }]}>{JOURS_LONGS[date.getUTCDay()].toUpperCase()}</Texte>
        <Texte style={[styles.date, { color: t.textPrimary }]}>
          {date.getUTCDate()} {MOIS[date.getUTCMonth()]}
        </Texte>

        <BandeJours aujourdhui={jour} choisi={jourChoisi} prevus={joursPleins} onChoisir={allerAu} />

        {/* Le bonhomme à gauche, la légende à droite (toucher = filtre). */}
        <View style={styles.haut}>
          <Bonhomme zones={zones} comptes={comptes} choisie={ouvert ? zone : null} onChoisir={ouvert ? choisirZone : undefined} />
          <View style={styles.legende}>
            {actives.map((z) => {
              const n = comptes[z.cle] ?? 0;
              const actif = filtre === z.cle;
              return (
                <TouchableOpacity
                  key={z.cle}
                  onPress={() => setFiltre(actif ? null : z.cle)}
                  style={[styles.legendeLigne, actif && { backgroundColor: t.bgCardActive }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  accessibilityLabel={`Filtrer : ${z.libelle}, ${n} entrée${n > 1 ? "s" : ""}`}
                >
                  <View style={[styles.legendePoint, { backgroundColor: couleurZone(z.couleur, Math.max(n, 1)) }]} />
                  <Texte style={[styles.legendeTexte, { color: n ? t.textPrimary : t.textMuted }]} numberOfLines={2}>
                    {z.libelle}
                  </Texte>
                  <Texte style={[styles.legendeNombre, { color: n ? t.textPrimary : t.textMuted }]}>{n || ""}</Texte>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {bravo && (
          <Texte style={[styles.bravo, { color: t.textPrimary, backgroundColor: t.bgCardActive }]}>
            ✦ {ZONES_POUR_BONUS} zones colorées : +{POINTS_BONUS_ZONES} points
          </Texte>
        )}

        {ouvert ? (
          <View style={styles.saisie}>
            <View style={styles.pastilles}>
              {MOMENTS_JOURNEE.map((m) => {
                const actif = moment === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMoment(m)}
                    style={[styles.pastille, { borderColor: actif ? t.accent : t.border, backgroundColor: actif ? t.accentFonce : "transparent" }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                  >
                    <Texte style={{ color: actif ? t.textOnAccentFonce : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{NOMS_MOMENT[m]}</Texte>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.ligneSaisie}>
              {zone && <View style={[styles.point, { backgroundColor: parCle[zone]?.couleur }]} />}
              <ChampTexte
                ref={champ}
                style={[styles.champ, { backgroundColor: t.bgCard, borderColor: zone ? parCle[zone]?.couleur : t.border, color: t.textPrimary }]}
                placeholder={zone ? `Ce que j'ai fait… (${PARTIES[zone].toLowerCase()})` : "Ce que j'ai fait…"}
                placeholderTextColor={t.textMuted}
                value={texte}
                onChangeText={(v) => {
                  setTexte(v);
                  if (message) setMessage(null);
                }}
                onSubmitEditing={valider}
                submitBehavior="submit"
                returnKeyType="done"
                accessibilityLabel="Ce que j'ai fait"
              />
              <TouchableOpacity onPress={valider} style={[styles.plus, { backgroundColor: t.accent }]} accessibilityRole="button" accessibilityLabel={enEdition ? "Enregistrer" : "Ajouter"}>
                <Texte style={[styles.plusTexte, { color: t.textOnAccent }]}>{enEdition ? "✓" : "+"}</Texte>
              </TouchableOpacity>
            </View>
            {message && <Texte style={[styles.message, { color: t.accentText }]}>{message}</Texte>}
            {enEdition && (
              <TouchableOpacity
                onPress={() => {
                  setEnEdition(null);
                  setTexte("");
                }}
                hitSlop={8}
              >
                <Texte style={[styles.lien, { color: t.textSecondary }]}>Annuler la modification</Texte>
              </TouchableOpacity>
            )}
            {proposees.length > 0 && (
              <View style={styles.pastilles}>
                {proposees.map((s) => (
                  <TouchableOpacity key={s} onPress={() => setTexte(s)} style={[styles.pastille, { borderColor: t.border }]} accessibilityLabel={`Suggestion : ${s}`}>
                    <Texte style={{ color: t.textSecondary, fontSize: typography.small }}>{s}</Texte>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Texte style={[styles.message, { color: t.textMuted }]}>{vu > jour ? "Ce jour n'est pas encore là." : "Lecture seule : ce jour a plus de 7 jours."}</Texte>
        )}

        <View style={{ marginTop: spacing.md }}>{visibles.map(ligne)}</View>

        {/* La semaine en bonhommes : toucher un jour = y aller. */}
        <View style={styles.semaine}>
          {semaineDe(vu).map((d, i) => {
            const actif = d === vu;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => allerAu(d === jour ? null : d)}
                style={[styles.jourMini, actif && { backgroundColor: t.bgCardActive }]}
                accessibilityRole="button"
                accessibilityLabel={`${JOURS_LONGS[new Date(d + "T00:00:00Z").getUTCDay()]} ${Number(d.slice(8))}`}
              >
                <Bonhomme zones={zones} comptes={compterParZone(semaine.filter((e) => e.jour === d))} largeur={26} plein />
                <Texte style={[styles.lettre, { color: actif ? t.textPrimary : t.textMuted }]}>{LETTRES[i]}</Texte>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* À ne pas oublier : mes tâches, repliées, sans compteur ni retard. Toucher = cocher. */}
        <TouchableOpacity
          onPress={() => setTachesOuvertes(!tachesOuvertes)}
          style={[styles.section, { borderTopColor: t.border }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: tachesOuvertes }}
        >
          <Texte style={[styles.sectionTitre, { color: t.textSecondary }]}>À ne pas oublier</Texte>
          <Texte style={{ color: t.textMuted, fontSize: typography.body }}>{tachesOuvertes ? "▾" : "▸"}</Texte>
        </TouchableOpacity>
        {tachesOuvertes && (
          <View style={{ gap: 2 }}>
            {taches.map((tache) => (
              <TouchableOpacity
                key={tache.id}
                onPress={() => (ouvert ? cocher(tache) : undefined)}
                disabled={!ouvert}
                style={styles.tache}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false, disabled: !ouvert }}
              >
                <View style={[styles.caseTache, { borderColor: t.textMuted }]} />
                <Texte style={{ color: t.textPrimary, fontSize: typography.body, flex: 1 }}>{tache.nom}</Texte>
              </TouchableOpacity>
            ))}
            <View style={styles.ligneSaisie}>
              <ChampTexte
                style={[styles.champ, { backgroundColor: t.bgCard, borderColor: t.border, color: t.textPrimary }]}
                placeholder="Ajouter une tâche…"
                placeholderTextColor={t.textMuted}
                value={nouvelleTache}
                onChangeText={setNouvelleTache}
                onSubmitEditing={ajouterTache}
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        {afficherTrois && (
          <TouchableOpacity onPress={() => router.push("/mes-trois" as never)} style={[styles.section, { borderTopColor: t.border }]} accessibilityRole="link">
            <Texte style={[styles.sectionTitre, { color: t.textSecondary }]}>Mes 3 priorités</Texte>
            <Texte style={{ color: t.textMuted, fontSize: typography.body }}>→</Texte>
          </TouchableOpacity>
        )}
      </ScrollView>

      <FeuilleZone
        visible={zonePour !== null}
        titre={zonePour ? `« ${zonePour.nom} » : quelle zone ?` : ""}
        sousTitre={zonePour?.liste_nom ? `Pour toute la liste « ${zonePour.liste_nom} » (modifiable dans Mes listes).` : undefined}
        zones={zones}
        choisie={null}
        onChoisir={async (cle) => {
          if (!zonePour) return;
          const tache = zonePour;
          setZonePour(null);
          if (tache.liste_id !== null) await definirZoneListe(tache.liste_id, cle);
          await cocher(tache, cle);
        }}
        onFermer={() => setZonePour(null)}
      />

      <MenuOptions titre={menu?.texte ?? ""} options={menu ? options(menu) : []} onFermer={() => setMenu(null)} />

      <FeuilleZone
        visible={changerZone !== null}
        titre="Changer de zone"
        zones={zones}
        choisie={changerZone?.zone ?? null}
        onChoisir={async (cle) => {
          if (!changerZone) return;
          const e = changerZone;
          setChangerZone(null);
          await modifierEntree(e.id, { zone: cle });
          feterBonus(await verifierBonus(e.jour));
          await charger();
        }}
        onFermer={() => setChangerZone(null)}
      />

      {annulable && (
        <View style={[styles.bandeau, { backgroundColor: t.textPrimary }]}>
          <Texte style={[styles.bandeauTexte, { color: t.bgApp }]} numberOfLines={1}>
            {annulable.texte}
          </Texte>
          <TouchableOpacity onPress={annuler} hitSlop={10}>
            <Texte style={[styles.bandeauAction, { color: t.bgApp }]}>Annuler</Texte>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  jourSemaine: { fontSize: typography.small, fontWeight: "700", letterSpacing: 1 },
  date: { fontSize: 30, fontWeight: "600", marginBottom: spacing.md },

  haut: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignItems: "flex-start" },
  legende: { flex: 1, gap: 2 },
  legendeLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 36, paddingHorizontal: 6, borderRadius: radius.sm },
  legendePoint: { width: 12, height: 12, borderRadius: 6 },
  legendeTexte: { flex: 1, fontSize: typography.tiny, lineHeight: 15 },
  legendeNombre: { fontSize: typography.small, fontWeight: "700", minWidth: 14, textAlign: "right" },

  saisie: { marginTop: spacing.lg, gap: spacing.sm },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pastille: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, minHeight: 32, justifyContent: "center" },
  ligneSaisie: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // 16 px : en dessous, Safari zoome au focus (voir scripts/build-web.mjs).
  champ: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, minHeight: 44 },
  plus: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  plusTexte: { fontSize: 24, lineHeight: 28, fontWeight: "600" },
  message: { fontSize: typography.small, marginTop: spacing.xs },
  lien: { fontSize: typography.small, fontWeight: "600" },

  entree: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, padding: spacing.md },
  point: { width: 10, height: 10, borderRadius: 5 },
  entreeTexte: { fontSize: typography.body },
  entreeInfos: { fontSize: typography.tiny, marginTop: 2 },
  plusDetails: { paddingVertical: 6, paddingLeft: spacing.xxl },
  actions: { flexDirection: "row", gap: 4, paddingLeft: 6 },
  action: { justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.md },

  details: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: 4, gap: spacing.sm },
  detailsTitre: { fontSize: typography.tiny, fontWeight: "700", letterSpacing: 0.5 },
  autre: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, minWidth: 70, minHeight: 32, fontSize: 16 },

  semaine: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl },
  jourMini: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, borderRadius: radius.sm, minWidth: 40 },
  lettre: { fontSize: typography.tiny, fontWeight: "700", marginTop: 4 },


  proposition: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 6, paddingLeft: spacing.xxl },
  bravo: { marginTop: spacing.md, borderRadius: radius.md, padding: spacing.md, fontSize: typography.bodySmall, fontWeight: "700", textAlign: "center", overflow: "hidden" },
  section: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, marginTop: spacing.xl, paddingTop: spacing.lg, minHeight: 44 },
  sectionTitre: { fontSize: typography.body, fontWeight: "700" },
  tache: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  caseTache: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5 },
  bandeau: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bandeauTexte: { flex: 1, fontSize: typography.bodySmall },
  bandeauAction: { fontSize: typography.bodySmall, fontWeight: "700", textDecorationLine: "underline" },
});

/** Toucher l'onglet déjà ouvert remonte l'écran : retour à aujourd'hui (voir lib/reset-onglet.ts). */
export default function MaJournee() {
  return <MaJourneeContenu key={useCleReset("taches")} />;
}
