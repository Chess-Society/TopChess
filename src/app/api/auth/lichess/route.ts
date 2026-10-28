import { NextResponse } from 'next/server';
import {
  oauthConfig,
  createPkce,
  sealAttempt,
  authorizationUrl,
  OAUTH_COOKIE,
} from '@/lib/lichess';
import { assert } from '@/lib/domain';
import { onCloudflare } from '@/lib/cloudflare';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const base = process.env.APP_URL || new URL(request.url).origin;
  try {
    const config = oauthConfig();
    assert(
      process.env.DATABASE_URL || onCloudflare(),
      'Base de datos pendiente de configuración.',
      503,
    );
    const attempt = createPkce();
    const response = NextResponse.redirect(
      authorizationUrl(attempt, config.clientId, config.redirectUri),
    );
    response.cookies.set(OAUTH_COOKIE, sealAttempt(attempt, config.secret), {
      httpOnly: true,
      secure: new URL(base).protocol === 'https:',
      sameSite: 'lax',
      path: '/api/auth/lichess',
      maxAge: 600,
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/acceso?error=configuracion', base));
  }
}
