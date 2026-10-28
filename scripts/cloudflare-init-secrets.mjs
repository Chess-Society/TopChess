import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
function run(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
    let output = '';
    child.stdout.on('data', (x) => (output += x));
    child.stderr.on('data', (x) => (output += x));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error('No se ha podido configurar el almacén de secretos de Cloudflare.')),
    );
    child.stdin.end(input || '');
  });
}
try {
  const output = await run(['secret', 'list']);
  const start = output.indexOf('['),
    end = output.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('No se puede verificar el inventario de secretos.');
  const existing = JSON.parse(output.slice(start, end + 1));
  const secrets = {};
  for (const key of ['OAUTH_COOKIE_SECRET', 'RATE_LIMIT_SECRET', 'CRON_SECRET'])
    if (!existing.some((entry) => entry.name === key))
      secrets[key] = randomBytes(32).toString('hex');
  if (Object.keys(secrets).length) {
    await run(['secret', 'bulk'], JSON.stringify(secrets));
    console.log(
      'Secretos inicializados en Cloudflare. No se han guardado ni mostrado sus valores.',
    );
  } else console.log('Los secretos necesarios ya están configurados. No se han rotado.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
