import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptIban, decryptIban, normalizeIban } from '../src/lib/teacher-bank';
test('el IBAN se valida, se cifra y queda vinculado al profesor correcto', () => {
  const iban = 'ES9121000418450200051332',
    secret = 'ab'.repeat(32);
  assert.equal(normalizeIban('ES91 2100 0418 4502 0005 1332'), iban);
  assert.throws(() => normalizeIban(iban.slice(0, -1) + '3'));
  const encrypted = encryptIban(iban, 'teacher-a', secret);
  assert.ok(!encrypted.includes(iban));
  assert.equal(decryptIban(encrypted, 'teacher-a', secret), iban);
  assert.throws(() => decryptIban(encrypted, 'teacher-b', secret));
  assert.throws(() => decryptIban(encrypted, 'teacher-a', 'cd'.repeat(32)));
});
