import { z } from 'zod';
import type { User } from './auth';
import { assert, canAdmin } from './domain';
import { atomic, d1Query, auditStatement, type Statement } from './cloudflare';
export function validateClassVideo(value: string, hosts = process.env.VIDEO_ALLOWED_HOSTS || '') {
  const url = new URL(value);
  assert(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .some((h) => (h.startsWith('*.') ? url.hostname.endsWith(h.slice(1)) : url.hostname === h)),
    'Usa un enlace HTTPS de Google Meet, Zoom o Jitsi autorizado por TopChess.',
  );
  return url.toString();
}
export async function setOwnGroupVideo(
  user: User,
  raw: unknown,
  deps: { query: typeof d1Query; write: (s: Statement[]) => Promise<unknown>; hosts?: string } = {
    query: d1Query,
    write: atomic,
  },
) {
  assert(user.role === 'teacher' || canAdmin(user.role), 'Acceso reservado a profesores.', 403);
  const d = z.object({ groupId: z.uuid(), videoUrl: z.url().max(2000) }).parse(raw);
  assert(
    (
      await deps.query(
        "SELECT g.id FROM groups g JOIN teacher_profiles t ON t.user_id=g.teacher_id WHERE g.id=$1 AND g.teacher_id=$2 AND t.status='active'",
        [d.groupId, user.id],
      )
    ).length,
    'Solo puedes gestionar el enlace de tus propios grupos.',
    403,
  );
  const url = validateClassVideo(d.videoUrl, deps.hosts);
  await deps.write([
    {
      sql: "UPDATE sessions SET video_url=$3 WHERE group_id=$1 AND teacher_id=$2 AND starts_at>now() AND status='scheduled'",
      values: [d.groupId, user.id, url],
    },
    auditStatement(user.id, 'set_own_group_video', 'group', d.groupId),
  ]);
}
