import { z } from 'zod';
import type { User } from './auth';
import { assert, canAdmin } from './domain';
import { query, transaction } from './db';
import { atomic, auditStatement, onCloudflare, type Statement } from './cloudflare';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export type Availability = {
  id: string;
  teacher_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  approved?: boolean;
};
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const input = z
  .object({
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
    weekday: z.coerce.number().int().min(1).max(7).optional(),
    start: time,
    end: time,
  })
  .refine((d) => d.weekdays?.length || d.weekday, 'Selecciona al menos un día.');
type Dependencies = { query: typeof query; write: (statements: Statement[]) => Promise<unknown> };
const write = async (statements: Statement[]) =>
  onCloudflare()
    ? atomic(statements)
    : transaction(async (c) => {
        for (const s of statements) await c.query(s.sql, s.values);
      });
export class TeacherAvailability {
  constructor(private d: Dependencies = { query, write }) {}
  private async authorize(user: User) {
    assert(user.role === 'teacher' || canAdmin(user.role), 'Acceso reservado a profesores.', 403);
    assert(
      (
        await this.d.query(
          "SELECT 1 FROM teacher_profiles WHERE user_id=$1 AND status='active' AND agreement_at IS NOT NULL AND verified_at IS NOT NULL",
          [user.id],
        )
      ).length,
      'Completa y confirma primero tu perfil docente.',
      403,
    );
  }
  async save(user: User, raw: unknown) {
    await this.authorize(user);
    const d = input.parse(raw),
      days = [...new Set(d.weekdays || [d.weekday!])];
    assert(d.end > d.start, 'La hora final debe ser posterior al inicio.');
    const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    assert(minutes(d.end) - minutes(d.start) >= 30, 'Indica una franja de al menos 30 minutos.');
    const current = await this.d.query<Availability>(
      'SELECT * FROM teacher_availability WHERE teacher_id=$1',
      [user.id],
    );
    const statements: Statement[] = [];
    for (const day of days) {
      const same = current.find(
        (s) =>
          s.weekday === day &&
          s.start_time.slice(0, 5) === d.start &&
          s.end_time.slice(0, 5) === d.end,
      );
      assert(
        !current.some(
          (s) =>
            s.weekday === day &&
            s.id !== same?.id &&
            s.start_time.slice(0, 5) < d.end &&
            s.end_time.slice(0, 5) > d.start,
        ),
        `Esta franja se solapa con otro horario del ${WEEKDAYS[day - 1].toLowerCase()}.`,
        409,
      );
      if (same)
        statements.push({
          sql: 'UPDATE teacher_availability SET approved=true WHERE id=$1 AND teacher_id=$2',
          values: [same.id, user.id],
        });
      else
        statements.push({
          sql: "INSERT INTO teacher_availability(teacher_id,weekday,start_time,end_time,timezone,approved) SELECT $1,$2,$3,$4,'Europe/Madrid',true WHERE NOT EXISTS(SELECT 1 FROM teacher_availability WHERE teacher_id=$1 AND weekday=$2 AND substr(CAST(start_time AS TEXT),1,5)<$5 AND substr(CAST(end_time AS TEXT),1,5)>$6)",
          values: [user.id, day, d.start, d.end, d.end, d.start],
        });
    }
    statements.push(
      auditStatement(user.id, 'publish_availability', 'teacher', user.id, {
        days,
        start: d.start,
        end: d.end,
      }),
    );
    await this.d.write(statements);
  }
  async remove(user: User, rawId: unknown) {
    await this.authorize(user);
    const id = z.uuid().parse(rawId);
    assert(
      (
        await this.d.query('SELECT id FROM teacher_availability WHERE id=$1 AND teacher_id=$2', [
          id,
          user.id,
        ])
      ).length,
      'Horario no encontrado.',
      404,
    );
    await this.d.write([
      {
        sql: 'DELETE FROM teacher_availability WHERE id=$1 AND teacher_id=$2',
        values: [id, user.id],
      },
      auditStatement(user.id, 'remove_availability', 'teacher', user.id),
    ]);
  }
}
export async function publicAvailability(teacherId?: string, read: typeof query = query) {
  return read<Availability>(
    `SELECT a.id,a.teacher_id,a.weekday,a.start_time,a.end_time,a.timezone FROM teacher_availability a JOIN teacher_profiles t ON t.user_id=a.teacher_id WHERE a.approved=true AND t.published=true AND t.status='active' AND t.agreement_at IS NOT NULL AND t.verified_at IS NOT NULL ${teacherId ? 'AND a.teacher_id=$1' : ''} ORDER BY a.weekday,a.start_time`,
    teacherId ? [teacherId] : [],
  );
}
