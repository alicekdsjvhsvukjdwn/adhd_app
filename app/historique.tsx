import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../components/Texte";
import { ZoneNote } from "../components/ZoneNote";
import { getItem } from "../lib/db";
import {
  carnetListe,
  foisFaites,
  type FoisFaite,
  type Note,
  type NoteCarnet,
} from "../lib/db/carnet";
import { getListes } from "../lib/db/listes";
import { idees } from "../lib/regles-taches";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const JOURS = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
// Midi local : aucun fuseau ne peut faire changer de jour.
const dateLisible = (iso: string) => JOURS.format(new Date(iso + "T12:00:00"));

/**
 * ?id=12 : les fois où la tâche a été faite, avec leur note (modifiable).
 * ?liste=3 : le carnet de la liste, toutes les notes de ses tâches.
 */
export default function Historique() {
  const router = useRouter();
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string; liste?: string }>();
  const itemId = params.id ? Number(params.id) : null;
  const listeParam = params.liste ? Number(params.liste) : null;

  const [titre, setTitre] = useState("");
  const [listeId, setListeId] = useState<number | null>(listeParam);
  const [fois, setFois] = useState<FoisFaite[]>([]);
  const [carnet, setCarnet] = useState<NoteCarnet[]>([]);
  const [enEdition, setEnEdition] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (itemId !== null) {
      const item = await getItem(itemId);
      setTitre(item?.nom ?? "");
      setListeId(item?.liste_id ?? null);
      setFois(await foisFaites(itemId));
    } else if (listeParam !== null) {
      const l = (await getListes()).find((x) => x.id === listeParam);
      setTitre(`Carnet${l ? ` · ${l.icone ? `${l.icone} ` : ""}${l.nom}` : ""}`);
      setCarnet(await carnetListe(listeParam));
    }
  }, [itemId, listeParam]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const enTache = (idee: string) =>
    router.push(
      `/nouvelle-tache?nom=${encodeURIComponent(idee)}${listeId !== null ? `&liste=${listeId}` : ""}`,
    );

  const contenuNote = (n: Note) => (
    <>
      {n.fait ? <Ligne libelle="Fait" texte={n.fait} /> : null}
      {n.retenu ? <Ligne libelle="Retenu" texte={n.retenu} /> : null}
      {idees(n.idees).map((idee, i) => (
        <View key={i} style={styles.idee}>
          <Texte style={[styles.texte, { color: t.textPrimary, flex: 1 }]}>💡 {idee}</Texte>
          <TouchableOpacity onPress={() => enTache(idee)} hitSlop={8}>
            <Texte style={[styles.lien, { color: t.accentText }]}>→ En faire une tâche</Texte>
          </TouchableOpacity>
        </View>
      ))}
    </>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>
      <Texte style={[styles.titre, { color: t.textPrimary }]}>{titre}</Texte>

      {itemId !== null && (
        <>
          <Texte style={[styles.aide, { color: t.textMuted }]}>
            {fois.length === 0
              ? "Pas encore faite."
              : `Faite ${fois.length} fois. Touche une date pour écrire ou modifier sa note.`}
          </Texte>
          {fois.map((f) =>
            enEdition === f.date ? (
              <ZoneNote
                key={f.date}
                itemId={itemId}
                date={f.date}
                initiale={f}
                titre={dateLisible(f.date)}
                onFerme={async () => {
                  setEnEdition(null);
                  await charger();
                }}
              />
            ) : (
              <TouchableOpacity
                key={f.date}
                style={[styles.carte, { backgroundColor: t.bgCard }]}
                onPress={() => setEnEdition(f.date)}
                accessibilityHint="Écrire ou modifier la note"
              >
                <Texte style={[styles.date, { color: t.textPrimary }]}>✓ {dateLisible(f.date)}</Texte>
                {f.fait || f.retenu || f.idees ? (
                  contenuNote(f)
                ) : (
                  <Texte style={[styles.texte, { color: t.textMuted }]}>+ Ajouter une note</Texte>
                )}
              </TouchableOpacity>
            ),
          )}
        </>
      )}

      {itemId === null && (
        <>
          <Texte style={[styles.aide, { color: t.textMuted }]}>
            {carnet.length === 0
              ? "Aucune note dans cette liste pour l'instant."
              : "Les notes de toutes les tâches de la liste, de la plus récente à la plus ancienne."}
          </Texte>
          {carnet.map((n) => (
            <View key={`${n.item_id}-${n.date}`} style={[styles.carte, { backgroundColor: t.bgCard }]}>
              <TouchableOpacity onPress={() => router.push(`/historique?id=${n.item_id}`)}>
                <Texte style={[styles.date, { color: t.textPrimary }]}>{n.nom}</Texte>
                <Texte style={[styles.texte, { color: t.textMuted }]}>{dateLisible(n.date)}</Texte>
              </TouchableOpacity>
              {contenuNote(n)}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Ligne({ libelle, texte }: { libelle: string; texte: string }) {
  const t = useTheme();
  return (
    <Texte style={[styles.texte, { color: t.textSecondary }]}>
      <Texte style={{ fontWeight: "600", color: t.textPrimary }}>{libelle} : </Texte>
      {texte}
    </Texte>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  titre: { fontSize: typography.h1, fontWeight: "600" },
  aide: { fontSize: typography.small, marginTop: 4, marginBottom: spacing.lg },
  carte: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, gap: 4 },
  date: { fontSize: typography.body, fontWeight: "600" },
  texte: { fontSize: typography.small, lineHeight: 19 },
  idee: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lien: { fontSize: typography.small, fontWeight: "600" },
});
