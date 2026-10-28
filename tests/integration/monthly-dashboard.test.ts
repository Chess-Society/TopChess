import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SQLInputValue } from 'node:sqlite';
import { dashboard } from '../../src/lib/academy';
import { monthlyStore } from '../helpers/monthly-store';

test('los cinco paneles ejecutan las consultas nuevas con el adaptador D1 y los enlaces de clase exigen el mes pagado', async () => {
  const store = monthlyStore(),
    enrollments = await store.seed(),
    symbol = Symbol.for('__cloudflare-context__');
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[symbol],
    priorFlag = process.env.CLOUDFLARE_DEPLOYMENT;
  const db = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...v: SQLInputValue[]) {
          values = v;
          return this;
        },
        async all() {
          return { results: store.db.prepare(sql).all(...values), meta: { changes: 0 } };
        },
      };
    },
  };
  globals[symbol] = { env: { DB: db } };
  process.env.CLOUDFLARE_DEPLOYMENT = 'true';
  try {
    for (const role of ['superadmin', 'admin', 'student', 'teacher', 'candidate'] as const) {
      const id =
        role === 'student'
          ? store.students[0].id
          : role === 'teacher'
            ? store.teacher
            : store.admin;
      const result = await dashboard({
        id,
        name: 'Prueba',
        email: null,
        role,
        verified_at: new Date(),
      });
      assert.ok(result);
    }
    const adminUser = {
      id: store.admin,
      name: 'Admin de prueba',
      email: null,
      role: 'superadmin' as const,
      verified_at: new Date(),
    };
    let adminData = await dashboard(adminUser);
    assert.ok('teaching' in adminData);
    assert.equal(adminData.groups?.length, 1);
    assert.equal(adminData.teaching?.groups?.length, 0);
    await store.query(
      "INSERT INTO teacher_profiles(user_id,headline,bio,published,agreement_at,verified_at) VALUES($1,'Prueba propia','Perfil propio',1,now(),now())",
      [store.admin],
    );
    await store.query('UPDATE groups SET teacher_id=$1 WHERE id=$2', [store.admin, store.group]);
    await store.query('UPDATE sessions SET teacher_id=$1 WHERE group_id=$2', [
      store.admin,
      store.group,
    ]);
    await store.query(
      "INSERT INTO teacher_availability(teacher_id,weekday,start_time,end_time,approved) VALUES($1,1,'17:00','19:00',1),($2,3,'10:00','12:00',0)",
      [store.admin, store.teacher],
    );
    adminData = await dashboard(adminUser);
    assert.ok('teaching' in adminData);
    assert.equal(adminData.groups?.length, 1);
    assert.equal(adminData.teaching?.groups?.length, 1);
    assert.equal(adminData.teaching?.profile?.headline, 'Prueba propia');
    assert.ok(adminData.teaching?.sessions?.length);
    assert.equal(adminData.teacherAvailability?.length, 2);
    assert.equal(adminData.teaching?.availability?.length, 1);
    assert.equal(adminData.teaching?.availability?.[0].teacher_id, store.admin);
    assert.equal(typeof adminData.billing?.enabled, 'boolean');
    assert.equal(typeof adminData.billing?.legalReady, 'boolean');
    await store.query("UPDATE groups SET status='active' WHERE id=$1", [store.group]);
    await store.query("UPDATE group_enrollments SET status='active' WHERE id=$1", [enrollments[0]]);
    await store.query(
      "INSERT INTO subscriptions(id,enrollment_id,billing_model,status,current_period_end) VALUES('test-sub',$1,'calendar_month','active',$2)",
      [enrollments[0], store.calendar[0].end],
    );
    await store.query(
      "UPDATE sessions SET video_url='https://meet.jit.si/test-room' WHERE group_id=$1",
      [store.group],
    );
    const user = store.students[0];
    let result = await dashboard(user);
    assert.ok(result.sessions?.every((s) => !s.video_url));
    await store.query(
      "INSERT INTO payments(subscription_id,stripe_invoice_id,amount_cents,status,teacher_bps,teacher_cycle,period_start,period_end) VALUES('test-sub','in_test',5000,'paid',5000,1,$1,$2)",
      [store.start, store.calendar[0].end],
    );
    result = await dashboard(user);
    assert.equal(result.sessions?.filter((s) => s.video_url).length, 4);
    await store.query("UPDATE payments SET status='refunded' WHERE stripe_invoice_id='in_test'");
    result = await dashboard(user);
    assert.ok(result.sessions?.every((s) => !s.video_url));
  } finally {
    if (previous) globals[symbol] = previous;
    else delete globals[symbol];
    if (priorFlag === undefined) delete process.env.CLOUDFLARE_DEPLOYMENT;
    else process.env.CLOUDFLARE_DEPLOYMENT = priorFlag;
    store.db.close();
  }
});
