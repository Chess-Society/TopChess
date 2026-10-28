import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInTimeZone } from 'date-fns-tz';
import { groupStartOptions } from '../src/lib/group-options';
import { monthlyCalendar } from '../src/lib/monthly-calendar';
const now = new Date('2026-10-20T12:00:00Z');
const slots = [
  {
    id: 'weekly-slot',
    teacher_id: 'teacher',
    weekday: 1,
    start_time: '17:00',
    end_time: '19:00',
    timezone: 'Europe/Madrid',
    approved: true,
  },
];
test('las opciones parten de la disponibilidad y calculan cuatro fechas sin elegir día ni hora libremente', () => {
  const options = groupStartOptions(slots, 60, [], [], now);
  assert.deepEqual(
    options.map((o) => [o.start, o.end]),
    [
      ['17:00', '18:00'],
      ['18:00', '19:00'],
    ],
  );
  assert.equal(options[0].availabilityId, slots[0].id);
  assert.deepEqual(
    options[0].dates.map((d) => formatInTimeZone(new Date(d), 'Europe/Madrid', 'yyyy-MM-dd HH:mm')),
    ['2026-11-02 17:00', '2026-11-09 17:00', '2026-11-16 17:00', '2026-11-23 17:00'],
  );
  assert.equal(groupStartOptions(slots, 120, [], [], now).length, 1);
  assert.equal(groupStartOptions(slots, 180, [], [], now).length, 0);
});
test('se excluyen conflictos de cualquier mes del calendario, también más allá de las primeras 24 clases', () => {
  const first = groupStartOptions(slots, 60, [], [], now)[0];
  const session = monthlyCalendar(new Date(first.firstAt), 60)[7].sessions[2];
  const options = groupStartOptions(
    slots,
    60,
    [{ starts_at: session.startsAt.toISOString(), ends_at: session.endsAt.toISOString() }],
    [],
    now,
  );
  assert.deepEqual(
    options.map((o) => o.start),
    ['18:00'],
  );
});
test('solo se ofrecen franjas publicadas, se recalculan festivos y se respeta el cierre de matrícula', () => {
  assert.equal(groupStartOptions([{ ...slots[0], approved: false }], 60, [], [], now).length, 0);
  const options = groupStartOptions(slots, 60, [], ['2026-11-02'], now);
  assert.equal(options[0].dates.length, 4);
  assert.equal(
    formatInTimeZone(new Date(options[0].firstAt), 'Europe/Madrid', 'yyyy-MM-dd'),
    '2026-11-09',
  );
  assert.equal(groupStartOptions(slots, 60, [], [], new Date('2026-10-31T12:00:00Z')).length, 0);
  assert.equal(groupStartOptions(slots, 0, [], [], now).length, 0);
});
