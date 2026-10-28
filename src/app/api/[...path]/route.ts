import { z, ZodError } from 'zod';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { query, transaction } from '@/lib/db';
import { assert, DomainError, type Role } from '@/lib/domain';
import { currentUser, requireUser, logout, rateLimit } from '@/lib/auth';
import { realNameSchema } from '@/lib/lichess';
import { reserve, createGroup, createReview, withdraw, dashboard, audit } from '@/lib/academy';
import { checkout, cancelRenewal } from '@/lib/billing';
import { saveCv, getCv } from '@/lib/storage';
import { onCloudflare } from '@/lib/cloudflare';
import { cloudflareApi } from '@/lib/cloudflare-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const id = z.string().uuid();
const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase().trim());
const adminRoles: Role[] = ['admin', 'superadmin'];
async function body(request: Request) {
  const text = await request.text();
  assert(text.length <= 20000, 'Solicitud demasiado grande.', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError('El formulario no es válido.');
  }
}
async function api(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/');
  const method = request.method;
  if (method === 'GET') {
    if (path === 'me') return { user: await currentUser() };
    if (path === 'dashboard') return dashboard(await requireUser());
    if (path.startsWith('applications/') && path.endsWith('/cv')) {
      const user = await requireUser(adminRoles);
      const applicationId = id.parse(path.split('/')[1]);
      const [row] = await query<{ cv_key: string }>(
        'SELECT cv_key FROM teacher_applications WHERE id=$1',
        [applicationId],
      );
      assert(row, 'No se encuentra el documento.', 404);
      await transaction((c) => audit(c, user.id, 'download_cv', 'application', applicationId));
      const file = await getCv(row.cv_key);
      return new Response(new Uint8Array(await file.Body!.transformToByteArray()).buffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="curriculum.pdf"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    throw new DomainError('Ruta no disponible.', 404);
  }
  assert(method === 'POST', 'Método no permitido.', 405);
  const origin = request.headers.get('origin');
  assert(
    process.env.APP_URL && origin === new URL(process.env.APP_URL).origin,
    'Origen de solicitud no autorizado.',
    403,
  );
  if (path === 'auth/logout') {
    await logout();
    return { redirect: '/' };
  }
  if (
    [
      'auth/register',
      'auth/login',
      'auth/forgot',
      'auth/resend',
      'auth/verify',
      'auth/reset',
    ].includes(path)
  ) {
    throw new DomainError('El acceso se realiza únicamente con Lichess.', 410);
  }
  if (path === 'profile') {
    const user = await requireUser(undefined, false);
    const d = z
      .object({
        name: realNameSchema,
        kind: z.enum(['student', 'teacher']).optional(),
        adult: z.literal(true).optional(),
        privacy: z.literal(true).optional(),
        realName: z.literal(true),
      })
      .parse(await body(request));
    assert(
      d.name.toLocaleLowerCase('es') !== user.lichess_username?.toLocaleLowerCase('es'),
      'Indica tu nombre real, no tu usuario de Lichess.',
    );
    if (!user.profile_completed_at)
      assert(
        d.adult && d.privacy && d.kind,
        'Completa tu modalidad, mayoría de edad y privacidad.',
      );
    await transaction(async (c) => {
      const row = (await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [user.id])).rows[0];
      const first = !row.profile_completed_at;
      const role = first && row.role === 'student' && d.kind === 'teacher' ? 'candidate' : row.role;
      await c.query(
        'UPDATE users SET name=$2,role=$3,profile_kind=CASE WHEN profile_completed_at IS NULL THEN $4 ELSE profile_kind END,privacy_accepted_at=coalesce(privacy_accepted_at,now()),privacy_version=coalesce(privacy_version,$5),profile_completed_at=coalesce(profile_completed_at,now()) WHERE id=$1',
        [user.id, d.name, role, d.kind || row.profile_kind, '2026-10-lichess-1'],
      );
      if (role === 'student')
        await c.query(
          'INSERT INTO student_profiles(user_id,adult_confirmed) VALUES($1,true) ON CONFLICT(user_id) DO UPDATE SET adult_confirmed=true',
          [user.id],
        );
      await audit(c, user.id, 'set_real_name', 'user', user.id);
    });
    return {
      message: 'Tu nombre real se ha guardado.',
      redirect: !user.profile_completed_at && d.kind === 'teacher' ? '/ser-profesor' : '/panel',
    };
  }
  if (path === 'contact') {
    const d = z
      .object({
        name: z.string().trim().min(2).max(100),
        email,
        message: z.string().trim().min(10).max(3000),
        privacy: z.literal(true),
      })
      .parse(await body(request));
    await rateLimit(`contact:${d.email}`, 3, 60);
    await query("INSERT INTO incidents(kind,description) VALUES('contact',$1)", [
      `Contacto de ${d.name} (${d.email}): ${d.message}`,
    ]);
    return { message: 'Consulta recibida. La academia la revisará desde su panel.' };
  }
  if (path === 'jobs/run') return runJobs(request);
  const user = await requireUser();
  if (path === 'enrollments') {
    assert(user.role === 'student', 'Solo las cuentas de alumno pueden reservar.', 403);
    const d = z
      .object({ groupId: id, terms: z.literal(true), campaign: z.string().max(80).optional() })
      .parse(await body(request));
    return reserve(user, d.groupId, d.campaign);
  }
  if (path === 'checkout') {
    const d = z.object({ enrollmentId: id, terms: z.literal(true) }).parse(await body(request));
    return checkout(user, d.enrollmentId);
  }
  if (path === 'cancel-renewal') {
    const d = z
      .object({ enrollmentId: id, reason: z.string().max(2000).default('') })
      .parse(await body(request));
    return cancelRenewal(user, d.enrollmentId, d.reason);
  }
  if (path === 'withdraw') {
    const d = z
      .object({
        enrollmentId: id,
        kind: z.enum(['cancel_renewal', 'change_teacher', 'change_group', 'wait']),
        reason: z.string().max(2000).default(''),
      })
      .parse(await body(request));
    return withdraw(user, d.enrollmentId, d.kind, d.reason);
  }
  if (path === 'reviews') {
    const d = z
      .object({
        enrollmentId: id,
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).default(''),
      })
      .parse(await body(request));
    return createReview(user, d.enrollmentId, d.rating, d.comment);
  }
  if (path === 'applications') {
    assert(
      user.role === 'student' || user.role === 'candidate',
      'Tu cuenta ya tiene otro rol. Contacta con TopChess.',
    );
    const form = await request.formData();
    const d = z
      .object({
        country: z.string().min(2).max(100),
        languages: z.string().min(2).max(200),
        experience: z.string().min(30).max(3000),
        levels: z.string().min(2).max(200),
        presentation: z.string().min(30).max(3000),
        availability: z.string().min(5).max(1000),
        privacy: z.literal('on'),
      })
      .parse(Object.fromEntries(form));
    await rateLimit(`application:${user.id}`, 2, 60);
    const file = form.get('cv');
    assert(file instanceof File, 'Adjunta tu currículum en PDF.');
    const key = await saveCv(file);
    await transaction(async (c) => {
      await c.query(
        'INSERT INTO teacher_applications(user_id,country,languages,experience,levels,presentation,availability,cv_key,privacy_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          user.id,
          d.country,
          d.languages.split(',').map((x) => x.trim()),
          d.experience,
          d.levels.split(',').map((x) => x.trim()),
          d.presentation,
          d.availability,
          key,
          '2026-10-1',
        ],
      );
      await c.query("UPDATE users SET role='candidate' WHERE id=$1", [user.id]);
      await audit(c, user.id, 'submit', 'application', user.id);
    });
    return { message: 'Candidatura recibida. Podrás consultar su estado en tu panel.' };
  }
  if (path === 'teacher/availability') {
    assert(user.role === 'teacher', 'Acceso reservado a profesores aprobados.', 403);
    const d = z
      .object({
        weekday: z.number().int().min(1).max(7),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .parse(await body(request));
    assert(d.end > d.start, 'La hora final debe ser posterior al inicio.');
    await query(
      'INSERT INTO teacher_availability(teacher_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)',
      [user.id, d.weekday, d.start, d.end],
    );
    return { message: 'Franja propuesta. TopChess debe aprobarla.' };
  }
  if (path === 'sessions/report') {
    assert(user.role === 'teacher' || adminRoles.includes(user.role), 'Acceso no autorizado.', 403);
    const d = z
      .object({
        sessionId: id,
        status: z.enum(['taught', 'teacher_absent']),
        description: z.string().max(3000).default(''),
      })
      .parse(await body(request));
    await transaction(async (c) => {
      const s = (await c.query('SELECT * FROM sessions WHERE id=$1 FOR UPDATE', [d.sessionId]))
        .rows[0];
      assert(
        s && (adminRoles.includes(user.role) || s.teacher_id === user.id),
        'Sesión no accesible.',
        403,
      );
      assert(
        new Date(s.ends_at) <= new Date(),
        'No se puede marcar una clase futura como impartida.',
      );
      assert(
        ['scheduled', 'in_progress'].includes(s.status),
        'La sesión ya tiene un resultado; solicita una corrección a administración.',
      );
      await c.query('UPDATE sessions SET status=$2 WHERE id=$1', [d.sessionId, d.status]);
      if (d.status === 'teacher_absent')
        await c.query(
          "INSERT INTO incidents(group_id,session_id,reported_by,kind,description) VALUES($1,$2,$3,'teacher_absent',$4)",
          [
            s.group_id,
            s.id,
            user.id,
            d.description || 'Debe gestionarse sustitución o recuperación.',
          ],
        );
      await c.query('UPDATE teacher_profiles SET last_activity_at=now() WHERE user_id=$1', [
        s.teacher_id,
      ]);
      await audit(c, user.id, d.status, 'session', s.id);
    });
    return { message: 'Resultado registrado con trazabilidad.' };
  }
  if (path === 'attendance') {
    assert(user.role === 'teacher' || adminRoles.includes(user.role), 'Acceso no autorizado.', 403);
    const d = z
      .object({ sessionId: id, studentId: id, status: z.enum(['present', 'absent']) })
      .parse(await body(request));
    await transaction(async (c) => {
      const s = (await c.query('SELECT * FROM sessions WHERE id=$1 FOR UPDATE', [d.sessionId]))
        .rows[0];
      assert(
        s && (adminRoles.includes(user.role) || s.teacher_id === user.id),
        'Sesión no accesible.',
        403,
      );
      assert(s.status === 'taught', 'La clase debe haberse impartido para registrar asistencia.');
      const e = await c.query(
        "SELECT 1 FROM group_enrollments WHERE group_id=$1 AND student_id=$2 AND status IN ('active','leaving')",
        [s.group_id, d.studentId],
      );
      assert(e.rowCount, 'El alumno no pertenece al grupo.');
      await c.query(
        'INSERT INTO attendance(session_id,student_id,status,marked_by) VALUES($1,$2,$3,$4) ON CONFLICT(session_id,student_id) DO UPDATE SET status=$3,marked_by=$4',
        [d.sessionId, d.studentId, d.status, user.id],
      );
      await audit(c, user.id, 'attendance', 'session', s.id, {
        studentId: d.studentId,
        status: d.status,
      });
    });
    return { message: 'Asistencia guardada. La ausencia del alumno no genera recuperación.' };
  }
  if (path === 'incidents') {
    const d = z
      .object({ groupId: id, description: z.string().min(10).max(3000) })
      .parse(await body(request));
    const access =
      adminRoles.includes(user.role) ||
      (
        await query(
          'SELECT 1 FROM groups g LEFT JOIN group_enrollments e ON e.group_id=g.id WHERE g.id=$1 AND (g.teacher_id=$2 OR e.student_id=$2)',
          [d.groupId, user.id],
        )
      ).length;
    assert(access, 'Grupo no accesible.', 403);
    await query(
      "INSERT INTO incidents(group_id,reported_by,kind,description) VALUES($1,$2,'support',$3)",
      [d.groupId, user.id, d.description],
    );
    return { message: 'Incidencia registrada.' };
  }
  assert(adminRoles.includes(user.role), 'Acceso reservado a administración.', 403);
  if (path === 'admin/groups') {
    const d = z
      .object({
        teacherId: id,
        title: z.string().min(5).max(120),
        level: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
        language: z.string().min(2).max(50),
        capacity: z.number().int().min(2).max(12),
        firstAt: z.iso.datetime(),
        duration: z.number().int().min(30).max(180),
        timezone: z.string().refine((v) => {
          try {
            new Intl.DateTimeFormat('es', { timeZone: v });
            return true;
          } catch {
            return false;
          }
        }),
        excludedDates: z.array(z.iso.date()).default([]),
      })
      .parse(await body(request));
    return createGroup(user, d);
  }
  if (path === 'admin/application') {
    const d = z
      .object({
        applicationId: id,
        status: z.enum([
          'documents',
          'review',
          'references',
          'interview',
          'trial',
          'approved',
          'rejected',
        ]),
        reason: z.string().min(5).max(2000),
        agreement: z.boolean().default(false),
        verified: z.boolean().default(false),
      })
      .parse(await body(request));
    await transaction(async (c) => {
      const app = (
        await c.query(
          'SELECT a.*,u.name FROM teacher_applications a JOIN users u ON u.id=a.user_id WHERE a.id=$1 FOR UPDATE OF a',
          [d.applicationId],
        )
      ).rows[0];
      assert(app, 'Candidatura no encontrada.', 404);
      assert(
        !['approved', 'withdrawn', 'rejected'].includes(app.status),
        'Este expediente ya está cerrado.',
      );
      if (d.status === 'approved') {
        assert(
          d.agreement && d.verified,
          'Confirma acuerdo profesional y requisitos administrativos antes de aprobar.',
        );
        await c.query(
          'INSERT INTO teacher_profiles(user_id,headline,bio,languages,levels,agreement_at,verified_at) VALUES($1,$2,$3,$4,$5,now(),now())',
          [app.user_id, 'Profesor de TopChess Global', app.presentation, app.languages, app.levels],
        );
        await c.query("UPDATE users SET role='teacher' WHERE id=$1", [app.user_id]);
      }
      await c.query('UPDATE teacher_applications SET status=$2 WHERE id=$1', [
        d.applicationId,
        d.status,
      ]);
      await audit(c, user.id, 'application_status', 'application', d.applicationId, {
        status: d.status,
        reason: d.reason,
      });
    });
    return {
      message:
        'Expediente actualizado. La publicación del perfil requiere una autorización separada.',
    };
  }
  if (path === 'admin/teacher') {
    const d = z
      .object({
        teacherId: id,
        action: z.enum(['publish', 'suspend', 'pause', 'depart', 'readmit']),
        reason: z.string().min(5).max(2000),
        agreement: z.boolean().default(false),
      })
      .parse(await body(request));
    await transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext('topchess:bookings'))");
      const t = (
        await c.query('SELECT * FROM teacher_profiles WHERE user_id=$1 FOR UPDATE', [d.teacherId])
      ).rows[0];
      assert(t, 'Profesor no encontrado.', 404);
      if (d.action === 'publish') {
        assert(t.status === 'active' && t.agreement_at && t.verified_at, 'Profesor no autorizado.');
        await c.query('UPDATE teacher_profiles SET published=true WHERE user_id=$1', [d.teacherId]);
      } else if (d.action === 'readmit') {
        assert(
          t.status === 'departed' && d.agreement,
          'La readmisión requiere una baja definitiva previa y un nuevo acuerdo.',
        );
        await c.query(
          "UPDATE teacher_profiles SET status='active',published=false,teacher_bps=5000,cycle=cycle+1,agreement_at=now() WHERE user_id=$1",
          [d.teacherId],
        );
      } else {
        assert(t.status !== 'departed', 'La colaboración ya está terminada.');
        const future = await c.query(
          "SELECT 1 FROM sessions s JOIN group_enrollments e ON e.group_id=s.group_id WHERE s.teacher_id=$1 AND s.starts_at>now() AND e.status IN ('active','leaving','awaiting_payment') LIMIT 1",
          [d.teacherId],
        );
        assert(
          !future.rowCount,
          'Gestiona primero la continuidad de todas las clases comprometidas.',
        );
        const state =
          d.action === 'depart' ? 'departed' : d.action === 'pause' ? 'paused' : 'suspended';
        await c.query('UPDATE teacher_profiles SET status=$2,published=false WHERE user_id=$1', [
          d.teacherId,
          state,
        ]);
        if (d.action === 'depart')
          await c.query(
            'INSERT INTO teacher_departures(teacher_id,cycle,reason,effective_at) VALUES($1,$2,$3,now())',
            [d.teacherId, t.cycle, d.reason],
          );
      }
      await c.query(
        'INSERT INTO teacher_status_history(teacher_id,status,reason,actor_id) VALUES($1,$2,$3,$4)',
        [d.teacherId, d.action, d.reason, user.id],
      );
      await audit(c, user.id, d.action, 'teacher', d.teacherId, { reason: d.reason });
    });
    return { message: 'Estado del profesor actualizado y auditado.' };
  }
  if (path === 'admin/review') {
    const d = z
      .object({
        reviewId: id,
        status: z.enum(['published', 'hidden', 'removed']),
        reason: z.string().min(10).max(2000),
      })
      .parse(await body(request));
    await transaction(async (c) => {
      const r = await c.query('UPDATE reviews SET status=$2 WHERE id=$1 RETURNING id', [
        d.reviewId,
        d.status,
      ]);
      assert(r.rowCount, 'Reseña no encontrada.');
      await c.query(
        'INSERT INTO review_moderation_actions(review_id,actor_id,action,reason) VALUES($1,$2,$3,$4)',
        [d.reviewId, user.id, d.status, d.reason],
      );
      await audit(c, user.id, 'moderate', 'review', d.reviewId, { reason: d.reason });
    });
    return {
      message: 'Moderación registrada. Las opiniones negativas legítimas deben conservarse.',
    };
  }
  if (path === 'admin/campaign') {
    const d = z
      .object({
        name: z.string().min(3).max(100),
        code: z.string().regex(/^[a-z0-9-]{3,80}$/),
        city: z.string().max(100),
        channel: z.string().min(2).max(100),
      })
      .parse(await body(request));
    await transaction(async (c) => {
      const r = await c.query(
        'INSERT INTO campaigns(name,code,city,channel) VALUES($1,$2,$3,$4) RETURNING id',
        [d.name, d.code, d.city, d.channel],
      );
      await audit(c, user.id, 'create', 'campaign', r.rows[0].id);
    });
    return { message: `Campaña creada: ${process.env.APP_URL}/clases?campana=${d.code}` };
  }
  if (path === 'admin/session') {
    const d = z.object({ sessionId: id, videoUrl: z.url() }).parse(await body(request));
    const url = new URL(d.videoUrl);
    assert(
      url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        process.env.VIDEO_ALLOWED_HOSTS?.split(',').includes(url.hostname),
      'El enlace debe usar un dominio HTTPS autorizado.',
    );
    await transaction(async (c) => {
      const r = await c.query('UPDATE sessions SET video_url=$2 WHERE id=$1 RETURNING id', [
        d.sessionId,
        d.videoUrl,
      ]);
      assert(r.rowCount, 'Sesión no encontrada.');
      await audit(c, user.id, 'set_video', 'session', d.sessionId);
    });
    return { message: 'Enlace de clase actualizado.' };
  }
  throw new DomainError('Ruta no disponible.', 404);
}
async function runJobs(request: Request) {
  const secret = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const expected = process.env.CRON_SECRET || '';
  assert(
    expected.length >= 32 &&
      secret.length === expected.length &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(expected)),
    'Acceso no autorizado.',
    401,
  );
  assert(
    process.env.MAIL_API_URL?.startsWith('https://') &&
      process.env.MAIL_API_TOKEN &&
      process.env.MAIL_FROM,
    'El envío de correo no está configurado.',
    503,
  );
  let sent = 0;
  await transaction(async (c) => {
    const rows = (
      await c.query(
        "SELECT * FROM mail_outbox WHERE status='pending' AND next_attempt_at<=now() AND attempts<8 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20",
      )
    ).rows;
    for (const mail of rows) {
      try {
        const r = await fetch(process.env.MAIL_API_URL!, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.MAIL_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': mail.id,
          },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: mail.recipient,
            subject: mail.subject,
            text: mail.body,
          }),
          signal: AbortSignal.timeout(10000),
        });
        assert(r.ok, 'Envío fallido.');
        await c.query(
          "UPDATE mail_outbox SET status='sent',sent_at=now(),body='[Contenido eliminado tras envío]' WHERE id=$1",
          [mail.id],
        );
        sent++;
      } catch {
        await c.query(
          "UPDATE mail_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '15 minutes' WHERE id=$1",
          [mail.id],
        );
      }
    }
    await c.query('DELETE FROM auth_sessions WHERE expires_at<now()');
    await c.query('DELETE FROM auth_tokens WHERE expires_at<now()');
    await c.query('DELETE FROM rate_limits WHERE reset_at<now()');
    // Una regla temporal genera revisión; nunca baja definitiva ni penaliza vacaciones.
    await c.query(
      `INSERT INTO notifications(user_id,title,body,dedupe_key) SELECT t.user_id,'Revisión de actividad','Revisa tu disponibilidad o solicita una pausa autorizada.', 'inactivity:'||t.user_id||':'||floor(extract(epoch FROM(now()-t.last_activity_at))/1296000)::text FROM teacher_profiles t WHERE t.status='active' AND t.last_activity_at<now()-interval '15 days' AND NOT EXISTS(SELECT 1 FROM teacher_time_off o WHERE o.teacher_id=t.user_id AND o.approved AND now() BETWEEN o.starts_at AND o.ends_at) ON CONFLICT(dedupe_key) DO NOTHING`,
    );
  });
  return { sent };
}
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    if (request.method === 'POST') {
      const limit = request.headers.get('content-type')?.includes('multipart/form-data')
        ? 6 * 1024 * 1024
        : 24000;
      assert(
        Number(request.headers.get('content-length') || 0) <= limit,
        'Solicitud demasiado grande.',
        413,
      );
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader)
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > limit) {
            await reader.cancel();
            throw new DomainError('Solicitud demasiado grande.', 413);
          }
          chunks.push(value);
        }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bytes.buffer,
      });
    }
    const result = onCloudflare()
      ? await cloudflareApi(request, context)
      : await api(request, context);
    return result instanceof Response
      ? result
      : Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ZodError)
      return Response.json(
        { error: error.issues[0]?.message || 'Revisa los campos del formulario.' },
        { status: 400 },
      );
    if (error instanceof DomainError)
      return Response.json({ error: error.message }, { status: error.status });
    if (onCloudflare()) {
      const message = error instanceof Error ? error.message : '';
      const safe = [
        'No quedan plazas',
        'El horario se solapa con otra reserva del alumno',
        'El horario se solapa con otra clase del profesor',
        'El grupo no admite nuevas reservas',
        'Solo puedes valorar después de asistir a una clase impartida',
        'Gestiona la continuidad de las clases antes de cambiar el estado del profesor',
        'El expediente ya está cerrado',
        'El calendario coincide con vacaciones aprobadas',
      ].find((text) => message.includes(text));
      if (safe) return Response.json({ error: safe }, { status: 409 });
      if (message.includes('UNIQUE constraint'))
        return Response.json(
          { error: 'La operación ya está registrada. Revisa tu panel.' },
          { status: 409 },
        );
    }
    const code = (error as { code?: string })?.code;
    if (code === '23505')
      return Response.json(
        { error: 'Ya existe un registro con estos datos. Revisa tu panel.' },
        { status: 409 },
      );
    if (code === '23P01')
      return Response.json(
        { error: 'El horario se solapa con otra reserva o clase. Elige otra franja.' },
        { status: 409 },
      );
    return Response.json(
      {
        error:
          'No se ha podido completar la operación. Inténtalo de nuevo o contacta con la academia.',
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
