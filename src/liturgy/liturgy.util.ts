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
