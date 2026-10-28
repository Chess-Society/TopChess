'use client';
import { Select } from '@/components/select';
import { useState } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Bell,
  FileCheck2,
  GraduationCap,
  MessageSquare,
  ChartNoAxesCombined,
  Settings2,
  ArrowUpRight,
} from 'lucide-react';
import { ActionForm, Logout } from './action-form';
import { SettlementsPanel, type SettlementsData } from './settlements-panel';
import { TeacherBankForm } from './teacher-bank';
import { TeacherAvailabilityForm } from './teacher-availability';
import type { Availability } from '@/lib/teacher-availability';
import { money, type Role } from '@/lib/domain';
type Row = { [key: string]: string | number | boolean | null | undefined };
export type DashboardData = {
  teacherAvailability?: Availability[];
  billing?: { enabled: boolean; legalReady: boolean };
  teaching?: DashboardData;
  enrollments?: Row[];
  sessions?: Row[];
  notifications?: Row[];
  payments?: Row[];
  applications?: Row[];
  profile?: Row;
  groups?: Row[];
  availability?: Row[];
  income?: Row;
  stats?: Row;
  teachers?: Row[];
  incidents?: Row[];
  reviews?: Row[];
  campaigns?: Row[];
  withdrawals?: Row[];
  roster?: Row[];
  settlements?: SettlementsData | null;
};
const labels: Record<string, string> = {
  reserved: 'Pendiente de alumnos',
  awaiting_payment: 'Pendiente de contratación',
  active: 'Activo',
  leaving: 'Renovación cancelada',
  left: 'Finalizada',
  expired: 'Plazo finalizado',
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  published: 'Publicado',
  full: 'Completo',
  draft: 'Borrador',
  scheduled: 'Programada',
  taught: 'Impartida',
  teacher_absent: 'Incidencia del profesor',
  cancelled: 'Cancelado',
  past_due: 'Pago pendiente',
  paid: 'Pagado',
  failed: 'Fallido',
  received: 'Recibida',
  documents: 'Pendiente de documentación',
  review: 'En revisión',
  references: 'Comprobación de referencias',
  interview: 'Entrevista pendiente',
  trial: 'Clase de prueba',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
  hidden: 'Oculta',
  removed: 'Retirada',
  suspended: 'Suspendido',
  paused: 'Pausa autorizada',
  departed: 'Baja definitiva',
  inactive: 'Inactivo',
};
function Status({ value }: { value: unknown }) {
  return (
    <span className="status-chip">{labels[String(value)] || String(value || 'Pendiente')}</span>
  );
}
function Empty({ text = 'Todavía no hay registros.' }: { text?: string }) {
  return <p className="panel-empty">{text}</p>;
}
function Metric({ title, value, note }: { title: string; value: string | number; note?: string }) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function Table({ rows, columns }: { rows: Row[]; columns: [string, string][] }) {
  return rows.length ? (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id || i)}>
              {columns.map(([key]) => (
                <td key={key}>
                  {key === 'status' ? (
                    <Status value={r[key]} />
                  ) : key.endsWith('_at') || key === 'effective_at' ? (
                    r[key] ? (
                      new Date(String(r[key])).toLocaleDateString('es-ES', {
                        timeZone: 'Europe/Madrid',
                      })
                    ) : (
                      '—'
                    )
                  ) : (
                    String(r[key] ?? '—')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
function Sessions({ items, teacher = false }: { items: Row[]; teacher?: boolean }) {
  return (
    <section className="panel">
      <h2>{teacher ? 'Tu agenda docente' : 'Tus próximas clases'}</h2>
      {items.length === 0 ? (
        <Empty text="Cuando tengas un grupo confirmado, aquí verás sus fechas." />
      ) : (
        items.map((s) => {
          const date = new Date(String(s.starts_at));
          return (
            <div className="session-row" key={String(s.id)}>
              <div className="session-date">
                <b>
                  {date.toLocaleDateString('es', { day: '2-digit', timeZone: 'Europe/Madrid' })}
                </b>
                <small>
                  {date.toLocaleDateString('es', { month: 'short', timeZone: 'Europe/Madrid' })}
                </small>
              </div>
              <div className="session-info">
                <strong>{s.title}</strong>
                <p>
                  {date.toLocaleString('es-ES', {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Madrid',
                  })}{' '}
                  · Madrid {s.teacher_name && `· ${s.teacher_name}`}
                </p>
              </div>
              {s.video_url ? (
                <a
                  href={String(s.video_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="button ghost"
                >
                  Acceder a clase <ArrowUpRight size={13} />
                </a>
              ) : (
                <Status value={s.status} />
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
export function Dashboard({
  user,
  data: initialData,
}: {
  user: { id: string; name: string; email: string | null; role: Role; verified: boolean };
  data: DashboardData;
}) {
  const adminAccount = ['admin', 'superadmin'].includes(user.role);
  const [space, setSpace] = useState<'admin' | 'teacher'>('admin');
  const admin = adminAccount && space === 'admin',
    teacher = user.role === 'teacher' || (adminAccount && space === 'teacher'),
    student = user.role === 'student';
  const data = adminAccount && teacher ? initialData.teaching || {} : initialData;
  const [tab, setTab] = useState('overview');
  const tabs = admin
    ? ([
        ['overview', 'Vista general', LayoutDashboard],
        ['applications', 'Candidaturas', FileCheck2],
        ['teachers', 'Profesores', GraduationCap],
        ['groups', 'Grupos y clases', CalendarDays],
        ['settlements', 'Pagos a profesores', CreditCard],
        ['reviews', 'Reseñas', MessageSquare],
        ['campaigns', 'Campañas', ChartNoAxesCombined],
        ['withdrawals', 'Bajas y cambios', Users],
        ['incidents', 'Incidencias', Bell],
      ] as const)
    : teacher
      ? ([
          ['overview', 'Mi academia', LayoutDashboard],
          ['sessions', 'Mis clases', CalendarDays],
          ['groups', 'Grupos y alumnos', Users],
          ['availability', 'Disponibilidad', Settings2],
          ['income', 'Mis ingresos', CreditCard],
        ] as const)
      : student
        ? ([
            ['overview', 'Mi academia', LayoutDashboard],
            ['sessions', 'Calendario', CalendarDays],
            ['enrollments', 'Mis grupos', Users],
            ['payments', 'Suscripciones y pagos', CreditCard],
            ['notifications', 'Notificaciones', Bell],
          ] as const)
        : ([['overview', 'Mi candidatura', FileCheck2]] as const);
  return (
    <div className="dashboard">
      {adminAccount && (
        <div className="workspace-switch" role="group" aria-label="Cambiar espacio">
          <button
            type="button"
            className={space === 'admin' ? 'active' : ''}
            aria-pressed={space === 'admin'}
            onClick={() => {
              setSpace('admin');
              setTab('overview');
            }}
          >
            Administración
          </button>
          <button
            type="button"
            className={space === 'teacher' ? 'active' : ''}
            aria-pressed={space === 'teacher'}
            onClick={() => {
              setSpace('teacher');
              setTab('overview');
            }}
          >
            Profesor
          </button>
        </div>
      )}
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">TU ESPACIO TOPCHESS</span>
          <h1>Hola, {user.name.split(' ')[0]}.</h1>
          <p>
            {admin
              ? 'Todo lo que mueve tu academia.'
              : teacher
                ? 'Tu enseñanza, con todo en su sitio.'
                : 'Un paso más cerca de tu siguiente jugada.'}
          </p>
        </div>
        <span className="role-badge">
          {admin ? 'Administración' : teacher ? 'Profesor' : student ? 'Alumno' : 'Candidato'}
        </span>
      </div>
      {!user.verified && (
        <div className="notice">
          <strong>Completa tu nombre real para continuar.</strong>
          <p>En las clases se mostrará tu nombre y apellidos, no tu alias de Lichess.</p>
          <Link className="text-link" href="/completar-perfil">
            Completar mi perfil
          </Link>
        </div>
      )}
      <div className="dashboard-wrap">
        <aside className="dashboard-nav" aria-label="Secciones del panel">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={tab === id ? 'active' : ''}
              aria-pressed={tab === id}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          <Link className="profile-settings-link" href="/completar-perfil">
            Mi nombre y perfil <ArrowUpRight size={14} />
          </Link>
          <Logout />
        </aside>
        <div className="dashboard-content">
          {student && (
            <>
              {tab === 'overview' && (
                <>
                  <div className="metric-grid">
                    <Metric
                      title="MIS GRUPOS"
                      value={
                        (data.enrollments || []).filter((e) =>
                          ['active', 'awaiting_payment', 'reserved', 'leaving'].includes(
                            String(e.status),
                          ),
                        ).length
                      }
                    />
                    <Metric
                      title="CLASES DEL CICLO"
                      value="4"
                      note="Por cada suscripción contratada"
                    />
                    <Metric
                      title="PRÓXIMAS FECHAS"
                      value={
                        (data.sessions || []).filter(
                          (s) => new Date(String(s.starts_at)) > new Date(),
                        ).length
                      }
                      note="Consulta tu calendario"
                    />
                  </div>
                  <Sessions items={(data.sessions || []).slice(0, 4)} />
                  <section className="panel">
                    <h2>Tu aprendizaje, con continuidad</h2>
                    <p>
                      Una ausencia consume la sesión. Si la incidencia es de la academia, abriremos
                      una solución. Los cambios y las cancelaciones se gestionan por separado.
                    </p>
                    <Link className="text-link" href="/clases">
                      Encuentra otro grupo <ArrowUpRight size={15} />
                    </Link>
                  </section>
                </>
              )}
              {tab === 'sessions' && <Sessions items={data.sessions || []} />}
              {(tab === 'enrollments' || tab === 'payments') && (
                <>
                  <section className="panel">
                    <h2>{tab === 'payments' ? 'Tus suscripciones' : 'Tus grupos'}</h2>
                    {!data.enrollments?.length ? (
                      <>
                        <Empty text="Aún no has solicitado plaza en un grupo." />
                        <Link className="button ghost" href="/clases">
                          Buscar mi grupo <ArrowUpRight size={16} />
                        </Link>
                      </>
                    ) : (
                      data.enrollments.map((e) => (
                        <div className="enrollment-item" key={String(e.id)}>
                          <div className="data-row">
                            <div>
                              <strong>{e.title}</strong>
                              <p>
                                {e.teacher_name} · {e.level}
                              </p>
                            </div>
                            <Status value={e.subscription_status || e.status} />
                          </div>
                          {e.setup_completed_at && !e.cancel_at_period_end && (
                            <p className="small-text">
                              Método de pago autorizado. Cuotas de 50 €/mes, IVA incluido, desde el
                              día 1 del mes de incorporación, sujeto al mínimo del grupo.
                            </p>
                          )}
                          {e.status === 'awaiting_payment' &&
                            !e.setup_completed_at &&
                            !e.cancel_at_period_end && (
                              <details>
                                <summary>
                                  Formalizar matrícula · 50 €/mes<span>+</span>
                                </summary>
                                <ActionForm
                                  endpoint="/api/checkout"
                                  label="Autorizar método de pago"
                                >
                                  <input type="hidden" name="enrollmentId" value={String(e.id)} />
                                  <h3>Datos para tu factura</h3>
                                  <label>
                                    Nombre completo o razón social
                                    <input
                                      name="billingName"
                                      defaultValue={user.name}
                                      minLength={3}
                                      maxLength={150}
                                      required
                                      autoComplete="billing name"
                                    />
                                  </label>
                                  <label>
                                    NIF / DNI / NIE
                                    <input
                                      name="billingTaxId"
                                      minLength={5}
                                      maxLength={30}
                                      required
                                      autoComplete="off"
                                    />
                                  </label>
                                  <label>
                                    Dirección fiscal
                                    <input
                                      name="billingStreet"
                                      minLength={4}
                                      maxLength={180}
                                      required
                                      autoComplete="billing street-address"
                                    />
                                  </label>
                                  <label>
                                    Localidad
                                    <input
                                      name="billingCity"
                                      minLength={2}
                                      maxLength={100}
                                      required
                                      autoComplete="billing address-level2"
                                    />
                                  </label>
                                  <label>
                                    Código postal
                                    <input
                                      name="billingPostalCode"
                                      minLength={3}
                                      maxLength={15}
                                      required
                                      autoComplete="billing postal-code"
                                    />
                                  </label>
                                  <input type="hidden" name="billingCountry" value="ES" />
                                  <p className="small-text">
                                    Facturación en España. Si necesitas otros datos fiscales,
                                    contacta con TopChess antes de contratar.
                                  </p>
                                  <label className="check-label">
                                    <input type="checkbox" name="terms" required />
                                    <span>
                                      Confirmo las fechas de mi grupo y acepto las{' '}
                                      <Link href="/legal/condiciones">
                                        condiciones de contratación
                                      </Link>
                                      . Autorizo 50 €/mes, impuestos aplicables incluidos, desde el
                                      día 1 del mes de incorporación. Hoy no se cobra. Las
                                      renovaciones son el día 1 y requieren continuidad del grupo.
                                    </span>
                                  </label>
                                  <Link className="text-link" href={`/clases/${e.group_id}`}>
                                    Revisar las cuatro fechas
                                  </Link>
                                </ActionForm>
                              </details>
                            )}
                          {['active', 'leaving', 'awaiting_payment', 'reserved'].includes(
                            String(e.status),
                          ) && (
                            <details>
                              <summary>
                                Dejar este grupo o cancelar renovaciones<span>+</span>
                              </summary>
                              <p>
                                Cancelar la renovación mantiene el acceso hasta el fin del periodo
                                abonado. No devuelve clases consumidas ni genera recuperaciones
                                automáticas. Los cambios de grupo requieren coordinación para evitar
                                doble disfrute.
                              </p>
                              <ActionForm
                                endpoint={
                                  e.subscription_status ? '/api/cancel-renewal' : '/api/withdraw'
                                }
                                label={
                                  e.subscription_status
                                    ? 'Cancelar futuras renovaciones'
                                    : 'Registrar solicitud'
                                }
                              >
                                <input type="hidden" name="enrollmentId" value={String(e.id)} />
                                {!e.subscription_status && (
                                  <label>
                                    Qué necesitas
                                    <Select name="kind">
                                      <option value="cancel_renewal">
                                        Retirar solicitud de plaza
                                      </option>
                                      <option value="change_teacher">Cambiar de profesor</option>
                                      <option value="change_group">Buscar otro grupo</option>
                                      <option value="wait">
                                        Permanecer temporalmente sin grupo
                                      </option>
                                    </Select>
                                  </label>
                                )}
                                <label>
                                  Motivo opcional
                                  <textarea name="reason" rows={2} maxLength={2000} />
                                  <small>
                                    Solo personal autorizado de TopChess podrá consultar este
                                    motivo.
                                  </small>
                                </label>
                                <label className="check-label">
                                  <input required type="checkbox" />
                                  <span>
                                    Entiendo las consecuencias y quiero confirmar la solicitud.
                                  </span>
                                </label>
                              </ActionForm>
                            </details>
                          )}
                          {e.current_period_end && (
                            <p className="small-text">
                              Fin del periodo:{' '}
                              {new Date(String(e.current_period_end)).toLocaleDateString('es-ES', {
                                timeZone: 'Europe/Madrid',
                              })}
                              .{' '}
                              {e.cancel_at_period_end
                                ? 'No habrá renovación.'
                                : 'Consulta el estado de tu cuota en el panel.'}
                            </p>
                          )}
                          <details>
                            <summary>
                              Valorar a mi profesor<span>+</span>
                            </summary>
                            <ActionForm
                              endpoint="/api/reviews"
                              label="Enviar reseña"
                              transform={(f) => ({
                                enrollmentId: f.get('enrollmentId'),
                                rating: Number(f.get('rating')),
                                comment: f.get('comment'),
                              })}
                            >
                              <input type="hidden" name="enrollmentId" value={String(e.id)} />
                              <label>
                                Tu valoración
                                <Select name="rating">
                                  <option value="5">5 · Excelente</option>
                                  <option value="4">4 · Muy buena</option>
                                  <option value="3">3 · Buena</option>
                                  <option value="2">2 · Mejorable</option>
                                  <option value="1">1 · Insatisfactoria</option>
                                </Select>
                              </label>
                              <label>
                                Comentario opcional
                                <textarea name="comment" maxLength={2000} rows={3} />
                              </label>
                              <p className="small-text">
                                Solo disponible después de asistir a una clase impartida. Una reseña
                                por matrícula.
                              </p>
                            </ActionForm>
                          </details>
                        </div>
                      ))
                    )}
                  </section>
                  {tab === 'payments' && (
                    <section className="panel">
                      <h2>Pagos y facturas</h2>
                      {data.payments?.length ? (
                        data.payments.map((p) => (
                          <div className="data-row" key={String(p.id)}>
                            <div>
                              <strong>{money(Number(p.amount_cents))}</strong>
                              <p>
                                {p.paid_at
                                  ? new Date(String(p.paid_at)).toLocaleDateString('es-ES')
                                  : 'Pendiente'}
                              </p>
                            </div>
                            <Status value={p.status} />
                            {p.invoice_number && (
                              <p>
                                Factura {p.invoice_number} ·{' '}
                                {new Date(String(p.invoice_date)).toLocaleDateString('es-ES')}
                              </p>
                            )}
                            {p.invoice_pdf && (
                              <a
                                className="text-link"
                                href={`/api/invoices/${p.id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Descargar factura PDF <ArrowUpRight size={14} />
                              </a>
                            )}
                          </div>
                        ))
                      ) : (
                        <Empty text="No hay pagos registrados. Una reserva pendiente no genera cargos." />
                      )}
                    </section>
                  )}
                </>
              )}
              {tab === 'notifications' && (
                <section className="panel">
                  <h2>Lo importante, a mano</h2>
                  {data.notifications?.length ? (
                    data.notifications.map((n) => (
                      <div className="data-row" key={String(n.id)}>
                        <div>
                          <strong>{n.title}</strong>
                          <p>{n.body}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty text="No tienes notificaciones." />
                  )}
                </section>
              )}
            </>
          )}
          {teacher && (
            <>
              {adminAccount && tab === 'overview' && (
                <section className="panel">
                  <h2>Mi perfil de profesor</h2>
                  <p>
                    Imparte clases con tu misma cuenta. Conservas el acceso a toda la administración
                    de TopChess.
                  </p>
                  <ActionForm
                    endpoint="/api/admin/teaching-profile"
                    label="Guardar mi perfil docente"
                  >
                    <label>
                      Presentación breve
                      <input
                        name="headline"
                        defaultValue={String(data.profile?.headline || '')}
                        minLength={3}
                        maxLength={150}
                        required
                      />
                    </label>
                    <label>
                      Sobre mí
                      <textarea
                        name="bio"
                        defaultValue={String(data.profile?.bio || '')}
                        minLength={80}
                        maxLength={3000}
                        required
                      />
                    </label>
                    <label>
                      Idiomas (separados por comas)
                      <input
                        name="languages"
                        defaultValue={String(data.profile?.languages || '')}
                        minLength={2}
                        maxLength={200}
                        required
                      />
                    </label>
                    <label>
                      Niveles que enseño (separados por comas)
                      <input
                        name="levels"
                        defaultValue={String(data.profile?.levels || '')}
                        minLength={2}
                        maxLength={200}
                        required
                      />
                    </label>
                    <label className="check-label">
                      <input type="checkbox" name="approved" required />
                      Confirmo mi alta y los requisitos docentes de mi escuela.
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        name="published"
                        defaultChecked={Boolean(data.profile?.published)}
                      />
                      Mostrar mi ficha en Nuestros profesores.
                    </label>
                  </ActionForm>
                </section>
              )}
              {tab === 'overview' && (
                <>
                  <div className="metric-grid">
                    <Metric title="MIS GRUPOS" value={data.groups?.length || 0} />
                    <Metric
                      title="TU PARTICIPACIÓN"
                      value={`${Number(data.profile?.teacher_bps || 5000) / 100} %`}
                      note="Sobre cada cuota completa de 50 €"
                    />
                    <Metric
                      title="CICLO PROFESIONAL"
                      value={Number(data.profile?.cycle || 1)}
                      note="Histórico conservado"
                    />
                  </div>
                  <Sessions items={(data.sessions || []).slice(0, 4)} teacher />
                </>
              )}
              {tab === 'sessions' && (
                <>
                  <Sessions items={data.sessions || []} teacher />
                  <section className="panel">
                    <h2>Registrar el resultado de una clase</h2>
                    <ActionForm endpoint="/api/sessions/report" label="Guardar resultado">
                      <label>
                        Sesión
                        <Select name="sessionId" required>
                          <option value="">Selecciona una sesión</option>
                          {data.sessions?.map((s) => (
                            <option value={String(s.id)} key={String(s.id)}>
                              {s.title} · {new Date(String(s.starts_at)).toLocaleString('es-ES')}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label>
                        Resultado
                        <Select name="status">
                          <option value="taught">Clase impartida</option>
                          <option value="teacher_absent">No impartida por el profesor</option>
                        </Select>
                      </label>
                      <label>
                        Descripción de incidencia (si corresponde)
                        <textarea name="description" rows={3} maxLength={3000} />
                      </label>
                    </ActionForm>
                  </section>
                  <section className="panel">
                    <h2>Asistencia del alumnado</h2>
                    <ActionForm endpoint="/api/attendance" label="Registrar asistencia">
                      <label>
                        Clase impartida
                        <Select name="sessionId" required>
                          <option value="">Selecciona una clase</option>
                          {data.sessions
                            ?.filter((s) => s.status === 'taught')
                            .map((s) => (
                              <option value={String(s.id)} key={String(s.id)}>
                                {s.title} ·{' '}
                                {new Date(String(s.starts_at)).toLocaleDateString('es-ES')}
                              </option>
                            ))}
                        </Select>
                      </label>
                      <label>
                        Alumno asignado
                        <Select name="studentId" required>
                          <option value="">Selecciona un alumno</option>
                          {data.roster?.map((s, i) => (
                            <option value={String(s.student_id)} key={i}>
                              {s.name} · {s.title}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label>
                        Asistencia
                        <Select name="status">
                          <option value="present">Presente</option>
                          <option value="absent">Ausente · sesión consumida</option>
                        </Select>
                      </label>
                    </ActionForm>
                  </section>
                </>
              )}
              {tab === 'groups' && (
                <>
                  <section className="panel">
                    <h2>Tus grupos</h2>
                    <Table
                      rows={data.groups || []}
                      columns={[
                        ['title', 'Grupo'],
                        ['level', 'Nivel'],
                        ['students', 'Alumnos'],
                        ['status', 'Estado'],
                      ]}
                    />
                  </section>
                  <section className="panel">
                    <h2>Alumnos asignados</h2>
                    <Table
                      rows={data.roster || []}
                      columns={[
                        ['name', 'Alumno'],
                        ['title', 'Grupo'],
                        ['level', 'Nivel'],
                      ]}
                    />
                    <p className="private-note">
                      Solo se muestran los datos necesarios para impartir las clases.
                    </p>
                  </section>
                </>
              )}
              {tab === 'availability' && (
                <TeacherAvailabilityForm
                  slots={(data.availability || []).map((s) => ({
                    id: String(s.id),
                    teacher_id: user.id,
                    weekday: Number(s.weekday),
                    start_time: String(s.start_time),
                    end_time: String(s.end_time),
                    timezone: String(s.timezone || 'Europe/Madrid'),
                    approved: Boolean(s.approved),
                  }))}
                />
              )}
              {tab === 'income' && (
                <>
                  <SettlementsPanel data={data.settlements} />
                  <TeacherBankForm />
                  <div className="metric-grid">
                    <Metric
                      title="TU PORCENTAJE"
                      value={`${Number(data.profile?.teacher_bps || 5000) / 100} %`}
                    />
                    <Metric
                      title="COMISIÓN TOPCHESS"
                      value={`${100 - Number(data.profile?.teacher_bps || 5000) / 100} %`}
                    />
                    <Metric
                      title="ASIGNACIONES REGISTRADAS"
                      value={money(Number(data.income?.allocated || 0))}
                      note="No equivale a beneficio neto"
                    />
                  </div>
                  <section className="panel">
                    <h2>Tu progresión</h2>
                    <p>
                      Los ascensos requieren alumnos únicos con suscripción pagada y activa durante
                      dos periodos consecutivos. Los tramos deben configurarse y aprobarse en el
                      acuerdo profesional antes de activarlos.
                    </p>
                    <div className="notice">
                      TopChess realiza los pagos a profesores por transferencia manual. El panel
                      distingue los importes generados y los pagos registrados; no necesitas una
                      cuenta de Stripe.
                    </div>
                    <p>
                      Una baja definitiva cierra tu ciclo de progresión. La readmisión comienza con
                      reparto 50/50; vacaciones o pausas autorizadas no reinician tu porcentaje.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
          {user.role === 'candidate' && (
            <section className="candidate-state">
              <span className="eyebrow">TU SOLICITUD, CON TRANSPARENCIA</span>
              <h2>
                {data.applications?.length
                  ? 'Gracias por querer enseñar.'
                  : 'Prepara tu candidatura.'}
              </h2>
              <p>
                {data.applications?.length
                  ? 'TopChess revisará tu candidatura. La recepción no implica aprobación ni publicación.'
                  : 'Has elegido el perfil de profesor. Completa la solicitud para que TopChess pueda revisarla; todavía no se ha enviado ninguna candidatura.'}
              </p>
              {data.applications?.map((a) => (
                <p key={String(a.id)}>
                  <Status value={a.status} />
                </p>
              ))}
              <p>
                Podremos solicitar documentación, entrevista o clase de prueba durante el proceso.
              </p>
              {!data.applications?.length && (
                <Link className="button" href="/ser-profesor">
                  Presentar mi candidatura <ArrowUpRight size={16} />
                </Link>
              )}
            </section>
          )}
          {admin && (
            <>
              {tab === 'settlements' && <SettlementsPanel data={data.settlements} admin />}
              {tab === 'overview' && (
                <>
                  <div className="metric-grid">
                    <Metric title="ALUMNOS REGISTRADOS" value={Number(data.stats?.students || 0)} />
                    <Metric
                      title="SUSCRIPCIONES ACTIVAS"
                      value={Number(data.stats?.subscriptions || 0)}
                    />
                    <Metric
                      title="COBROS REGISTRADOS"
                      value={money(Number(data.stats?.gross || 0))}
                      note="No es beneficio neto"
                    />
                    <Metric title="PROFESORES ACTIVOS" value={Number(data.stats?.teachers || 0)} />
                    <Metric title="GRUPOS ACTIVOS" value={Number(data.stats?.groups || 0)} />
                    <Metric
                      title="CANDIDATURAS ABIERTAS"
                      value={Number(data.stats?.applications || 0)}
                    />
                  </div>
                  <section className="panel">
                    <h2>Prioridad: continuidad y confianza</h2>
                    <ActionForm
                      endpoint="/api/admin/billing-check"
                      label="Comprobar conexión con Stripe"
                    >
                      <p className="small-text">
                        Verifica la conexión, el precio y el IVA sin realizar cargos.
                      </p>
                    </ActionForm>
                    <p>
                      Revisa grupos pendientes, incidencias docentes y bajas antes de realizar
                      nuevos cobros o cerrar liquidaciones. Los indicadores de retención no son una
                      evaluación automática de calidad.
                    </p>
                    <div className="notice">
                      <strong>
                        Cobros mensuales:{' '}
                        {data.billing?.enabled && data.billing?.legalReady
                          ? 'activados'
                          : 'desactivados'}
                        .
                      </strong>{' '}
                      Stripe gestiona las cuotas de los alumnos. Las transferencias a profesores las
                      realiza TopChess manualmente y se registran en «Pagos a profesores». Los
                      cobros requieren completar la configuración y las pruebas antes de activarse.
                    </div>
                  </section>
                </>
              )}
              {tab === 'applications' && (
                <section className="panel">
                  <h2>Candidaturas</h2>
                  {!data.applications?.length ? (
                    <Empty />
                  ) : (
                    data.applications.map((a) => (
                      <details key={String(a.id)}>
                        <summary>
                          <span>
                            <strong>{a.name}</strong> · {a.country}
                          </span>
                          <Status value={a.status} />
                        </summary>
                        <p>{a.email}</p>
                        <p>
                          <strong>Experiencia</strong>
                          <br />
                          {a.experience}
                        </p>
                        <p>
                          <strong>Presentación</strong>
                          <br />
                          {a.presentation}
                        </p>
                        <p>
                          <strong>Disponibilidad</strong>
                          <br />
                          {a.availability}
                        </p>
                        <a className="text-link" href={`/api/applications/${a.id}/cv`}>
                          Descargar CV privado <ArrowUpRight size={15} />
                        </a>
                        {!['approved', 'rejected', 'withdrawn'].includes(String(a.status)) && (
                          <ActionForm
                            endpoint="/api/admin/application"
                            label="Actualizar expediente"
                          >
                            <input type="hidden" name="applicationId" value={String(a.id)} />
                            <label>
                              Nuevo estado
                              <Select name="status">
                                {[
                                  'documents',
                                  'review',
                                  'references',
                                  'interview',
                                  'trial',
                                  'approved',
                                  'rejected',
                                ].map((s) => (
                                  <option key={s} value={s}>
                                    {labels[s]}
                                  </option>
                                ))}
                              </Select>
                            </label>
                            <label>
                              Motivo administrativo
                              <textarea
                                name="reason"
                                minLength={5}
                                maxLength={2000}
                                required
                                rows={2}
                              />
                            </label>
                            <label className="check-label">
                              <input type="checkbox" name="agreement" />
                              Acuerdo profesional aceptado (obligatorio para aprobar)
                            </label>
                            <label className="check-label">
                              <input type="checkbox" name="verified" />
                              Requisitos administrativos verificados (obligatorio para aprobar)
                            </label>
                          </ActionForm>
                        )}
                      </details>
                    ))
                  )}
                </section>
              )}
              {tab === 'teachers' && (
                <section className="panel">
                  <h2>Equipo docente</h2>
                  {!data.teachers?.length ? (
                    <Empty />
                  ) : (
                    data.teachers.map((t) => (
                      <details key={String(t.id)}>
                        <summary>
                          <span>
                            {t.name} · {Number(t.teacher_bps) / 100} %
                          </span>
                          <Status value={t.status} />
                        </summary>
                        <p>
                          Perfil público: {t.published ? 'Sí' : 'No'} · Ciclo profesional: {t.cycle}
                        </p>
                        <h3>Disponibilidad semanal · Madrid</h3>
                        {data.teacherAvailability?.some((s) => s.teacher_id === t.id) ? (
                          <ul className="availability-list">
                            {data.teacherAvailability
                              .filter((s) => s.teacher_id === t.id)
                              .map((s) => (
                                <li key={s.id}>
                                  <strong>
                                    {
                                      [
                                        'Lunes',
                                        'Martes',
                                        'Miércoles',
                                        'Jueves',
                                        'Viernes',
                                        'Sábado',
                                        'Domingo',
                                      ][s.weekday - 1]
                                    }
                                  </strong>
                                  <span>
                                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                                    {!s.approved
                                      ? ' · Pendiente de publicar'
                                      : !t.published
                                        ? ' · Perfil privado'
                                        : ''}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p>El profesor todavía no ha indicado sus horarios.</p>
                        )}
                        <ActionForm endpoint="/api/admin/teacher" label="Aplicar cambio">
                          <input type="hidden" name="teacherId" value={String(t.id)} />
                          <label>
                            Acción
                            <Select name="action">
                              <option value="publish">Autorizar publicación</option>
                              <option value="pause">Pausa autorizada</option>
                              <option value="suspend">Suspensión provisional</option>
                              <option value="depart">Baja definitiva</option>
                              <option value="readmit">Readmitir · nuevo ciclo 50/50</option>
                            </Select>
                          </label>
                          <label>
                            Motivo
                            <textarea
                              name="reason"
                              required
                              minLength={5}
                              maxLength={2000}
                              rows={2}
                            />
                          </label>
                          <label className="check-label">
                            <input type="checkbox" name="agreement" />
                            Nuevo acuerdo aceptado (readmisión)
                          </label>
                          <label className="check-label">
                            <input type="checkbox" required />
                            He revisado el impacto y la continuidad de las clases.
                          </label>
                        </ActionForm>
                      </details>
                    ))
                  )}
                </section>
              )}
              {tab === 'groups' && (
                <>
                  <section className="panel">
                    <h2>Grupos de la academia</h2>
                    <Table
                      rows={data.groups || []}
                      columns={[
                        ['title', 'Grupo'],
                        ['teacher_name', 'Profesor'],
                        ['first_at', 'Inicio'],
                        ['status', 'Estado'],
                      ]}
                    />
                  </section>
                  <section className="panel">
                    <h2>Publicar un nuevo grupo</h2>
                    <p>
                      El grupo empieza el mes siguiente, con cuatro clases por mes, horario fijo y
                      entre dos y cuatro alumnos. El calendario se prepara para doce meses y la
                      inscripción cierra 48 horas antes del día 1. Indica la hora de Madrid.
                    </p>
                    <ActionForm
                      endpoint="/api/admin/groups"
                      label="Validar calendario y publicar"
                      transform={(f) => ({
                        teacherId: f.get('teacherId'),
                        title: f.get('title'),
                        level: f.get('level'),
                        language: f.get('language'),
                        capacity: Number(f.get('capacity')),
                        firstAt: fromZonedTime(
                          String(f.get('firstAt')),
                          'Europe/Madrid',
                        ).toISOString(),
                        duration: Number(f.get('duration')),
                        timezone: 'Europe/Madrid',
                        excludedDates: String(f.get('excludedDates') || '')
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })}
                    >
                      <label>
                        Profesor aprobado
                        <Select name="teacherId" required>
                          <option value="">Selecciona un profesor</option>
                          {data.teachers
                            ?.filter(
                              (t) =>
                                t.status === 'active' &&
                                t.published &&
                                t.agreement_at &&
                                t.verified_at,
                            )
                            .map((t) => (
                              <option key={String(t.id)} value={String(t.id)}>
                                {t.name}
                              </option>
                            ))}
                        </Select>
                      </label>
                      <label>
                        Nombre del grupo
                        <input name="title" minLength={5} maxLength={120} required />
                      </label>
                      <div className="form-row">
                        <label>
                          Nivel
                          <Select name="level">
                            <option>Principiante</option>
                            <option>Intermedio</option>
                            <option>Avanzado</option>
                          </Select>
                        </label>
                        <label>
                          Idioma
                          <input name="language" defaultValue="Español" required />
                        </label>
                      </div>
                      <label>
                        Primera clase · hora de Madrid
                        <input name="firstAt" type="datetime-local" required />
                        <small>
                          Elige una fecha del mes siguiente. Se mantendrá el día y la hora semanal.
                        </small>
                      </label>
                      <div className="form-row">
                        <label>
                          Capacidad
                          <input
                            type="number"
                            name="capacity"
                            min={2}
                            max={4}
                            defaultValue={4}
                            required
                          />
                        </label>
                        <label>
                          Duración (min)
                          <input
                            type="number"
                            name="duration"
                            min={30}
                            max={180}
                            defaultValue={60}
                            required
                          />
                        </label>
                      </div>
                      <label>
                        Festivos y excepciones · YYYY-MM-DD, separados por coma
                        <input name="excludedDates" placeholder="2026-12-25, 2027-01-01" />
                      </label>
                    </ActionForm>
                  </section>
                  <section className="panel">
                    <h2>Enlace de videoclase</h2>
                    <ActionForm endpoint="/api/admin/session" label="Guardar enlace privado">
                      <label>
                        Identificador de sesión
                        <input name="sessionId" required />
                      </label>
                      <label>
                        URL HTTPS autorizada
                        <input name="videoUrl" type="url" required />
                      </label>
                    </ActionForm>
                  </section>
                </>
              )}
              {tab === 'reviews' && (
                <section className="panel">
                  <h2>Reseñas y moderación</h2>
                  {!data.reviews?.length ? (
                    <Empty />
                  ) : (
                    data.reviews.map((r) => (
                      <details key={String(r.id)}>
                        <summary>
                          <span>
                            {r.name} · {r.rating}/5
                          </span>
                          <Status value={r.status} />
                        </summary>
                        <p>{r.comment || 'Sin comentario escrito.'}</p>
                        <ActionForm endpoint="/api/admin/review" label="Registrar moderación">
                          <input type="hidden" name="reviewId" value={String(r.id)} />
                          <label>
                            Acción
                            <Select name="status">
                              <option value="published">Publicar</option>
                              <option value="hidden">Ocultar durante investigación</option>
                              <option value="removed">Retirar por infracción</option>
                            </Select>
                          </label>
                          <label>
                            Motivo verificable
                            <textarea
                              name="reason"
                              required
                              minLength={10}
                              maxLength={2000}
                              rows={3}
                            />
                          </label>
                          <p className="small-text">
                            No retirar reseñas legítimas por ser negativas. Todas las actuaciones se
                            registran.
                          </p>
                        </ActionForm>
                      </details>
                    ))
                  )}
                </section>
              )}
              {tab === 'campaigns' && (
                <>
                  <section className="panel">
                    <h2>Origen de las matrículas</h2>
                    <Table
                      rows={data.campaigns || []}
                      columns={[
                        ['name', 'Campaña'],
                        ['city', 'Ciudad'],
                        ['channel', 'Canal'],
                        ['requests', 'Solicitudes'],
                      ]}
                    />
                    {data.campaigns?.map((c) => (
                      <p className="small-text" key={String(c.id)}>
                        {c.name}:{' '}
                        <Link href={`/clases?campana=${c.code}`}>/clases?campana={c.code}</Link>
                      </p>
                    ))}
                    <p className="private-note">
                      El origen comercial no cambia la comisión del profesor. El conteo refleja
                      solicitudes, no pagos ni visitantes.
                    </p>
                  </section>
                  <section className="panel">
                    <h2>Crear campaña</h2>
                    <ActionForm endpoint="/api/admin/campaign" label="Crear enlace de campaña">
                      <label>
                        Nombre
                        <input name="name" required minLength={3} maxLength={100} />
                      </label>
                      <label>
                        Código de enlace
                        <input
                          name="code"
                          pattern="[a-z0-9-]{3,80}"
                          required
                          placeholder="vuelta-espana-madrid"
                        />
                      </label>
                      <div className="form-row">
                        <label>
                          Ciudad
                          <input name="city" maxLength={100} />
                        </label>
                        <label>
                          Canal
                          <input
                            name="channel"
                            required
                            maxLength={100}
                            placeholder="QR presencial"
                          />
                        </label>
                      </div>
                    </ActionForm>
                  </section>
                </>
              )}
              {tab === 'withdrawals' && (
                <section className="panel">
                  <h2>Bajas y solicitudes de cambio</h2>
                  <Table
                    rows={data.withdrawals || []}
                    columns={[
                      ['name', 'Alumno'],
                      ['title', 'Grupo'],
                      ['kind', 'Solicitud'],
                      ['reason', 'Motivo privado'],
                      ['effective_at', 'Fecha efectiva'],
                    ]}
                  />
                  <p className="private-note">
                    Información confidencial para gestión autorizada. No se comparte con los
                    profesores.
                  </p>
                </section>
              )}
              {tab === 'incidents' && (
                <section className="panel">
                  <h2>Incidencias abiertas</h2>
                  {!data.incidents?.length ? (
                    <Empty />
                  ) : (
                    data.incidents.map((i) => (
                      <div className="data-row" key={String(i.id)}>
                        <div>
                          <strong>{i.title || i.kind}</strong>
                          <p>{i.description}</p>
                          <span className="small-text">
                            {new Date(String(i.created_at)).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <Status value={i.status} />
                      </div>
                    ))
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
