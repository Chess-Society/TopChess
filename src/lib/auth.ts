import { randomBytes, createHash, createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { query, orm } from './db';
import { eq, and, gt } from 'drizzle-orm';
import { usersTable, authSessionsTable } from './schema';
import { assert, type Role } from './domain';
import { onCloudflare } from './cloudflare';
export type User = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  verified_at: Date | null;
  lichess_id?: string | null;
  lichess_username?: string | null;
  profile_completed_at?: Date | null;
};
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get('tc_session')?.value;
  if (!token || (!process.env.DATABASE_URL && !onCloudflare())) return null;
  if (onCloudflare()) {
    const [user] = await query<User>(
      'SELECT u.id,u.name,u.email,u.role,u.verified_at,u.lichess_id,u.lichess_username,u.profile_completed_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
      [hash(token)],
    );
    return user || null;
  }
  const [user] = await orm()
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      verified_at: usersTable.verifiedAt,
      lichess_id: usersTable.lichessId,
      lichess_username: usersTable.lichessUsername,
      profile_completed_at: usersTable.profileCompletedAt,
    })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, authSessionsTable.userId))
    .where(
      and(
        eq(authSessionsTable.tokenHash, hash(token)),
        gt(authSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return user ?? null;
}
export async function requireUser(roles?: Role[], verified = true) {
  const user = await currentUser();
  assert(user, 'Inicia sesión para continuar.', 401);
  assert(!roles || roles.includes(user.role), 'No tienes permiso para realizar esta acción.', 403);
  assert(
    !verified || (user.lichess_id && user.profile_completed_at),
    'Completa tu nombre real en tu perfil para continuar.',
    403,
  );
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hash(token), userId],
  );
  (await cookies()).set('tc_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 604800,
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get('tc_session')?.value;
  if (token) await query('DELETE FROM auth_sessions WHERE token_hash=$1', [hash(token)]);
  jar.delete('tc_session');
}
export async function rateLimit(key: string, limit = 10, minutes = 15) {
  assert(process.env.RATE_LIMIT_SECRET, 'Falta configurar la protección de acceso.', 503);
  const digest = createHmac('sha256', process.env.RATE_LIMIT_SECRET).update(key).digest('hex');
  const [row] = await query<{ hits: number }>(
    `INSERT INTO rate_limits(key_hash,hits,reset_at) VALUES($1,1,now()+make_interval(mins=>$2)) ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.hits+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+make_interval(mins=>$2) ELSE rate_limits.reset_at END RETURNING hits`,
    [digest, minutes],
  );
  assert(row.hits <= limit, 'Demasiados intentos. Vuelve a intentarlo más tarde.', 429);
}
