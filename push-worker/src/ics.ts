/**
 * Google Agenda (adresse iCal secrète) → liste d'événements en JSON.
 * Pur et sans dépendance : tourne dans le Worker et dans les tests (tests/agenda.test.mjs).
 *
 * Gère : lignes repliées, heures UTC / TZID / flottantes, journées entières,
 * RRULE (DAILY, WEEKLY + BYDAY, MONTHLY + BYMONTHDAY / BYDAY, YEARLY ; INTERVAL, COUNT, UNTIL),
 * EXDATE, RECURRENCE-ID (occurrence déplacée ou annulée).
 * Les récurrences sont dépliées à l'heure du mur du fuseau de l'événement (9 h reste 9 h
 * après le changement d'heure), puis converties en Europe/Paris.
 * ponytail: pas de BYSETPOS, BYWEEKNO ni BYYEARDAY (rares dans Google Agenda).
 */

export type Evenement = {
  id: string;
  titre: string;
  /** Jour (Europe/Paris), AAAA-MM-JJ. */
  jour: string;
  /** HH:MM, null pour une journée entière. */
  debut: string | null;
  fin: string | null;
  journee: boolean;
  /** Minutes occupées ce jour-là (0 pour une journée entière). */
  duree_min: number;
};

const SORTIE = "Europe/Paris";
const MIN = 60_000;
const JOUR = 86_400_000;
const MAX_OCCURRENCES = 20_000;

// ─── Fuseaux ────────────────────────────────────────────────────────────

const formats = new Map<string, Intl.DateTimeFormat>();
function format(tz: string): Intl.DateTimeFormat {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formats.set(tz, f);
  }
  return f;
}

/** Heure du mur de `tz` à l'instant donné, en « ms UTC » (calendrier sans fuseau). */
function murDans(instant: number, tz: string): number {
  if (tz === "UTC") return instant;
  const p: Record<string, number> = {};
  for (const x of format(tz).formatToParts(new Date(instant))) {
    if (x.type !== "literal") p[x.type] = Number(x.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}

/** Instant (ms UTC) d'une heure du mur dans `tz`. */
function instantDepuisMur(mur: number, tz: string): number {
  if (tz === "UTC") return mur;
  let instant = mur - (murDans(mur, tz) - mur);
  instant = mur - (murDans(instant, tz) - instant);
  return instant;
}

const SANS_FUSEAU = new Set(["", "floating"]);
/** Heure du mur d'un événement → heure du mur à Paris. Un fuseau inconnu est lu comme Paris. */
function versParis(mur: number, tz: string): number {
  if (SANS_FUSEAU.has(tz) || tz === SORTIE) return mur;
  try {
    return murDans(instantDepuisMur(mur, tz), SORTIE);
  } catch {
    return mur;
  }
}

// ─── Lecture des lignes ─────────────────────────────────────────────────

type Prop = { nom: string; params: Record<string, string>; valeur: string };

function lireLigne(l: string): Prop | null {
  const sep = l.indexOf(":");
  if (sep < 0) return null;
  const [nom, ...ps] = l.slice(0, sep).split(";");
  const params: Record<string, string> = {};
  for (const p of ps) {
    const [k, v] = p.split("=");
    if (v !== undefined) params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
  }
  return { nom: nom.toUpperCase(), params, valeur: l.slice(sep + 1) };
}

const texte = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

type Date_ = { mur: number; tz: string; journee: boolean };

function lireDate(valeur: string, params: Record<string, string>): Date_ | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(valeur.trim());
  if (!m) return null;
  const mur = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  const journee = m[4] === undefined || params.VALUE === "DATE";
  return { mur, tz: m[7] ? "UTC" : (params.TZID ?? ""), journee };
}

function lireDuree(v: string): number | null {
  const m = /^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/.exec(v.trim());
  if (!m) return null;
  const ms = (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * JOUR + +(m[4] ?? 0) * 60 * MIN + +(m[5] ?? 0) * MIN;
  return m[1] ? -ms : ms;
}

const pad = (n: number) => String(n).padStart(2, "0");
const jourDe = (mur: number) => new Date(mur).toISOString().slice(0, 10);
const heureDe = (mur: number) => {
  const d = new Date(mur);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
/** Clé d'une occurrence : date et heure à Paris. */
const cle = (mur: number, tz: string) => jourDe(versParis(mur, tz)) + "T" + heureDe(versParis(mur, tz));

type Brut = {
  uid: string;
  titre: string;
  debut: Date_;
  duree: number;
  rrule: Record<string, string> | null;
  exdates: Set<string>;
  recurrenceId: string | null;
  annule: boolean;
};

function lireEvenement(lignes: Prop[]): Brut | null {
  const get = (n: string) => lignes.find((p) => p.nom === n);
  const ds = get("DTSTART");
  const debut = ds && lireDate(ds.valeur, ds.params);
  if (!debut) return null;

  const de = get("DTEND");
  const fin = de && lireDate(de.valeur, de.params);
  const dur = get("DURATION");
  let duree = debut.journee ? JOUR : 0;
  if (fin) {
    // Même fuseau pour les deux : la différence des heures du mur suffit.
    duree = fin.tz === debut.tz || debut.journee ? fin.mur - debut.mur : instantDepuisMur(fin.mur, fin.tz) - instantDepuisMur(debut.mur, debut.tz);
  } else if (dur) {
    duree = lireDuree(dur.valeur) ?? duree;
  }
  if (duree < 0) duree = 0;

  const rr = get("RRULE");
  const rrule = rr ? Object.fromEntries(rr.valeur.split(";").map((x) => x.split("=") as [string, string])) : null;

  const exdates = new Set<string>();
  for (const p of lignes.filter((x) => x.nom === "EXDATE")) {
    for (const v of p.valeur.split(",")) {
      const d = lireDate(v, p.params);
      if (d) exdates.add(cle(d.mur, d.tz || debut.tz));
    }
  }

  const rid = get("RECURRENCE-ID");
  const ridDate = rid && lireDate(rid.valeur, rid.params);

  return {
    uid: get("UID")?.valeur ?? "",
    titre: texte(get("SUMMARY")?.valeur ?? "") || "(sans titre)",
    debut,
    duree,
    rrule,
    exdates,
    recurrenceId: ridDate ? cle(ridDate.mur, ridDate.tz || debut.tz) : null,
    annule: get("STATUS")?.valeur.toUpperCase() === "CANCELLED",
  };
}

// ─── Récurrences ────────────────────────────────────────────────────────

const JOURS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** BYDAY : « MO », « 1MO », « -1FR » → jour de semaine et rang éventuel. */
function lireByDay(v: string | undefined): { jour: number; rang: number }[] {
  return (v ?? "")
    .split(",")
    .map((x) => /^([+-]?\d+)?([A-Z]{2})$/.exec(x.trim()))
    .filter((m): m is RegExpExecArray => !!m && JOURS_ICS.includes(m[2]))
    .map((m) => ({ jour: JOURS_ICS.indexOf(m[2]), rang: m[1] ? +m[1] : 0 }));
}

/** Les heures du mur des occurrences, dans l'ordre, à partir du début (inclus). */
function* occurrences(debut: Date_, r: Record<string, string>): Generator<number> {
  const interval = Math.max(1, +(r.INTERVAL ?? 1) || 1);
  const t0 = new Date(debut.mur);
  const heure = debut.mur - Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), t0.getUTCDate());
  const jourMur = (a: number, m: number, j: number) => Date.UTC(a, m, j) + heure;
  const byDay = lireByDay(r.BYDAY);

  if (r.FREQ === "DAILY") {
    for (let k = 0; ; k++) yield debut.mur + k * interval * JOUR;
  } else if (r.FREQ === "WEEKLY") {
    const jours = (byDay.length ? byDay.map((b) => b.jour) : [t0.getUTCDay()]).sort(
      (a, b) => ((a + 6) % 7) - ((b + 6) % 7),
    );
    const lundi = Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), t0.getUTCDate() - ((t0.getUTCDay() + 6) % 7));
    for (let k = 0; ; k++) {
      for (const j of jours) {
        const t = lundi + (k * interval * 7 + ((j + 6) % 7)) * JOUR + heure;
        if (t >= debut.mur) yield t;
      }
    }
  } else if (r.FREQ === "MONTHLY") {
    const parJour = (r.BYMONTHDAY ?? "").split(",").filter(Boolean).map(Number);
    for (let k = 0; ; k++) {
      const a = t0.getUTCFullYear();
      const m = t0.getUTCMonth() + k * interval;
      const nbJours = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
      const dans: number[] = [];
      if (byDay.length) {
        for (const b of byDay) {
          const tous = Array.from({ length: nbJours }, (_, i) => i + 1).filter(
            (j) => new Date(Date.UTC(a, m, j)).getUTCDay() === b.jour,
          );
          if (b.rang === 0) dans.push(...tous);
          else {
            const j = b.rang > 0 ? tous[b.rang - 1] : tous[tous.length + b.rang];
            if (j) dans.push(j);
          }
        }
      } else if (parJour.length) {
        for (const j of parJour) dans.push(j > 0 ? j : nbJours + 1 + j);
      } else if (t0.getUTCDate() <= nbJours) {
        dans.push(t0.getUTCDate());
      }
      for (const j of dans.filter((x) => x >= 1 && x <= nbJours).sort((x, y) => x - y)) {
        const t = jourMur(a, m, j);
        if (t >= debut.mur) yield t;
      }
    }
  } else if (r.FREQ === "YEARLY") {
    for (let k = 0; ; k++) {
      const t = jourMur(t0.getUTCFullYear() + k * interval, t0.getUTCMonth(), t0.getUTCDate());
      if (new Date(t).getUTCMonth() === t0.getUTCMonth()) yield t; // 29 février : années sans, ignorées
    }
  } else {
    yield debut.mur; // fréquence inconnue (HOURLY…) : une seule occurrence
  }
}

// ─── Analyse ────────────────────────────────────────────────────────────

/**
 * Événements entre `aujourdhui - 7` et `aujourdhui + 60` jours (Paris).
 * `aujourdhui` : AAAA-MM-JJ.
 */
export function analyserIcs(ics: string, aujourdhui: string): Evenement[] {
  const base = Date.parse(aujourdhui + "T00:00:00Z");
  const debutFenetre = base - 7 * JOUR;
  const finFenetre = base + 61 * JOUR; // exclu
  const lignes = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);

  const bruts: Brut[] = [];
  let courant: Prop[] | null = null;
  for (const l of lignes) {
    if (l === "BEGIN:VEVENT") courant = [];
    else if (l === "END:VEVENT") {
      const b = courant && lireEvenement(courant);
      if (b) bruts.push(b);
      courant = null;
    } else if (courant) {
      const p = lireLigne(l);
      if (p) courant.push(p);
    }
  }

  // Occurrences déplacées ou annulées : la série d'origine les saute.
  const remplacees = new Set(bruts.filter((b) => b.recurrenceId).map((b) => b.uid + "|" + b.recurrenceId));

  const sortie: Evenement[] = [];
  const ajouter = (b: Brut, mur: number, n: number) => {
    const paris = versParis(mur, b.debut.tz);
    const id = `${b.uid}#${n}`;
    if (b.debut.journee) {
      // Chaque jour couvert (la fin d'une journée entière est exclue), 14 jours au plus.
      const jours = Math.min(14, Math.max(1, Math.round(b.duree / JOUR)));
      for (let i = 0; i < jours; i++) {
        const j = paris + i * JOUR;
        if (j >= debutFenetre && j < finFenetre)
          sortie.push({ id: i ? `${id}+${i}` : id, titre: b.titre, jour: jourDe(j), debut: null, fin: null, journee: true, duree_min: 0 });
      }
      return;
    }
    if (paris < debutFenetre || paris >= finFenetre) return;
    const finMur = paris + b.duree;
    const jusquaMinuit = Math.floor(paris / JOUR) * JOUR + JOUR - paris;
    const memeJour = b.duree <= jusquaMinuit;
    sortie.push({
      id,
      titre: b.titre,
      jour: jourDe(paris),
      debut: heureDe(paris),
      fin: memeJour ? heureDe(finMur) : "23:59",
      journee: false,
      duree_min: Math.round(Math.min(b.duree, jusquaMinuit) / MIN),
    });
  };

  for (const b of bruts) {
    if (!b.rrule) {
      if (!b.annule) ajouter(b, b.debut.mur, 0);
      continue;
    }
    let jusqua = Infinity;
    if (b.rrule.UNTIL) {
      const u = lireDate(b.rrule.UNTIL, {});
      if (u) jusqua = u.journee ? instantDepuisMur(u.mur + JOUR - 1, b.debut.tz) : instantDepuisMur(u.mur, u.tz || b.debut.tz);
    }
    const max = b.rrule.COUNT ? +b.rrule.COUNT : Infinity;
    let n = 0;
    for (const mur of occurrences(b.debut, b.rrule)) {
      if (n >= max || n >= MAX_OCCURRENCES) break;
      if (instantDepuisMur(mur, b.debut.tz) > jusqua) break;
      if (versParis(mur, b.debut.tz) >= finFenetre) break;
      n++;
      const k = cle(mur, b.debut.tz);
      if (b.exdates.has(k) || remplacees.has(b.uid + "|" + k)) continue;
      if (!b.annule) ajouter(b, mur, n);
    }
  }

  return sortie.sort((a, b) => a.jour.localeCompare(b.jour) || (a.debut ?? "").localeCompare(b.debut ?? ""));
}
