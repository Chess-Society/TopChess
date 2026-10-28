import { z } from 'zod';
import type { User } from './auth';
import { assert, canAdmin } from './domain';
import { atomic, d1Query, auditStatement } from './cloudflare';

const fields = z.object({
  headline: z.string().trim().min(3).max(150),
  bio: z.string().trim().min(80).max(3000),
  languages: z.string().trim().min(2).max(200),
  levels: z.string().trim().min(2).max(200),
  approved: z.literal(true),
  published: z.boolean().default(false),
});
export async function saveAdminTeachingProfile(
  user: User,
  input: unknown,
  deps: {
    query: typeof d1Query;
    write: (statements: import('./cloudflare').Statement[]) => Promise<unknown>;
  } = { query: d1Query, write: atomic },
) {
  assert(canAdmin(user.role), 'Acceso reservado a la administración de TopChess.', 403);
  const d = fields.parse(input);
  const [existing] = await deps.query<{ status: string }>(
    'SELECT status FROM teacher_profiles WHERE user_id=$1',
    [user.id],
  );
  assert(
    !existing || existing.status === 'active',
    'Revisa el estado del docente desde Administración antes de continuar.',
    409,
  );
  const list = (value: string) => [
    ...new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const languages = list(d.languages),
    levels = list(d.levels);
  assert(languages.length && levels.length, 'Indica al menos un idioma y un nivel.');
  await deps.write([
    {
      sql: 'INSERT INTO teacher_profiles(user_id,headline,bio,languages,levels,published,agreement_at,verified_at) VALUES($1,$2,$3,$4,$5,$6,now(),now()) ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,bio=excluded.bio,languages=excluded.languages,levels=excluded.levels,published=excluded.published,agreement_at=coalesce(teacher_profiles.agreement_at,excluded.agreement_at),verified_at=coalesce(teacher_profiles.verified_at,excluded.verified_at)',
      values: [user.id, d.headline, d.bio, languages, levels, d.published],
    },
    auditStatement(user.id, 'save_own_teaching_profile', 'teacher', user.id, {
      published: d.published,
    }),
  ]);
}

export async function requireTeachingProfile(user: User) {
  assert(user.role === 'teacher' || canAdmin(user.role), 'Acceso reservado a profesores.', 403);
  assert(
    (
      await d1Query(
        "SELECT 1 FROM teacher_profiles WHERE user_id=$1 AND status='active' AND agreement_at IS NOT NULL AND verified_at IS NOT NULL",
        [user.id],
      )
    ).length,
    'Completa y confirma primero tu perfil docente.',
    403,
  );
}
