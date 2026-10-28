import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { DomainError } from './domain';
import * as schema from './schema';
import { onCloudflare, d1Query } from './cloudflare';
const globalDb = globalThis as unknown as { pool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new DomainError(
      'El servicio está pendiente de configurar PostgreSQL. No se ha guardado ningún dato.',
      503,
    );
  return (globalDb.pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  }));
}
export function orm() {
  return drizzle(pool(), { schema });
}
export { sql };
export async function query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  if (onCloudflare()) return d1Query<T>(text, values);
  return (await pool().query(text, values)).rows as T[];
}
export async function transaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>) {
  if (onCloudflare())
    throw new DomainError('Esta operación requiere el módulo transaccional de Cloudflare.', 503);
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
