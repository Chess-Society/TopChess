import Link from 'next/link';
import {
  ArrowUpRight,
  MoveRight,
  Users,
  Video,
  CalendarCheck2,
  ShieldCheck,
  ArrowDown,
  Check,
  Globe2,
  BookOpen,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { groups, teachers } from '@/lib/catalog';
import { GroupCard, TeacherCard, SectionHeading, PriceCard } from '@/components/ui';
import { AudienceTabs } from '@/components/audience-tabs';
import { TeacherLanding } from '@/components/teacher-landing';
export const dynamic = 'force-dynamic';
function ChessScene() {
  return (
    <div className="chess-scene">
      <div className="scene-caption">
        <span className="status-dot" /> TU MEJOR JUGADA EMPIEZA AQUÍ
      </div>
      <div className="board-wrap" aria-label="Ilustración de un tablero de ajedrez">
        <div className="hero-board">
          {Array.from({ length: 64 }, (_, i) => (
            <div
              key={i}
              className={(Math.floor(i / 8) + (i % 8)) % 2 === 0 ? 'square light' : 'square dark'}
            >
              {(
                {
                  9: '♟',
                  11: '♟',
                  14: '♚',
                  19: '♞',
                  28: '♙',
                  34: '♘',
                  42: '♙',
                  46: '♔',
                  51: '♙',
                  54: '♙',
                } as Record<number, string>
              )[i] && (
                <span
                  className={[28, 34, 42, 46, 51, 54].includes(i) ? 'white-piece' : 'black-piece'}
                >
                  {
                    (
                      {
                        9: '♟',
                        11: '♟',
                        14: '♚',
                        19: '♞',
                        28: '♙',
                        34: '♘',
                        42: '♙',
                        46: '♔',
                        51: '♙',
                        54: '♙',
                      } as Record<number, string>
                    )[i]
                  }
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="board-edge" />
      </div>
      <div className="floating-note note-one">
        <div className="note-icon">
          <Users size={20} />
        </div>
        <div>
          <strong>Tu grupo. Tu progreso.</strong>
          <span>Aprende acompañado.</span>
        </div>
      </div>
      <div className="floating-note note-two">
        <span className="sparkle">✦</span>
        <span>
          Cada movimiento
          <br />
          <strong>tiene una idea.</strong>
        </span>
      </div>
      <span className="scene-bottom">MENOS MOVER POR MOVER. MÁS ENTENDER.</span>
    </div>
  );
}
export default async function Home({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  const audience = (await searchParams).para === 'profesores' ? 'profesores' : 'alumnos';
  const [catalog, faculty] = await Promise.all([groups(), teachers()]);
  return (
    <AudienceTabs
      key={audience}
      initialAudience={audience}
      teacherContent={<TeacherLanding />}
      studentContent={
        <>
          <section className="hero">
            <div className="container hero-grid">
              <div className="hero-copy">
                <div className="hero-label">
                  <span className="status-dot" /> TU ACADEMIA DE AJEDREZ ONLINE
                </div>
                <h1>
                  Tu siguiente
                  <br />
                  gran <span>jugada.</span>
                </h1>
                <p>
                  Aprende con profesores seleccionados manualmente por TopChess. Clases en directo,
                  grupos reducidos y el respaldo de una escuela que te acompaña.
                </p>
                <div className="hero-buttons">
                  <Link className="button" href="/clases">
                    Encuentra tu clase <ArrowUpRight size={19} />
                  </Link>
                  <Link className="button ghost" href="/como-funciona">
                    Así funciona <MoveRight size={18} />
                  </Link>
                </div>
                <div className="hero-proof">
                  <span className="proof-price">
                    50 €<small>/mes</small>
                  </span>
                  <span className="proof-separator" />
                  <div>
                    <strong>Cuatro clases. Un plan para avanzar.</strong>
                    <span>Online · Grupos reducidos · Sin permanencia*</span>
                  </div>
                </div>
                <small className="hero-footnote">
                  *Puedes cancelar futuras renovaciones según las condiciones.
                </small>
              </div>
              <ChessScene />
            </div>
          </section>
          <section className="trust-strip">
            <div className="container trust-items">
              <span>
                <Video size={20} />
                Clases en directo, estés donde estés
              </span>
              <span>
                <Users size={20} />
                De 2 a 4 alumnos por grupo
              </span>
              <span>
                <ShieldCheck size={20} />
                Profesores elegidos uno a uno
              </span>
              <span>
                <CalendarCheck2 size={20} />
                Un horario que encaja contigo
              </span>
            </div>
          </section>
          <section className="container selection-student-section">
            <div className="manual-selection-banner">
              <span className="benefit-icon">
                <ShieldCheck size={25} />
              </span>
              <div>
                <span className="eyebrow">LA CONFIANZA EMPIEZA CON LA SELECCIÓN</span>
                <h2>Tu profesor no aparece aquí por registrarse.</h2>
                <p>
                  TopChess selecciona manualmente a cada profesor. Revisamos su candidatura y
                  decidimos quién se incorpora a nuestra escuela antes de autorizar su perfil y sus
                  grupos.
                </p>
              </div>
            </div>
            <div className="student-benefits">
              <article>
                <ShieldCheck size={22} />
                <h3>Un equipo elegido por TopChess</h3>
                <p>
                  La escuela revisa la experiencia y la propuesta docente de cada candidato. No hay
                  altas automáticas como profesor activo.
                </p>
              </article>
              <article>
                <Users size={22} />
                <h3>Un grupo para aprender acompañado</h3>
                <p>
                  Profesor asignado, nivel adecuado y grupos estables de 2 a 4 alumnos. Con cuatro
                  fechas claras en cada ciclo.
                </p>
              </article>
              <article>
                <HeartHandshake size={22} />
                <h3>La escuela responde contigo</h3>
                <p>
                  Contratas con TopChess Global. La academia coordina incidencias, cambios de
                  profesor y continuidad de tus clases.
                </p>
              </article>
            </div>
          </section>
          <section className="section container">
            <SectionHeading
              eyebrow="CADA NIVEL TIENE SU SIGUIENTE PASO"
              title="Hay un grupo para ti."
              text="Empieza desde cero o lleva tu juego un poco más lejos."
              href="/clases"
              label="Explorar todas las clases"
            />
            <div className="course-grid">
              {catalog.items.slice(0, 3).map((g, i) => (
                <GroupCard key={g.id} group={g} index={i} />
              ))}
            </div>
            {catalog.items.length === 0 && (
              <div className="empty-state">
                Estamos preparando nuevos grupos.{' '}
                <Link href="/contacto">Cuéntanos qué horario buscas.</Link>
              </div>
            )}
          </section>
          <section className="how-section">
            <div className="container how-grid">
              <div>
                <span className="eyebrow">SENCILLO DESDE LA PRIMERA JUGADA</span>
                <h2>
                  Tú pones las ganas.
                  <br />
                  Nosotros, el camino.
                </h2>
                <p>
                  Una academia que se ocupa de todo
                  <br />
                  para que tú te centres en aprender.
                </p>
                <Link className="text-link" href="/como-funciona">
                  Conoce la experiencia <MoveRight size={18} />
                </Link>
              </div>
              <div className="steps">
                {[
                  {
                    n: '01',
                    title: 'Encuentra tu grupo',
                    text: 'Elige tu nivel y un horario que te venga bien. No necesitas tener ELO.',
                  },
                  {
                    n: '02',
                    title: 'Conoce a tu profesor',
                    text: 'Descubre su enfoque y experiencia. TopChess ha revisado y aprobado personalmente su incorporación.',
                  },
                  {
                    n: '03',
                    title: 'Nos vemos en el tablero',
                    text: 'Reserva ahora e incorpórate el mes siguiente. Cuatro clases con horario fijo y fechas confirmadas para todo el grupo.',
                  },
                ].map((s) => (
                  <div className="step" key={s.n}>
                    <span className="step-number">{s.n}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="section container">
            <SectionHeading
              eyebrow="EL APRENDIZAJE EMPIEZA CON LAS PERSONAS"
              title="Mucho más que saber ajedrez."
              text="Cada profesor publicado ha sido seleccionado manualmente y autorizado por TopChess."
              href="/profesores"
              label="Conoce al equipo"
            />
            <div className="teacher-grid">
              {faculty.items.slice(0, 3).map((t, i) => (
                <TeacherCard key={t.id} teacher={t} index={i} />
              ))}
            </div>
          </section>
          <section className="container pricing-section">
            <div className="pricing-copy">
              <span className="eyebrow">INVIERTE EN TU FORMA DE PENSAR</span>
              <h2>
                Un precio claro.
                <br />
                Un aprendizaje
                <br />
                <span>que se queda.</span>
              </h2>
              <p>
                Sin bonos que se acumulan ni clases sueltas sin rumbo. Un grupo estable, continuidad
                y atención de verdad.
              </p>
              <div className="pricing-fact">
                <span>
                  <BookOpen size={23} />
                </span>
                <div>
                  <strong>Un hilo conductor, cada mes</strong>
                  <p>Construye sobre lo aprendido, a tu ritmo.</p>
                </div>
              </div>
              <div className="pricing-fact">
                <span>
                  <ShieldCheck size={23} />
                </span>
                <div>
                  <strong>La confianza de una academia</strong>
                  <p>Tu relación es con TopChess. Te acompañamos.</p>
                </div>
              </div>
              <Link className="text-link" href="/precios">
                Todos los detalles del plan <MoveRight size={18} />
              </Link>
            </div>
            <PriceCard />
          </section>
          <section className="teacher-cta container">
            <div className="cta-piece" aria-hidden="true">
              ♘
            </div>
            <div>
              <span className="eyebrow">EL TALENTO SE COMPARTE</span>
              <h2>Enseña ajedrez. Crece con TopChess.</h2>
              <p>Nosotros ponemos la estructura. Tú, tu manera de enseñar.</p>
            </div>
            <Link className="button light-button" href="/?para=profesores">
              Descubre la propuesta docente <ArrowUpRight size={18} />
            </Link>
          </section>
          <section className="section container faq-preview">
            <SectionHeading
              eyebrow="ANTES DE TU PRIMERA CLASE"
              title="Todo un poco más claro."
              href="/preguntas-frecuentes"
              label="Todas las preguntas"
            />
            {[
              [
                '¿Puedo empezar si nunca he jugado?',
                'Sí. Los grupos de iniciación empiezan desde la base. No necesitas ELO FIDE ni experiencia previa.',
              ],
              [
                '¿Cuándo se confirma mi grupo?',
                'Cuando se alcanza el mínimo de dos alumnos. Mientras tanto, tu solicitud queda pendiente y no se realiza ningún cobro.',
              ],
              [
                '¿Qué pasa si no puedo asistir a una clase?',
                'Una ausencia del alumno consume la sesión y no genera recuperación automática. Si la incidencia es de TopChess, gestionamos una solución equivalente.',
              ],
              [
                '¿Hay cinco clases en los meses con cinco semanas?',
                'No. Cada ciclo mensual incluye cuatro sesiones con fechas visibles antes de contratar. No se añade automáticamente una quinta sesión.',
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        </>
      }
    />
  );
}
