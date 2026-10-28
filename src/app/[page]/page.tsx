import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ActionForm } from '@/components/action-form';
import { PriceCard } from '@/components/ui';
import { Check, ArrowUpRight, ShieldCheck, Users, CalendarDays, GraduationCap } from 'lucide-react';
const authPages = ['acceso', 'registro', 'recuperar', 'verificar', 'restablecer'];
const faq = [
  [
    '¿Puedo aprender desde cero?',
    'Sí. No necesitas experiencia ni ELO FIDE. Elige un grupo de iniciación y empieza por los fundamentos.',
  ],
  [
    '¿Qué incluye la suscripción?',
    'Cuatro clases online de 60 minutos por mes natural, con profesor asignado y grupo estable. El precio final es 50 € al mes, con los impuestos aplicables incluidos.',
  ],
  [
    '¿Qué pasa si reservo a finales de mes?',
    'Reservas ahora para incorporarte el mes siguiente. No empiezas con un mes a medias ni pierdes clases por llegar tarde. La reserva no genera un cobro: con el grupo confirmado, el primer cargo corresponde al mes de incorporación y las renovaciones se realizan el día 1.',
  ],
  [
    '¿Puedo mover una clase o elegir otra fecha?',
    'No. Al contratar aceptas las cuatro fechas y el horario compartido de tu grupo. El alumno no puede mover una sesión individualmente ni recuperarla por una ausencia personal.',
  ],
  [
    '¿Puede el profesor cambiar las clases?',
    'El profesor tampoco puede cambiar unilateralmente las fechas confirmadas. Debe comunicar cualquier incidencia a TopChess. La academia coordina y comunica una sustitución, una recuperación acordada con el grupo o la solución que corresponda si no puede prestarse la clase.',
  ],
  [
    '¿Cuándo se confirma un grupo?',
    'Al alcanzar dos solicitudes. La reserva no genera cobros; el inicio requiere dos matrículas autorizadas y pagos confirmados. La inscripción cierra 48 horas antes del día 1 del mes de incorporación.',
  ],
  [
    '¿Puedo descargar mi factura?',
    'Sí. Cuando Stripe emite la factura de tu cuota, la encontrarás en «Suscripciones y pagos» de tu panel, con número, fecha y descarga en PDF. Antes de contratar indicarás tu nombre fiscal, NIF/DNI/NIE y dirección. El precio final de la cuota sigue siendo 50 €, IVA incluido. Una reserva gratuita no genera una factura de cobro.',
  ],
  [
    '¿Cómo funcionan los meses con cinco semanas?',
    'Cada ciclo tiene cuatro fechas concretas. La semana adicional no genera una quinta clase incluida. Los periodos de facturación y las fechas se muestran antes de contratar.',
  ],
  [
    '¿Qué pasa si falto?',
    'La sesión se considera consumida. No se acumula ni genera recuperación automática por una ausencia del alumno. Esto no limita los derechos legales aplicables.',
  ],
  [
    '¿Y si el profesor no puede dar clase?',
    'Se registra una incidencia del profesor. TopChess gestionará sustitución, recuperación o una solución equivalente; nunca se registrará como ausencia tuya.',
  ],
  [
    '¿Puedo cambiar de profesor o de grupo?',
    'Puedes solicitarlo a TopChess para un mes posterior, sujeto a disponibilidad y confirmación de la academia. No es un cambio libre de las clases ya contratadas.',
  ],
  [
    '¿Cómo cancelo mi suscripción?',
    'Desde tu panel puedes cancelar las renovaciones futuras. No se confunde con faltar a una clase: el acceso continúa hasta la fecha efectiva indicada.',
  ],
  [
    '¿Aceptáis alumnos menores?',
    'El registro inicial está limitado a mayores de 18 años. La contratación por tutores requiere habilitar y validar primero el flujo específico de autorización de menores.',
  ],
  [
    '¿Cómo se selecciona a los profesores?',
    'Mediante candidatura y revisión de documentación, experiencia, referencias pertinentes y, cuando corresponda, entrevista o clase de prueba. No hay activación pública automática.',
  ],
];
export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { page } = await params;
  const search = await searchParams;
  if (authPages.includes(page)) {
    if (page !== 'acceso') redirect('/acceso');
    const user = await currentUser();
    if (user) redirect(user.profile_completed_at ? '/panel' : '/completar-perfil');
    return (
      <div className="auth-layout container">
        <div className="auth-story">
          <span className="eyebrow">TOPCHESS GLOBAL</span>
          <h1>
            Tu cuenta Lichess.
            <br />
            Tu nombre real.
            <br />
            <span>Tu academia.</span>
          </h1>
          <div className="auth-piece" aria-hidden="true">
            ♘
          </div>
          <p>
            Una sola forma de entrar, seas alumno o profesor.
            <br />
            Tu progreso, siempre contigo.
          </p>
        </div>
        <section className="auth-card">
          <span className="eyebrow">TU ACADEMIA, CONTIGO</span>
          <h2>Entra con Lichess.</h2>
          <p>Usa tu cuenta de Lichess para acceder o darte de alta en TopChess Global.</p>
          <a className="button full lichess-button" href="/api/auth/lichess">
            <span className="lichess-knight" aria-hidden="true">
              ♞
            </span>
            Continuar con Lichess
            <ArrowUpRight size={18} />
          </a>
          {search.error && (
            <div className="form-message form-error" role="alert">
              {search.error === 'configuracion'
                ? 'El acceso con Lichess está pendiente de configurar PostgreSQL y OAuth. No se ha iniciado ninguna sesión.'
                : 'No se ha podido completar el acceso con Lichess. Vuelve a intentarlo desde este botón.'}
            </div>
          )}
          <div className="auth-how">
            <div>
              <span>01</span>
              <p>Autoriza tu acceso en Lichess.</p>
            </div>
            <div>
              <span>02</span>
              <p>Indica tu nombre y apellidos reales.</p>
            </div>
            <div>
              <span>03</span>
              <p>Elige alumno o candidatura de profesor.</p>
            </div>
          </div>
          <div className="notice">
            <strong>En TopChess te conocemos por tu nombre.</strong>
            <p>
              Tu nombre real será el que aparezca en clases y fichas. El alias de Lichess queda
              vinculado a tu cuenta por separado.
            </p>
          </div>
          <p className="small-text">
            La autorización permite identificar tu cuenta y consultar tu correo para comunicaciones
            de la academia. Consulta la <Link href="/legal/privacidad">política de privacidad</Link>
            .
          </p>
        </section>
      </div>
    );
  }
  if (page === 'precios')
    return (
      <div className="container section">
        <div className="page-heading centered">
          <span className="eyebrow">SIN SORPRESAS EN EL TABLERO</span>
          <h1>
            Un plan claro.
            <br />
            Muchas buenas jugadas.
          </h1>
          <p>Continuidad, un grupo reducido y un profesor que conoce tu progreso.</p>
        </div>
        <div className="price-page">
          <PriceCard />
          <div>
            <h2>Antes de contratar</h2>
            {[
              '50 € por mes natural, con los impuestos aplicables incluidos y cuatro clases programadas.',
              'Reserva ahora e incorpórate el mes siguiente, con el grupo confirmado.',
              'El primer cargo corresponde al mes de incorporación; las renovaciones se hacen el día 1.',
              'Factura con número, fecha y descarga en PDF desde tu panel.',
              'Consulta las fechas, la hora y el profesor de tu grupo.',
              'El horario es fijo: ni alumno ni profesor cambian las sesiones por su cuenta.',
              'Los grupos se confirman con un mínimo de dos alumnos.',
              'Una reserva pendiente no activa ningún cargo recurrente.',
              'Puedes cancelar las renovaciones futuras desde tu panel.',
              'Las ausencias del alumno no generan recuperación automática.',
            ].map((x) => (
              <p className="with-icon" key={x}>
                <Check size={19} />
                {x}
              </p>
            ))}
            <div className="notice">
              Las incidencias de TopChess tienen un tratamiento diferente y requieren una solución
              de la academia. Las condiciones no eliminan derechos irrenunciables de consumidores.
            </div>
            <Link className="text-link" href="/legal/condiciones">
              Consultar condiciones <ArrowUpRight size={17} />
            </Link>
            <p>
              <Link className="text-link" href="/como-funciona">
                Cómo funcionan las clases <ArrowUpRight size={17} />
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  if (page === 'como-funciona')
    return (
      <div className="container section">
        <div className="page-heading">
          <span className="eyebrow">EL CAMINO, SIN COMPLICACIONES</span>
          <h1>
            Del «quiero aprender»
            <br />a tu siguiente jugada.
          </h1>
          <p>
            Reserva ahora e incorpórate el mes siguiente. Un grupo, un horario fijo y cuatro clases
            al mes.
          </p>
        </div>
        <div className="feature-grid">
          {[
            [
              Users,
              '01 · Encuentra tu grupo',
              'Filtra por nivel, idioma y horario. TopChess selecciona manualmente a cada profesor. Revisa el horario y las cuatro fechas del mes en que te incorporarás.',
            ],
            [
              ShieldCheck,
              '02 · Reserva con claridad',
              'Accede con Lichess, completa tu nombre real y solicita plaza para el mes siguiente. La reserva no genera ningún cobro y el grupo necesita al menos dos alumnos para confirmarse.',
            ],
            [
              CalendarDays,
              '03 · Confirma tu matrícula',
              'Con el grupo confirmado, acepta las fechas, el horario y las condiciones. Pagas a TopChess, nunca directamente al profesor: 50 € por mes natural, impuestos aplicables incluidos. El primer cargo corresponde al mes de incorporación; las renovaciones se hacen el día 1.',
            ],
            [
              GraduationCap,
              '04 · Aprende con continuidad',
              'Asiste a las cuatro clases del calendario compartido. No hay cambios individuales de fecha ni una quinta sesión automática. Puedes comunicar incidencias y cancelar futuras renovaciones desde tu panel.',
            ],
          ].map(([Icon, title, text]) => (
            <article className="feature-card" key={String(title)}>
              {typeof Icon !== 'string' && <Icon size={29} />}
              <h2>{String(title)}</h2>
              <p>{String(text)}</p>
            </article>
          ))}
        </div>
        <section className="section compact-section" aria-labelledby="horarios-clases">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LAS REGLAS, ANTES DE RESERVAR</span>
              <h2 id="horarios-clases">Un calendario fijo para aprender juntos.</h2>
              <p>El alumno y el profesor conocen las mismas fechas antes de empezar.</p>
            </div>
          </div>
          <div className="feature-grid">
            {[
              [
                '¿Puede el alumno mover una clase?',
                'No. La sesión pertenece a todo el grupo y mantiene su fecha y hora. Si no puedes asistir por un motivo personal, la clase se considera consumida: no se traslada ni se acumula para otro mes, sin perjuicio de los derechos legales aplicables.',
              ],
              [
                '¿Puede el profesor cambiarla?',
                'Tampoco puede mover una clase unilateralmente. Debe comunicar la incidencia a TopChess. La academia coordina cualquier solución y la comunica al grupo; el profesor no cambia por su cuenta el calendario contratado.',
              ],
              [
                '¿Y si TopChess o el profesor cancelan?',
                'No pierdes la clase ni se registra como ausencia tuya. TopChess organiza una sustitución, una recuperación acordada con el grupo o, cuando no sea posible prestar el servicio, la devolución que corresponda. Las recuperaciones son excepciones, no cambios libres de horario.',
              ],
              [
                '¿Y los festivos o los meses con cinco semanas?',
                'Las cuatro fechas se fijan antes de contratar, teniendo en cuenta los festivos. Una quinta semana no añade una clase incluida. Si quieres otro grupo u horario para un mes posterior, solicítalo a TopChess: requiere disponibilidad y confirmación.',
              ],
            ].map(([title, text]) => (
              <article className="feature-card" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p className="small-text">
            Consulta también las{' '}
            <Link className="text-link" href="/legal/asistencia">
              normas de asistencia
            </Link>{' '}
            y las{' '}
            <Link className="text-link" href="/legal/condiciones">
              condiciones de contratación
            </Link>
            .
          </p>
        </section>
        <div className="centered section compact-section">
          <Link className="button" href="/clases">
            Encuentra tu clase <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    );
  if (page === 'preguntas-frecuentes')
    return (
      <div className="container section narrow">
        <div className="page-heading">
          <span className="eyebrow">RESOLVEMOS TUS DUDAS</span>
          <h1>
            Todo sobre
            <br />
            tu academia.
          </h1>
        </div>
        {faq.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span>+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
        <div className="notice">
          ¿Te queda alguna duda? <Link href="/contacto">Escríbenos a través del formulario.</Link>
        </div>
      </div>
    );
  if (page === 'contacto')
    return (
      <div className="container section contact-grid">
        <div className="page-heading">
          <span className="eyebrow">ESTAMOS AL OTRO LADO</span>
          <h1>
            Hablemos de
            <br />
            tu próxima jugada.
          </h1>
          <p>Horarios, niveles, grupos o cualquier duda sobre la academia.</p>
          <div className="notice">
            No incluyas contraseñas, datos bancarios ni información sensible en el mensaje.
          </div>
        </div>
        <div className="form-card">
          <ActionForm endpoint="/api/contact" label="Enviar consulta">
            <label>
              Tu nombre
              <input name="name" required minLength={2} maxLength={100} />
            </label>
            <label>
              Correo electrónico
              <input name="email" type="email" required maxLength={254} />
            </label>
            <label>
              ¿En qué podemos ayudarte?
              <textarea name="message" required minLength={10} maxLength={3000} rows={6} />
            </label>
            <label className="check-label">
              <input name="privacy" type="checkbox" required />
              <span>
                He leído la <Link href="/legal/privacidad">política de privacidad</Link>.
              </span>
            </label>
          </ActionForm>
        </div>
      </div>
    );
  if (page === 'ser-profesor')
    return (
      <div className="container section">
        <div className="page-heading">
          <span className="eyebrow">EL TALENTO SE COMPARTE</span>
          <h1>
            Tu forma de enseñar.
            <br />
            Nuestra forma de acompañarte.
          </h1>
          <p>
            Captación, grupos y administración desde una academia. Una relación profesional clara
            para crecer juntos.
          </p>
        </div>
        <div className="application-layout">
          <aside>
            <h2>Enseña con estructura.</h2>
            <p>
              TopChess selecciona a sus docentes. Presentar esta solicitud no publica un perfil ni
              activa una cuenta de profesor.
            </p>
            <ul className="check-list">
              {[
                'Revisión de experiencia y documentación',
                'Referencias pertinentes con transparencia',
                'Acuerdo profesional antes de la activación',
                'Reparto inicial: 50 % profesor / 50 % academia',
                'Progresión por alumnos únicos, pagados y activos',
                'Sin clasificaciones públicas entre profesores',
              ].map((x) => (
                <li key={x}>
                  <Check size={17} />
                  {x}
                </li>
              ))}
            </ul>
            <div className="notice">
              Los tramos de progresión requieren aprobación contractual. Las liquidaciones dependen
              de una base económica definida, impuestos y ajustes; el porcentaje del precio no es
              beneficio neto.
            </div>
          </aside>
          <div className="form-card">
            <h2>Cuéntanos quién eres</h2>
            <p>
              Primero <Link href="/registro">accede con Lichess</Link> y completa tu nombre real.
              Usaremos el nombre real y el correo vinculado a tu cuenta de Lichess.
            </p>
            <ActionForm endpoint="/api/applications" multipart label="Presentar candidatura">
              <div className="form-row">
                <label>
                  País de residencia
                  <input name="country" required maxLength={100} />
                </label>
                <label>
                  Idiomas de enseñanza
                  <input name="languages" required placeholder="Español, inglés…" maxLength={200} />
                </label>
              </div>
              <label>
                Niveles que puedes enseñar
                <input
                  name="levels"
                  required
                  placeholder="Principiante, intermedio…"
                  maxLength={200}
                />
              </label>
              <label>
                Experiencia, centros y fechas de colaboración
                <textarea name="experience" required minLength={30} maxLength={3000} rows={4} />
              </label>
              <label>
                Presentación, especialidades y certificaciones
                <textarea name="presentation" required minLength={30} maxLength={3000} rows={4} />
                <small>El ELO FIDE es opcional. No incluyas datos sensibles innecesarios.</small>
              </label>
              <label>
                Disponibilidad aproximada
                <textarea name="availability" required minLength={5} maxLength={1000} rows={2} />
              </label>
              <label>
                Currículum en PDF
                <input name="cv" type="file" required accept="application/pdf,.pdf" />
                <small>Máximo 5 MB. Documento privado, accesible solo a personal autorizado.</small>
              </label>
              <label className="check-label">
                <input name="privacy" type="checkbox" required />
                <span>
                  He leído la <Link href="/legal/privacidad">política de privacidad</Link> y la
                  información sobre revisión de candidaturas. Las referencias se comprobarán con
                  transparencia previa; no se contactará indiscriminadamente con empleadores
                  actuales.
                </span>
              </label>
            </ActionForm>
          </div>
        </div>
      </div>
    );
  notFound();
}
