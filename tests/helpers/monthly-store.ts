import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { bindValues, sqliteQuery, normalizeRows, type Statement } from '../../src/lib/cloudflare';
import { monthlyCalendar, nextBillingMonth } from '../../src/lib/monthly-calendar';
import type { User } from '../../src/lib/auth';
export function monthlyStore() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('cloudflare/migrations/0001_initial.sql', 'utf8'));
  db.exec(readFileSync('cloudflare/migrations/0002_monthly_billing.sql', 'utf8'));
  const query = async <T = Record<string, any>>(text: string, values: unknown[] = []) =>
    normalizeRows<T>(db.prepare(sqliteQuery(text)).all(...(bindValues(values) as SQLInputValue[])));
  const write = async (statements: Statement[]) => {
    db.exec('BEGIN');
    try {
      for (const s of statements) await query(s.sql, s.values);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  const teacher = randomUUID(),
    group = randomUUID(),
    admin = randomUUID(),
    students: User[] = Array.from({ length: 2 }, () => ({
      id: randomUUID(),
      name: 'Alumno de prueba',
      email: randomUUID() + '@example.test',
      role: 'student',
      verified_at: new Date(),
    }));
  const start = nextBillingMonth(),
    first = new Date(start.getTime() + 17 * 3600_000),
    calendar = monthlyCalendar(first, 60),
    deadline = new Date(start.getTime() - 48 * 3600_000);
  async function seed() {
    await query(
      "INSERT INTO users(id,name,role,profile_completed_at) VALUES($1,'Profesor de prueba','teacher',now()),($2,'Admin de prueba','superadmin',now())",
      [teacher, admin],
    );
    await query(
      "INSERT INTO teacher_profiles(user_id,headline,bio,status,published,verified_at,agreement_at) VALUES($1,'Prueba','Perfil de prueba','active',1,now(),now())",
      [teacher],
    );
    for (const s of students)
      await query(
        "INSERT INTO users(id,name,email,role,profile_completed_at) VALUES($1,$2,$3,'student',now())",
        [s.id, s.name, s.email],
      );
    // Los fixtures se insertan como legado para no depender del día real de ejecución.
    await query(
      "INSERT INTO groups(id,teacher_id,title,level,status,first_at,enrollment_deadline) VALUES($1,$2,'Grupo de prueba','Inicial','published',$3,$4)",
      [group, teacher, first, new Date(first.getTime() - 1)],
    );
    for (const [i, c] of calendar.entries()) {
      const id = randomUUID();
      await query(
        'INSERT INTO billing_cycles(id,group_id,sequence,starts_at,ends_at,approved) VALUES($1,$2,$3,$4,$5,1)',
        [id, group, i + 1, c.start, c.end],
      );
      for (const s of c.sessions)
        await query(
          'INSERT INTO sessions(group_id,cycle_id,teacher_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
          [group, id, teacher, s.startsAt, s.endsAt],
        );
    }
    const enrollments: string[] = [];
    for (const s of students) {
      const id = randomUUID();
      enrollments.push(id);
      await query(
        "INSERT INTO group_enrollments(id,group_id,student_id,terms_version) VALUES($1,$2,$3,'test')",
        [id, group, s.id],
      );
    }
    await query(
      "UPDATE groups SET billing_model='calendar_month',enrollment_deadline=$2 WHERE id=$1",
      [group, deadline],
    );
    return enrollments;
  }
  return { db, query, write, teacher, admin, group, students, start, calendar, deadline, seed };
}
