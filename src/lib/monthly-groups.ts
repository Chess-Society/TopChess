import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { formatInTimeZone } from 'date-fns-tz';
import type { User } from './auth';
import { assert, canAdmin } from './domain';
import { atomic, d1Query, auditStatement, type Statement } from './cloudflare';
import { monthlyCalendar, sameBillingMonth, BILLING_TIMEZONE } from './monthly-calendar';
type Dependencies = {
  query: typeof d1Query;
  write: (statements: Statement[]) => Promise<unknown>;
  now: () => Date;
  selfService?: boolean;
};
const id = z.uuid();
async function validateOwnSchedule(
  user: User,
  d: { teacherId: string; firstAt: string; duration: number },
  deps: Dependencies,
) {
  if (!deps.selfService && canAdmin(user.role)) return;
  assert(d.teacherId === user.id, 'Solo puedes publicar tus propios grupos.', 403);
  const first = new Date(d.firstAt),
    end = new Date(first.getTime() + d.duration * 60000);
  const day = Number(formatInTimeZone(first, BILLING_TIMEZONE, 'i'));
  const startText = formatInTimeZone(first, BILLING_TIMEZONE, 'HH:mm'),
    endText = formatInTimeZone(end, BILLING_TIMEZONE, 'HH:mm');
  const slots = await deps.query<{ start_time: string; end_time: string }>(
    'SELECT start_time,end_time FROM teacher_availability WHERE teacher_id=$1 AND weekday=$2 AND approved=true',
    [user.id, day],
  );
  assert(
    formatInTimeZone(first, BILLING_TIMEZONE, 'yyyy-MM-dd') ===
      formatInTimeZone(end, BILLING_TIMEZONE, 'yyyy-MM-dd') &&
      slots.some((s) => s.start_time.slice(0, 5) <= startText && s.end_time.slice(0, 5) >= endText),
    'La clase debe quedar dentro de tu disponibilidad publicada. Revisa tus horarios antes de crear el grupo.',
    409,
  );
}
export async function publishMonthlyGroup(
  user: User,
  raw: unknown,
  deps: Dependencies = { query: d1Query, write: atomic, now: () => new Date() },
) {
  assert(
    user.role === 'teacher' || canAdmin(user.role),
    'Acceso reservado a profesores autorizados.',
    403,
  );

  const d = z
    .object({
      teacherId: id,
      title: z.string().min(5).max(120),
      level: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
      language: z.string().min(2).max(50),
      capacity: z.number().int().min(2).max(4),
      firstAt: z.iso.datetime(),
      duration: z.number().int().min(30).max(180),
      timezone: z.string(),
      excludedDates: z.array(z.iso.date()).default([]),
    })
    .parse(raw);
  const [teacher] = await deps.query(
    "SELECT 1 FROM teacher_profiles WHERE user_id=$1 AND status='active' AND published=1 AND agreement_at IS NOT NULL AND verified_at IS NOT NULL",
    [d.teacherId],
  );
  assert(teacher, 'El profesor debe estar activo, verificado y autorizado.');
  assert(
    canAdmin(user.role) || user.id === d.teacherId,
    'No puedes crear grupos para otro profesor.',
    403,
  );
  await validateOwnSchedule(user, d, deps);
  const first = new Date(d.firstAt);
  assert(d.timezone === BILLING_TIMEZONE, 'El calendario mensual se organiza en Europe/Madrid.');
  assert(sameBillingMonth(first, deps.now()), 'Los grupos nuevos empiezan el mes siguiente.');
  const calendar = monthlyCalendar(first, d.duration, d.excludedDates);
  const deadline = new Date(calendar[0].start.getTime() - 48 * 3600_000);
  assert(
    deadline > deps.now(),
    'La matrícula debe cerrar 48 horas antes del día 1. Publica un grupo para el siguiente mes.',
  );
  assert(
    first.getTime() > deps.now().getTime() + 48 * 3600_000,
    'El inicio debe ser posterior al cierre de inscripción.',
  );
  const groupId = randomUUID();
  const statements: Statement[] = [
    {
      sql: "INSERT INTO groups(id,teacher_id,title,level,language,capacity,first_at,timezone,duration,enrollment_deadline,excluded_dates,status,billing_model) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published','calendar_month')",
      values: [
        groupId,
        d.teacherId,
        d.title,
        d.level,
        d.language,
        d.capacity,
        first,
        d.timezone,
        d.duration,
        deadline,
        d.excludedDates,
      ],
    },
  ];
  for (const [i, { start, end, sessions }] of calendar.entries()) {
    const cycleId = randomUUID();
    statements.push({
      sql: 'INSERT INTO billing_cycles(id,group_id,sequence,starts_at,ends_at,approved) VALUES($1,$2,$3,$4,$5,1)',
      values: [cycleId, groupId, i + 1, start, end],
    });
    for (const s of sessions)
      statements.push({
        sql: 'INSERT INTO sessions(group_id,cycle_id,teacher_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
        values: [groupId, cycleId, d.teacherId, s.startsAt, s.endsAt],
      });
  }
  statements.push(auditStatement(user.id, 'publish', 'group', groupId));
  await deps.write(statements);
  return { id: groupId };
}
