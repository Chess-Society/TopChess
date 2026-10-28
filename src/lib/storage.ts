import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { assert } from './domain';
import { onCloudflare, cloudflareEnv, atomic, d1Query, type Statement } from './cloudflare';
function client() {
  assert(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
    'El almacenamiento privado no está configurado. No se ha enviado tu documento.',
    503,
  );
  return new S3Client({
    region: process.env.S3_REGION || 'eu-west-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}
export async function saveCv(file: File) {
  assert(
    file.size > 0 && file.size <= 5 * 1024 * 1024,
    'El currículum debe ocupar como máximo 5 MB.',
  );
  assert(
    file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf'),
    'Adjunta un archivo PDF.',
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  assert(
    buffer.subarray(0, 5).toString() === '%PDF-' &&
      buffer.subarray(-1024).toString().includes('%%EOF'),
    'El archivo no es un PDF válido.',
  );
  // Los documentos nunca se renderizan en el navegador; descarga autenticada como attachment.
  const key = `applications/${randomUUID()}.pdf`;
  if (onCloudflare()) {
    const bucket = (await cloudflareEnv()).DOCUMENTS;
    if (bucket)
      await bucket.put(key, buffer, {
        httpMetadata: {
          contentType: 'application/pdf',
          contentDisposition: 'attachment; filename="curriculum.pdf"',
        },
      });
    else {
      const statements: Statement[] = [
        {
          sql: 'INSERT INTO private_documents(key,size_bytes) VALUES($1,$2)',
          values: [key, buffer.length],
        },
      ];
      const chunkSize = 256 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const part = buffer.subarray(offset, offset + chunkSize);
        statements.push({
          sql: 'INSERT INTO private_document_chunks(document_key,sequence,data) VALUES($1,$2,$3)',
          values: [key, offset / chunkSize, new Uint8Array(part).buffer],
        });
      }
      await atomic(statements);
    }
    return key;
  }
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'attachment; filename="curriculum.pdf"',
      ServerSideEncryption: 'AES256',
    }),
  );
  return key;
}
export async function getCv(key: string) {
  if (onCloudflare()) {
    const bucket = (await cloudflareEnv()).DOCUMENTS;
    if (bucket) {
      const file = await bucket.get(key);
      if (file)
        return {
          Body: { transformToByteArray: async () => new Uint8Array(await file.arrayBuffer()) },
        };
    }
    const [document] = await d1Query<{ size_bytes: number }>(
      'SELECT size_bytes FROM private_documents WHERE key=$1',
      [key],
    );
    assert(document, 'Documento no encontrado.', 404);
    const chunks = await d1Query<{ data_hex: string }>(
      'SELECT hex(data) AS data_hex FROM private_document_chunks WHERE document_key=$1 ORDER BY sequence',
      [key],
    );
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.data_hex, 'hex')));
    assert(
      bytes.length === document.size_bytes,
      'No se ha podido recuperar el documento completo.',
      503,
    );
    return { Body: { transformToByteArray: async () => new Uint8Array(bytes) } };
  }
  return client().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}
