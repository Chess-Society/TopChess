import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sqliteQuery, bindValues, normalizeRows } from '../../src/lib/cloudflare';
const db = new DatabaseSync(':memory:');
function q(sql: string, values: unknown[] = []) {
  return db
    .prepare(sqliteQuery(sql))
    .all(
      ...(bindValues(values).map((v) =>
        v instanceof ArrayBuffer ? new Uint8Array(v) : v,
      ) as SQLInputValue[]),
    ) as Record<string, unknown>[];
}
const teacher = randomUUID(),
  students = Array.from({ length: 6 }, () => randomUUID()),
  group = randomUUID(),
  cycle = randomUUID();
before(() => {
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(readFileSync('cloudflare/migrations/0001_initial.sql', 'utf8'));
  q(
    "INSERT INTO users(id,name,role,profile_completed_at) VALUES($1,'Profesor de prueba','teacher',now())",
    [teacher],
  );
  q(
    "INSERT INTO teacher_profiles(user_id,headline,bio,published,agreement_at,verified_at) VALUES($1,'Docente de prueba','Prueba',1,now(),now())",
    [teacher],
  );
  for (const id of students)
    q(
      "INSERT INTO users(id,name,role,profile_completed_at) VALUES($1,'Alumno de prueba','student',now())",
      [id],
    );
  q(
    "INSERT INTO groups(id,teacher_id,title,level,status,first_at,enrollment_deadline) VALUES($1,$2,'Grupo de prueba','Principiante','published','2090-11-06T17:00:00.000Z','2090-11-04T17:00:00.000Z')",
    [group, teacher],
  );
  q(
    "INSERT INTO billing_cycles(id,group_id,sequence,starts_at,ends_at,approved) VALUES($1,$2,1,'2090-11-06T17:00:00.000Z','2090-12-06T17:00:00.000Z',1)",
    [cycle, group],
  );
  for (let i = 0; i < 4; i++) {
    const start = new Date('2090-11-06T17:00Z');
    start.setUTCDate(start.getUTCDate() + 7 * i);
    q(
      'INSERT INTO sessions(group_id,cycle_id,teacher_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
      [group, cycle, teacher, start, new Date(start.getTime() + 3600000)],
    );
  }
});
after(() => db.close());
test('D1 empieza sin datos de clientes ni profesores inventados', () => {
  const clean = new DatabaseSync(':memory:');
  clean.exec(readFileSync('cloudflare/migrations/0001_initial.sql', 'utf8'));
  for (const table of ['users', 'teacher_profiles', 'groups', 'reviews', 'payments'])
    assert.equal(clean.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n, 0);
  clean.close();
});
test('D1 confirma al segundo alumno en el mismo INSERT sin crear pagos', () => {
  q('INSERT INTO group_enrollments(group_id,student_id,terms_version) VALUES($1,$2,$3)', [
    group,
    students[0],
    'test',
  ]);
  assert.equal(q('SELECT status FROM groups WHERE id=$1', [group])[0].status, 'pending');
  q('INSERT INTO group_enrollments(group_id,student_id,terms_version) VALUES($1,$2,$3)', [
    group,
    students[1],
    'test',
  ]);
  assert.equal(q('SELECT status FROM groups WHERE id=$1', [group])[0].status, 'confirmed');
  assert.equal(q('SELECT count(*) AS n FROM student_slots')[0].n, 8);
  assert.equal(q('SELECT count(*) AS n FROM payments')[0].n, 0);
});
test('D1 no sobrepasa cuatro plazas y revierte la solicitud rechazada', () => {
  for (const student of students.slice(2, 4))
    q('INSERT INTO group_enrollments(group_id,student_id,terms_version) VALUES($1,$2,$3)', [
      group,
      student,
      'test',
    ]);
  assert.throws(
    () =>
      q('INSERT INTO group_enrollments(group_id,student_id,terms_version) VALUES($1,$2,$3)', [
        group,
        students[4],
        'test',
      ]),
    /plazas/,
  );
  assert.equal(q('SELECT count(*) AS n FROM group_enrollments WHERE group_id=$1', [group])[0].n, 4);
});
test('D1 protege el horario del profesor y la continuidad de clases comprometidas', () => {
  const s = q('SELECT * FROM sessions LIMIT 1')[0];
  assert.throws(
    () =>
      q(
        'INSERT INTO sessions(group_id,cycle_id,teacher_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
        [group, cycle, teacher, s.starts_at, s.ends_at],
      ),
    /solapa/,
  );
  assert.throws(
    () => q("UPDATE teacher_profiles SET status='departed' WHERE user_id=$1", [teacher]),
    /continuidad/,
  );
});
test('D1 rechaza una reseña sin asistencia académica', () => {
  const e = q('SELECT id FROM group_enrollments LIMIT 1')[0];
  assert.throws(
    () => q('INSERT INTO reviews(enrollment_id,rating) VALUES($1,5)', [e.id]),
    /asistir/,
  );
});
test('D1 conserva el libro económico y la auditoría', () => {
  q(
    "INSERT INTO ledger_entries(kind,amount_cents,idempotency_key) VALUES('adjustment',1,'test-only')",
  );
  assert.throws(
    () => q("UPDATE ledger_entries SET amount_cents=3 WHERE idempotency_key='test-only'"),
    /inmutable/,
  );
  q("INSERT INTO audit_logs(action,entity_type,entity_id) VALUES('test','test','test')");
  assert.throws(() => q('DELETE FROM audit_logs'), /inmutable/);
});
test('D1 admite documentos privados en fragmentos sin rutas públicas', () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 0, 255]);
  q('INSERT INTO private_documents(key,size_bytes) VALUES($1,$2)', [
    'test/private.pdf',
    bytes.length,
  ]);
  q('INSERT INTO private_document_chunks(document_key,sequence,data) VALUES($1,0,$2)', [
    'test/private.pdf',
    bytes.buffer,
  ]);
  const row = q('SELECT hex(data) AS hex FROM private_document_chunks WHERE document_key=$1', [
    'test/private.pdf',
  ])[0];
  assert.equal(row.hex, Buffer.from(bytes).toString('hex').toUpperCase());
});
test('las lecturas de catálogo y límites temporales conservan valores tipados', () => {
  const rows = q(
    'SELECT g.id,ARRAY(SELECT s.starts_at::text FROM sessions s JOIN billing_cycles b ON b.id=s.cycle_id WHERE s.group_id=g.id AND b.sequence=1 ORDER BY s.starts_at) AS dates FROM groups g WHERE g.id=$1',
    [group],
  );
  const typed = normalizeRows<{ dates: string[] }>(rows);
  assert.equal(typed[0].dates.length, 4);
  q('INSERT INTO rate_limits(key_hash,hits,reset_at) VALUES($1,1,now()+make_interval(mins=>$2))', [
    'test-rate',
    15,
  ]);
  assert.equal(q('SELECT hits FROM rate_limits WHERE key_hash=$1', ['test-rate'])[0].hits, 1);
});
