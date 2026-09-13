import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    enregistrerEtat,
    fenetreCourante,
    getEtat,
    type Niveau,
} from "../lib/db";
import { radius, spacing, typography, useTheme } from "../lib/theme";

type Question = {
  cle: "energie" | "focus" | "humeur";
  titre: string;
  options: [string, string, string];
};

const QUESTIONS: Question[] = [
  {
    cle: "energie",
    titre: "Ton énergie, là ?",
    options: ["À plat", "Correcte", "En forme"],
  },
  {
    cle: "focus",
    titre: "Et ta capacité à te concentrer ?",
    options: ["Éparpillée", "Moyenne", "Nette"],
  },
  {
    cle: "humeur",
    titre: "L'humeur ?",
    options: ["Basse", "Neutre", "Bonne"],
  },
];

export default function EtatScreen() {
  const router = useRouter();
  const t = useTheme();

  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState<Partial<Record<string, Niveau>>>({});
  const [correction, setCorrection] = useState(false);

  const fenetre = fenetreCourante();

  useEffect(() => {
    getEtat(fenetre).then((e) => {
      if (!e) return;
      setCorrection(true);
      setReponses({ energie: e.energie, focus: e.focus, humeur: e.humeur });
    });
  }, [fenetre]);

  const repondre = async (niveau: Niveau) => {
    const question = QUESTIONS[index];
    const suivantes = { ...reponses, [question.cle]: niveau };
    setReponses(suivantes);

    if (index < QUESTIONS.length - 1) {
      setIndex(index + 1);
      return;
    }

    await enregistrerEtat({
      energie: suivantes.energie as Niveau,
      focus: suivantes.focus as Niveau,
      humeur: suivantes.humeur as Niveau,
    });
    router.back();
  };

  const question = QUESTIONS[index];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bgApp }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.retour}>
        <Text style={[styles.retourTexte, { color: t.accent }]}>
          ← Plus tard
        </Text>
      </TouchableOpacity>

      <View style={styles.centre}>
        <Text style={[styles.etape, { color: t.textMuted }]}>
          {index + 1} / {QUESTIONS.length}
          {correction ? " · correction" : ""}
        </Text>

        <Text style={[styles.titre, { color: t.textPrimary }]}>
          {question.titre}
        </Text>

        {question.options.map((label, i) => {
          const niveau = (i + 1) as Niveau;
          const dejaChoisi = reponses[question.cle] === niveau;
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.option,
                {
                  backgroundColor: dejaChoisi ? t.accent : t.bgCard,
                  borderColor: t.border,
                },
              ]}
              onPress={() => repondre(niveau)}
            >
              <Text
                style={[
                  styles.optionTexte,
                  { color: dejaChoisi ? t.textOnAccent : t.textPrimary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.note, { color: t.textMuted }]}>
          Aucune bonne réponse. C'est juste un repère, et ça aide l'appli à
          proposer ce qui est faisable maintenant.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: spacing.xl },
  retour: { paddingVertical: spacing.sm },
  retourTexte: { fontSize: typography.bodySmall, fontWeight: "500" },
  centre: { flex: 1, justifyContent: "center", paddingBottom: 80 },
  etape: {
    fontSize: typography.tiny,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  titre: {
    fontSize: typography.h1,
    fontWeight: "600",
    marginBottom: spacing.xl,
  },
  option: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  optionTexte: { fontSize: typography.h3 },
  note: {
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.lg,
  },
});
