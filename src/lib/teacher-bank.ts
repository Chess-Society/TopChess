import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { assert } from './domain';
export function normalizeIban(input: string) {
  const iban = input.replace(/\s/g, '').toUpperCase();
  assert(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban), 'Revisa el formato del IBAN.');
  let remainder = 0;
  for (const char of iban.slice(4) + iban.slice(0, 4))
    for (const digit of /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char)
      remainder = (remainder * 10 + Number(digit)) % 97;
  assert(remainder === 1, 'El IBAN no supera la comprobación de dígitos de control.');
  if (iban.startsWith('ES'))
    assert(iban.length === 24, 'Un IBAN español debe tener 24 caracteres.');
  return iban;
}
function key(secret: string) {
  assert(
    /^[a-f0-9]{64}$/i.test(secret),
    'La protección de los datos bancarios no está configurada.',
    503,
  );
  return createHmac('sha256', Buffer.from(secret, 'hex'))
    .update('topchess-teacher-bank-v1')
    .digest();
}
export function encryptIban(iban: string, teacherId: string, secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(teacherId));
  const encrypted = Buffer.concat([cipher.update(normalizeIban(iban), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((v) => v.toString('base64url')).join('.');
}
export function decryptIban(value: string, teacherId: string, secret: string) {
  const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  decipher.setAAD(Buffer.from(teacherId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
