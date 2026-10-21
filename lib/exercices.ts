import { manquants, type Materiel, type MaterielCle } from "./materiel";
import type { Zone } from "./seances";

/**
 * Bibliothèque d'exercices : callisthénie, haltères, parallettes, mobilité, du débutant à l'intermédiaire.
 * Sert aux séances guidées (lib/seances.ts), à l'écran Exercices et, plus tard, aux skills et au plan.
 * Sans accès à la base : testable seul (tests/exercices.test.mjs, tests/seances.test.mjs).
 * Les étapes des skills (lib/skills.ts) portent le même nom quand c'est le même mouvement.
 */

export type ModeExercice = "reps" | "s" | "reps_poids";

export type Exercice = {
  id: string;
  nom: string;
  zones: Zone[];
  /** Muscles principaux. */
  muscles: string[];
  /** Matériel requis : tout doit être là (le sol l'est toujours). */
  materiel: MaterielCle[];
  /** 1 (débutant) à 5. */
  niveau: 1 | 2 | 3 | 4 | 5;
  /** Répétitions, tenir (secondes), ou répétitions avec un poids. */
  mode: ModeExercice;
  /** 2 ou 3 consignes courtes. */
  consignes: string[];
  /** La première consigne, pour le lecteur de séance. */
  consigne: string;
  /** Clé du bonhomme (components/FigureSkill.tsx). */
  figure: string;
  plus_facile?: string;
  plus_dur?: string;
  /** Un exercice proche qui demande moins de matériel. */
  alternative?: string;
  /** Lien vidéo facultatif (vide pour l'instant). */
  lien?: string;
};

type Liens = { facile?: string; dur?: string; alt?: string };

const x = (
  id: string,
  nom: string,
  zones: Zone[],
  niveau: Exercice["niveau"],
  mode: ModeExercice,
  figure: string,
  materiel: MaterielCle[],
  muscles: string[],
  consignes: string[],
  l: Liens = {},
): Exercice => ({
  id,
  nom,
  zones,
  niveau,
  mode,
  figure,
  materiel,
  muscles,
  consignes,
  consigne: consignes[0],
  ...(l.facile ? { plus_facile: l.facile } : {}),
  ...(l.dur ? { plus_dur: l.dur } : {}),
  ...(l.alt ? { alternative: l.alt } : {}),
});

export const EXERCICES: Exercice[] = [
  // ── Haut du corps : pousser ──
  x("pompes_mur", "Pompes au mur", ["haut"], 1, "reps", "pompe_mur", [], ["pectoraux", "triceps", "épaules"], ["Corps droit de la tête aux talons", "Coudes à 45°, poitrine vers le mur"], { dur: "pompes_inclinees" }),
  x("pompes_inclinees", "Pompes inclinées", ["haut"], 1, "reps", "pompe", ["mobilier"], ["pectoraux", "triceps", "épaules"], ["Mains sur une table ou un banc, poitrine jusqu'au bord", "Corps droit, fesses serrées"], { facile: "pompes_mur", dur: "pompes_genoux", alt: "pompes_mur" }),
  x("pompes_genoux", "Pompes sur les genoux", ["haut", "complet"], 2, "reps", "pompe", [], ["pectoraux", "triceps", "épaules"], ["Hanches alignées, pas de dos creux", "Descendre en 2 s"], { facile: "pompes_inclinees", dur: "pompes" }),
  x("pompes", "Pompes", ["haut", "complet"], 3, "reps", "pompe", [], ["pectoraux", "triceps", "épaules", "gainage"], ["Corps gainé, poitrine à un poing du sol", "Coudes à 45°, pas à l'équerre"], { facile: "pompes_genoux", dur: "pompes_diamant" }),
  x("pompes_larges", "Pompes mains larges", ["haut"], 3, "reps", "pompe", [], ["pectoraux", "épaules"], ["Mains un peu plus larges que les épaules", "Poitrine vers le sol, coudes qui s'ouvrent doucement"], { facile: "pompes", dur: "pompes_archer" }),
  x("pompes_diamant", "Pompes diamant", ["haut"], 3, "reps", "pompe", [], ["triceps", "pectoraux"], ["Mains rapprochées sous la poitrine", "Coudes le long du corps"], { facile: "pompes", dur: "pompes_archer" }),
  x("pompes_pieds_sureleves", "Pompes pieds surélevés", ["haut"], 4, "reps", "pompe_decline", ["mobilier"], ["épaules", "pectoraux", "triceps"], ["Pieds sur une chaise, corps en ligne", "Poitrine vers le sol sans cambrer"], { facile: "pompes", dur: "pompes_archer", alt: "pompes" }),
  x("pompes_archer", "Pompes archer", ["haut"], 4, "reps", "archer", [], ["pectoraux", "triceps", "épaules"], ["Un bras tendu sur le côté, l'autre fléchit", "Alterner à chaque répétition"], { facile: "pompes_larges" }),
  x("pompes_parallettes", "Pompes aux parallettes", ["haut"], 3, "reps", "pompe_parallettes", ["parallettes"], ["pectoraux", "triceps", "épaules"], ["Poignets droits sur les parallettes", "Descendre plus bas que pour des pompes au sol"], { facile: "pompes", alt: "pompes" }),
  x("pompes_pseudo_planche", "Pompes pseudo-planche", ["haut"], 4, "reps", "pseudo", [], ["épaules", "pectoraux", "gainage"], ["Mains près des hanches, doigts vers les pieds", "Épaules bien en avant des mains"], { facile: "pompes" }),
  x("pike_pushups", "Pike push-ups", ["haut"], 3, "reps", "pike_taps", [], ["épaules", "triceps"], ["Hanches hautes, tête entre les mains en bas", "Dos long, jambes presque tendues"], { facile: "pike_taps", dur: "pike_pushups_sureleves" }),
  x("pike_pushups_sureleves", "Pike push-ups pieds surélevés", ["haut"], 4, "reps", "pike_taps", ["mobilier"], ["épaules", "triceps"], ["Pieds sur une chaise, hanches au-dessus des épaules", "Tête vers le sol entre les mains"], { facile: "pike_pushups", alt: "pike_pushups" }),
  x("pike_taps", "Pike shoulder taps", ["haut", "complet"], 2, "reps", "pike_taps", [], ["épaules", "gainage"], ["Hanches hautes, une main touche l'épaule opposée", "Bassin le plus stable possible"], { dur: "pike_pushups" }),
  x("dips_banc", "Dips sur banc", ["haut"], 2, "reps", "dips", ["mobilier"], ["triceps", "épaules"], ["Mains derrière toi sur une chaise, coudes vers l'arrière", "Épaules loin des oreilles"], { dur: "dips_parallettes", alt: "pompes_diamant" }),
  x("dips_parallettes", "Dips aux parallettes", ["haut"], 3, "reps", "dips", ["parallettes"], ["triceps", "pectoraux", "épaules"], ["Bras tendus, épaules basses", "Descendre jusqu'à 90° aux coudes"], { facile: "dips_banc", alt: "dips_banc" }),
  x("snow_angels", "Reverse snow angels", ["haut", "mobilite"], 1, "reps", "snow_angels", [], ["haut du dos", "épaules"], ["À plat ventre, bras qui glissent des hanches au-dessus de la tête", "Pouces vers le plafond"]),
  x("presse_epaules", "Presse d'épaules aux haltères", ["haut"], 2, "reps_poids", "presse_halteres", ["halteres"], ["épaules", "triceps"], ["Debout, haltères à hauteur d'épaules", "Pousser vers le plafond sans cambrer"], { alt: "pike_pushups" }),
  x("developpe_sol", "Développé couché au sol", ["haut"], 2, "reps_poids", "developpe", ["halteres"], ["pectoraux", "triceps"], ["Allongée, haltères au-dessus de la poitrine", "Coudes qui touchent le sol en bas"], { alt: "pompes" }),
  x("elevations_laterales", "Élévations latérales", ["haut"], 2, "reps_poids", "elev_lat", ["halteres"], ["épaules"], ["Haltères légers, bras presque tendus", "Monter jusqu'à hauteur d'épaules, descendre lentement"], { alt: "pike_taps" }),
  x("extension_triceps", "Extension triceps haltère", ["haut"], 2, "reps_poids", "triceps_ext", ["halteres"], ["triceps"], ["Un haltère à deux mains derrière la tête", "Coudes serrés, étendre vers le haut"], { alt: "pompes_diamant" }),
  // ── Haut du corps : tirer ──
  x("superman", "Superman", ["haut", "abdos"], 1, "reps", "superman", [], ["dos", "fessiers"], ["À plat ventre, bras et jambes qui décollent", "Tenir une seconde en haut, nuque dans le prolongement"], { dur: "snow_angels" }),
  x("rowing_halteres", "Rowing haltère", ["haut"], 2, "reps_poids", "rowing", ["halteres"], ["dos", "biceps"], ["Dos plat, un haltère tiré vers la hanche", "Coude le long du corps, pas d'élan"], { dur: "rowing_table", alt: "rowing_table" }),
  x("rowing_table", "Rowing sous une table", ["haut"], 3, "reps", "rowing_table", ["mobilier"], ["dos", "biceps"], ["Allongée sous une table solide, mains sur le bord", "Tirer la poitrine vers la table, corps droit"], { facile: "rowing_halteres", dur: "tractions" }),
  x("curl_halteres", "Curl aux haltères", ["haut"], 1, "reps_poids", "curl", ["halteres"], ["biceps"], ["Coudes collés au corps", "Monter sans balancer le buste"]),
  x("rowing_elastique", "Rowing à l'élastique", ["haut"], 2, "reps_poids", "rowing", ["elastiques"], ["dos", "biceps"], ["Élastique fixé devant toi, tirer vers le ventre", "Omoplates qui se rapprochent"], { alt: "rowing_table" }),
  x("tractions_negatives", "Tractions négatives", ["haut"], 4, "reps", "traction", ["barre"], ["dos", "biceps"], ["Monter en sautant, menton au-dessus de la barre", "Descendre en 4 à 5 s"], { facile: "rowing_table", dur: "tractions", alt: "rowing_table" }),
  x("tractions", "Tractions", ["haut"], 4, "reps", "traction", ["barre"], ["dos", "biceps"], ["Épaules basses avant de tirer", "Menton au-dessus de la barre, descente contrôlée"], { facile: "tractions_negatives", alt: "rowing_table" }),
  // ── Bas du corps ──
  x("squat", "Squat", ["bas", "complet"], 1, "reps", "squat", [], ["quadriceps", "fessiers"], ["Talons au sol, genoux dans l'axe des pieds", "Descendre cuisses parallèles"], { dur: "squat_halteres" }),
  x("squat_halteres", "Squat gobelet", ["bas"], 2, "reps_poids", "squat", ["halteres"], ["quadriceps", "fessiers"], ["Un haltère tenu contre la poitrine", "Dos droit, descendre en contrôle"], { facile: "squat", dur: "squat_bulgare", alt: "squat" }),
  x("squat_saute", "Squat sauté", ["bas", "complet"], 2, "reps", "squat", [], ["quadriceps", "fessiers", "mollets"], ["Descendre, puis sauter vers le haut", "Réception douce, genoux fléchis"], { facile: "squat" }),
  x("chaise", "Chaise au mur", ["bas"], 2, "s", "squat", [], ["quadriceps"], ["Dos au mur, cuisses parallèles au sol", "Pousser dans les talons"], { facile: "squat" }),
  x("fente", "Fente", ["bas", "complet"], 2, "reps", "fente", [], ["quadriceps", "fessiers"], ["Grand pas, genou arrière près du sol, alterner", "Buste droit, genou avant au-dessus du pied"], { dur: "squat_bulgare" }),
  x("fente_arriere", "Fente arrière", ["bas"], 2, "reps", "fente", [], ["fessiers", "quadriceps"], ["Un pas en arrière, genou près du sol", "Se relever en poussant dans le pied avant"], { dur: "squat_bulgare" }),
  x("squat_bulgare", "Squat bulgare", ["bas"], 3, "reps", "pistol", ["mobilier"], ["quadriceps", "fessiers"], ["Pied arrière sur une chaise, changer à mi-temps", "Buste droit, pied avant bien posé"], { facile: "fente", dur: "squat_bulgare_halteres", alt: "fente" }),
  x("squat_bulgare_halteres", "Squat bulgare aux haltères", ["bas"], 3, "reps_poids", "pistol", ["mobilier", "halteres"], ["quadriceps", "fessiers"], ["Un haltère dans chaque main, pied arrière surélevé", "Descendre en contrôle"], { facile: "squat_bulgare", alt: "squat_bulgare" }),
  x("pistol_assiste", "Pistol squat assisté", ["bas"], 4, "reps", "pistol", ["mobilier"], ["quadriceps", "fessiers", "équilibre"], ["Une main sur un appui stable", "Une jambe tendue devant, descendre lentement"], { facile: "squat_bulgare", dur: "pistol_squat", alt: "squat_bulgare" }),
  x("pistol_squat", "Pistol squat", ["bas"], 5, "reps", "pistol", [], ["quadriceps", "fessiers", "équilibre"], ["Une jambe tendue devant, bras en avant", "Talon au sol, remonter sans élan"], { facile: "pistol_assiste" }),
  x("step_up", "Montée sur chaise", ["bas"], 2, "reps", "stepup", ["mobilier"], ["quadriceps", "fessiers"], ["Un pied sur une chaise solide", "Se hisser en poussant dans ce pied, descendre doucement"], { dur: "squat_bulgare" }),
  x("pont", "Pont fessier", ["bas", "mobilite", "complet"], 1, "reps", "pont", [], ["fessiers", "ischios"], ["Pousser dans les talons, serrer les fesses en haut", "Bassin aligné, sans creuser le dos"], { dur: "pont_unijambiste" }),
  x("pont_unijambiste", "Pont fessier une jambe", ["bas"], 3, "reps", "pont", [], ["fessiers", "ischios"], ["Une jambe tendue, pousser dans l'autre talon", "Bassin bien horizontal"], { facile: "pont", dur: "hip_thrust" }),
  x("hip_thrust", "Hip thrust", ["bas"], 3, "reps_poids", "hip_thrust", ["mobilier"], ["fessiers", "ischios"], ["Épaules sur un canapé ou une chaise stable", "Monter le bassin, menton rentré, serrer les fesses"], { facile: "pont", alt: "pont_unijambiste" }),
  x("souleve_de_terre_roumain", "Soulevé de terre roumain", ["bas"], 2, "reps_poids", "rdl", ["halteres"], ["ischios", "fessiers", "dos"], ["Haltères le long des cuisses, dos plat", "Pousser les fesses vers l'arrière, genoux légèrement fléchis"], { alt: "pont" }),
  x("mollets", "Montées sur pointes", ["bas"], 1, "reps", "mollets", [], ["mollets"], ["Monter sur la pointe des pieds, tenir une seconde", "Descendre lentement"], { dur: "mollets_unijambiste" }),
  x("mollets_unijambiste", "Mollets une jambe", ["bas"], 2, "reps", "mollets", [], ["mollets"], ["Une main sur un mur pour l'équilibre", "Amplitude complète, sans rebond"], { facile: "mollets" }),
  // ── Abdos & gainage ──
  x("crunch", "Crunch", ["abdos"], 1, "reps", "crunch", [], ["abdominaux"], ["Genoux fléchis, mains près des tempes", "Décoller les épaules, le bas du dos reste au sol"], { dur: "releve_jambes" }),
  x("bird_dog", "Bird dog", ["abdos", "mobilite"], 1, "reps", "bird_dog", [], ["gainage", "dos", "fessiers"], ["À quatre pattes, bras et jambe opposés qui s'allongent", "Bassin immobile, comme avec un verre posé sur le dos"], { dur: "planche" }),
  x("dead_bug", "Dead bug", ["abdos", "mobilite"], 1, "reps", "hollow", [], ["abdominaux profonds"], ["Bras et jambe opposés qui descendent, dos collé au sol", "Respirer, ne pas creuser"], { dur: "hollow" }),
  x("planche", "Planche", ["abdos", "complet"], 1, "s", "gainage", [], ["gainage", "épaules"], ["Coudes sous les épaules, fesses serrées", "Corps droit de la tête aux talons"], { dur: "planche_touche_epaule" }),
  x("planche_touche_epaule", "Planche avec touche d'épaule", ["abdos"], 2, "reps", "gainage", [], ["gainage", "épaules"], ["En appui sur les mains, toucher une épaule puis l'autre", "Bassin qui ne bouge pas"], { facile: "planche", dur: "mountain" }),
  x("bear_hold", "Bear hold", ["abdos"], 2, "s", "bear", [], ["gainage", "épaules", "quadriceps"], ["À quatre pattes, genoux qui décollent d'un poing", "Dos plat, tenir en respirant"], { facile: "bird_dog", dur: "planche_touche_epaule" }),
  x("mountain", "Mountain climbers", ["abdos", "complet"], 2, "reps", "pompe", [], ["abdominaux", "épaules"], ["En appui sur les mains, genoux vers la poitrine à tour de rôle", "Épaules au-dessus des mains"], { facile: "planche" }),
  x("planche_laterale_tenue", "Planche latérale", ["abdos"], 2, "s", "planche_laterale", [], ["obliques", "gainage"], ["Sur un coude, corps en ligne", "Changer de côté à mi-temps"], { facile: "planche", dur: "planche_laterale" }),
  x("planche_laterale", "Planche latérale avec rotation", ["abdos"], 3, "reps", "planche_laterale", [], ["obliques", "épaules"], ["Bras du dessus qui passe sous le corps puis s'ouvre", "Changer de côté à mi-temps"], { facile: "planche_laterale_tenue" }),
  x("hollow", "Hollow body hold", ["abdos"], 3, "s", "hollow", [], ["abdominaux", "gainage"], ["Bas du dos collé au sol, bras et jambes tendus", "Respirer, descendre les jambes si le dos se décolle"], { facile: "dead_bug", dur: "hollow_rock" }),
  x("hollow_rock", "Hollow rock", ["abdos"], 4, "reps", "hollow", [], ["abdominaux"], ["En position hollow, se balancer d'avant en arrière", "Corps gainé comme une banane"], { facile: "hollow" }),
  x("releve_jambes", "Relevé de jambes au sol", ["abdos"], 2, "reps", "releve", [], ["abdominaux bas"], ["Allongée, jambes tendues qui montent à la verticale", "Descendre sans toucher le sol, dos plaqué"], { facile: "crunch", dur: "hollow" }),
  x("russian_twist", "Russian twist", ["abdos"], 2, "reps_poids", "twist", [], ["obliques"], ["Assise, buste incliné, pieds au sol ou levés", "Tourner les épaules, pas seulement les bras"], { facile: "crunch" }),
  x("tuck_lsit_parallettes", "Tuck L-sit aux parallettes", ["abdos", "haut"], 3, "s", "lsit_tuck", ["parallettes"], ["abdominaux", "triceps", "épaules"], ["Bras tendus, épaules basses", "Genoux contre la poitrine, fesses décollées"], { facile: "bear_hold", dur: "lsit_parallettes", alt: "hollow" }),
  x("lsit_parallettes", "L-sit aux parallettes", ["abdos", "haut"], 4, "s", "lsit", ["parallettes"], ["abdominaux", "triceps", "quadriceps"], ["Jambes tendues devant, parallèles au sol", "Pousser fort dans les parallettes"], { facile: "tuck_lsit_parallettes", alt: "hollow" }),
  x("tuck_planche_parallettes", "Tuck planche aux parallettes", ["haut", "abdos"], 4, "s", "planche", ["parallettes"], ["épaules", "gainage", "poignets"], ["Genoux repliés, bras tendus, épaules en avant", "Dos arrondi, bassin au niveau des épaules"], { facile: "pompes_pseudo_planche", alt: "pompes_pseudo_planche" }),
  x("poirier_mur", "Poirier contre le mur", ["haut"], 3, "s", "poirier", [], ["épaules", "gainage"], ["Mains à 15 cm du mur, corps en ligne", "Pousser le sol, regarder entre les mains"], { facile: "pike_pushups" }),
  // ── Mobilité ──
  x("chat_vache", "Chat-vache", ["mobilite"], 1, "reps", "chat_vache", [], ["colonne", "dos"], ["À quatre pattes, dos rond puis dos creux", "Respirer avec le mouvement"]),
  x("cercles_bras", "Cercles de bras", ["mobilite", "haut"], 1, "reps", "cercles_bras", [], ["épaules"], ["Bras tendus sur les côtés, petits puis grands cercles", "Changer de sens à mi-temps"]),
  x("etirement_pectoraux", "Étirement des pectoraux au mur", ["mobilite", "haut"], 1, "s", "etir_pecs", [], ["pectoraux", "épaules"], ["Avant-bras contre le mur, coude à hauteur d'épaule", "Tourner doucement le buste à l'opposé"]),
  x("rotation_thoracique", "Rotation thoracique", ["mobilite"], 1, "reps", "rot_thoracique", [], ["colonne", "épaules"], ["À quatre pattes, main derrière la tête", "Ouvrir le coude vers le plafond, suivre des yeux"]),
  x("chien_tete_en_bas", "Chien tête en bas", ["mobilite", "haut"], 1, "s", "chien", [], ["épaules", "ischios", "mollets"], ["Mains et pieds au sol, hanches vers le plafond", "Pédaler doucement des talons"]),
  x("posture_enfant", "Posture de l'enfant", ["mobilite"], 1, "s", "enfant", [], ["dos", "hanches"], ["Fesses vers les talons, bras allongés devant", "Relâcher la nuque et respirer"]),
  x("fente_basse", "Fente basse", ["mobilite"], 1, "s", "fente", [], ["hanches", "quadriceps"], ["Genou arrière au sol, bassin vers l'avant", "Changer à mi-temps"]),
  x("squat_tenu", "Squat tenu en bas", ["mobilite"], 1, "s", "squat", [], ["hanches", "chevilles"], ["Talons au sol, coudes qui écartent les genoux", "Buste droit, respirer"]),
  x("mobilite_hanches", "Mobilité des hanches 90/90", ["mobilite"], 2, "s", "hanches_90", [], ["hanches"], ["Assise, genoux fléchis à 90° d'un côté et de l'autre", "Buste droit, basculer doucement"]),
  x("etirement_ischios", "Étirement des ischios", ["mobilite"], 1, "s", "ischios", [], ["ischios", "bas du dos"], ["Assise, une jambe tendue, pencher le buste vers le pied", "Dos long, sans forcer"]),
  x("etirement_quadriceps", "Étirement des quadriceps", ["mobilite"], 1, "s", "quad", [], ["quadriceps"], ["Debout, talon vers la fesse, genoux serrés", "Une main au mur pour l'équilibre, changer de jambe"]),
  // ── Progressions des skills (lib/skills.ts) ──
  x("suspension_passive", "Suspension passive", ["haut"], 2, "s", "traction", ["barre"], ["dos", "avant-bras", "épaules"], ["Bras tendus, épaules relâchées", "Respirer calmement"], { dur: "tractions_scapulaires", alt: "chien_tete_en_bas" }),
  x("tractions_scapulaires", "Tractions scapulaires", ["haut"], 3, "reps", "traction", ["barre"], ["dos", "épaules"], ["Bras tendus", "Abaisser les épaules sans plier les coudes"], { facile: "suspension_passive", dur: "tractions_negatives", alt: "rowing_table" }),
  x("tractions_assistees", "Tractions pieds au sol", ["haut"], 4, "reps", "traction", ["barre"], ["dos", "biceps"], ["Pieds au sol, qui aident juste ce qu'il faut", "Menton au-dessus de la barre"], { facile: "tractions_negatives", dur: "tractions", alt: "rowing_table" }),
  x("appui_tenu", "Appui tenu entre deux chaises", ["haut"], 2, "s", "dips", ["mobilier"], ["triceps", "épaules"], ["Bras tendus entre deux chaises stables", "Épaules basses"], { dur: "dips_banc" }),
  x("dips_negatifs", "Dips négatifs", ["haut"], 3, "reps", "dips", ["mobilier"], ["triceps", "pectoraux"], ["Descendre en 3 s", "Remonter avec les pieds"], { facile: "dips_banc", dur: "dips_parallettes" }),
  x("pistol_boite", "Pistol sur boîte", ["bas"], 4, "reps", "pistol", ["mobilier"], ["quadriceps", "fessiers", "équilibre"], ["S'asseoir sur une chaise sur une jambe", "Se relever sans élan"], { facile: "squat_bulgare", dur: "pistol_assiste" }),
  x("appui_parallettes", "Appui tenu aux parallettes", ["haut", "abdos"], 2, "s", "dips", ["parallettes"], ["triceps", "épaules", "gainage"], ["Bras tendus, épaules basses", "Regard devant, bassin neutre"], { dur: "tuck_lsit_parallettes", alt: "appui_tenu" }),
  x("lsit_une_jambe", "L-sit une jambe", ["abdos", "haut"], 4, "s", "lsit", ["parallettes"], ["abdominaux", "triceps"], ["Une jambe tendue, l'autre pliée", "Pointe de pied tirée"], { facile: "tuck_lsit_parallettes", dur: "lsit_parallettes", alt: "hollow" }),
  x("poirier_pieds_mur_l", "Poirier pieds au mur en L", ["haut"], 3, "s", "poirier", [], ["épaules", "gainage"], ["Mains à une jambe du mur", "Bras verrouillés"], { facile: "pike_pushups", dur: "poirier_mur" }),
  x("poirier_montees", "Montées en poirier contrôlées", ["haut"], 4, "reps", "poirier", [], ["épaules", "gainage"], ["Monter une jambe après l'autre", "Redescendre doucement"], { facile: "poirier_mur", dur: "poirier_libre" }),
  x("poirier_libre", "Poirier libre", ["haut"], 5, "s", "poirier", [], ["épaules", "gainage", "équilibre"], ["Doigts qui corrigent l'équilibre", "Regard entre les mains"], { facile: "poirier_montees" }),
  x("archer_assistee", "Pompes archer assistées", ["haut"], 3, "reps", "archer", [], ["pectoraux", "triceps"], ["Bras tendu sur un ballon ou un livre", "Le bras plié travaille"], { facile: "pompes_larges", dur: "pompes_archer" }),
  x("tractions_poitrine", "Poitrine à la barre", ["haut"], 5, "reps", "traction", ["barre"], ["dos", "biceps"], ["Tirer jusqu'au sternum", "Coudes vers l'arrière"], { facile: "tractions", dur: "tractions_explosives", alt: "rowing_table" }),
  x("tractions_explosives", "Tractions explosives", ["haut"], 5, "reps", "traction", ["barre"], ["dos", "biceps"], ["Tirer vite et haut", "Descente contrôlée"], { facile: "tractions_poitrine", dur: "muscleup_negatif", alt: "rowing_table" }),
  x("transition_barre_basse", "Transition à la barre basse", ["haut"], 5, "reps", "muscleup", ["barre"], ["dos", "triceps", "poignets"], ["Pieds au sol, barre à la poitrine", "Passer les poignets au-dessus"], { facile: "tractions_poitrine", dur: "muscleup_negatif", alt: "dips_banc" }),
  x("muscleup_negatif", "Muscle-up négatifs", ["haut"], 5, "reps", "muscleup", ["barre"], ["dos", "triceps", "poignets"], ["Partir au-dessus de la barre", "Descendre lentement"], { facile: "transition_barre_basse", dur: "muscleup", alt: "dips_banc" }),
  x("muscleup", "Muscle-up", ["haut"], 5, "reps", "muscleup", ["barre"], ["dos", "triceps", "poignets"], ["Tirer vers les hanches", "Basculer les poignets vite"], { facile: "muscleup_negatif", alt: "dips_banc" }),
  x("tuck_frontlever", "Tuck front lever", ["haut", "abdos"], 5, "s", "frontlever", ["barre"], ["dos", "abdominaux"], ["Genoux à la poitrine", "Bras tendus, dos parallèle au sol"], { dur: "adv_tuck_frontlever", alt: "hollow" }),
  x("adv_tuck_frontlever", "Advanced tuck front lever", ["haut", "abdos"], 5, "s", "frontlever", ["barre"], ["dos", "abdominaux"], ["Dos plat", "Genoux à 90°"], { facile: "tuck_frontlever", dur: "frontlever_une_jambe", alt: "hollow" }),
  x("frontlever_une_jambe", "Front lever une jambe", ["haut", "abdos"], 5, "s", "frontlever", ["barre"], ["dos", "abdominaux"], ["Une jambe tendue", "Hanches hautes"], { facile: "adv_tuck_frontlever", dur: "frontlever_straddle", alt: "hollow" }),
  x("frontlever_straddle", "Front lever straddle", ["haut", "abdos"], 5, "s", "frontlever", ["barre"], ["dos", "abdominaux"], ["Jambes écartées tendues", "Corps à l'horizontale"], { facile: "frontlever_une_jambe", dur: "frontlever", alt: "hollow" }),
  x("frontlever", "Front lever", ["haut", "abdos"], 5, "s", "frontlever", ["barre"], ["dos", "abdominaux"], ["Jambes serrées", "Tout le corps à l'horizontale"], { facile: "frontlever_straddle", alt: "hollow" }),
  x("planche_lean", "Planche lean", ["haut", "abdos"], 3, "s", "pseudo", [], ["épaules", "poignets", "gainage"], ["Épaules en avant des mains, bras tendus", "Dos rond, pousser dans le sol"], { facile: "pompes", dur: "tuck_planche_parallettes" }),
  x("adv_tuck_planche", "Advanced tuck planche", ["haut", "abdos"], 5, "s", "planche", ["parallettes"], ["épaules", "gainage", "poignets"], ["Dos plat", "Hanches au niveau des épaules"], { facile: "tuck_planche_parallettes", dur: "planche_straddle", alt: "planche_lean" }),
  x("planche_straddle", "Planche straddle", ["haut", "abdos"], 5, "s", "planche", ["parallettes"], ["épaules", "gainage", "poignets"], ["Jambes écartées tendues", "Corps à l'horizontale"], { facile: "adv_tuck_planche", alt: "planche_lean" }),
];

export const exercice = (id: string): Exercice | undefined => EXERCICES.find((e) => e.id === id);

// ─── Matériel et alternatives ───────────────────────────────────────────

/** Faisable avec mon matériel. */
export const faisable = (e: Exercice, m: Materiel): boolean => manquants(e.materiel, m).length === 0;

/**
 * Quand le matériel manque : l'alternative proposée. D'abord celle de l'exercice, puis les variantes
 * plus faciles, puis un exercice de même zone et de niveau voisin qui ne demande rien de plus.
 */
export function alternativeA(e: Exercice, m: Materiel): Exercice | null {
  if (faisable(e, m)) return null;
  const ok = (id: string | undefined) => {
    const c = id ? exercice(id) : undefined;
    return c && c.id !== e.id && faisable(c, m) ? c : null;
  };
  const direct = ok(e.alternative);
  if (direct) return direct;
  const vus = new Set<string>([e.id]);
  for (let courant: Exercice | undefined = exercice(e.plus_facile ?? ""); courant && !vus.has(courant.id); courant = exercice(courant.plus_facile ?? "")) {
    vus.add(courant.id);
    if (faisable(courant, m)) return courant;
  }
  return (
    EXERCICES.filter((c) => c.id !== e.id && faisable(c, m) && c.zones.some((z) => e.zones.includes(z)) && Math.abs(c.niveau - e.niveau) <= 1)
      .sort((a, b) => Math.abs(a.niveau - e.niveau) - Math.abs(b.niveau - e.niveau) || a.id.localeCompare(b.id))[0] ?? null
  );
}

// ─── Recherche et filtres ───────────────────────────────────────────────

export type FiltreExercices = {
  texte?: string;
  zone?: Zone | null;
  niveau?: number | null;
  /** Seulement ce que mon matériel permet. */
  materielDispo?: boolean;
};

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrer(f: FiltreExercices, m: Materiel, liste: Exercice[] = EXERCICES): Exercice[] {
  const q = sansAccents((f.texte ?? "").trim());
  return liste.filter(
    (e) =>
      (!q || sansAccents(`${e.nom} ${e.muscles.join(" ")}`).includes(q)) &&
      (!f.zone || e.zones.includes(f.zone)) &&
      (!f.niveau || e.niveau === f.niveau) &&
      (!f.materielDispo || faisable(e, m)),
  );
}

/** Unité de ce qu'on note pour cet exercice. */
export const uniteDe = (e: Exercice): "reps" | "s" => (e.mode === "s" ? "s" : "reps");
