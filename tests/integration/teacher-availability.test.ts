import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TeacherAvailability, publicAvailability } from '../../src/lib/teacher-availability';
import { monthlyStore } from '../helpers/monthly-store';

async function fixture() {
  const store = monthlyStore();
  await store.seed();
  const user = {
    id: store.teacher,
    name: 'Profesor de prueba',
    email: null,
    role: 'teacher' as const,
    verified_at: new Date(),
  };
  return {
    store,
    user,
    service: new TeacherAvailability({ query: store.query, write: store.write }),
  };
}
test('un profesor publica varios días, evita duplicados y retira una franja sin alterar sus clases', async () => {
  const { store, user, service } = await fixture();
  try {
    const before = await store.query('SELECT * FROM sessions ORDER BY id');
    const input = { weekdays: [1, 3, 1], start: '17:00', end: '19:00' };
    await service.save(user, input);
    await service.save(user, input);
    let slots = await publicAvailability(user.id, store.query);
    assert.equal(slots.length, 2);
    assert.deepEqual(
      slots.map((s) => s.weekday),
      [1, 3],
    );
    assert.ok(slots.every((s) => s.timezone === 'Europe/Madrid'));
    await service.remove(user, slots[0].id);
    slots = await publicAvailability(user.id, store.query);
    assert.equal(slots.length, 1);
    assert.deepEqual(await store.query('SELECT * FROM sessions ORDER BY id'), before);
  } finally {
    store.db.close();
  }
});
test('se validan horas, días y solapamientos sin guardar parcialmente', async () => {
  const { store, user, service } = await fixture();
  try {
    await service.save(user, { weekdays: [1], start: '17:00', end: '19:00' });
    for (const bad of [
      { weekdays: [], start: '17:00', end: '18:00' },
      { weekdays: [8], start: '17:00', end: '18:00' },
      { weekdays: [1], start: '17:00', end: '24:00' },
      { weekdays: [2], start: '18:00', end: '17:00' },
      { weekdays: [2], start: '18:00', end: '18:15' },
      { weekdays: [2, 1], start: '18:00', end: '20:00' },
    ])
      await assert.rejects(service.save(user, bad));
    assert.equal((await publicAvailability(user.id, store.query)).length, 1);
    await service.save(user, { weekdays: [1], start: '19:00', end: '20:00' });
    assert.equal((await publicAvailability(user.id, store.query)).length, 2);
  } finally {
    store.db.close();
  }
});
test('los alumnos no publican; un admin sin ficha no es docente; las franjas privadas no se exponen ni se borran por terceros', async () => {
  const { store, user, service } = await fixture();
  try {
    await assert.rejects(
      service.save(store.students[0], { weekdays: [1], start: '17:00', end: '19:00' }),
      /reservado/,
    );
    const admin = { ...user, id: store.admin, role: 'superadmin' as const };
    await assert.rejects(
      service.save(admin, { weekdays: [1], start: '17:00', end: '19:00' }),
      /perfil docente/,
    );
    await service.save(user, { weekdays: [1], start: '17:00', end: '19:00' });
    const [slot] = await publicAvailability(user.id, store.query);
    await store.query(
      "INSERT INTO teacher_profiles(user_id,headline,bio,agreement_at,verified_at) VALUES($1,'Prueba','Prueba',now(),now())",
      [store.admin],
    );
    await assert.rejects(service.remove(admin, slot.id), /no encontrado/);
    await store.query("UPDATE group_enrollments SET status='left'");
    await store.query('UPDATE teacher_profiles SET published=0 WHERE user_id=$1', [user.id]);
    assert.equal((await publicAvailability(undefined, store.query)).length, 0);
    await store.query('UPDATE teacher_profiles SET published=1 WHERE user_id=$1', [user.id]);
    await store.query('UPDATE teacher_availability SET approved=0 WHERE id=$1', [slot.id]);
    assert.equal((await publicAvailability(user.id, store.query)).length, 0);
    await service.save(user, { weekday: '1', start: '17:00', end: '19:00' });
    assert.equal((await publicAvailability(user.id, store.query)).length, 1);
    await store.query("UPDATE teacher_profiles SET status='suspended' WHERE user_id=$1", [user.id]);
    assert.equal((await publicAvailability(user.id, store.query)).length, 0);
  } finally {
    store.db.close();
  }
});
