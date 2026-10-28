import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CalendarDays, Clock3, Users, Check, ChevronLeft } from 'lucide-react';
import { groups } from '@/lib/catalog';
import { fourSessions } from '@/lib/domain';
import { Reservation } from '@/components/reservation';
import { Avatar } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await groups();
  const g = data.items.find((x) => x.id === id);
  if (!g) notFound();
  const dates = g.dates?.length
    ? g.dates.map((d) => new Date(d))
    : fourSessions(new Date(g.first_at), g.timezone, g.duration).map((s) => s.startsAt);
  return (
    <div className="container section">
      <Link className="back-link" href="/clases">
        <ChevronLeft size={16} />
        Todas las clases
      </Link>
      <div className="detail-grid">
        <div>
          <span className="eyebrow">
            {g.level.toUpperCase()} · {g.language.toUpperCase()}
          </span>
          <h1>{g.title}</h1>
          <p className="lead">
            Un grupo estable para entender el ajedrez, compartir ideas y disfrutar de tu progreso.
          </p>
          <Link className="teacher-line" href={`/profesores/${g.teacher_id}`}>
            <Avatar name={g.teacher_name} />
            <span>
              Tu profesor
              <br />
              <strong>{g.teacher_name}</strong>
            </span>
          </Link>
          <div className="info-row">
            <span>
              <Clock3 size={18} />
              {g.duration} minutos
            </span>
            <span>
              <Users size={18} />
              {g.count} de {g.capacity} plazas
            </span>
            <span>
              <CalendarDays size={18} />
              Europe/Madrid
            </span>
          </div>
          <h2>Tus cuatro primeras clases</h2>
          <p>
            Estas son las fechas del primer ciclo. La siguiente renovación incluye un nuevo ciclo de
            cuatro sesiones; nunca una quinta clase automática.
          </p>
          <div className="date-list">
            {dates.map((d, i) => (
              <div key={d.toISOString()}>
                <span className="date-number">0{i + 1}</span>
                <span>
                  {new Intl.DateTimeFormat('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: g.timezone,
                  }).format(d)}
                </span>
                <strong>
                  {new Intl.DateTimeFormat('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: g.timezone,
                  }).format(d)}
                </strong>
              </div>
            ))}
          </div>
          <h2>Aprender con continuidad</h2>
          <ul className="check-list">
            {[
              'Explicaciones claras y ejercicios para aplicar cada idea.',
              'Un profesor asignado y un grupo a tu nivel.',
              'La academia gestiona incidencias y continuidad.',
              'Sin necesidad de ELO FIDE para empezar.',
            ].map((x) => (
              <li key={x}>
                <Check size={17} />
                {x}
              </li>
            ))}
          </ul>
          <div className="notice">
            <strong>Tu plaza y tus clases, con claridad</strong>
            <p>
              El grupo necesita un mínimo de dos alumnos. La inscripción cierra 48 horas antes del
              día 1 del mes de incorporación. Una ausencia del alumno consume la sesión. Las
              incidencias de la academia se gestionan mediante sustitución, recuperación o una
              solución equivalente.
            </p>
          </div>
        </div>
        <aside className="booking-card">
          <span className="eyebrow">TU SITIO EN EL GRUPO</span>
          <div className="big-price">
            50<span>€ / mes</span>
          </div>
          <p>4 clases por ciclo · {g.duration} min por clase</p>
          <div className="booking-status">
            <span className="status-dot" />
            {['published', 'pending', 'draft'].includes(g.status)
              ? 'Pendiente del mínimo de alumnos'
              : 'Grupo confirmado'}
          </div>
          <Suspense>
            <Reservation groupId={g.id} />
          </Suspense>
          <p className="small-text">
            Contratas con TopChess Global. Puedes cancelar futuras renovaciones según las
            condiciones aplicables.
          </p>
        </aside>
      </div>
    </div>
  );
}
