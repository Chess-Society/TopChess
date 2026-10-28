import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { monthlyStore } from '../helpers/monthly-store';
import { publishMonthlyGroup } from '../../src/lib/monthly-groups';
import { setOwnGroupVideo, validateClassVideo } from '../../src/lib/class-video';
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
  const first = fromZonedTime(
    store.start.toISOString().slice(0, 10) + 'T20:00:00',
    'Europe/Madrid',
  );
  await store.query(
    "INSERT INTO teacher_availability(teacher_id,weekday,start_time,end_time,approved) VALUES($1,$2,'20:00','22:00',1)",
    [user.id, Number(formatInTimeZone(first, 'Europe/Madrid', 'i'))],
  );
  const input = {
    teacherId: user.id,
    title: 'Grupo autogestionado',
    level: 'Principiante',
    language: 'Español',
    capacity: 4,
    firstAt: first.toISOString(),
    duration: 60,
    timezone: 'Europe/Madrid',
    excludedDates: [],
  };
  const deps = {
    query: store.query,
    write: store.write,
    now: () => new Date(store.start.getTime() - 7 * 86400_000),
  };
  return { store, user, input, deps };
}
test('un profesor autorizado publica su grupo mensual sin intervención ni cobros', async () => {
  const { store, user, input, deps } = await fixture();
  try {
    const { id } = await publishMonthlyGroup(user, input, deps);
    const [group] = await store.query('SELECT * FROM groups WHERE id=$1', [id]);
    assert.equal(group.teacher_id, user.id);
    assert.equal(group.status, 'published');
    assert.equal(group.billing_model, 'calendar_month');
    assert.equal(
      (await store.query('SELECT * FROM billing_cycles WHERE group_id=$1', [id])).length,
      12,
    );
    assert.equal((await store.query('SELECT * FROM sessions WHERE group_id=$1', [id])).length, 48);
    for (const table of ['payments', 'subscriptions'])
      assert.equal((await store.query(`SELECT * FROM ${table}`)).length, 0);
    await assert.rejects(publishMonthlyGroup(user, input, deps), /solapa/);
    assert.equal(
      (await store.query('SELECT * FROM groups WHERE teacher_id=$1', [user.id])).length,
      2,
    );
  } finally {
    store.db.close();
  }
});
test('se impide publicar para otro docente, fuera de disponibilidad, sin autorización o con más de cuatro plazas', async () => {
  const { store, user, input, deps } = await fixture();
  try {
    const second = randomUUID();
    await store.query("INSERT INTO users(id,name,role) VALUES($1,'Segundo profesor','teacher')", [
      second,
    ]);
    await store.query(
      "INSERT INTO teacher_profiles(user_id,headline,bio,published,agreement_at,verified_at) VALUES($1,'Prueba','Prueba',1,now(),now())",
      [second],
    );
    await assert.rejects(
      publishMonthlyGroup(user, { ...input, teacherId: second }, deps),
      /otro profesor/,
    );
    await assert.rejects(publishMonthlyGroup(store.students[0], input, deps), /reservado/);
    await assert.rejects(publishMonthlyGroup(user, { ...input, capacity: 5 }, deps));
    await assert.rejects(
      publishMonthlyGroup(
        user,
        {
          ...input,
          firstAt: new Date(new Date(input.firstAt).getTime() - 2 * 3600_000).toISOString(),
        },
        deps,
      ),
      /disponibilidad/,
    );
    const admin = { ...user, id: store.admin, role: 'superadmin' as const };
    await assert.rejects(
      publishMonthlyGroup(admin, input, { ...deps, selfService: true }),
      /propios/,
    );
    await store.query("UPDATE group_enrollments SET status='left'");
    await store.query('UPDATE teacher_profiles SET published=0 WHERE user_id=$1', [user.id]);
    await assert.rejects(publishMonthlyGroup(user, input, deps), /autorizado/);
  } finally {
    store.db.close();
  }
});
test('el profesor gestiona el enlace privado de su grupo sin alterar fechas ni acceder al de otro', async () => {
  const { store, user, deps } = await fixture();
  try {
    const before = await store.query(
      'SELECT id,starts_at,ends_at,status FROM sessions ORDER BY id',
    );
    const video = { groupId: store.group, videoUrl: 'https://meet.google.com/test-room' };
    const options = { ...deps, hosts: 'meet.google.com,*.zoom.us' };
    await setOwnGroupVideo(user, video, options);
    assert.ok(
      (await store.query('SELECT video_url FROM sessions WHERE group_id=$1', [store.group])).every(
        (s) => s.video_url === video.videoUrl,
      ),
    );
    assert.deepEqual(
      await store.query('SELECT id,starts_at,ends_at,status FROM sessions ORDER BY id'),
      before,
    );
    await assert.rejects(
      setOwnGroupVideo({ ...user, id: store.admin, role: 'superadmin' }, video, options),
      /propios/,
    );
    await assert.rejects(setOwnGroupVideo(store.students[0], video, options), /reservado/);
    for (const bad of [
      'http://meet.google.com/room',
      'https://meet.google.com.evil.test/room',
      'https://name:secret@meet.google.com/room',
    ])
      assert.throws(() => validateClassVideo(bad, options.hosts));
    assert.equal(
      validateClassVideo('https://us06web.zoom.us/j/test', options.hosts),
      'https://us06web.zoom.us/j/test',
    );
  } finally {
    store.db.close();
  }
});
