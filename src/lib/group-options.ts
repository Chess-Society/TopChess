import { fromZonedTime } from 'date-fns-tz';
import { fourSessions } from './domain';
import { BILLING_TIMEZONE, monthlyCalendar, nextBillingMonth } from './monthly-calendar';
import type { Availability } from './teacher-availability';

export type BusySession = { starts_at: string; ends_at: string };
export type GroupStartOption = {
  key: string;
  availabilityId: string;
  weekday: number;
  start: string;
  end: string;
  firstAt: string;
  dates: string[];
};
/** Opciones del horario publicado; el servidor vuelve a validar al crear el grupo. */
export function groupStartOptions(
  slots: Availability[],
  duration: number,
  busy: BusySession[] = [],
  excluded: string[] = [],
  now = new Date(),
): GroupStartOption[] {
  const month = nextBillingMonth(now);
  if (
    !Number.isInteger(duration) ||
    duration < 30 ||
    duration > 180 ||
    month.getTime() - 48 * 3600_000 <= now.getTime()
  )
    return [];
  const minutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  const clock = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const result: GroupStartOption[] = [],
    seen = new Set<string>();
  const busyRanges = busy.map((b) => [
    new Date(b.starts_at).getTime(),
    new Date(b.ends_at).getTime(),
  ]);
  for (const slot of slots.filter((s) => s.approved)) {
    const day = new Date(month);
    day.setUTCDate(1 + (((slot.weekday % 7) - month.getUTCDay() + 7) % 7));
    for (
      let start = minutes(slot.start_time);
      start + duration <= minutes(slot.end_time);
      start += duration
    ) {
      const anchor = fromZonedTime(
        `${day.toISOString().slice(0, 10)}T${clock(start)}:00`,
        BILLING_TIMEZONE,
      );
      try {
        const first = fourSessions(anchor, BILLING_TIMEZONE, duration, excluded)[0].startsAt;
        const calendar = monthlyCalendar(first, duration, excluded);
        if (
          calendar.some((c) =>
            c.sessions.some((s) =>
              busyRanges.some(
                ([start, end]) => s.startsAt.getTime() < end && s.endsAt.getTime() > start,
              ),
            ),
          )
        )
          continue;
        const firstAt = first.toISOString();
        if (seen.has(firstAt)) continue;
        seen.add(firstAt);
        result.push({
          key: `${slot.id}:${clock(start)}:${duration}`,
          availabilityId: slot.id,
          weekday: slot.weekday,
          start: clock(start),
          end: clock(start + duration),
          firstAt,
          dates: calendar[0].sessions.map((s) => s.startsAt.toISOString()),
        });
      } catch {
        /* No ofrecer un calendario que no permite cuatro clases por mes. */
      }
    }
  }
  return result.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}
