import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { atomic, d1Query, auditStatement, type Statement } from './cloudflare';
import { currentUser, requireUser, logout, rateLimit } from './auth';
import { assert, DomainError, TERMS_VERSION, canAdmin } from './domain';
import { realNameSchema } from './lichess';
import { dashboard } from './academy';
import { saveCv, getCv } from './storage';
import { monthlyBilling, billingDetails } from './monthly-billing';
import { sameBillingMonth } from './monthly-calendar';
import { ManualSettlements } from './manual-settlements';
import { normalizeIban, encryptIban, decryptIban } from './teacher-bank';
import { billingPreflight } from './billing-preflight';
import { publishMonthlyGroup } from './monthly-groups';
import { setOwnGroupVideo, validateClassVideo } from './class-video';
import { TeacherAvailability } from './teacher-availability';
import { saveAdminTeachingProfile, requireTeachingProfile } from './admin-teaching';
const id = z.uuid();
async function data(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new DomainError('El formulario no es válido.');
  }
}
const done = (message: string) => ({ message });
/** Escrituras D1 en lotes atómicos. Las invariantes concurrentes se ejecutan en triggers SQL. */
export async function cloudflareApi(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join('/');
  if (request.method === 'GET') {
    if (path === 'me') return { user: await currentUser() };
    if (path === 'dashboard') return dashboard(await requireUser());
    if (/^teachers\/[^/]+\/bank$/.test(path)) {
      const user = await requireUser(),
        teacherId = id.parse(path.split('/')[1]);
      assert(canAdmin(user.role) || user.id === teacherId, 'No puedes consultar esta cuenta.', 403);
      const [bank] = await d1Query<{ holder: string; iban_encrypted: string; updated_at: string }>(
        'SELECT holder,iban_encrypted,updated_at FROM teacher_bank_accounts WHERE teacher_id=$1',
        [teacherId],
      );
      if (!bank) return { message: 'El profesor todavía no ha indicado su cuenta.' };
      await atomic([auditStatement(user.id, 'view_teacher_bank', 'teacher', teacherId)]);
      return {
        holder: bank.holder,
        iban: decryptIban(bank.iban_encrypted, teacherId, process.env.OAUTH_COOKIE_SECRET || ''),
        updated_at: bank.updated_at,
      };
    }
    if (path.startsWith('applications/') && path.endsWith('/cv')) {
      const user = await requireUser(['admin', 'superadmin']);
      const applicationId = id.parse(path.split('/')[1]);
      const [app] = await d1Query<{ cv_key: string }>(
        'SELECT cv_key FROM teacher_applications WHERE id=$1',
        [applicationId],
      );
      assert(app, 'Documento no encontrado.', 404);
      const file = await getCv(app.cv_key);
      await atomic([auditStatement(user.id, 'download_cv', 'application', applicationId)]);
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
  assert(request.method === 'POST', 'Método no permitido.', 405);
  assert(
    process.env.APP_URL && request.headers.get('origin') === new URL(process.env.APP_URL).origin,
    'Origen de solicitud no autorizado.',
    403,
  );
  if (
    [
      'auth/register',
      'auth/login',
      'auth/forgot',
      'auth/resend',
      'auth/reset',
      'auth/verify',
    ].includes(path)
  )
    throw new DomainError('El acceso se realiza únicamente con Lichess.', 410);
  if (path === 'auth/logout') {
    await logout();
    return { redirect: '/' };
  }
  if (path === 'contact') {
    const d = z
      .object({
        name: realNameSchema,
        email: z.email().max(254),
        message: z.string().trim().min(10).max(3000),
        privacy: z.literal(true),
      })
      .parse(await data(request));
    await rateLimit(`contact:${d.email}`, 3, 60);
    await atomic([
      {
        sql: "INSERT INTO incidents(kind,description) VALUES('contact',$1)",
        values: [`Contacto de ${d.name} (${d.email}): ${d.message}`],
      },
    ]);
    return done('Consulta recibida. TopChess la revisará desde su panel.');
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
      .parse(await data(request));
    if (!user.profile_completed_at)
      assert(
        d.kind && d.adult && d.privacy,
        'Completa tu modalidad, mayoría de edad y privacidad.',
      );
    const statements: Statement[] = [
      {
        sql: "UPDATE users SET name=$2,role=CASE WHEN profile_completed_at IS NULL AND role='student' AND $3='teacher' THEN 'candidate' ELSE role END,profile_kind=CASE WHEN profile_completed_at IS NULL THEN $3 ELSE profile_kind END,privacy_accepted_at=coalesce(privacy_accepted_at,now()),privacy_version=coalesce(privacy_version,'2026-10-lichess-1'),profile_completed_at=coalesce(profile_completed_at,now()) WHERE id=$1",
        values: [user.id, d.name, d.kind || null],
      },
      {
        sql: "INSERT INTO student_profiles(user_id,adult_confirmed) SELECT id,1 FROM users WHERE id=$1 AND role='student' ON CONFLICT(user_id) DO UPDATE SET adult_confirmed=1",
        values: [user.id],
      },
      auditStatement(user.id, 'set_real_name', 'user', user.id),
    ];
    await atomic(statements);
    return {
      message: 'Tu nombre real se ha guardado.',
      redirect:
        !user.profile_completed_at && user.role === 'student' && d.kind === 'teacher'
          ? '/ser-profesor'
          : '/panel',
    };
  }
  const user = await requireUser();
  if (path === 'admin/teaching-profile') {
    await saveAdminTeachingProfile(user, await data(request));
    return done('Tu perfil docente está guardado. Conservas todos tus permisos de administración.');
  }
  if (path === 'admin/billing-check') {
    assert(canAdmin(user.role), 'Acceso reservado a TopChess.', 403);
    const state = await billingPreflight();
    return done(
      state.account_id && state.price_ok && state.tax_ok && state.webhook_present
        ? 'Stripe está conectado: cuota de 50 €/mes e IVA del 21 % incluido verificados. Los cobros requieren la aprobación fiscal y contractual antes de activarse.'
        : `La conexión de Stripe necesita revisión: ${state.error || 'faltan ajustes o permisos'}. No se han realizado cargos.`,
    );
  }
  if (path === 'teacher/bank') {
    await requireTeachingProfile(user);
    const d = z
      .object({ holder: z.string().trim().min(3).max(150), iban: z.string().min(15).max(42) })
      .parse(await data(request));
    const iban = normalizeIban(d.iban),
      encrypted = encryptIban(iban, user.id, process.env.OAUTH_COOKIE_SECRET || '');
    await atomic([
      {
        sql: 'INSERT INTO teacher_bank_accounts(teacher_id,holder,iban_encrypted,last_four,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(teacher_id) DO UPDATE SET holder=excluded.holder,iban_encrypted=excluded.iban_encrypted,last_four=excluded.last_four,updated_at=excluded.updated_at',
        values: [user.id, d.holder, encrypted, iban.slice(-4)],
      },
      auditStatement(user.id, 'update_teacher_bank', 'teacher', user.id),
    ]);
    return done(`Cuenta terminada en ${iban.slice(-4)} guardada para tus transferencias.`);
  }
  if (path === 'admin/settlements-refresh') {
    assert(canAdmin(user.role), 'Acceso reservado a TopChess.', 403);
    await new ManualSettlements().refresh();
    return done(
      'Importes revisados según las clases y cobros registrados. No se ha enviado dinero.',
    );
  }
  if (path === 'admin/manual-payout') {
    assert(canAdmin(user.role), 'Acceso reservado a TopChess.', 403);
    const d = z
      .object({
        payoutId: id,
        amount: z.coerce.number().int().positive(),
        reference: z.string().trim().min(3).max(150),
        confirmed: z.literal(true),
      })
      .parse(await data(request));
    return new ManualSettlements().markPaid(user.id, d.payoutId, d.amount, d.reference);
  }
  if (path === 'enrollments') {
    assert(user.role === 'student', 'Solo los alumnos pueden solicitar plaza.', 403);
    const d = z
      .object({ groupId: id, terms: z.literal(true), campaign: z.string().max(80).optional() })
      .parse(await data(request));
    const [existing] = await d1Query<{ id: string; status: string }>(
      'SELECT id,status FROM group_enrollments WHERE group_id=$1 AND student_id=$2',
      [d.groupId, user.id],
    );
    if (existing) {
      assert(
        ['reserved', 'awaiting_payment', 'active'].includes(existing.status),
        'Ya existe un historial en este grupo. Contacta con la academia.',
      );
      return done('Tu solicitud ya está registrada.');
    }
    const [calendarGroup] = await d1Query<{ first_at: string; billing_model: string }>(
      'SELECT first_at,billing_model FROM groups WHERE id=$1',
      [d.groupId],
    );
    assert(
      calendarGroup?.billing_model === 'calendar_month' &&
        sameBillingMonth(new Date(calendarGroup.first_at)),
      'La incorporación requiere un grupo del mes siguiente con calendario mensual confirmado.',
    );
    const enrollmentId = randomUUID();
    await atomic([
      {
        sql: 'INSERT INTO group_enrollments(id,group_id,student_id,terms_version) VALUES($1,$2,$3,$4)',
        values: [enrollmentId, d.groupId, user.id, TERMS_VERSION],
      },
      {
        sql: "INSERT INTO attribution_records(enrollment_id,campaign_id,source) VALUES($1,(SELECT id FROM campaigns WHERE code=$2 AND active=1),CASE WHEN EXISTS(SELECT 1 FROM campaigns WHERE code=$2 AND active=1) THEN 'campaign' ELSE 'direct' END)",
        values: [enrollmentId, d.campaign || null],
      },
      auditStatement(user.id, 'reserve', 'enrollment', enrollmentId),
    ]);
    return done('Plaza solicitada sin cobro. Consulta el estado real del grupo en tu panel.');
  }
  if (path === 'checkout') {
    const d = billingDetails
      .extend({ enrollmentId: id, terms: z.literal(true) })
      .parse(await data(request));
    await rateLimit(`checkout:${user.id}`, 6, 1);
    return monthlyBilling().checkout(user, d.enrollmentId, d);
  }
  if (path === 'cancel-renewal') {
    const d = z
      .object({ enrollmentId: id, reason: z.string().max(2000).default('') })
      .parse(await data(request));
    return monthlyBilling().cancel(user, d.enrollmentId, d.reason);
  }
  if (path === 'withdraw') {
    const d = z
      .object({
        enrollmentId: id,
        kind: z.enum(['cancel_renewal', 'change_teacher', 'change_group', 'wait']),
        reason: z.string().max(2000).default(''),
      })
      .parse(await data(request));
    const [e] = await d1Query<{ group_id: string; status: string }>(
      'SELECT group_id,status FROM group_enrollments WHERE id=$1 AND student_id=$2',
      [d.enrollmentId, user.id],
    );
    assert(e, 'Matrícula no encontrada.', 404);
    if (
      (
        await d1Query(
          "SELECT id FROM subscriptions WHERE enrollment_id=$1 AND billing_model='calendar_month'",
          [d.enrollmentId],
        )
      ).length
    )
      return monthlyBilling().cancel(user, d.enrollmentId, d.reason);
    assert(
      ['reserved', 'awaiting_payment'].includes(e.status),
      'Esta matrícula requiere gestionar sus renovaciones y continuidad. Contacta con TopChess.',
    );
    await atomic([
      {
        sql: "UPDATE group_enrollments SET status='left' WHERE id=$1 AND student_id=$2 AND status IN ('reserved','awaiting_payment')",
        values: [d.enrollmentId, user.id],
      },
      { sql: 'DELETE FROM student_slots WHERE enrollment_id=$1', values: [d.enrollmentId] },
      {
        sql: 'INSERT INTO student_withdrawals(enrollment_id,kind,reason,effective_at) VALUES($1,$2,$3,now())',
        values: [d.enrollmentId, d.kind, d.reason || null],
      },
      {
        sql: "UPDATE groups SET status='pending' WHERE id=$1 AND (SELECT count(*) FROM group_enrollments e WHERE e.group_id=$1 AND e.status IN ('reserved','awaiting_payment','active','leaving'))<min_students AND NOT EXISTS(SELECT 1 FROM group_enrollments e JOIN subscriptions s ON s.enrollment_id=e.id WHERE e.group_id=$1 AND s.status='active')",
        values: [e.group_id],
      },
      {
        sql: "UPDATE group_enrollments SET status='reserved' WHERE group_id=$1 AND status='awaiting_payment' AND (SELECT status FROM groups WHERE id=$1)='pending'",
        values: [e.group_id],
      },
      auditStatement(user.id, 'withdraw', 'enrollment', d.enrollmentId),
    ]);
    return done('Solicitud retirada sin cobro. El historial se conserva.');
  }
  if (path === 'reviews') {
    const d = z
      .object({
        enrollmentId: id,
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).default(''),
      })
      .parse(await data(request));
    const [e] = await d1Query('SELECT id FROM group_enrollments WHERE id=$1 AND student_id=$2', [
      d.enrollmentId,
      user.id,
    ]);
    assert(e, 'Matrícula no accesible.', 403);
    await atomic([
      {
        sql: 'INSERT INTO reviews(enrollment_id,rating,comment) VALUES($1,$2,$3)',
        values: [d.enrollmentId, d.rating, d.comment],
      },
    ]);
    return done('Reseña recibida para revisión.');
  }
  if (path === 'applications') {
    assert(['student', 'candidate'].includes(user.role), 'Tu cuenta ya tiene otro rol.', 403);
    const form = await request.formData();
    const d = z
      .object({
        country: z.string().min(2).max(100),
        languages: z.string().min(2).max(200),
        levels: z.string().min(2).max(200),
        experience: z.string().min(30).max(3000),
        presentation: z.string().min(30).max(3000),
        availability: z.string().min(5).max(1000),
        privacy: z.literal('on'),
      })
      .parse(Object.fromEntries(form));
    await rateLimit(`application:${user.id}`, 2, 60);
    assert(
      !(await d1Query('SELECT id FROM teacher_applications WHERE user_id=$1', [user.id])).length,
      'Ya existe una candidatura para tu cuenta.',
    );
    const file = form.get('cv');
    assert(file instanceof File, 'Adjunta tu currículum en PDF.');
    const key = await saveCv(file);
    await atomic([
      {
        sql: 'INSERT INTO teacher_applications(user_id,country,languages,experience,levels,presentation,availability,cv_key,privacy_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        values: [
          user.id,
          d.country,
          d.languages.split(',').map((x) => x.trim()),
          d.experience,
          d.levels.split(',').map((x) => x.trim()),
          d.presentation,
          d.availability,
          key,
          '2026-10-lichess-1',
        ],
      },
      { sql: "UPDATE users SET role='candidate' WHERE id=$1", values: [user.id] },
      auditStatement(user.id, 'submit', 'application', user.id),
    ]);
    return done('Candidatura recibida. Consulta su estado en tu panel.');
  }
  if (path === 'teacher/availability' || path === 'teacher/availability/remove') {
    const service = new TeacherAvailability();
    const d = await data(request);
    if (path.endsWith('/remove')) await service.remove(user, d.id);
    else await service.save(user, d);
    return done(
      path.endsWith('/remove')
        ? 'Horario retirado. Tus clases acordadas se mantienen.'
        : 'Disponibilidad publicada. Los alumnos podrán verla en tu ficha pública.',
    );
  }
  if (path === 'sessions/report' || path === 'attendance') {
    assert(user.role === 'teacher' || canAdmin(user.role), 'Acceso no autorizado.', 403);
    const raw = await data(request);
    const sessionId = id.parse(raw.sessionId);
    const [s] = await d1Query<{
      teacher_id: string;
      ends_at: string;
      group_id: string;
      status: string;
    }>('SELECT * FROM sessions WHERE id=$1', [sessionId]);
    assert(s && (s.teacher_id === user.id || canAdmin(user.role)), 'Sesión no accesible.', 403);
    if (path === 'sessions/report') {
      const d = z
        .object({
          status: z.enum(['taught', 'teacher_absent']),
          description: z.string().max(3000).default(''),
        })
        .parse(raw);
      assert(new Date(s.ends_at) <= new Date(), 'No se puede registrar una clase futura.');
      assert(['scheduled', 'in_progress'].includes(s.status), 'La sesión ya tiene un resultado.');
      const statements: Statement[] = [
        {
          sql: "UPDATE sessions SET status=$2 WHERE id=$1 AND status IN ('scheduled','in_progress')",
          values: [sessionId, d.status],
        },
        {
          sql: 'UPDATE teacher_profiles SET last_activity_at=now() WHERE user_id=$1',
          values: [s.teacher_id],
        },
        auditStatement(user.id, d.status, 'session', sessionId),
      ];
      if (d.status === 'teacher_absent')
        statements.push({
          sql: "INSERT INTO incidents(group_id,session_id,reported_by,kind,description) VALUES($1,$2,$3,'teacher_absent',$4)",
          values: [
            s.group_id,
            sessionId,
            user.id,
            d.description || 'Gestionar sustitución o recuperación.',
          ],
        });
      await atomic(statements);
    } else {
      const d = z.object({ studentId: id, status: z.enum(['present', 'absent']) }).parse(raw);
      assert(s.status === 'taught', 'La clase debe haberse impartido.');
      await atomic([
        {
          sql: 'INSERT INTO attendance(session_id,student_id,status,marked_by) VALUES($1,$2,$3,$4) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,marked_by=excluded.marked_by',
          values: [sessionId, d.studentId, d.status, user.id],
        },
        auditStatement(user.id, 'attendance', 'session', sessionId, {
          studentId: d.studentId,
          status: d.status,
        }),
      ]);
    }
    return done('Registro guardado con trazabilidad.');
  }
  if (path === 'incidents') {
    const d = z
      .object({ groupId: id, description: z.string().min(10).max(3000) })
      .parse(await data(request));
    assert(
      canAdmin(user.role) ||
        (
          await d1Query(
            'SELECT 1 FROM groups g LEFT JOIN group_enrollments e ON e.group_id=g.id WHERE g.id=$1 AND (g.teacher_id=$2 OR e.student_id=$2)',
            [d.groupId, user.id],
          )
        ).length,
      'Grupo no accesible.',
      403,
    );
    await atomic([
      {
        sql: "INSERT INTO incidents(group_id,reported_by,kind,description) VALUES($1,$2,'support',$3)",
        values: [d.groupId, user.id, d.description],
      },
    ]);
    return done('Incidencia registrada.');
  }
  if (path === 'teacher/groups') {
    const raw = await data(request);
    await publishMonthlyGroup(
      user,
      { ...raw, teacherId: user.id },
      { query: d1Query, write: atomic, now: () => new Date(), selfService: true },
    );
    return done('Grupo publicado. Los alumnos ya pueden consultar el calendario y reservar plaza.');
  }
  if (path === 'teacher/group-video') {
    await setOwnGroupVideo(user, await data(request));
    return done('Enlace privado guardado para las próximas clases de tu grupo.');
  }
  assert(canAdmin(user.role), 'Acceso reservado a administración.', 403);
  if (path === 'admin/groups') {
    await publishMonthlyGroup(user, await data(request));
    return done('Grupo publicado con cuatro fechas por mes.');
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
      .parse(await data(request));
    const [a] = await d1Query<{
      user_id: string;
      status: string;
      presentation: string;
      languages: string[];
      levels: string[];
    }>('SELECT * FROM teacher_applications WHERE id=$1', [d.applicationId]);
    assert(a, 'Candidatura no encontrada.', 404);
    assert(
      !['approved', 'rejected', 'withdrawn'].includes(a.status),
      'El expediente ya está cerrado.',
    );
    const statements: Statement[] = [];
    if (d.status === 'approved') {
      assert(d.agreement && d.verified, 'Confirma el acuerdo y los requisitos administrativos.');
      statements.push(
        {
          sql: 'INSERT INTO teacher_profiles(user_id,headline,bio,languages,levels,agreement_at,verified_at) VALUES($1,$2,$3,$4,$5,now(),now())',
          values: [a.user_id, 'Profesor de TopChess Global', a.presentation, a.languages, a.levels],
        },
        { sql: "UPDATE users SET role='teacher' WHERE id=$1", values: [a.user_id] },
      );
    }
    statements.push(
      {
        sql: 'UPDATE teacher_applications SET status=$2 WHERE id=$1',
        values: [d.applicationId, d.status],
      },
      auditStatement(user.id, 'application_status', 'application', d.applicationId, {
        status: d.status,
        reason: d.reason,
      }),
    );
    await atomic(statements);
    return done(
      'Expediente actualizado. La publicación del perfil requiere autorización separada.',
    );
  }
  if (path === 'admin/teacher') {
    const d = z
      .object({
        teacherId: id,
        action: z.enum(['publish', 'pause', 'suspend', 'depart', 'readmit']),
        reason: z.string().min(5).max(2000),
        agreement: z.boolean().default(false),
      })
      .parse(await data(request));
    const [t] = await d1Query<{
      status: string;
      cycle: number;
      agreement_at: string | null;
      verified_at: string | null;
    }>('SELECT * FROM teacher_profiles WHERE user_id=$1', [d.teacherId]);
    assert(t, 'Profesor no encontrado.', 404);
    const statements: Statement[] = [];
    if (d.action === 'publish') {
      assert(
        t.status === 'active' && t.agreement_at && t.verified_at,
        'El docente no está autorizado.',
      );
      statements.push({
        sql: 'UPDATE teacher_profiles SET published=1 WHERE user_id=$1',
        values: [d.teacherId],
      });
    } else if (d.action === 'readmit') {
      assert(
        t.status === 'departed' && d.agreement,
        'La readmisión exige baja previa y nuevo acuerdo.',
      );
      statements.push({
        sql: "UPDATE teacher_profiles SET status='active',published=0,teacher_bps=5000,cycle=cycle+1,agreement_at=now() WHERE user_id=$1",
        values: [d.teacherId],
      });
    } else {
      assert(
        !(
          await d1Query(
            "SELECT 1 FROM sessions s JOIN group_enrollments e ON e.group_id=s.group_id WHERE s.teacher_id=$1 AND s.starts_at>now() AND e.status IN ('active','leaving','awaiting_payment') LIMIT 1",
            [d.teacherId],
          )
        ).length,
        'Resuelve primero la continuidad de las clases.',
      );
      assert(t.status !== 'departed', 'La colaboración ya terminó.');
      statements.push({
        sql: 'UPDATE teacher_profiles SET status=$2,published=0 WHERE user_id=$1',
        values: [
          d.teacherId,
          d.action === 'depart' ? 'departed' : d.action === 'pause' ? 'paused' : 'suspended',
        ],
      });
      if (d.action === 'depart')
        statements.push({
          sql: 'INSERT INTO teacher_departures(teacher_id,cycle,reason,effective_at) VALUES($1,$2,$3,now())',
          values: [d.teacherId, t.cycle, d.reason],
        });
    }
    statements.push(
      {
        sql: 'INSERT INTO teacher_status_history(teacher_id,status,reason,actor_id) VALUES($1,$2,$3,$4)',
        values: [d.teacherId, d.action, d.reason, user.id],
      },
      auditStatement(user.id, d.action, 'teacher', d.teacherId, { reason: d.reason }),
    );
    await atomic(statements);
    return done('Cambio docente registrado.');
  }
  if (path === 'admin/review') {
    const d = z
      .object({
        reviewId: id,
        status: z.enum(['published', 'hidden', 'removed']),
        reason: z.string().min(10).max(2000),
      })
      .parse(await data(request));
    await atomic([
      { sql: 'UPDATE reviews SET status=$2 WHERE id=$1', values: [d.reviewId, d.status] },
      {
        sql: 'INSERT INTO review_moderation_actions(review_id,actor_id,action,reason) VALUES($1,$2,$3,$4)',
        values: [d.reviewId, user.id, d.status, d.reason],
      },
      auditStatement(user.id, 'moderate', 'review', d.reviewId, { reason: d.reason }),
    ]);
    return done('Moderación registrada.');
  }
  if (path === 'admin/campaign') {
    const d = z
      .object({
        name: z.string().min(3).max(100),
        code: z.string().regex(/^[a-z0-9-]{3,80}$/),
        city: z.string().max(100),
        channel: z.string().min(2).max(100),
      })
      .parse(await data(request));
    await atomic([
      {
        sql: 'INSERT INTO campaigns(name,code,city,channel) VALUES($1,$2,$3,$4)',
        values: [d.name, d.code, d.city, d.channel],
      },
      auditStatement(user.id, 'create_campaign', 'campaign', d.code),
    ]);
    return done(`Campaña creada: ${process.env.APP_URL}/clases?campana=${d.code}`);
  }
  if (path === 'admin/session') {
    const d = z.object({ sessionId: id, videoUrl: z.url() }).parse(await data(request));
    validateClassVideo(d.videoUrl);
    await atomic([
      { sql: 'UPDATE sessions SET video_url=$2 WHERE id=$1', values: [d.sessionId, d.videoUrl] },
      auditStatement(user.id, 'set_video', 'session', d.sessionId),
    ]);
    return done('Enlace privado actualizado.');
  }
  throw new DomainError('Esta operación aún no está habilitada.', 503);
}
