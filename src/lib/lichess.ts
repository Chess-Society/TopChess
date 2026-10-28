import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';
import { assert } from './domain';
import { transaction } from './db';
import { audit } from './academy';
import { onCloudflare, atomic, d1Query, cloudflareEnv, auditStatement } from './cloudflare';

export const OAUTH_COOKIE = 'tc_lichess_oauth';
const attemptSchema = z.object({
  state: z.string().min(40).max(128),
  verifier: z.string().min(43).max(128),
  createdAt: z.number(),
});
export type OAuthAttempt = z.infer<typeof attemptSchema>;
export type LichessIdentity = { id: string; username: string; email: string | null };
export function oauthConfig() {
  assert(
    process.env.APP_URL && process.env.LICHESS_CLIENT_ID && process.env.OAUTH_COOKIE_SECRET,
    'El acceso con Lichess está pendiente de configuración.',
    503,
  );
  const base = new URL(process.env.APP_URL);
  assert(
    base.protocol === 'https:' ||
      process.env.NODE_ENV !== 'production' ||
      ['127.0.0.1', 'localhost'].includes(base.hostname),
    'El acceso con Lichess requiere HTTPS.',
    503,
  );
  assert(
    /^[a-f0-9]{64}$/i.test(process.env.OAUTH_COOKIE_SECRET),
    'La clave de protección de Lichess debe tener 32 bytes hexadecimales.',
    503,
  );
  return {
    clientId: process.env.LICHESS_CLIENT_ID,
    redirectUri: `${base.origin}/api/auth/lichess/callback`,
    secret: process.env.OAUTH_COOKIE_SECRET,
  };
}
export function createPkce(): OAuthAttempt {
  return {
    state: randomBytes(32).toString('base64url'),
    verifier: randomBytes(48).toString('base64url'),
    createdAt: Date.now(),
  };
}
export function authorizationUrl(attempt: OAuthAttempt, clientId: string, redirectUri: string) {
  const url = new URL('https://lichess.org/oauth');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(attempt.verifier).digest('base64url'),
    scope: 'email:read',
    state: attempt.state,
  }).toString();
  return url.toString();
}
export function sealAttempt(attempt: OAuthAttempt, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(attempt), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString('base64url');
}
export function openAttempt(
  value: string,
  secret: string,
  state: string,
  now = Date.now(),
): OAuthAttempt {
  assert(value.length < 2000, 'Intento de acceso inválido.');
  let attempt: OAuthAttempt;
  try {
    const raw = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(secret, 'hex'),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    attempt = attemptSchema.parse(JSON.parse(plain.toString('utf8')));
  } catch {
    throw new Error('Intento de acceso inválido.');
  }
  assert(
    now - attempt.createdAt >= 0 && now - attempt.createdAt <= 10 * 60_000,
    'El acceso ha caducado. Vuelve a intentarlo.',
  );
  assert(
    state.length === attempt.state.length &&
      timingSafeEqual(Buffer.from(state), Buffer.from(attempt.state)),
    'No se puede validar el acceso con Lichess.',
  );
  return attempt;
}
export async function exchangeIdentity(
  code: string,
  verifier: string,
  config: { clientId: string; redirectUri: string },
  fetcher: typeof fetch = fetch,
): Promise<LichessIdentity> {
  assert(/^[a-zA-Z0-9_]{1,2048}$/.test(code), 'Código de autorización inválido.');
  const tokenResponse = await fetcher('https://lichess.org/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  assert(tokenResponse.ok, 'Lichess no ha podido completar la autorización.');
  const result = z
    .object({ access_token: z.string().min(1).max(8192), token_type: z.string() })
    .parse(await tokenResponse.json());
  assert(result.token_type.toLowerCase() === 'bearer', 'Respuesta de Lichess no válida.');
  const headers = { Authorization: `Bearer ${result.access_token}` };
  try {
    const response = await fetcher('https://lichess.org/api/account', {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    assert(response.ok, 'No se ha podido verificar la identidad de Lichess.');
    const account = z
      .object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        username: z.string().min(1).max(100),
        disabled: z.boolean().optional(),
        tosViolation: z.boolean().optional(),
      })
      .parse(await response.json());
    assert(!account.disabled, 'La cuenta de Lichess no está disponible.');
    const emailResponse = await fetcher('https://lichess.org/api/account/email', {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const contact = emailResponse.ok
      ? z.object({ email: z.email() }).safeParse(await emailResponse.json())
      : null;
    return {
      id: account.id.toLowerCase(),
      username: account.username,
      email: contact?.success ? contact.data.email.toLowerCase() : null,
    };
  } finally {
    // La academia solo necesita identificar al usuario; no conserva su token de Lichess.
    try {
      await fetcher('https://lichess.org/api/token', {
        method: 'DELETE',
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* La sesión local no depende de la disponibilidad del endpoint de revocación. */
    }
  }
}
export async function linkIdentity(identity: LichessIdentity) {
  if (onCloudflare()) {
    const env = await cloudflareEnv();
    const owner = String(env.OWNER_LICHESS_ID || '').toLowerCase() === identity.id;
    await atomic([
      {
        sql: `INSERT INTO users(name,email,lichess_id,lichess_username,verified_at,role) VALUES('',CASE WHEN EXISTS(SELECT 1 FROM users WHERE email=$1) THEN NULL ELSE $1 END,$2,$3,now(),$4) ON CONFLICT(lichess_id) DO UPDATE SET lichess_username=excluded.lichess_username,verified_at=now(),role=CASE WHEN $4='superadmin' THEN 'superadmin' ELSE users.role END`,
        values: [identity.email, identity.id, identity.username, owner ? 'superadmin' : 'student'],
      },
    ]);
    const [record] = await d1Query<{ id: string; profile_completed_at: Date | null }>(
      'SELECT id,profile_completed_at FROM users WHERE lichess_id=$1',
      [identity.id],
    );
    await atomic([auditStatement(record.id, 'lichess_login', 'user', record.id)]);
    return record;
  }
  return transaction(async (c) => {
    const record = (
      await c.query(
        `INSERT INTO users(name,email,lichess_id,lichess_username,verified_at) VALUES('',CASE WHEN EXISTS(SELECT 1 FROM users WHERE email=$1) THEN NULL ELSE $1 END,$2,$3,now()) ON CONFLICT(lichess_id) DO UPDATE SET lichess_username=EXCLUDED.lichess_username,verified_at=now() RETURNING id,profile_completed_at`,
        [identity.email, identity.id, identity.username],
      )
    ).rows[0] as { id: string; profile_completed_at: Date | null };
    await audit(c, record.id, 'lichess_login', 'user', record.id);
    return record;
  });
}
export const realNameSchema = z
  .string()
  .trim()
  .min(3, 'Indica tu nombre y apellidos.')
  .max(100)
  .transform((v) => v.replace(/\s+/g, ' '))
  .refine(
    (v) => /^[\p{L}\p{M}][\p{L}\p{M}'’ -]+$/u.test(v) && v.split(' ').length >= 2,
    'Escribe tu nombre y apellidos reales, sin números ni alias.',
  );
