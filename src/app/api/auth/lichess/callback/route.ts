import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  oauthConfig,
  openAttempt,
  exchangeIdentity,
  linkIdentity,
  OAUTH_COOKIE,
} from '@/lib/lichess';
import { createSession } from '@/lib/auth';
import { assert } from '@/lib/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const base = process.env.APP_URL || new URL(request.url).origin;
  const jar = await cookies();
  const saved = jar.get(OAUTH_COOKIE)?.value;
  // Consumir el intento antes de cualquier petición externa, incluso cuando falla el callback.
  jar.set(OAUTH_COOKIE, '', {
    httpOnly: true,
    secure: new URL(base).protocol === 'https:',
    sameSite: 'lax',
    path: '/api/auth/lichess',
    maxAge: 0,
  });
  try {
    const config = oauthConfig();
    const url = new URL(request.url);
    assert(saved && url.searchParams.get('state'), 'Falta el intento de acceso.');
    const attempt = openAttempt(saved, config.secret, url.searchParams.get('state')!);
    assert(
      !url.searchParams.has('error') && url.searchParams.get('code'),
      'No se ha autorizado el acceso.',
    );
    const identity = await exchangeIdentity(
      url.searchParams.get('code')!,
      attempt.verifier,
      config,
    );
    const user = await linkIdentity(identity);
    await createSession(user.id);
    const response = NextResponse.redirect(
      new URL(user.profile_completed_at ? '/panel' : '/completar-perfil', base),
    );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/acceso?error=lichess', base));
  }
}
