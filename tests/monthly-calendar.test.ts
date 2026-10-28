import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInTimeZone } from 'date-fns-tz';
import { monthlyCalendar, nextBillingMonth, sameBillingMonth } from '../src/lib/monthly-calendar';

test('el mes de incorporación se determina en Madrid incluso al cambiar el año', () => {
  assert.equal(
    nextBillingMonth(new Date('2026-12-31T23:30:00Z')).toISOString(),
    '2027-02-01T00:00:00.000Z',
  );
  assert.equal(
    nextBillingMonth(new Date('2026-12-31T20:00:00Z')).toISOString(),
    '2027-01-01T00:00:00.000Z',
  );
  assert.equal(
    sameBillingMonth(new Date('2027-01-04T17:00:00Z'), new Date('2026-12-20T12:00:00Z')),
    true,
  );
});
test('los doce meses empiezan el día 1 y contienen cuatro clases del mismo día y hora local', () => {
  const calendar = monthlyCalendar(new Date('2026-11-02T17:00:00Z'), 60);
  assert.equal(calendar.length, 12);
  for (const [index, cycle] of calendar.entries()) {
    assert.equal(cycle.start.getUTCDate(), 1);
    assert.equal(cycle.end.getUTCDate(), 1);
    if (index) assert.equal(calendar[index - 1].end.getTime(), cycle.start.getTime());
    assert.equal(cycle.sessions.length, 4);
    for (const session of cycle.sessions) {
      assert.equal(formatInTimeZone(session.startsAt, 'Europe/Madrid', 'i HH:mm'), '1 18:00');
      assert.ok(session.startsAt >= cycle.start && session.endsAt <= cycle.end);
    }
  }
  assert.equal(calendar[5].sessions[0].startsAt.getUTCHours(), 16);
});
test('un festivo aprovecha la quinta semana sin añadir clases ni trasladarlas de mes', () => {
  const [cycle] = monthlyCalendar(new Date('2026-11-09T17:00:00Z'), 60, ['2026-11-02'], 1);
  assert.deepEqual(
    cycle.sessions.map((s) => s.startsAt.getUTCDate()),
    [9, 16, 23, 30],
  );
  assert.throws(
    () => monthlyCalendar(new Date('2026-11-16T17:00:00Z'), 60, ['2026-11-02', '2026-11-09'], 1),
    /cuatro clases dentro del mes/,
  );
});
test('se rechaza un inicio que omite clases previas sin festivo declarado', () => {
  assert.throws(
    () => monthlyCalendar(new Date('2026-11-09T17:00:00Z'), 60, [], 1),
    /primera fecha disponible/,
  );
});
