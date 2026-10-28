import { DomainError } from './domain';
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number } }>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1Statement;
  batch(
    statements: D1Statement[],
  ): Promise<{ results: Record<string, unknown>[]; meta: { changes: number } }[]>;
}
export interface R2Storage {
  put(key: string, body: ArrayBuffer | Uint8Array, options?: unknown): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}
export type CloudflareEnv = {
  DB?: D1Database;
  DOCUMENTS?: R2Storage;
  OWNER_LICHESS_ID?: string;
  [key: string]: unknown;
};
export function onCloudflare() {
  return process.env.CLOUDFLARE_DEPLOYMENT === 'true';
}
export async function cloudflareEnv(): Promise<CloudflareEnv> {
  if (!onCloudflare()) return {};
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  return (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv;
}
export async function d1() {
  const db = (await cloudflareEnv()).DB;
  if (!db) throw new DomainError('La base de datos de Cloudflare no está conectada.', 503);
  return db;
}
const columns = ['languages', 'levels', 'specialties', 'excluded_dates', 'dates'];
export function normalizeRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => {
    for (const column of columns)
      if (typeof row[column] === 'string') {
        try {
          row[column] = JSON.parse(row[column] as string);
        } catch {
          row[column] = [];
        }
      }
    for (const key of ['published', 'approved', 'cancel_at_period_end', 'promotions_frozen'])
      if (key in row) row[key] = Boolean(row[key]);
    return row;
  }) as T[];
}
export function sqliteQuery(text: string) {
  return text
    .replace(
      /now\(\)\s*-\s*interval\s*'(\d+) (days?|minutes?|hours?)'/gi,
      (_, n, unit) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${n} ${unit}')`,
    )
    .replace(
      /now\(\)\s*\+\s*interval\s*'(\d+) (days?|minutes?|hours?)'/gi,
      (_, n, unit) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','+${n} ${unit}')`,
    )
    .replace(
      /now\(\)\+make_interval\(mins=>\$(\d+)\)/gi,
      (_, n) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','+' || ?${n} || ' minutes')`,
    )
    .replace(/now\(\)/gi, "strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    .replace(/::(?:int|text|float|date)\b/g, '')
    .replace(
      /ARRAY\((SELECT s\.starts_at[\s\S]*?ORDER BY s\.starts_at)\) AS dates/g,
      '(SELECT json_group_array(starts_at) FROM ($1)) AS dates',
    )
    .replace(/\$(\d+)/g, '?$1');
}
export function bindValues(values: unknown[]) {
  return values.map((v) =>
    v instanceof Date
      ? v.toISOString()
      : typeof v === 'boolean'
        ? Number(v)
        : Array.isArray(v)
          ? JSON.stringify(v)
          : (v ?? null),
  );
}
export async function d1Query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const db = await d1();
  const result = await db
    .prepare(sqliteQuery(text))
    .bind(...bindValues(values))
    .all();
  return normalizeRows<T>(result.results);
}
export type Statement = { sql: string; values?: unknown[] };
export async function atomic(statements: Statement[]) {
  const db = await d1();
  return db.batch(
    statements.map((s) => db.prepare(sqliteQuery(s.sql)).bind(...bindValues(s.values || []))),
  );
}
export function auditStatement(
  actor: string | null,
  action: string,
  type: string,
  id: string,
  details: Record<string, unknown> = {},
): Statement {
  return {
    sql: 'INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',
    values: [actor, action, type, id, JSON.stringify(details)],
  };
}
