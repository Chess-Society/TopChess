import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { dashboard } from '../../src/lib/academy';
import { sqliteQuery, bindValues } from '../../src/lib/cloudflare';
const db = new DatabaseSync(':memory:');
before(() => {
  db.exec(readFileSync('cloudflare/migrations/0001_initial.sql', 'utf8'));
  process.env.DATABASE_URL = 'postgresql://test.invalid/topchess';
  mock.method(Pool.prototype, 'query', async (text: string, values: unknown[] = []) => ({
    rows: db.prepare(sqliteQuery(text)).all(...(bindValues(values) as SQLInputValue[])),
  }));
});
after(() => {
  mock.restoreAll();
  delete process.env.DATABASE_URL;
  db.close();
});
for (const role of ['superadmin', 'admin', 'student', 'teacher', 'candidate'] as const)
  test(`el panel ${role} ejecuta sus consultas sobre el esquema D1`, async () => {
    const result = await dashboard({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Usuario de prueba',
      email: null,
      role,
      verified_at: new Date(),
    });
    assert.ok(result);
  });
