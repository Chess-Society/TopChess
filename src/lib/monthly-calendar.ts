import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { assert, fourSessions } from './domain';

export const BILLING_TIMEZONE = 'Europe/Madrid';
export const MONTHLY_TERMS = '2026-10-monthly-2';
/** El cargo UTC siempre cae en el día 1 en Madrid, también con horario de verano. */
export function monthBoundary(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1));
}
export function nextBillingMonth(now = new Date()) {
  const [year, month] = formatInTimeZone(now, BILLING_TIMEZONE, 'yyyy-MM').split('-').map(Number);
  return monthBoundary(year, month);
}
export function sameBillingMonth(first: Date, now = new Date()) {
  return (
    formatInTimeZone(first, BILLING_TIMEZONE, 'yyyy-MM') ===
    nextBillingMonth(now).toISOString().slice(0, 7)
  );
}
export function monthlyCalendar(
  first: Date,
  duration: number,
  excluded: string[] = [],
  months = 12,
) {
  const local = formatInTimeZone(first, BILLING_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  const [year, month, day] = local.slice(0, 10).split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return Array.from({ length: months }, (_, index) => {
    const start = monthBoundary(year, month - 1 + index);
    const end = monthBoundary(year, month + index);
    const date = new Date(start);
    date.setUTCDate(1 + ((weekday - start.getUTCDay() + 7) % 7));
    const anchor = fromZonedTime(
      `${date.toISOString().slice(0, 10)}T${local.slice(11)}`,
      BILLING_TIMEZONE,
    );
    const sessions = fourSessions(anchor, BILLING_TIMEZONE, duration, excluded);
    assert(
      sessions.every((s) => s.startsAt >= start && s.endsAt <= end),
      'Los festivos no dejan cuatro clases dentro del mes. Revisa el calendario antes de publicar.',
    );
    if (!index)
      assert(
        sessions[0].startsAt.getTime() === first.getTime(),
        'El inicio debe ser la primera fecha disponible de ese día de la semana en el mes.',
      );
    return { start, end, sessions };
  });
}
