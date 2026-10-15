// ============================================================
// AMISACHE — liturgy.util.ts
// Validation « cette date est-elle une occurrence valide de ce
// Schedule » — règle métier cahier-des-charges §4.6 : « la date doit
// être une occurrence valide du Schedule ». Pur — aucune DI.
//
// ⚠️ Limitation assumée sur BIWEEKLY : le modèle ne porte aucune date
// d'ancrage pour distinguer "semaine A" de "semaine B" — on valide donc
// seulement le jour de semaine, comme WEEKLY. À affiner si un ancrage
// est ajouté au modèle plus tard.
// ============================================================
import { ScheduleFrequency } from './liturgy.enum';

export interface ScheduleOccurrenceInput {
  frequency: ScheduleFrequency;
  dayOfWeek?: number;
  weekOfMonth?: number;
  startDate?: string;
  endDate?: string;
}

export function isValidScheduleOccurrence(
  schedule: ScheduleOccurrenceInput,
  dateStr: string,
): boolean {
  if (schedule.startDate && dateStr < schedule.startDate) return false;
  if (schedule.endDate && dateStr > schedule.endDate) return false;

  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  switch (schedule.frequency) {
    case ScheduleFrequency.ONCE:
      return schedule.startDate === dateStr;

    case ScheduleFrequency.DAILY:
      return true;

    case ScheduleFrequency.WEEKLY:
    case ScheduleFrequency.BIWEEKLY:
      return schedule.dayOfWeek == null || date.getUTCDay() === schedule.dayOfWeek;

    case ScheduleFrequency.MONTHLY: {
      if (schedule.dayOfWeek == null || schedule.weekOfMonth == null) return true;
      if (date.getUTCDay() !== schedule.dayOfWeek) return false;
      const nthOfMonth = Math.ceil(date.getUTCDate() / 7);
      return nthOfMonth === schedule.weekOfMonth;
    }

    default:
      return true;
  }
}

// ============================================================
// nextScheduleOccurrence — prochaine occurrence future d'un Schedule,
// utilisée par ScheduleService.nearby (« Messes autour de vous »).
//
// ⚠️ Simplification assumée : `schedule.time` est traité comme une heure
// locale Bénin (UTC+1, pas de changement d'heure) — pas de fuseau par
// église dans le modèle (déploiement mono-pays pour l'instant). On
// convertit donc en instant UTC réel via BENIN_UTC_OFFSET_HOURS pour que
// la comparaison à `from` (l'heure serveur, réellement UTC) soit exacte.
// À généraliser si Amisache s'étend à un pays dans un autre fuseau.
// ============================================================
const BENIN_UTC_OFFSET_HOURS = 1;

export interface ScheduleTimingInput extends ScheduleOccurrenceInput {
  time: string; // "HH:mm" ou "HH:mm:ss"
  duration: number; // minutes
}

/**
 * Cherche, jour par jour sur `horizonDays`, la première occurrence dont la
 * fin (début + durée) est encore à venir par rapport à `from` — une messe
 * en cours compte donc comme « prochaine » (§4.11 : détection « en cours »).
 * `undefined` si aucune occurrence valide dans l'horizon (horaire expiré).
 */
export function nextScheduleOccurrence(
  schedule: ScheduleTimingInput,
  from: Date,
  horizonDays = 14,
): Date | undefined {
  const [hours, minutes] = schedule.time.split(':').map(Number);

  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + offset);
    const dateStr = day.toISOString().slice(0, 10);
    if (!isValidScheduleOccurrence(schedule, dateStr)) continue;

    const localStart = new Date(`${dateStr}T00:00:00Z`);
    localStart.setUTCHours(hours, minutes, 0, 0);
    const occurrenceStart = new Date(localStart.getTime() - BENIN_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    const occurrenceEnd = new Date(occurrenceStart.getTime() + schedule.duration * 60 * 1000);

    if (occurrenceEnd.getTime() > from.getTime()) return occurrenceStart;
  }

  return undefined;
}

// ============================================================
// Délai minimum d'une demande (RequestType/Tariff.minLeadHours) — en heures,
// pour couvrir aussi bien « 12 heures » que « 3 jours » ou « 2 semaines ».
// Même simplification de fuseau que ci-dessus : les dates/heures d'une
// demande sont des valeurs locales Bénin.
// ============================================================

/** Premier instant (heure locale Bénin, sous forme `YYYY-MM-DDTHH:mm`) admis pour une demande. */
export function earliestRequestLocal(minLeadHours: number, now = new Date()): string {
  const local = new Date(now.getTime() + (BENIN_UTC_OFFSET_HOURS + Math.max(0, minLeadHours)) * 3600 * 1000);
  return local.toISOString().slice(0, 16);
}

/**
 * La date souhaitée (et l'heure de la messe, si connue) respecte-t-elle le
 * délai ? Sans heure, seul le jour compte : le jour du premier instant admis
 * est accepté (comportement identique à l'ancien délai en jours pour un
 * multiple de 24 h).
 */
export function respectsLeadTime(
  date: string,
  time: string | undefined,
  minLeadHours: number,
  now = new Date(),
): boolean {
  const earliest = earliestRequestLocal(minLeadHours, now);
  const earliestDay = earliest.slice(0, 10);
  if (date !== earliestDay) return date > earliestDay;
  return !time || time.slice(0, 5) >= earliest.slice(11, 16);
}

/** Libellé lisible d'un délai en heures — « 3 jours », « 2 semaines », « 12 heures ». */
export function formatLeadTime(hours: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n > 1 ? 's' : ''}`;
  if (hours > 0 && hours % 168 === 0) return plural(hours / 168, 'semaine');
  if (hours > 0 && hours % 24 === 0) return plural(hours / 24, 'jour');
  return plural(hours, 'heure');
}
