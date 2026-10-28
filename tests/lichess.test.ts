import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createPkce,
  authorizationUrl,
  sealAttempt,
  openAttempt,
  exchangeIdentity,
  realNameSchema,
} from '../src/lib/lichess';

test('OAuth usa PKCE S256, estado aleatorio y únicamente el permiso de correo', () => {
  const attempt = createPkce();
  const next = createPkce();
  assert.notEqual(attempt.state, next.state);
  assert.notEqual(attempt.verifier, next.verifier);
  const url = new URL(
    authorizationUrl(attempt, 'topchess-test', 'https://example.test/api/auth/lichess/callback'),
  );
  assert.equal(url.origin, 'https://lichess.org');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(
    url.searchParams.get('code_challenge'),
    createHash('sha256').update(attempt.verifier).digest('base64url'),
  );
  assert.equal(url.searchParams.get('scope'), 'email:read');
  assert.equal(url.searchParams.get('state'), attempt.state);
  assert.equal(url.toString().includes(attempt.verifier), false);
});
test('el intento cifrado detecta manipulación, estado incorrecto y caducidad', () => {
  const secret = 'ab'.repeat(32);
  const attempt = createPkce();
  const sealed = sealAttempt(attempt, secret);
  assert.deepEqual(openAttempt(sealed, secret, attempt.state), attempt);
  assert.throws(() => openAttempt(sealed, secret, 'different-state'));
  assert.throws(() => openAttempt(sealed, secret, attempt.state, attempt.createdAt + 601000));
  assert.throws(() => openAttempt(sealed, secret, attempt.state, attempt.createdAt - 1));
  const bytes = Buffer.from(sealed, 'base64url');
  bytes[32] ^= 1;
  assert.throws(() => openAttempt(bytes.toString('base64url'), secret, attempt.state));
});
test('canje en servidor: verifica la cuenta, obtiene contacto y revoca el token', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/api/token') && init?.method === 'POST')
      return Response.json({ token_type: 'Bearer', access_token: 'fictional-test-token' });
    if (url.endsWith('/api/account'))
      return Response.json({ id: 'chess_user', username: 'Chess_User' });
    if (url.endsWith('/api/account/email'))
      return Response.json({ email: 'identity@example.test' });
    return new Response(null, { status: 204 });
  };
  const identity = await exchangeIdentity(
    'fictional_code',
    'fictional_verifier',
    { clientId: 'test', redirectUri: 'https://example.test/callback' },
    provider as typeof fetch,
  );
  assert.deepEqual(identity, {
    id: 'chess_user',
    username: 'Chess_User',
    email: 'identity@example.test',
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[3].init?.method, 'DELETE');
  assert.equal(
    calls.some((c) => c.url.includes('fictional-test-token')),
    false,
  );
});
test('un código rechazado no concede identidad', async () => {
  const provider = async () => Response.json({ error: 'invalid_grant' }, { status: 400 });
  await assert.rejects(
    exchangeIdentity(
      'bad_code',
      'verifier',
      { clientId: 'test', redirectUri: 'https://example.test' },
      provider as typeof fetch,
    ),
    /autorización/,
  );
});
test('un perfil requiere nombre y apellidos, admite acentos y rechaza alias numéricos', () => {
  assert.equal(realNameSchema.parse('  María  García López '), 'María García López');
  assert.equal(realNameSchema.parse('Ana O’Neill'), 'Ana O’Neill');
  assert.equal(realNameSchema.safeParse('farmer32').success, false);
  assert.equal(realNameSchema.safeParse('Chess_Player').success, false);
  assert.equal(realNameSchema.safeParse('<script>John Smith</script>').success, false);
});
