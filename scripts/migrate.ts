import { readFileSync, readdirSync } from 'node:fs';
import { pool, transaction } from '../src/lib/db';
async function main() {
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('topchess:migrations'))");
    await c.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())',
    );
    for (const file of readdirSync('migrations')
      .filter((x) => x.endsWith('.sql'))
      .sort()) {
      if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [file])).rowCount)
        continue;
      await c.query(readFileSync(`migrations/${file}`, 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
      console.log(`Aplicada: ${file}`);
    }
  });
}
main()
  .catch(() => {
    console.error('Migración fallida. Revisar conexión y permisos de PostgreSQL.');
    process.exitCode = 1;
  })
  .finally(() => pool().end());
