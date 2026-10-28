import { stdin } from 'node:process';
import { pool, transaction } from '../src/lib/db';
import { z } from 'zod';
async function main() {
  if (stdin.isTTY)
    throw new Error(
      'Proporciona JSON {lichessId} por stdin. La cuenta debe haber accedido con Lichess y completado su nombre.',
    );
  let input = '';
  for await (const chunk of stdin) input += chunk;
  const d = z
    .object({ lichessId: z.string().regex(/^[a-z0-9_-]{1,100}$/) })
    .parse(JSON.parse(input));
  await transaction(async (c) => {
    const r = await c.query(
      "UPDATE users SET role='superadmin' WHERE lichess_id=$1 AND profile_completed_at IS NOT NULL RETURNING id",
      [d.lichessId],
    );
    if (!r.rows[0])
      throw new Error('La cuenta debe haber completado el acceso con Lichess y su perfil.');
    await c.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'bootstrap_lichess_admin','user',$1)",
      [r.rows[0].id],
    );
  });
  console.log('Cuenta Lichess autorizada como superadministrador.');
}
main()
  .catch(() => {
    console.error('No se pudo autorizar la cuenta. Revisa su identificador Lichess y el perfil.');
    process.exitCode = 1;
  })
  .finally(() => pool().end());
