import Link from 'next/link';
import {
  ArrowUpRight,
  Clock3,
  Users,
  CalendarDays,
  MoveRight,
  Check,
  ShieldCheck,
} from 'lucide-react';
import type { Group, Teacher } from '@/lib/catalog';
export function SectionHeading({
  eyebrow,
  title,
  text,
  href,
  label,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {label || 'Ver todos'} <MoveRight size={19} />
        </Link>
      )}
    </div>
  );
}
export function Avatar({
  name,
  index = 0,
  large = false,
}: {
  name: string;
  index?: number;
  large?: boolean;
}) {
  return (
    <div className={`avatar avatar-${index % 3} ${large ? 'avatar-large' : ''}`} aria-hidden="true">
      <span>
        {name
          .split(' ')
          .map((x) => x[0])
          .slice(0, 2)
          .join('')}
      </span>
      <span className="avatar-piece">{['♘', '♗', '♙'][index % 3]}</span>
    </div>
  );
}
export function GroupCard({
  group,
  index = 0,
  campaign,
}: {
  group: Group;
  index?: number;
  campaign?: string;
}) {
  const date = new Date(group.first_at);
  const weekday = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    timeZone: group.timezone,
  }).format(date);
  const time = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: group.timezone,
  }).format(date);
  const free = group.capacity - group.count;
  const forming = ['published', 'pending', 'draft'].includes(group.status);
  return (
    <article className="group-card">
      <div className={`course-art course-art-${index % 3}`}>
        <div className="mini-board" aria-hidden="true">
          {['♘', '♙', '♗'].map((p, i) => (
            <span key={i} className={`mini-piece mini-piece-${i}`}>
              {p}
            </span>
          ))}
        </div>
        <span className="level-badge">{group.level}</span>
        <span className="course-number">0{index + 1}</span>
      </div>
      <div className="card-content">
        <div className="card-kicker">AJEDREZ ONLINE · GRUPO REDUCIDO</div>
        <h3>{group.title}</h3>
        <Link className="teacher-line" href={`/profesores/${group.teacher_id}`}>
          <Avatar name={group.teacher_name} index={index} />
          <span>
            Con <strong>{group.teacher_name}</strong>
          </span>
          <ArrowUpRight size={15} />
        </Link>
        <div className="course-details">
          <span>
            <CalendarDays size={16} />
            <span className="capitalize">{weekday}</span> · {time}
          </span>
          <span>
            <Clock3 size={16} />
            {group.duration} minutos
          </span>
          <span>
            <Users size={16} />
            {Math.max(free, 0)} {free === 1 ? 'plaza disponible' : 'plazas disponibles'}
          </span>
        </div>
        <div className="card-price">
          <span>
            <strong>50 €</strong>
            <span> / mes</span>
          </span>
          <Link
            className="round-link"
            href={`/clases/${group.id}${campaign ? `?campana=${encodeURIComponent(campaign)}` : ''}`}
            aria-label={`Ver ${group.title}`}
          >
            <ArrowUpRight size={21} />
          </Link>
        </div>
        <div className={`group-state ${forming ? 'waiting' : ''}`}>
          <span className="status-dot" />
          {forming
            ? 'En formación · reserva sin cobro'
            : group.status === 'full' || free <= 0
              ? 'Grupo completo'
              : 'Grupo confirmado'}
        </div>
      </div>
    </article>
  );
}
export function TeacherCard({ teacher, index = 0 }: { teacher: Teacher; index?: number }) {
  return (
    <article className="teacher-card">
      <div className={`teacher-art teacher-art-${index % 3}`}>
        <Avatar name={teacher.name} index={index} large />
        <span className="art-label">
          <ShieldCheck size={14} /> Docente seleccionado
        </span>
      </div>
      <div className="teacher-info">
        <div className="teacher-name">
          <h3>{teacher.name}</h3>
          <ArrowUpRight size={20} />
        </div>
        <p>{teacher.headline}</p>
        <div className="tags">
          {teacher.specialties.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className="teacher-bottom">
          <span>{teacher.languages.join(' · ')}</span>
          <span>
            {teacher.rating ? `★ ${teacher.rating} (${teacher.reviews})` : 'Sin reseñas publicadas'}
          </span>
        </div>
        <Link
          className="stretched-link"
          href={`/profesores/${teacher.id}`}
          aria-label={`Conocer a ${teacher.name}`}
        />
      </div>
    </article>
  );
}
export function PriceCard() {
  return (
    <div className="price-card">
      <div className="price-top">
        <span className="eyebrow">UN PLAN. TODO LO IMPORTANTE.</span>
        <span className="popular">Tu próxima jugada</span>
      </div>
      <h3>Tu sitio en la academia</h3>
      <div className="big-price">
        50<span>€ / mes</span>
      </div>
      <p>
        Un profesor que te conoce.
        <br />
        Un grupo con el que avanzar.
      </p>
      <ul>
        {[
          '4 clases online por ciclo mensual',
          '60 minutos para aprender de verdad',
          'Grupos estables de 2 a 4 alumnos',
          'Profesor seleccionado por TopChess',
          'Horario fijo y cuatro fechas confirmadas',
          'Sin permanencia en renovaciones futuras',
        ].map((x) => (
          <li key={x}>
            <Check size={17} />
            {x}
          </li>
        ))}
      </ul>
      <Link className="button full" href="/clases">
        Encuentra tu grupo <MoveRight size={18} />
      </Link>
      <small>
        Reserva ahora e incorpórate el mes siguiente.
        <br />
        Sin cobro por reservar. Consulta las cuatro fechas antes de contratar.
      </small>
      <Link className="text-link" href="/como-funciona">
        Cómo funcionan las clases <MoveRight size={15} />
      </Link>
    </div>
  );
}
