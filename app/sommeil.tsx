import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Texte } from "../components/Texte";
import { PlusMoins } from "../components/PlusMoins";
import { decalerJours } from "../lib/dates";
import { getAujourdhui } from "../lib/db/completions";
import { enregistrerNuit, getNuit, heuresParDefaut } from "../lib/db/sommeil";
import {
  decalerHeure,
  dureeLisible,
  dureeSommeilMin,
  nuitRapporte,
  POINTS_NUIT,
  QUALITES,
  type Qualite,
} from "../lib/suivi-regles";
import { radius, spacing, typography, useTheme } from "../lib/theme";

const PAS_MIN = 15;

function jourLisible(date: string): string {
  const aujourdhui = getAujourdhui();
  if (date === aujourdhui) return "Cette nuit";
  if (date === decalerJours(aujourdhui, -1)) return "La nuit d'avant";
  // Midi local : aucun fuseau ne peut faire changer de jour.
  return `Nuit du ${new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })}`;
}

/**
 * Saisie du matin, en quelques taps : heures pré-remplies avec la veille,
 * qualité, écrans. La nuit est datée du jour du lever ; les flèches
 * permettent de remplir ou corriger un jour oublié.
 */
export default function Sommeil() {
  const router = useRouter();
  const t = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const aujourdhui = getAujourdhui();

  const [date, setDate] = useState(params.date ?? aujourdhui);
  const [coucher, setCoucher] = useState("23:00");
  const [lever, setLever] = useState("07:00");
  const [qualite, setQualite] = useState<Qualite | null>(null);
  const [ecrans, setEcrans] = useState<0 | 1 | null>(null);
  const [dejaNotee, setDejaNotee] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      const nuit = await getNuit(date);
      const h = nuit ?? (await heuresParDefaut(date));
      if (!actif) return;
      setCoucher(h.coucher);
      setLever(h.lever);
      setQualite(nuit?.qualite ?? null);
      setEcrans(nuit?.ecrans ?? null);
      setDejaNotee(!!nuit);
    })();
    return () => {
      actif = false;
    };
  }, [date]);

  const valide = qualite !== null && ecrans !== null;

  const enregistrer = async () => {
    if (!valide || enregistrement) return;
    setEnregistrement(true);
    try {
      await enregistrerNuit({ date, coucher, lever, qualite, ecrans });
      router.back();
    } finally {
      setEnregistrement(false);
    }
  };

  const choix = (actif: boolean, libelle: string, onPress: () => void) => (
    <TouchableOpacity
      key={libelle}
      onPress={onPress}
      style={[
        styles.choix,
        {
          backgroundColor: actif ? t.accent : t.bgCard,
          borderColor: actif ? t.accent : t.border,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
    >
      <Texte style={[styles.choixTexte, { color: actif ? t.textOnAccent : t.textSecondary }]}>
        {libelle}
      </Texte>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bgApp }}
      contentContainerStyle={styles.contenu}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Texte style={[styles.retour, { color: t.accentText }]}>← Retour</Texte>
      </TouchableOpacity>

      <View style={styles.jours}>
        <TouchableOpacity
          onPress={() => setDate(decalerJours(date, -1))}
          hitSlop={12}
          accessibilityLabel="Nuit précédente"
        >
          <Texte style={[styles.fleche, { color: t.accentText }]}>‹</Texte>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Texte style={[styles.titre, { color: t.textPrimary }]}>{jourLisible(date)}</Texte>
          <Texte style={[styles.aide, { color: t.textMuted }]}>
            {dejaNotee
              ? "Déjà notée : tu peux la corriger."
              : nuitRapporte(date, aujourdhui)
                ? `Nuit à noter · +${POINTS_NUIT} pts`
                : "Nuit à noter (plus de 7 jours : sans points)"}
          </Texte>
        </View>
        <TouchableOpacity
          onPress={() => setDate(decalerJours(date, 1))}
          disabled={date >= aujourdhui}
          hitSlop={12}
          accessibilityLabel="Nuit suivante"
        >
          <Texte
            style={[styles.fleche, { color: date >= aujourdhui ? t.border : t.accentText }]}
          >
            ›
          </Texte>
        </TouchableOpacity>
      </View>

      <View style={[styles.carte, { backgroundColor: t.bgCard }]}>
        <View style={styles.heure}>
          <Texte style={[styles.labelHeure, { color: t.textSecondary }]}>Coucher</Texte>
          <PlusMoins
            valeur={coucher}
            libelle="Heure de coucher"
            onPas={(s) => setCoucher((h) => decalerHeure(h, s * PAS_MIN))}
          />
        </View>
        <View style={styles.heure}>
          <Texte style={[styles.labelHeure, { color: t.textSecondary }]}>Lever</Texte>
          <PlusMoins
            valeur={lever}
            libelle="Heure de lever"
            onPas={(s) => setLever((h) => decalerHeure(h, s * PAS_MIN))}
          />
        </View>
        <Texte style={[styles.duree, { color: t.textPrimary }]}>
          {dureeLisible(dureeSommeilMin(coucher, lever))} de nuit
        </Texte>
      </View>

      <Texte style={[styles.label, { color: t.textSecondary }]}>Comment as-tu dormi ?</Texte>
      <View style={styles.ligneChoix}>
        {([1, 2, 3] as Qualite[]).map((q) =>
          choix(qualite === q, QUALITES[q][0].toUpperCase() + QUALITES[q].slice(1), () =>
            setQualite(q),
          ),
        )}
      </View>

      <Texte style={[styles.label, { color: t.textSecondary }]}>
        Des écrans avant de dormir ?
      </Texte>
      <View style={styles.ligneChoix}>
        {choix(ecrans === 1, "Oui", () => setEcrans(1))}
        {choix(ecrans === 0, "Non", () => setEcrans(0))}
      </View>

      <TouchableOpacity
        style={[styles.bouton, { backgroundColor: valide ? t.accent : t.border }]}
        onPress={enregistrer}
        disabled={!valide || enregistrement}
      >
        <Texte style={[styles.boutonTexte, { color: t.textOnAccent }]}>Enregistrer</Texte>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  retour: { fontSize: typography.body, fontWeight: "600", marginBottom: spacing.lg },
  jours: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  fleche: { fontSize: 34, paddingHorizontal: spacing.md },
  titre: { fontSize: typography.h2, fontWeight: "600", textTransform: "capitalize" },
  aide: { fontSize: typography.small, marginTop: 2 },
  carte: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  heure: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  labelHeure: { fontSize: typography.body, fontWeight: "600" },
  duree: { fontSize: typography.body, fontWeight: "600", textAlign: "center" },
  ligneChoix: { flexDirection: "row", gap: spacing.sm },
  choix: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  choixTexte: { fontSize: typography.body, fontWeight: "600" },
  bouton: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  boutonTexte: { fontSize: typography.body, fontWeight: "700" },
});
