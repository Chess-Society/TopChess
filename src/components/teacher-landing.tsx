import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  Users,
  Megaphone,
  CalendarDays,
  ShieldCheck,
  ReceiptText,
  TrendingUp,
  HeartHandshake,
  BookOpen,
} from 'lucide-react';
import { CommissionExplainer } from './commission-explainer';

export function TeacherLanding() {
  return (
    <>
      <section className="teacher-landing-hero">
        <div className="container teacher-hero-grid">
          <div>
            <span className="eyebrow">ENSEÑAR CON EL RESPALDO DE TOPCHESS</span>
            <h1>
              Tú enseñas.
              <br />
              Crecemos <span>contigo.</span>
            </h1>
            <p>
              Forma parte de una escuela que selecciona personalmente a sus profesores, organiza los
              grupos y construye contigo una relación a largo plazo.
            </p>
            <div className="hero-buttons">
              <Link className="button" href="/ser-profesor">
                Presentar mi candidatura <ArrowUpRight size={18} />
              </Link>
              <a className="button ghost" href="#reparto-profesores">
                Entender el reparto <TrendingUp size={18} />
              </a>
            </div>
            <p className="teacher-hero-caption">
              Primero nos conocemos. Después, si encajamos, acordamos cómo colaborar.
            </p>
          </div>
          <aside className="teacher-promise">
            <span className="promise-piece" aria-hidden="true">
              ♘
            </span>
            <span className="eyebrow">UN ACUERDO CLARO DESDE EL PRINCIPIO</span>
            <h2>
              Tu talento merece
              <br />
              saber a qué atenerse.
            </h2>
            <ul>
              {[
                'Selección manual, no alta automática',
                'Reparto inicial 50 % / 50 %',
                'Progresión con criterios transparentes',
                'Pausas y vacaciones sin reiniciar tu nivel',
              ].map((text) => (
                <li key={text}>
                  <Check size={17} />
                  {text}
                </li>
              ))}
            </ul>
            <span className="promise-footnote">
              Tu candidatura no publica un perfil ni te compromete a aceptar una colaboración.
            </span>
          </aside>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NO TIENES QUE HACERLO TODO A SOLAS</span>
            <h2>Una estructura que respalda tu enseñanza.</h2>
            <p>Esto es lo que aporta TopChess a la colaboración.</p>
          </div>
        </div>
        <div className="benefit-grid">
          {[
            {
              Icon: Megaphone,
              title: 'Captación y visibilidad',
              text: 'Promoción de la academia, campañas y presencia de tu perfil autorizado para acercar alumnos a tus clases.',
            },
            {
              Icon: CalendarDays,
              title: 'Grupos y organización',
              text: 'Horarios coordinados, grupos estables y un calendario compartido para trabajar con continuidad.',
            },
            {
              Icon: ReceiptText,
              title: 'Gestión comercial',
              text: 'La relación comercial, las suscripciones y la administración corresponden a TopChess. El reparto se define en tu acuerdo.',
            },
            {
              Icon: HeartHandshake,
              title: 'Acompañamiento real',
              text: 'Una escuela a la que acudir para coordinar cambios, incidencias y continuidad del alumnado.',
            },
            {
              Icon: TrendingUp,
              title: 'Un camino para progresar',
              text: 'Un modelo que reconoce mantener alumnos activos, con criterios de progresión y porcentajes conocidos antes de empezar.',
            },
            {
              Icon: BookOpen,
              title: 'Espacio para enseñar',
              text: 'Centra tu energía en explicar, acompañar y ayudar a tus grupos a mejorar, con el respaldo de la academia.',
            },
          ].map(({ Icon, title, text }) => (
            <article className="benefit-card" key={title}>
              <span className="benefit-icon">
                <Icon size={23} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="selection-section">
        <div className="container selection-grid">
          <div>
            <span className="eyebrow">CADA PROFESOR, ELEGIDO UNO A UNO</span>
            <h2>
              TopChess te conoce
              <br />
              antes de presentarte a sus alumnos.
            </h2>
            <p>
              El equipo de TopChess revisa manualmente cada candidatura. Crear una cuenta o enviar
              un formulario no te convierte en profesor activo.
            </p>
            <Link className="text-link" href="/ser-profesor">
              Conoce la candidatura <ArrowUpRight size={16} />
            </Link>
          </div>
          <ol className="selection-steps">
            {[
              [
                'Nos cuentas tu experiencia',
                'Revisamos tu trayectoria, tu currículum y los niveles que puedes enseñar.',
              ],
              [
                'Conversamos sobre tu enseñanza',
                'Podemos solicitar documentación, referencias pertinentes, entrevista o clase de prueba.',
              ],
              [
                'Acordamos la colaboración',
                'Si aprobamos tu candidatura, concretamos condiciones, porcentajes y requisitos antes de activar tu perfil.',
              ],
              [
                'TopChess autoriza la publicación',
                'Solo publicamos tu ficha y tus grupos cuando la escuela lo aprueba.',
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span className="step-number">0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section id="reparto-profesores" className="container section commission-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LOS PORCENTAJES, SIN LETRA PEQUEÑA</span>
            <h2>Un reparto que puedes entender.</h2>
            <p>El punto de partida es claro. La progresión se pacta antes de colaborar.</p>
          </div>
        </div>
        <div className="commission-grid">
          <div>
            <div className="initial-split">
              <div>
                <span>Profesor · al incorporarte</span>
                <strong>50 %</strong>
              </div>
              <span className="split-divider" aria-hidden="true" />
              <div>
                <span>TopChess · al incorporarte</span>
                <strong>50 %</strong>
              </div>
            </div>
            <div className="commission-rules">
              <h3>¿Cómo se plantea la progresión?</h3>
              <ul className="check-list">
                <li>
                  <Check size={17} />
                  <span>
                    Cuentan alumnos <strong>únicos, activos y con suscripción pagada</strong>. El
                    mismo alumno en varios grupos tuyos cuenta una vez.
                  </span>
                </li>
                <li>
                  <Check size={17} />
                  <span>
                    El umbral de un tramo debe mantenerse durante{' '}
                    <strong>dos periodos mensuales consecutivos</strong>.
                  </span>
                </li>
                <li>
                  <Check size={17} />
                  <span>
                    El modelo prevé aumentar la participación del profesor hasta un máximo del{' '}
                    <strong>95 %</strong>; TopChess conserva al menos el <strong>5 %</strong>.
                  </span>
                </li>
                <li>
                  <Check size={17} />
                  <span>
                    Los umbrales concretos y la base económica se detallan en tu acuerdo. No se
                    modifican liquidaciones ya cerradas.
                  </span>
                </li>
              </ul>
              <p className="commission-disclosure">
                Tu porcentaje se aplica a la cuota de 50 €. TopChess asume el IVA y las comisiones
                de Stripe. El panel muestra lo generado por las clases impartidas y cobradas, lo
                pendiente y lo pagado. TopChess realiza las transferencias manualmente el día 28,
                con cierre de las clases hasta el 27; las posteriores pasan al siguiente cierre.
              </p>
            </div>
          </div>
          <CommissionExplainer />
        </div>
        <div className="continuity-cards">
          <article>
            <ShieldCheck size={23} />
            <h3>Una pausa no te devuelve al inicio</h3>
            <p>
              Vacaciones autorizadas, inactividad temporal y suspensión provisional no reinician
              automáticamente tu porcentaje. Una bajada de alumnado requiere la revisión trimestral
              prevista, no una reducción inmediata.
            </p>
          </article>
          <article>
            <HeartHandshake size={23} />
            <h3>Una baja definitiva sí cierra el ciclo</h3>
            <p>
              Si finaliza la colaboración y más adelante eres readmitido, empieza un nuevo ciclo con
              reparto 50/50. El historial se conserva y no se utilizan bajas ficticias para reducir
              remuneraciones.
            </p>
          </article>
        </div>
      </section>
      <section className="container teacher-cta">
        <div>
          <span className="eyebrow">UNA COLABORACIÓN QUE SE CONSTRUYE CON PERSONAS</span>
          <h2>Cuéntanos cómo enseñas.</h2>
          <p>
            Revisaremos tu candidatura personalmente y te explicaremos las condiciones antes de
            incorporarte.
          </p>
        </div>
        <Link className="button light-button" href="/ser-profesor">
          Solicitar incorporación <ArrowUpRight size={18} />
        </Link>
      </section>
      <section className="container section faq-preview">
        <span className="eyebrow">LO QUE QUIERES SABER ANTES DE EMPEZAR</span>
        <h2>Con las cosas claras.</h2>
        {[
          [
            '¿Me convierto en profesor al registrarme?',
            'No. La cuenta de Lichess solo permite identificarte. TopChess revisa manualmente tu candidatura, aprueba la colaboración y autoriza por separado tu publicación.',
          ],
          [
            '¿El 95 % está garantizado?',
            'No. Es el límite máximo previsto del modelo. Los tramos, sus umbrales y la base de cálculo deben constar en tu acuerdo profesional; no se prometen ingresos ni ascensos por el mero registro.',
          ],
          [
            '¿Quién gestiona la relación con los alumnos?',
            'Los alumnos contratan con TopChess Global. La escuela gestiona la relación comercial, los grupos y la continuidad; el profesor aporta su enseñanza dentro de esa estructura.',
          ],
          [
            '¿Puedo cambiar las fechas de un grupo?',
            'No puedes mover unilateralmente una clase confirmada. Los alumnos contratan un horario fijo y cuatro fechas. Si surge una incidencia, comunícala a TopChess: la escuela coordina una sustitución, una recuperación acordada con el grupo o la solución correspondiente. Consulta las normas en Cómo funciona.',
          ],
          [
            '¿Tengo que dejar de enseñar fuera de TopChess?',
            'La propuesta se apoya en el valor de trabajar con la academia, no en prohibiciones generales de enseñar fuera. Las condiciones concretas se detallan en el acuerdo aplicable.',
          ],
        ].map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <span>+</span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
        <Link className="text-link" href="/como-funciona">
          Ver cómo funcionan las clases <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
