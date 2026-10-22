import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDown, ArrowUp, Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import { FeuilleAvance } from "../components/FeuilleAvance";
import { IconeProjet } from "../components/IconeProjet";
import { BoutonOptions, type Option } from "../components/Options";
import { ChampTexte, Texte } from "../components/Texte";
import {
  ajouterEntree,
  ajouterEtape,
  ajouterLien,
  ajouterMateriel,
  ajouterPhotoFinale,
  basculerEtape,
  basculerMateriel,
  changerEtat,
  deplacerEtape,
  enregistrerNotes,
  estPourAujourdhui,
  pourAujourdhui,
  rattraperProjets,
  tacheDeLEtape,
  lireProjet,
  listerEtapes,
  listerJournal,
  listerLiens,
  listerMateriel,
  listerTypes,
  photosDuJournal,
  photosFinales,
  renommerEtape,
  supprimerEntree,
  supprimerEtape,
  supprimerLien,
  supprimerMateriel,
  supprimerPhoto,
  supprimerProjet,
  type EntreeJournal,
  type EtapeBdd,
  type LienProjet,
  type Materiel,
  type PhotoProjet,
  type Projet,
  type TypeProjet,
} from "../lib/db/projets";
import { getAujourdhui } from "../lib/db/completions";
import { dateCourte } from "../lib/esprit-regles";
import { choisirPhotos } from "../lib/photos";
import { avancement, avantMaintenant, ETATS_PROJET, etapesOrdonnees, libelleDuree, prochaineEtape, tempsTotal, toutEstFait, urlValide } from "../lib/projets-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Saisie = { titre: string; valeur: string; ok: (v: string) => Promise<void> | void };

/** La fiche d'un projet : prochaine étape, étapes, journal de bord, matériel, notes et liens. */
export default function FicheProjet() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projetId = Number(id);

  const [projet, setProjet] = useState<Projet | null>(null);
  const [type, setType] = useState<TypeProjet | null>(null);
  const [etapes, setEtapes] = useState<EtapeBdd[]>([]);
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [photos, setPhotos] = useState<PhotoProjet[]>([]);
  const [finales, setFinales] = useState<PhotoProjet[]>([]);
  const [materiel, setMateriel] = useState<Materiel[]>([]);
  const [liens, setLiens] = useState<LienProjet[]>([]);
  const [notes, setNotes] = useState("");
  const [nouvelleEtape, setNouvelleEtape] = useState("");
  const [nouveauMateriel, setNouveauMateriel] = useState("");
  const [lienTitre, setLienTitre] = useState("");
  const [lienUrl, setLienUrl] = useState("");
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [entree, setEntree] = useState<{ note: string; minutes: string; photos: string[] } | null>(null);
  const [avance, setAvance] = useState(false);
  const [dansTrois, setDansTrois] = useState(false);
  const [message, setMessage] = useState("");
  const [curseur, setCurseur] = useState(50);
  const [largeur, setLargeur] = useState(0);

  const charger = useCallback(async () => {
    await rattraperProjets();
    const p = await lireProjet(projetId);
    setProjet(p);
    if (!p) return;
    const [types, e, j, ph, f, m, l] = await Promise.all([
      listerTypes(),
      listerEtapes(projetId),
      listerJournal(projetId),
      photosDuJournal(projetId),
      photosFinales(projetId),
      listerMateriel(projetId),
      listerLiens(projetId),
    ]);
    setType(types.find((x) => x.id === p.type_id) ?? null);
    setEtapes(e);
    setJournal(j);
    setPhotos(ph);
    setFinales(f);
    setMateriel(m);
    setLiens(l);
    setNotes(p.notes);
    const suivante = prochaineEtape(e);
    setDansTrois(suivante ? await estPourAujourdhui(suivante.id, getAujourdhui()) : false);
  }, [projetId]);
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (!projet) return <View style={{ flex: 1, backgroundColor: t.bgApp }} />;

  const couleur = type?.couleur ?? t.accent;
  const av = avancement(etapes);
  const prochaine = prochaineEtape(etapes);
  const minutes = tempsTotal(journal);
  const duo = avantMaintenant(photos);

  const confirmer = (titre: string, message: string, action: () => Promise<void>) =>
    Alert.alert(titre, message, [
      { text: "Garder", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => action().then(charger) },
    ]);

  const cocher = async (idEtape: number) => {
    setMessage("");
    await basculerEtape(idEtape);
    await charger();
  };

  const pourAujourdhuiClic = async (idEtape: number) => {
    const ok = await pourAujourdhui(idEtape, getAujourdhui());
    setMessage(ok ? "Ajoutée à Mes 3 d'aujourd'hui." : "Tes 3 emplacements du jour sont déjà pris.");
    await charger();
  };

  const jeMyMets = async (idEtape: number) => {
    const item = await tacheDeLEtape(idEtape);
    if (item !== null) router.push(`/je-commence?id=${item}&projet=${projetId}` as never);
  };

  const ajouterPhotoFin = async () => {
    const [p] = await choisirPhotos(1);
    if (p) {
      await ajouterPhotoFinale(projetId, p);
      await charger();
    }
  };

  const optionsProjet: Option[] = [
    { libelle: "Modifier le projet", onPress: () => router.push(`/projet-edition?id=${projetId}` as never) },
    { libelle: "Supprimer le projet", danger: true, onPress: () => Alert.alert(`Supprimer « ${projet.nom} » ?`, "Ses étapes, son journal et ses photos seront effacés.", [{ text: "Garder", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: async () => { await supprimerProjet(projetId); router.back(); } }]) },
  ];

  const optionsEtape = (e: { id: number; nom: string; niveau: 0 | 1 }): Option[] => [
    { libelle: "Modifier", onPress: () => setSaisie({ titre: "Modifier l'étape", valeur: e.nom, ok: async (v) => { await renommerEtape(e.id, v); await charger(); } }) },
    ...(e.niveau === 0
      ? [{ libelle: "Ajouter une sous-étape", onPress: () => setSaisie({ titre: `Sous-étape de « ${e.nom} »`, valeur: "", ok: async (v) => { await ajouterEtape(projetId, v, e.id); await charger(); } }) }]
      : []),
    { libelle: "Supprimer", danger: true, onPress: () => confirmer(`Supprimer « ${e.nom} » ?`, e.niveau === 0 ? "Ses sous-étapes aussi." : "", () => supprimerEtape(e.id)) },
  ];

  const enregistrerEntree = async () => {
    if (!entree) return;
    const m = parseInt(entree.minutes, 10);
    if (!entree.note.trim() && entree.photos.length === 0 && !(m > 0)) return;
    await ajouterEntree(projetId, { note: entree.note, minutes: Number.isFinite(m) ? m : 0, photos: entree.photos });
    setEntree(null);
    await charger();
  };

  const glisser = (e: GestureResponderEvent) => {
    if (largeur > 0) setCurseur(Math.min(100, Math.max(0, Math.round((e.nativeEvent.locationX / largeur) * 100))));
  };

  const ajouterUnLien = async () => {
    const u = urlValide(lienUrl);
    if (!u) return;
    await ajouterLien(projetId, lienTitre, u);
    setLienTitre("");
    setLienUrl("");
    await charger();
  };

  const champ = [styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgCard }];
  const titreSection = (s: string) => <Texte style={[styles.etiquette, { color: t.textMuted }]}>{s}</Texte>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bgApp }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.ecran} keyboardShouldPersistTaps="handled">
        <View style={styles.entete}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Texte style={{ color: t.accentText, fontSize: typography.body }}>← Projets</Texte>
          </TouchableOpacity>
          <BoutonOptions options={optionsProjet} titre={projet.nom} />
        </View>

        {/* En-tête : couverture, nom, type, état, jauge, temps */}
        <View style={[styles.couverture, { backgroundColor: couleur + "33" }]}>
          {projet.couverture ? <Image source={{ uri: projet.couverture }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <IconeProjet nom={type?.icone ?? "sparkles"} couleur={couleur} taille={56} />}
        </View>
        <Texte style={[styles.titre, { color: t.textPrimary }]}>{projet.nom}</Texte>
        <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>{type?.nom ?? "Autre"}</Texte>
        {projet.pourquoi ? <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.xs }}>{projet.pourquoi}</Texte> : null}

        <View style={styles.puces}>
          {ETATS_PROJET.map((e) => {
            const actif = projet.etat === e.cle;
            return (
              <TouchableOpacity
                key={e.cle}
                onPress={async () => {
                  await changerEtat(projetId, e.cle);
                  await charger();
                }}
                style={[styles.puce, { borderColor: actif ? couleur : t.border, backgroundColor: actif ? couleur + "33" : "transparent" }]}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <Texte style={{ color: actif ? t.textPrimary : t.textSecondary, fontSize: typography.small, fontWeight: "600" }}>{e.nom}</Texte>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.piste, { backgroundColor: t.border }]}>
          <View style={{ width: `${Math.round(av.jauge * 100)}%`, height: "100%", backgroundColor: couleur, borderRadius: 4 }} />
        </View>
        <Texte style={{ color: t.textMuted, fontSize: typography.small, marginTop: 4 }}>
          {av.total === 0 ? "Pas encore d'étape" : `${av.faites} étape${av.faites > 1 ? "s" : ""} sur ${av.total}`}
          {minutes > 0 ? ` · ${libelleDuree(minutes)} passées dessus` : ""}
        </Texte>

        {/* Prochaine étape */}
        {titreSection("PROCHAINE ÉTAPE")}
        <View style={[styles.carte, { backgroundColor: t.bgCard, borderColor: couleur }]}>
          {prochaine ? (
            <>
              <Texte style={{ color: t.textPrimary, fontSize: typography.h3, fontWeight: "600" }}>{prochaine.nom}</Texte>
              <TouchableOpacity onPress={() => jeMyMets(prochaine.id)} style={[styles.action, { backgroundColor: couleur }]} accessibilityRole="button">
                <Texte style={{ color: "#000", fontWeight: "700" }}>▶ Je m&apos;y mets</Texte>
              </TouchableOpacity>
              <View style={styles.ligne}>
                <TouchableOpacity onPress={() => pourAujourdhuiClic(prochaine.id)} style={[styles.secondaire, { borderColor: couleur }]} accessibilityRole="button">
                  <Texte style={{ color: t.textPrimary, fontWeight: "600", fontSize: typography.bodySmall }}>{dansTrois ? "★ Dans Mes 3" : "★ Pour aujourd'hui"}</Texte>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => cocher(prochaine.id)} style={[styles.secondaire, { borderColor: t.border }]} accessibilityRole="button">
                  <Check color={t.textSecondary} size={16} />
                  <Texte style={{ color: t.textSecondary, fontWeight: "600", fontSize: typography.bodySmall }}>C&apos;est fait</Texte>
                </TouchableOpacity>
              </View>
              {message ? <Texte style={{ color: t.textMuted, fontSize: typography.small }}>{message}</Texte> : null}
            </>
          ) : toutEstFait(etapes) ? (
            <>
              <Texte style={{ color: t.textPrimary, fontSize: typography.body, fontWeight: "600" }}>Toutes les étapes sont faites.</Texte>
              {projet.etat !== "fini" && (
                <TouchableOpacity
                  onPress={async () => {
                    await changerEtat(projetId, "fini");
                    await charger();
                  }}
                  style={[styles.action, { backgroundColor: couleur }]}
                  accessibilityRole="button"
                >
                  <Texte style={{ color: "#000", fontWeight: "700" }}>Marquer le projet comme fini</Texte>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall }}>Ajoute une première étape ci-dessous, même toute petite.</Texte>
          )}
        </View>

        <TouchableOpacity onPress={() => setAvance(true)} style={[styles.bouton, { borderColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontWeight: "600" }}>J&apos;ai avancé</Texte>
        </TouchableOpacity>

        {/* Réalisation : photos finales d'un projet fini */}
        {projet.etat === "fini" && (
          <>
            {titreSection("MA RÉALISATION")}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {finales.map((p) => (
                <TouchableOpacity key={p.id} onLongPress={() => confirmer("Retirer cette photo ?", "", () => supprimerPhoto(p.id))}>
                  <Image source={{ uri: p.data }} style={styles.finale} resizeMode="cover" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={ajouterPhotoFin} style={[styles.finale, styles.ajoutPhoto, { borderColor: t.border }]} accessibilityRole="button">
                <Texte style={{ color: t.textSecondary, fontSize: typography.small, textAlign: "center" }}>+ Photo finale</Texte>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* Étapes */}
        {titreSection("ÉTAPES")}
        {etapesOrdonnees(etapes).map((e) => {
          const fait = e.faite === 1;
          return (
            <View key={e.id} style={[styles.etape, { marginLeft: e.niveau * spacing.xl, backgroundColor: t.bgCard, borderColor: t.border }]}>
              <TouchableOpacity
                onPress={() => cocher(e.id)}
                style={[styles.case, { borderColor: fait ? couleur : t.border, backgroundColor: fait ? couleur : "transparent" }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: fait }}
                accessibilityLabel={e.nom}
                hitSlop={6}
              >
                {fait && <Check color="#000" size={14} />}
              </TouchableOpacity>
              <Texte style={{ flex: 1, color: fait ? t.textMuted : t.textPrimary, fontSize: typography.body, textDecorationLine: fait ? "line-through" : "none" }}>{e.nom}</Texte>
              <TouchableOpacity onPress={() => deplacerEtape(e.id, -1).then(charger)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Monter ${e.nom}`}>
                <ArrowUp color={t.textMuted} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deplacerEtape(e.id, 1).then(charger)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Descendre ${e.nom}`}>
                <ArrowDown color={t.textMuted} size={18} />
              </TouchableOpacity>
              <BoutonOptions options={optionsEtape(e)} titre={e.nom} />
            </View>
          );
        })}
        <View style={styles.ajoutLigne}>
          <ChampTexte
            value={nouvelleEtape}
            onChangeText={setNouvelleEtape}
            placeholder="Ajouter une étape"
            placeholderTextColor={t.textMuted}
            style={[...champ, { flex: 1 }]}
            onSubmitEditing={async () => {
              await ajouterEtape(projetId, nouvelleEtape);
              setNouvelleEtape("");
              await charger();
            }}
            returnKeyType="done"
            accessibilityLabel="Nouvelle étape"
          />
          <TouchableOpacity
            onPress={async () => {
              await ajouterEtape(projetId, nouvelleEtape);
              setNouvelleEtape("");
              await charger();
            }}
            style={[styles.plus, { backgroundColor: nouvelleEtape.trim() ? t.accent : t.border }]}
            accessibilityRole="button"
            accessibilityLabel="Ajouter l'étape"
          >
            <Texte style={{ color: t.textOnAccent, fontWeight: "700", fontSize: 20 }}>+</Texte>
          </TouchableOpacity>
        </View>

        {/* Journal de bord */}
        {titreSection("JOURNAL DE BORD")}
        <TouchableOpacity onPress={() => setEntree({ note: "", minutes: "", photos: [] })} style={[styles.bouton, { borderColor: t.accent }]} accessibilityRole="button">
          <Texte style={{ color: t.accentText, fontWeight: "600" }}>+ Ajouter une entrée</Texte>
        </TouchableOpacity>

        {duo && (
          <View style={{ marginTop: spacing.lg }}>
            <Texte style={{ color: t.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>Avant → maintenant</Texte>
            <View
              style={[styles.duo, { borderColor: t.border }]}
              onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={glisser}
              onResponderMove={glisser}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Comparer la première et la dernière photo"
              accessibilityValue={{ min: 0, max: 100, now: curseur }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(e) => setCurseur((c) => Math.min(100, Math.max(0, c + (e.nativeEvent.actionName === "increment" ? 10 : -10))))}
            >
              {/* Rien ne reçoit le toucher sauf la zone : locationX reste relatif à elle. */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Image source={{ uri: duo.maintenant.data }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${curseur}%`, overflow: "hidden" }}>
                  <Image source={{ uri: duo.avant.data }} style={{ width: largeur, height: "100%" }} resizeMode="cover" />
                </View>
                <View style={[styles.separateur, { left: `${curseur}%` }]} />
                <Texte style={[styles.legende, { left: 8 }]}>avant</Texte>
                <Texte style={[styles.legende, { right: 8 }]}>maintenant</Texte>
              </View>
            </View>
          </View>
        )}

        {journal.length === 0 && <Texte style={{ color: t.textMuted, fontSize: typography.bodySmall, marginTop: spacing.md }}>Rien ici pour l&apos;instant. Une photo et une ligne suffisent.</Texte>}
        {journal.map((j) => (
          <View key={j.id} style={[styles.entree, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <View style={styles.ligne}>
              <Texte style={{ flex: 1, color: t.textMuted, fontSize: typography.small }}>
                {dateCourte(j.jour)}
                {j.minutes > 0 ? ` · ${libelleDuree(j.minutes)}` : ""}
              </Texte>
              <BoutonOptions options={[{ libelle: "Supprimer l'entrée", danger: true, onPress: () => confirmer("Supprimer cette entrée ?", "Ses photos aussi.", () => supprimerEntree(j.id)) }]} />
            </View>
            {j.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginVertical: spacing.sm }}>
                {j.photos.map((p) => (
                  <Image key={p.id} source={{ uri: p.data }} style={styles.miniature} resizeMode="cover" />
                ))}
              </ScrollView>
            )}
            {j.note ? <Texte style={{ color: t.textPrimary, fontSize: typography.body, lineHeight: 22 }}>{j.note}</Texte> : null}
          </View>
        ))}

        {/* Matériel */}
        {titreSection("MATÉRIEL")}
        {materiel.map((m) => (
          <View key={m.id} style={[styles.etape, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <TouchableOpacity onPress={() => basculerMateriel(m.id).then(charger)} style={[styles.statut, { borderColor: m.a_acheter ? t.accent : t.border }]} accessibilityRole="button" accessibilityLabel={`${m.nom} : ${m.a_acheter ? "à acheter, toucher pour dire que je l'ai" : "je l'ai, toucher pour dire à acheter"}`}>
              <Texte style={{ color: m.a_acheter ? t.accentText : t.textMuted, fontSize: typography.small, fontWeight: "600" }}>{m.a_acheter ? "à acheter" : "j'ai"}</Texte>
            </TouchableOpacity>
            <Texte style={{ flex: 1, color: t.textPrimary, fontSize: typography.body }}>{m.nom}</Texte>
            <TouchableOpacity onPress={() => supprimerMateriel(m.id).then(charger)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer ${m.nom}`}>
              <Texte style={{ color: t.textMuted, fontSize: 18 }}>×</Texte>
            </TouchableOpacity>
          </View>
        ))}
        <ChampTexte
          value={nouveauMateriel}
          onChangeText={setNouveauMateriel}
          placeholder="Ajouter du matériel"
          placeholderTextColor={t.textMuted}
          style={champ}
          returnKeyType="done"
          onSubmitEditing={async () => {
            await ajouterMateriel(projetId, nouveauMateriel);
            setNouveauMateriel("");
            await charger();
          }}
          accessibilityLabel="Nouveau matériel"
        />

        {/* Notes & idées */}
        {titreSection("NOTES & IDÉES")}
        <ChampTexte
          value={notes}
          onChangeText={setNotes}
          onBlur={() => enregistrerNotes(projetId, notes)}
          multiline
          placeholder="Tout ce qui te passe par la tête…"
          placeholderTextColor={t.textMuted}
          style={[...champ, { minHeight: 110, textAlignVertical: "top" }]}
          accessibilityLabel="Notes et idées"
        />
        {liens.map((l) => (
          <View key={l.id} style={[styles.etape, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(l.url)} accessibilityRole="link">
              <Texte style={{ color: t.accentText, fontSize: typography.body }} numberOfLines={1}>
                {l.titre}
              </Texte>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => supprimerLien(l.id).then(charger)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Retirer le lien ${l.titre}`}>
              <Texte style={{ color: t.textMuted, fontSize: 18 }}>×</Texte>
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <ChampTexte value={lienTitre} onChangeText={setLienTitre} placeholder="Titre du lien (facultatif)" placeholderTextColor={t.textMuted} style={champ} accessibilityLabel="Titre du lien" />
          <ChampTexte value={lienUrl} onChangeText={setLienUrl} placeholder="Adresse du lien" placeholderTextColor={t.textMuted} autoCapitalize="none" keyboardType="url" style={champ} returnKeyType="done" onSubmitEditing={ajouterUnLien} accessibilityLabel="Adresse du lien" />
          <TouchableOpacity onPress={ajouterUnLien} disabled={!urlValide(lienUrl)} style={[styles.bouton, { borderColor: urlValide(lienUrl) ? t.accent : t.border }]} accessibilityRole="button">
            <Texte style={{ color: urlValide(lienUrl) ? t.accentText : t.textMuted, fontWeight: "600" }}>+ Ajouter le lien</Texte>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FeuilleAvance
        projetId={projetId}
        minutes={0}
        visible={avance}
        onFerme={() => {
          setAvance(false);
          setMessage("");
          charger();
        }}
      />

      {/* Saisie d'un texte (modifier une étape, ajouter une sous-étape) */}
      <Modal visible={saisie !== null} transparent animationType="slide" onRequestClose={() => setSaisie(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.fond} onPress={() => setSaisie(null)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {saisie && (
                <>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>{saisie.titre}</Texte>
                  <ChampTexte
                    value={saisie.valeur}
                    onChangeText={(v) => setSaisie({ ...saisie, valeur: v })}
                    autoFocus
                    style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp }]}
                    accessibilityLabel={saisie.titre}
                    returnKeyType="done"
                    onSubmitEditing={async () => {
                      await saisie.ok(saisie.valeur);
                      setSaisie(null);
                    }}
                  />
                  <View style={styles.boutons}>
                    <TouchableOpacity onPress={() => setSaisie(null)} hitSlop={8}>
                      <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        await saisie.ok(saisie.valeur);
                        setSaisie(null);
                      }}
                      style={[styles.valider, { backgroundColor: t.accent }]}
                      accessibilityRole="button"
                    >
                      <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Enregistrer</Texte>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Nouvelle entrée du journal */}
      <Modal visible={entree !== null} transparent animationType="slide" onRequestClose={() => setEntree(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.fond} onPress={() => setEntree(null)}>
            <Pressable style={[styles.feuille, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {entree && (
                <>
                  <Texte style={{ color: t.textPrimary, fontSize: typography.h2, fontWeight: "600", marginBottom: spacing.md }}>Une entrée au journal</Texte>
                  <ChampTexte
                    value={entree.note}
                    onChangeText={(v) => setEntree({ ...entree, note: v })}
                    multiline
                    placeholder="Ce que j'ai fait, ce que j'ai appris…"
                    placeholderTextColor={t.textMuted}
                    style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp, minHeight: 80, textAlignVertical: "top" }]}
                    accessibilityLabel="Note du journal"
                  />
                  <View style={[styles.ligne, { marginTop: spacing.md }]}>
                    <ChampTexte
                      value={entree.minutes}
                      onChangeText={(v) => setEntree({ ...entree, minutes: v.replace(/[^0-9]/g, "") })}
                      keyboardType="number-pad"
                      placeholder="Minutes"
                      placeholderTextColor={t.textMuted}
                      style={[styles.champ, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.bgApp, width: 110 }]}
                      accessibilityLabel="Minutes passées"
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        const p = await choisirPhotos(4);
                        if (p.length) setEntree((x) => (x ? { ...x, photos: [...x.photos, ...p].slice(0, 4) } : x));
                      }}
                      style={[styles.bouton, { borderColor: t.border, marginTop: 0 }]}
                      accessibilityRole="button"
                    >
                      <Texte style={{ color: t.textSecondary, fontSize: typography.bodySmall }}>
                        {entree.photos.length ? `${entree.photos.length} photo${entree.photos.length > 1 ? "s" : ""} · en ajouter` : "Ajouter des photos"}
                      </Texte>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.boutons}>
                    <TouchableOpacity onPress={() => setEntree(null)} hitSlop={8}>
                      <Texte style={{ color: t.textSecondary, fontSize: typography.body }}>Annuler</Texte>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={enregistrerEntree} style={[styles.valider, { backgroundColor: t.accent }]} accessibilityRole="button">
                      <Texte style={{ color: t.textOnAccent, fontWeight: "700" }}>Enregistrer</Texte>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  couverture: { height: 170, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: spacing.md },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.md },
  puce: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  piste: { height: 8, borderRadius: 4, overflow: "hidden" },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: spacing.xl, marginBottom: spacing.sm },
  carte: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  secondaire: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderRadius: radius.pill, paddingVertical: spacing.md },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.pill, paddingVertical: spacing.md },
  etape: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  case: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  statut: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  ajoutLigne: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  champ: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body },
  bouton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  entree: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  miniature: { width: 96, height: 96, borderRadius: radius.md },
  finale: { width: 200, height: 200, borderRadius: radius.lg },
  ajoutPhoto: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", width: 120 },
  duo: { height: 240, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", justifyContent: "center" },
  separateur: { position: "absolute", top: 0, bottom: 0, width: 3, marginLeft: -1, backgroundColor: "#fff" },
  legende: { position: "absolute", bottom: 8, color: "#fff", fontSize: 12, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 4 },
  fond: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.xl },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  valider: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
