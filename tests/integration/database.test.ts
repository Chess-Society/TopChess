import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { Pool } from 'pg';
import { reserve, createGroup, withdraw, createReview } from '../../src/lib/academy';
import type { User } from '../../src/lib/auth';
import { linkIdentity } from '../../src/lib/lichess';
import { TeacherAvailability, publicAvailability } from '../../src/lib/teacher-availability';
const database = new PGlite({ extensions: { btree_gist } });

test('la disponibilidad semanal conserva compatibilidad con PostgreSQL', async () => {
  const user: User = {
    id: teacherId,
    name: 'Profesor de prueba',
    email: null,
    role: 'teacher',
    verified_at: new Date(),
  };
  const service = new TeacherAvailability();
  await service.save(user, { weekdays: [1, 3], start: '17:00', end: '19:00' });
  await service.save(user, { weekdays: [1], start: '19:00', end: '20:00' });
  await service.save(user, { weekdays: [1, 3], start: '17:00', end: '19:00' });
  const slots = await publicAvailability(teacherId);
  assert.equal(slots.length, 3);
  await service.remove(user, slots[0].id);
  assert.equal((await publicAvailability(teacherId)).length, 2);
});
const admin: User = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Admin de prueba',
  email: 'admin@example.test',
  role: 'admin',
  verified_at: new Date(),
};
const teacherId = '00000000-0000-4000-8000-000000000002';
const students: User[] = Array.from({ length: 7 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 3).padStart(12, '0')}`,
  name: `Alumno ficticio ${i}`,
  email: `student${i}@example.test`,
  role: 'student',
  verified_at: new Date(),
}));
let groupId = '';
async function q(text: string, values: unknown[] = []) {
  const r = await database.query(text, values);
  return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
}
before(async () => {
  await database.exec(readFileSync('migrations/001_initial.sql', 'utf8'));
  await database.exec(readFileSync('migrations/002_lichess_identity.sql', 'utf8'));
  process.env.DATABASE_URL = 'postgresql://test.invalid/topchess';
  mock.method(Pool.prototype, 'connect', async () => ({ query: q, release() {} }));
  mock.method(Pool.prototype, 'query', q);
  for (const u of [admin, ...students])
    await q(
      'INSERT INTO users(id,name,email,password_hash,role,verified_at) VALUES($1,$2,$3,$4,$5,now())',
      [u.id, u.name, u.email, 'not-a-real-password', u.role],
    );
  await q(
    "INSERT INTO users(id,name,email,password_hash,role,verified_at) VALUES($1,'Profesor ficticio','teacher@example.test','test','teacher',now())",
    [teacherId],
  );
  await q(
    "INSERT INTO teacher_profiles(user_id,headline,bio,published,agreement_at,verified_at) VALUES($1,'Test','Test',true,now(),now())",
    [teacherId],
  );
});
after(async () => {
  mock.restoreAll();
  delete process.env.DATABASE_URL;
  await database.close();
});
test('migración y publicación: 12 ciclos de cuatro sesiones', async () => {
  const first = new Date();
  first.setUTCFullYear(first.getUTCFullYear() + 1);
  first.setUTCMonth(10, 9);
  first.setUTCHours(17, 0, 0, 0);
  const result = await createGroup(admin, {
    teacherId,
    title: 'Grupo de prueba',
    level: 'Principiante',
    language: 'Español',
    capacity: 4,
    firstAt: first.toISOString(),
    duration: 60,
    timezone: 'Europe/Madrid',
    excludedDates: [],
  });
  groupId = result.id;
  const r = await q(
    'SELECT cycle_id,count(*)::int AS n FROM sessions WHERE group_id=$1 GROUP BY cycle_id',
    [groupId],
  );
  assert.equal(r.rows.length, 12);
  for (const row of r.rows as { n: number }[]) assert.equal(row.n, 4);
});
test('primera reserva pendiente sin suscripción ni cobro; segunda confirma', async () => {
  await reserve(students[0], groupId, undefined);
  assert.equal(
    (await q('SELECT status FROM groups WHERE id=$1', [groupId])).rows[0] &&
      ((await q('SELECT status FROM groups WHERE id=$1', [groupId])).rows[0] as { status: string })
        .status,
    'pending',
  );
  assert.equal((await q('SELECT * FROM subscriptions')).rows.length, 0);
  assert.equal((await q('SELECT * FROM payments')).rows.length, 0);
  await reserve(students[1], groupId, undefined);
  assert.equal(
    ((await q('SELECT status FROM groups WHERE id=$1', [groupId])).rows[0] as { status: string })
      .status,
    'confirmed',
  );
  assert.equal((await q('SELECT * FROM student_slots')).rows.length, 96);
});
test('una reserva repetida es idempotente', async () => {
  await reserve(students[0], groupId, undefined);
  assert.equal(
    (await q('SELECT * FROM group_enrollments WHERE group_id=$1', [groupId])).rows.length,
    2,
  );
});
test('no se sobrepasa la capacidad máxima', async () => {
  await reserve(students[2], groupId, undefined);
  await reserve(students[3], groupId, undefined);
  await assert.rejects(reserve(students[4], groupId, undefined), /plazas/);
  assert.equal(
    (await q('SELECT * FROM group_enrollments WHERE group_id=$1', [groupId])).rows.length,
    4,
  );
});
test('PostgreSQL impide solapamientos del profesor', async () => {
  const s = (await q('SELECT * FROM sessions WHERE group_id=$1 LIMIT 1', [groupId])).rows[0] as {
    cycle_id: string;
    starts_at: Date;
    ends_at: Date;
  };
  await assert.rejects(
    q(
      'INSERT INTO sessions(group_id,cycle_id,teacher_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
      [groupId, s.cycle_id, teacherId, s.starts_at, s.ends_at],
    ),
  );
});
test('PostgreSQL impide doble reserva del alumno incluso con otro profesor', async () => {
  const s = (await q('SELECT * FROM student_slots WHERE student_id=$1 LIMIT 1', [students[0].id]))
    .rows[0] as { session_id: string; enrollment_id: string; starts_at: Date; ends_at: Date };
  const other = (
    await q('SELECT id FROM sessions WHERE group_id=$1 AND id<>$2 LIMIT 1', [groupId, s.session_id])
  ).rows[0] as { id: string };
  await assert.rejects(
    q(
      'INSERT INTO student_slots(enrollment_id,student_id,session_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
      [s.enrollment_id, students[0].id, other.id, s.starts_at, s.ends_at],
    ),
  );
});
test('no se puede valorar sin una clase recibida', async () => {
  const e = (await q('SELECT id FROM group_enrollments WHERE student_id=$1', [students[0].id]))
    .rows[0] as { id: string };
  await assert.rejects(createReview(students[0], e.id, 5, 'Buen curso'), /asistir/);
});
test('retirar una reserva conserva historial y libera sus plazas', async () => {
  const e = (await q('SELECT id FROM group_enrollments WHERE student_id=$1', [students[3].id]))
    .rows[0] as { id: string };
  await withdraw(students[3], e.id, 'wait', 'Motivo privado de prueba');
  assert.equal(
    (await q('SELECT * FROM student_slots WHERE student_id=$1', [students[3].id])).rows.length,
    0,
  );
  assert.equal(
    (await q('SELECT * FROM student_withdrawals WHERE enrollment_id=$1', [e.id])).rows.length,
    1,
  );
  await assert.rejects(withdraw(students[0], e.id, 'wait', ''), /matrícula/);
});
test('auditoría y libro económico son inmutables', async () => {
  await q(
    "INSERT INTO ledger_entries(kind,amount_cents,idempotency_key) VALUES('adjustment',10,'test-adjustment')",
  );
  await assert.rejects(
    q("UPDATE ledger_entries SET amount_cents=20 WHERE idempotency_key='test-adjustment'"),
    /inmutable/,
  );
  await assert.rejects(q('DELETE FROM audit_logs'), /inmutable/);
});
test('un reintento de evento o movimiento no duplica registros', async () => {
  await q(
    "INSERT INTO stripe_events(id,type) VALUES('evt_test','invoice.paid') ON CONFLICT DO NOTHING",
  );
  await q(
    "INSERT INTO stripe_events(id,type) VALUES('evt_test','invoice.paid') ON CONFLICT DO NOTHING",
  );
  assert.equal((await q("SELECT * FROM stripe_events WHERE id='evt_test'")).rows.length, 1);
});

test('Lichess vincula por identidad, no por email, y mantiene el nombre real al volver', async () => {
  const identity = {
    id: 'test_lichess_identity',
    username: 'Test_Lichess_Identity',
    email: students[0].email,
  };
  const first = await linkIdentity(identity);
  assert.notEqual(first.id, students[0].id);
  const fresh = (await q('SELECT * FROM users WHERE id=$1', [first.id])).rows[0] as {
    email: string | null;
    name: string;
    role: string;
  };
  assert.equal(fresh.email, null);
  assert.equal(fresh.name, '');
  assert.equal(fresh.role, 'student');
  await q("UPDATE users SET name='María García López',profile_completed_at=now() WHERE id=$1", [
    first.id,
  ]);
  const second = await linkIdentity({ ...identity, username: 'TEST_LICHESS_IDENTITY' });
  assert.equal(second.id, first.id);
  const saved = (await q('SELECT name,lichess_username FROM users WHERE id=$1', [first.id]))
    .rows[0] as { name: string; lichess_username: string };
  assert.equal(saved.name, 'María García López');
  assert.equal(saved.lichess_username, 'TEST_LICHESS_IDENTITY');
});
