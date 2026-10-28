import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveAdminTeachingProfile } from '../../src/lib/admin-teaching';
import { monthlyStore } from '../helpers/monthly-store';

const profile = {
  headline: 'Clases de ajedrez con la dirección de la escuela',
  bio: 'Perfil docente de prueba con una descripción completa de la metodología y de los objetivos de aprendizaje para sus alumnos.',
  languages: 'Español, Inglés',
  levels: 'Inicial, Intermedio',
  approved: true,
  published: true,
};
test('el administrador puede ser profesor sin perder su rol ni duplicar el perfil', async () => {
  const store = monthlyStore();
  try {
    await store.seed();
    const user = {
      id: store.admin,
      name: 'Admin de prueba',
      email: null,
      role: 'superadmin' as const,
      verified_at: new Date(),
    };
    const deps = { query: store.query, write: store.write };
    await saveAdminTeachingProfile(
      user,
      { ...profile, bio: undefined, teacherId: store.teacher },
      deps,
    );
    assert.equal(
      (await store.query('SELECT bio FROM teacher_profiles WHERE user_id=$1', [user.id]))[0].bio,
      '',
    );
    await store.query('UPDATE teacher_profiles SET teacher_bps=6500 WHERE user_id=$1', [user.id]);
    await saveAdminTeachingProfile(
      user,
      { ...profile, bio: 'Clases cercanas.', published: false },
      deps,
    );
    assert.equal(
      (await store.query('SELECT role FROM users WHERE id=$1', [user.id]))[0].role,
      'superadmin',
    );
    const rows = await store.query('SELECT * FROM teacher_profiles WHERE user_id=$1', [user.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].published, false);
    assert.equal(rows[0].teacher_bps, 6500);
    assert.equal(rows[0].bio, 'Clases cercanas.');
    assert.ok(rows[0].agreement_at && rows[0].verified_at);
    assert.deepEqual(rows[0].languages, ['Español', 'Inglés']);
    assert.equal(
      (
        await store.query('SELECT headline FROM teacher_profiles WHERE user_id=$1', [store.teacher])
      )[0].headline,
      'Prueba',
    );
  } finally {
    store.db.close();
  }
});
test('el alta propia no permite a alumnos obtener permisos docentes ni reactivar profesores suspendidos', async () => {
  const store = monthlyStore();
  try {
    await store.seed();
    const deps = { query: store.query, write: store.write };
    await assert.rejects(saveAdminTeachingProfile(store.students[0], profile, deps), /reservado/);
    const user = {
      id: store.admin,
      name: 'Admin de prueba',
      email: null,
      role: 'superadmin' as const,
      verified_at: new Date(),
    };
    await assert.rejects(saveAdminTeachingProfile(user, { ...profile, approved: false }, deps));
    assert.equal(
      (await store.query('SELECT * FROM teacher_profiles WHERE user_id=$1', [user.id])).length,
      0,
    );
    await saveAdminTeachingProfile(user, profile, deps);
    await store.query(
      "UPDATE teacher_profiles SET status='suspended',published=0 WHERE user_id=$1",
      [user.id],
    );
    await assert.rejects(saveAdminTeachingProfile(user, profile, deps), /estado del docente/);
  } finally {
    store.db.close();
  }
});
