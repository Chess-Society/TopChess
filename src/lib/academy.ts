import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { transaction, query } from './db';
import { assert, fourSessions, TERMS_VERSION } from './domain';
import type { PoolClient } from 'pg';
import type { User } from './auth';
import { onCloudflare } from './cloudflare';
import { settlementOverview } from './manual-settlements';
export async function audit(
  c: PoolClient,
  actor: string | null,
  action: string,
  type: string,
  id: string,
  details: Record<string, unknown> = {},
) {
  await c.query(
    'INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',
    [actor, action, type, id, JSON.stringify(details)],
  );
}
async function notify(c: PoolClient, userId: string, title: string, body: string, key: string) {
  const r = await c.query(
    'INSERT INTO notifications(user_id,title,body,dedupe_key) VALUES($1,$2,$3,$4) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id',
    [userId, title, body, key],
  );
  if (r.rowCount)
    await c.query(
      'INSERT INTO mail_outbox(recipient,subject,body) SELECT email,$2,$3 FROM users WHERE id=$1 AND email IS NOT NULL',
      [userId, title, body],
    );
}
export async function reserve(user: User, groupId: string, campaign: string | undefined) {
  return transaction(async (c) => {
    // El bloqueo ordena las mutaciones de calendario y evita interbloqueos.
    await c.query("SELECT pg_advisory_xact_lock(hashtext('topchess:bookings'))");
    const g = (
      await c.query(
        'SELECT g.*,t.status AS teacher_status FROM groups g JOIN teacher_profiles t ON t.user_id=g.teacher_id WHERE g.id=$1 FOR UPDATE OF g',
        [groupId],
      )
    ).rows[0];
    assert(g, 'No se encuentra el grupo.', 404);
    assert(g.teacher_status === 'active', 'El profesor no está disponible.');
    assert(
      ['published', 'pending', 'confirmed'].includes(g.status),
      'Este grupo no admite nuevas matrículas.',
    );
    assert(new Date(g.enrollment_deadline) > new Date(), 'El plazo de inscripción ha terminado.');
    const existing = (
      await c.query('SELECT id,status FROM group_enrollments WHERE group_id=$1 AND student_id=$2', [
        groupId,
        user.id,
      ])
    ).rows[0];
    if (existing && ['reserved', 'awaiting_payment', 'active'].includes(existing.status))
      return { id: existing.id, message: 'Tu plaza ya está solicitada.' };
    assert(
      !existing,
      'Ya existe un historial de matrícula en este grupo. Contacta con la academia.',
    );
    const count = Number(
      (
        await c.query(
          "SELECT count(*) FROM group_enrollments WHERE group_id=$1 AND status IN ('reserved','awaiting_payment','active','leaving')",
          [groupId],
        )
      ).rows[0].count,
    );
    assert(count < g.capacity, 'No quedan plazas.');
    const conflict = await c.query(
      `SELECT 1 FROM sessions a JOIN sessions b ON a.starts_at<b.ends_at AND a.ends_at>b.starts_at JOIN group_enrollments e ON e.group_id=b.group_id WHERE a.group_id=$1 AND e.student_id=$2 AND e.status IN ('reserved','awaiting_payment','active','leaving') AND a.status NOT IN ('cancelled','rescheduled') AND b.status NOT IN ('cancelled','rescheduled') LIMIT 1`,
      [groupId, user.id],
    );
    assert(!conflict.rowCount, 'El horario coincide con otro grupo que ya has solicitado.');
    const e = (
      await c.query(
        'INSERT INTO group_enrollments(group_id,student_id,terms_version) VALUES($1,$2,$3) RETURNING id',
        [groupId, user.id, TERMS_VERSION],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO attribution_records(enrollment_id,campaign_id,source) VALUES($1,(SELECT id FROM campaigns WHERE code=$2 AND active=true),CASE WHEN EXISTS(SELECT 1 FROM campaigns WHERE code=$2 AND active=true) THEN 'campaign' ELSE 'direct' END)",
      [e.id, campaign ?? null],
    );
    if (count + 1 >= g.min_students) {
      await c.query("UPDATE groups SET status='confirmed' WHERE id=$1", [groupId]);
      // Los ciclos ya fueron publicados por administración con cuatro fechas por periodo.
      const sessions = (
        await c.query('SELECT * FROM sessions WHERE group_id=$1 ORDER BY starts_at', [groupId])
      ).rows;
      assert(sessions.length >= 4, 'El calendario del grupo todavía no está aprobado.');
      const members = (
        await c.query(
          "UPDATE group_enrollments SET status='awaiting_payment' WHERE group_id=$1 AND status='reserved' RETURNING id,student_id",
          [groupId],
        )
      ).rows;
      for (const member of members) {
        for (const s of sessions)
          await c.query(
            'INSERT INTO student_slots(enrollment_id,student_id,session_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,session_id) DO NOTHING',
            [member.id, member.student_id, s.id, s.starts_at, s.ends_at],
          );
        await notify(
          c,
          member.student_id,
          'Tu grupo está confirmado',
          'Ya se ha alcanzado el mínimo. Consulta las fechas y formaliza la matrícula en tu panel.',
          `confirmed:${member.id}`,
        );
      }
    } else {
      await c.query("UPDATE groups SET status='pending' WHERE id=$1", [groupId]);
      await notify(
        c,
        user.id,
        'Solicitud de plaza recibida',
        'Falta al menos otro alumno para confirmar el grupo. No se ha realizado ningún cobro.',
        `reserved:${e.id}`,
      );
    }
    await audit(c, user.id, 'reserve', 'enrollment', e.id);
    return {
      id: e.id,
      message:
        count + 1 >= g.min_students
          ? 'Grupo confirmado. Consulta tu panel para completar la matrícula.'
          : 'Plaza solicitada sin cobro. Te avisaremos al confirmar el grupo.',
    };
  });
}
function monthlyAnchor(first: Date, offset: number, timezone: string) {
  const text = formatInTimeZone(first, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  const last = new Date(Date.UTC(year, month + offset, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, month - 1 + offset, Math.min(day, last)));
  return fromZonedTime(`${date.toISOString().slice(0, 10)}T${text.slice(11)}`, timezone);
}
export async function createGroup(
  user: User,
  data: {
    teacherId: string;
    title: string;
    level: string;
    language: string;
    capacity: number;
    firstAt: string;
    duration: number;
    timezone: string;
    excludedDates: string[];
  },
) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('topchess:bookings'))");
    const t = (
      await c.query(
        "SELECT * FROM teacher_profiles WHERE user_id=$1 AND status='active' AND published=true AND agreement_at IS NOT NULL AND verified_at IS NOT NULL",
        [data.teacherId],
      )
    ).rows[0];
    assert(t, 'El profesor debe estar activo, verificado y autorizado.');
    const first = new Date(data.firstAt);
    assert(
      first.getTime() > Date.now() + 48 * 3600_000,
      'La primera clase debe empezar dentro de más de 48 horas.',
    );
    const settings = (
      await c.query("SELECT value FROM platform_settings WHERE key='enrollment_cutoff_hours'")
    ).rows[0];
    const cutoff = Number(settings?.value ?? 48);
    const g = (
      await c.query(
        "INSERT INTO groups(teacher_id,title,level,language,capacity,first_at,timezone,duration,enrollment_deadline,excluded_dates,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published') RETURNING id",
        [
          data.teacherId,
          data.title,
          data.level,
          data.language,
          data.capacity,
          first,
          data.timezone,
          data.duration,
          new Date(first.getTime() - cutoff * 3600_000),
          data.excludedDates,
        ],
      )
    ).rows[0];
    // Doce ciclos mensuales fechados. Ningún cobro puede prolongarse más allá del calendario aprobado.
    for (let i = 0; i < 12; i++) {
      const start = monthlyAnchor(first, i, data.timezone),
        end = monthlyAnchor(first, i + 1, data.timezone);
      const dates = fourSessions(start, data.timezone, data.duration, data.excludedDates);
      assert(
        dates[3].endsAt < end,
        'Un festivo desplaza sesiones fuera del ciclo. Ajusta el inicio o las excepciones antes de publicar.',
      );
      const cycle = (
        await c.query(
          'INSERT INTO billing_cycles(group_id,sequence,starts_at,ends_at,approved) VALUES($1,$2,$3,$4,true) RETURNING id',
          [g.id, i + 1, start, end],
        )
      ).rows[0];
      for (const s of dates) {
        const off = await c.query(
          'SELECT 1 FROM teacher_time_off WHERE teacher_id=$1 AND approved=true AND starts_at<$3 AND ends_at>$2',
          [data.teacherId, s.startsAt, s.endsAt],
        );
        assert(!off.rowCount, 'El calendario coincide con vacaciones aprobadas.');
        await c.query(
          'INSERT INTO sessions(group_id,cycle_id,teacher_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',
          [g.id, cycle.id, data.teacherId, s.startsAt, s.endsAt],
        );
      }
    }
    await audit(c, user.id, 'publish', 'group', g.id);
    return { message: 'Grupo publicado con doce ciclos y cuatro sesiones por ciclo.', id: g.id };
  });
}
export async function withdraw(user: User, id: string, kind: string, reason: string) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('topchess:bookings'))");
    const row = (
      await c.query(
        'SELECT e.*,s.stripe_id,s.current_period_end,s.status AS subscription_status FROM group_enrollments e LEFT JOIN subscriptions s ON s.enrollment_id=e.id WHERE e.id=$1 AND e.student_id=$2 FOR UPDATE OF e',
        [id, user.id],
      )
    ).rows[0];
    assert(row, 'No se encuentra la matrícula.', 404);
    assert(
      !row.stripe_id,
      'Utiliza la cancelación de renovación para una suscripción contratada. Después solicita el cambio a la academia.',
    );
    assert(!['left', 'expired'].includes(row.status), 'La solicitud ya está cerrada.');
    await c.query("UPDATE group_enrollments SET status='left' WHERE id=$1", [id]);
    await c.query('DELETE FROM student_slots WHERE enrollment_id=$1', [id]);
    await c.query(
      'INSERT INTO student_withdrawals(enrollment_id,kind,reason,effective_at) VALUES($1,$2,$3,now())',
      [id, kind, reason || null],
    );
    await audit(c, user.id, 'withdraw', 'enrollment', id, { kind });
    await c.query(
      "INSERT INTO incidents(group_id,reported_by,kind,description) VALUES($1,$2,'continuity','Una reserva se ha retirado. Revisar mínimo y continuidad antes de cobrar.')",
      [row.group_id, user.id],
    );
    const remaining = Number(
      (
        await c.query(
          "SELECT count(*) FROM group_enrollments WHERE group_id=$1 AND status IN ('reserved','awaiting_payment','active','leaving')",
          [row.group_id],
        )
      ).rows[0].count,
    );
    if (remaining < 2) {
      const paid = await c.query(
        "SELECT 1 FROM subscriptions s JOIN group_enrollments e ON e.id=s.enrollment_id WHERE e.group_id=$1 AND s.status='active'",
        [row.group_id],
      );
      if (!paid.rowCount) {
        await c.query("UPDATE groups SET status='pending' WHERE id=$1", [row.group_id]);
        await c.query(
          "UPDATE group_enrollments SET status='reserved' WHERE group_id=$1 AND status='awaiting_payment'",
          [row.group_id],
        );
      }
    }
    return { message: 'Solicitud registrada. No se ha realizado ningún cobro.' };
  });
}
export async function createReview(user: User, id: string, rating: number, comment: string) {
  return transaction(async (c) => {
    const valid = await c.query(
      `SELECT e.id FROM group_enrollments e JOIN attendance a ON a.student_id=e.student_id JOIN sessions s ON s.id=a.session_id AND s.group_id=e.group_id WHERE e.id=$1 AND e.student_id=$2 AND a.status='present' AND s.status='taught' LIMIT 1`,
      [id, user.id],
    );
    assert(valid.rowCount, 'Solo puedes valorar después de asistir a una clase impartida.');
    await c.query('INSERT INTO reviews(enrollment_id,rating,comment) VALUES($1,$2,$3)', [
      id,
      rating,
      comment,
    ]);
    return { message: 'Reseña enviada para revisión. Gracias por compartir tu experiencia.' };
  });
}
async function teacherDashboard(user: User) {
  const [profile, groups, sessions, availability, income, roster] = await Promise.all([
    query(
      'SELECT headline,bio,languages,levels,status,published,teacher_bps,cycle,promotions_frozen FROM teacher_profiles WHERE user_id=$1',
      [user.id],
    ),
    query(
      `SELECT g.id,g.title,g.level,g.status,g.capacity,g.first_at,(SELECT count(*)::int FROM group_enrollments e WHERE e.group_id=g.id AND e.status IN ('active','leaving','awaiting_payment','reserved')) AS students FROM groups g WHERE g.teacher_id=$1`,
      [user.id],
    ),
    query(
      "SELECT s.id,s.starts_at,s.ends_at,s.status,g.title,s.video_url FROM sessions s JOIN groups g ON g.id=s.group_id WHERE s.teacher_id=$1 AND s.starts_at>now()-interval '7 days' ORDER BY s.starts_at LIMIT 24",
      [user.id],
    ),
    query('SELECT * FROM teacher_availability WHERE teacher_id=$1', [user.id]),
    query(
      "SELECT coalesce(sum(le.amount_cents),0)::int AS allocated FROM ledger_entries le JOIN payments p ON p.id=le.payment_id JOIN subscriptions sub ON sub.id=p.subscription_id JOIN group_enrollments e ON e.id=sub.enrollment_id JOIN groups g ON g.id=e.group_id WHERE g.teacher_id=$1 AND le.kind='teacher_allocation'",
      [user.id],
    ),
    query(
      "SELECT DISTINCT u.id AS student_id,u.name,g.id AS group_id,g.title,g.level,e.status FROM users u JOIN group_enrollments e ON e.student_id=u.id JOIN groups g ON g.id=e.group_id WHERE g.teacher_id=$1 AND e.status IN ('reserved','awaiting_payment','active','leaving')",
      [user.id],
    ),
  ]);
  return {
    profile: profile[0],
    groups,
    sessions,
    availability,
    income: income[0],
    roster,
    settlements: onCloudflare() ? await settlementOverview(user.id) : null,
  };
}
export async function dashboard(user: User) {
  if (user.role === 'student') {
    const [enrollments, sessions, notifications, payments] = await Promise.all([
      query(
        `SELECT e.id,e.status,g.title,g.level,g.id AS group_id,g.status AS group_status,u.name AS teacher_name,s.status AS subscription_status,s.cancel_at_period_end,s.current_period_end,${onCloudflare() ? 's.setup_completed_at,s.billing_start_at' : 'NULL AS setup_completed_at,NULL AS billing_start_at'} FROM group_enrollments e JOIN groups g ON g.id=e.group_id JOIN users u ON u.id=g.teacher_id LEFT JOIN subscriptions s ON s.enrollment_id=e.id WHERE e.student_id=$1 ORDER BY e.created_at DESC`,
        [user.id],
      ),
      query(
        `SELECT s.id,g.title,u.name AS teacher_name,s.starts_at,s.ends_at,s.status,a.status AS attendance, (CASE WHEN e.status IN ('active','leaving') AND g.status='active' AND EXISTS(SELECT 1 FROM subscriptions sub WHERE sub.enrollment_id=e.id AND s.starts_at<sub.current_period_end AND ${onCloudflare() ? "EXISTS(SELECT 1 FROM payments p WHERE p.subscription_id=sub.id AND p.status='paid' AND p.period_start<=s.starts_at AND p.period_end>=s.ends_at)" : "sub.status='active'"}) THEN s.video_url ELSE NULL END) AS video_url FROM sessions s JOIN groups g ON g.id=s.group_id JOIN users u ON u.id=s.teacher_id JOIN group_enrollments e ON e.group_id=g.id LEFT JOIN attendance a ON a.session_id=s.id AND a.student_id=e.student_id WHERE e.student_id=$1 AND e.status IN ('awaiting_payment','active','leaving') AND s.starts_at>now()-interval '30 days' ORDER BY s.starts_at LIMIT 24`,
        [user.id],
      ),
      query(
        'SELECT id,title,body,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',
        [user.id],
      ),
      query(
        `SELECT p.id,p.amount_cents,p.status,p.paid_at,p.invoice_url,${onCloudflare() ? 'p.invoice_number,p.invoice_date,p.invoice_pdf' : 'NULL AS invoice_number,NULL AS invoice_date,NULL AS invoice_pdf'} FROM payments p JOIN subscriptions s ON s.id=p.subscription_id JOIN group_enrollments e ON e.id=s.enrollment_id WHERE e.student_id=$1 ORDER BY p.paid_at DESC`,
        [user.id],
      ),
    ]);
    return { enrollments, sessions, notifications, payments };
  }
  if (user.role === 'teacher') return teacherDashboard(user);
  if (user.role === 'candidate')
    return {
      applications: await query(
        'SELECT id,status,created_at FROM teacher_applications WHERE user_id=$1',
        [user.id],
      ),
    };
  const [stats, applications, teachers, groups, incidents, reviews, campaigns, withdrawals] =
    await Promise.all([
      query(
        `SELECT (SELECT count(*)::int FROM users WHERE role='student') AS students,(SELECT count(*)::int FROM subscriptions WHERE status='active') AS subscriptions,(SELECT coalesce(sum(amount_cents),0)::int FROM payments WHERE status='paid') AS gross,(SELECT count(*)::int FROM groups WHERE status='active') AS groups,(SELECT count(*)::int FROM teacher_profiles WHERE status='active') AS teachers,(SELECT count(*)::int FROM teacher_applications WHERE status NOT IN ('approved','rejected','withdrawn')) AS applications`,
      ),
      query(
        'SELECT a.id,a.status,a.country,a.experience,a.presentation,a.availability,a.created_at,u.name,u.email FROM teacher_applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC',
      ),
      query(
        'SELECT t.user_id AS id,u.name,t.status,t.published,t.teacher_bps,t.cycle,t.agreement_at,t.verified_at FROM teacher_profiles t JOIN users u ON u.id=t.user_id',
      ),
      query(
        "SELECT g.id,g.title,g.status,g.level,g.capacity,g.first_at,u.name AS teacher_name,(SELECT count(*) FROM group_enrollments e WHERE e.group_id=g.id AND e.status IN ('reserved','awaiting_payment','active','leaving')) AS students FROM groups g JOIN users u ON u.id=g.teacher_id ORDER BY first_at DESC",
      ),
      query(
        "SELECT i.id,i.kind,i.description,i.status,i.created_at,g.title FROM incidents i LEFT JOIN groups g ON g.id=i.group_id WHERE i.status='open' ORDER BY i.created_at DESC",
      ),
      query(
        'SELECT r.id,r.rating,r.comment,r.status,u.name FROM reviews r JOIN group_enrollments e ON e.id=r.enrollment_id JOIN users u ON u.id=e.student_id ORDER BY r.created_at DESC',
      ),
      query(
        'SELECT c.*, (SELECT count(*)::int FROM attribution_records a WHERE a.campaign_id=c.id) AS requests FROM campaigns c',
      ),
      query(
        'SELECT w.id,w.kind,w.reason,w.effective_at,u.name,g.title FROM student_withdrawals w JOIN group_enrollments e ON e.id=w.enrollment_id JOIN users u ON u.id=e.student_id JOIN groups g ON g.id=e.group_id ORDER BY w.created_at DESC LIMIT 50',
      ),
    ]);
  const [groupRoster, schoolSessions] = await Promise.all([
    query(
      "SELECT e.id,e.group_id,e.status,u.name,g.title,t.name AS teacher_name,sub.status AS subscription_status FROM group_enrollments e JOIN users u ON u.id=e.student_id JOIN groups g ON g.id=e.group_id JOIN users t ON t.id=g.teacher_id LEFT JOIN subscriptions sub ON sub.enrollment_id=e.id WHERE e.status IN ('reserved','awaiting_payment','active','leaving') ORDER BY g.title,u.name",
    ),
    query(
      "SELECT s.id,s.group_id,s.starts_at,s.ends_at,s.status,g.title,u.name AS teacher_name FROM sessions s JOIN groups g ON g.id=s.group_id JOIN users u ON u.id=s.teacher_id WHERE s.starts_at>now()-interval '1 day' ORDER BY s.starts_at LIMIT 200",
    ),
  ]);
  return {
    stats: stats[0],
    groupRoster,
    schoolSessions,
    applications,
    teachers,
    groups,
    incidents,
    reviews,
    campaigns,
    withdrawals,
    teacherAvailability: await query<import('./teacher-availability').Availability>(
      'SELECT * FROM teacher_availability ORDER BY teacher_id,weekday,start_time',
    ),
    billing: {
      enabled: process.env.BILLING_ENABLED === 'true',
      legalReady: process.env.LEGAL_READY === 'true',
    },
    settlements: onCloudflare() ? await settlementOverview() : null,
    teaching: await teacherDashboard(user),
  };
}
