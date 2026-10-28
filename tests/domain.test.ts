import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInTimeZone } from 'date-fns-tz';
import {
  canReserve,
  fourSessions,
  overlaps,
  splitCents,
  nextCommission,
  commissionAfterStatus,
  consumeSession,
  canAdmin,
} from '../src/lib/domain';
test('un ciclo contiene exactamente cuatro sesiones aunque el mes tenga cinco semanas', () => {
  const dates = fourSessions(new Date('2026-12-01T17:00:00Z'));
  assert.equal(dates.length, 4);
  assert.equal(dates[3].startsAt.toISOString(), '2026-12-22T17:00:00.000Z');
});
test('conserva las 18:00 locales durante el cambio de horario de verano', () => {
  const dates = fourSessions(new Date('2027-03-15T17:00:00Z'));
  assert.deepEqual(
    dates.map((s) => formatInTimeZone(s.startsAt, 'Europe/Madrid', 'HH:mm')),
    ['18:00', '18:00', '18:00', '18:00'],
  );
  assert.equal(dates[2].startsAt.getUTCHours(), 16);
});
test('un festivo se excluye pero no reduce el número de sesiones', () => {
  const dates = fourSessions(new Date('2026-12-01T17:00:00Z'), 'Europe/Madrid', 60, ['2026-12-08']);
  assert.equal(dates[1].startsAt.toISOString(), '2026-12-15T17:00:00.000Z');
  assert.equal(dates.length, 4);
});
test('no permite reservar grupos llenos, suspendidos ni dentro del cierre', () => {
  const g = {
    status: 'published',
    capacity: 4,
    count: 3,
    firstAt: new Date('2026-11-10T18:00:00Z'),
  };
  assert.doesNotThrow(() => canReserve(g, new Date('2026-11-01')));
  assert.throws(() => canReserve({ ...g, count: 4 }, new Date('2026-11-01')), /plazas/);
  assert.throws(() => canReserve({ ...g, status: 'suspended' }, new Date('2026-11-01')), /admite/);
  assert.throws(() => canReserve(g, new Date('2026-11-10')), /48 horas/);
});
test('las clases consecutivas no se solapan, las simultáneas sí', () => {
  const a = new Date('2026-11-01T17:00Z');
  assert.equal(overlaps(a, new Date('2026-11-01T18:00Z')), false);
  assert.equal(overlaps(a, new Date('2026-11-01T17:59Z')), true);
});
test('el reparto en céntimos no pierde dinero por redondeo', () => {
  for (const bps of [5000, 6500, 9500]) {
    const result = splitCents(4999, bps);
    assert.equal(result.teacher + result.academy, 4999);
  }
  assert.throws(() => splitCents(5000, 9900));
  assert.throws(() => splitCents(-1, 5000));
});
test('ascenso requiere dos periodos consecutivos y respeta congelación', () => {
  const levels = [
    { threshold: 10, teacherBps: 6000 },
    { threshold: 20, teacherBps: 7000 },
  ];
  assert.equal(nextCommission(5000, [10, 9], levels), 5000);
  assert.equal(nextCommission(5000, [12, 10], levels), 6000);
  assert.equal(nextCommission(5000, [30, 30], levels, true), 5000);
  assert.equal(nextCommission(7000, [1, 1], levels), 7000);
});
test('solo una readmisión reinicia el reparto, no una pausa ni una suspensión', () => {
  for (const status of ['inactive', 'paused', 'suspended'])
    assert.equal(commissionAfterStatus(status, 7500), 7500);
  assert.equal(commissionAfterStatus('readmitted', 7500), 5000);
});
test('ausencia del alumno consume sesión, la del profesor no', () => {
  assert.equal(consumeSession('student_absent'), true);
  assert.equal(consumeSession('taught'), true);
  assert.equal(consumeSession('teacher_absent'), false);
});
test('solo administración puede gestionar datos globales', () => {
  assert.equal(canAdmin('admin'), true);
  assert.equal(canAdmin('superadmin'), true);
  for (const role of ['student', 'teacher', 'candidate'] as const)
    assert.equal(canAdmin(role), false);
});
