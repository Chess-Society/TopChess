import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export const PRICE_CENTS = 5000;
export const TERMS_VERSION = '2026-10-mvp-1';
export const GROUP_STATES = [
  'draft',
  'published',
  'pending',
  'confirmed',
  'active',
  'full',
  'suspended',
  'finished',
  'cancelled',
] as const;
export type Role = 'student' | 'candidate' | 'teacher' | 'admin' | 'superadmin';
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export function canAdmin(role: Role) {
  return role === 'admin' || role === 'superadmin';
}
export function canReserve(
  group: { status: string; capacity: number; count: number; firstAt: Date },
  now = new Date(),
) {
  assert(
    ['published', 'pending', 'confirmed'].includes(group.status),
    'Este grupo no admite nuevas reservas.',
  );
  assert(group.count < group.capacity, 'No quedan plazas en este grupo.');
  assert(
    group.firstAt.getTime() - now.getTime() >= 48 * 3600_000,
    'La inscripción se cierra 48 horas antes de empezar.',
  );
}
export function overlaps(a: Date, b: Date, durationA = 60, durationB = 60) {
  return (
    a.getTime() < b.getTime() + durationB * 60_000 && b.getTime() < a.getTime() + durationA * 60_000
  );
}
/** Cuatro sesiones explícitas. Conserva la hora local al cambiar el horario de verano. */
export function fourSessions(
  first: Date,
  timezone = 'Europe/Madrid',
  duration = 60,
  excluded: string[] = [],
) {
  const local = formatInTimeZone(first, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  const cursor = new Date(local + 'Z');
  const result: { startsAt: Date; endsAt: Date }[] = [];
  for (let i = 0; result.length < 4 && i < 104; i++) {
    const wall = cursor.toISOString().slice(0, 19);
    if (!excluded.includes(wall.slice(0, 10))) {
      const startsAt = fromZonedTime(wall, timezone);
      result.push({ startsAt, endsAt: new Date(startsAt.getTime() + duration * 60_000) });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  assert(result.length === 4, 'No se puede generar el ciclo con estas excepciones.');
  return result;
}
export function splitCents(base: number, teacherBps: number) {
  assert(Number.isSafeInteger(base) && base >= 0, 'Base económica inválida.');
  assert(
    Number.isInteger(teacherBps) && teacherBps >= 5000 && teacherBps <= 9500,
    'Comisión fuera de los límites.',
  );
  const teacher = Math.floor((base * teacherBps) / 10_000);
  return { teacher, academy: base - teacher };
}
export function nextCommission(
  current: number,
  counts: [number, number],
  levels: { threshold: number; teacherBps: number }[],
  frozen = false,
) {
  if (frozen) return current;
  return Math.max(
    current,
    ...levels.filter((l) => counts.every((n) => n >= l.threshold)).map((l) => l.teacherBps),
  );
}
export function commissionAfterStatus(status: string, oldBps: number) {
  return status === 'readmitted' ? 5000 : oldBps;
}
export function consumeSession(status: string) {
  return status === 'taught' || status === 'student_absent';
}
export function money(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
