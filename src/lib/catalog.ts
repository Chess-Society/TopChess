import { query } from './db';
import { onCloudflare } from './cloudflare';
import { publicAvailability, type Availability } from './teacher-availability';
export type Group = {
  id: string;
  title: string;
  level: string;
  language: string;
  capacity: number;
  count: number;
  status: string;
  first_at: string;
  duration: number;
  timezone: string;
  teacher_id: string;
  teacher_name: string;
  headline: string;
  specialties: string[];
  dates?: string[];
};
export type Teacher = {
  availability?: Availability[];
  id: string;
  name: string;
  headline: string;
  bio: string;
  languages: string[];
  levels: string[];
  specialties: string[];
  rating: number | null;
  reviews: number;
};
export async function groups(): Promise<{ items: Group[]; demo: boolean }> {
  if (!process.env.DATABASE_URL && !onCloudflare()) return { items: [], demo: false };
  const items = await query<Group>(
    `SELECT g.*, u.name AS teacher_name,t.headline,t.specialties, (SELECT count(*)::int FROM group_enrollments e WHERE e.group_id=g.id AND e.status IN ('reserved','awaiting_payment','active','leaving')) AS count, ARRAY(SELECT s.starts_at::text FROM sessions s JOIN billing_cycles b ON b.id=s.cycle_id WHERE s.group_id=g.id AND b.sequence=1 ORDER BY s.starts_at) AS dates FROM groups g JOIN teacher_profiles t ON t.user_id=g.teacher_id JOIN users u ON u.id=t.user_id WHERE g.status IN ('published','pending','confirmed','active','full') AND t.published=true AND t.status='active' ORDER BY g.first_at`,
  );
  return { items: JSON.parse(JSON.stringify(items)), demo: false };
}
export async function teachers(): Promise<{ items: Teacher[]; demo: boolean }> {
  if (!process.env.DATABASE_URL && !onCloudflare()) return { items: [], demo: false };
  const items = await query<Teacher>(
    `SELECT t.user_id AS id,u.name,t.headline,t.bio,t.languages,t.levels,t.specialties,(SELECT round(avg(r.rating),1)::float FROM reviews r JOIN group_enrollments e ON e.id=r.enrollment_id JOIN groups g ON g.id=e.group_id WHERE g.teacher_id=t.user_id AND r.status='published') AS rating,(SELECT count(*)::int FROM reviews r JOIN group_enrollments e ON e.id=r.enrollment_id JOIN groups g ON g.id=e.group_id WHERE g.teacher_id=t.user_id AND r.status='published') AS reviews FROM teacher_profiles t JOIN users u ON u.id=t.user_id WHERE t.published=true AND t.status='active'`,
  );
  const slots = await publicAvailability();
  const byTeacher = new Map<string, Availability[]>();
  for (const slot of slots)
    byTeacher.set(slot.teacher_id, [...(byTeacher.get(slot.teacher_id) || []), slot]);
  return {
    items: items.map((t) => ({ ...t, availability: byTeacher.get(t.id) || [] })),
    demo: false,
  };
}
