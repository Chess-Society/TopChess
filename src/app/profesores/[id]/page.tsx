import Link from 'next/link';
import { notFound } from 'next/navigation';
import { teachers, groups } from '@/lib/catalog';
import { Avatar, GroupCard } from '@/components/ui';
import { query } from '@/lib/db';
import { WEEKDAYS } from '@/lib/teacher-availability';
export const dynamic = 'force-dynamic';
export default async function TeacherDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [faculty, catalog] = await Promise.all([teachers(), groups()]);
  const t = faculty.items.find((x) => x.id === id);
  if (!t) notFound();
  const reviews = await query<{ id: string; rating: number; comment: string; created_at: string }>(
    "SELECT r.id,r.rating,r.comment,r.created_at FROM reviews r JOIN group_enrollments e ON e.id=r.enrollment_id JOIN groups g ON g.id=e.group_id WHERE g.teacher_id=$1 AND r.status='published' ORDER BY r.created_at DESC LIMIT 20",
    [id],
  );
  return (
    <div className="container section">
      <section className="profile-hero">
        <Avatar name={t.name} large />
        <div>
          <span className="eyebrow">EL EQUIPO DE TU ACADEMIA</span>
          <h1>{t.name}</h1>
          <p className="lead">{t.headline}</p>
          <div className="tags">
            {t.specialties.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      </section>
      <div className="profile-about">
        {t.bio?.trim() && (
          <div>
            <h2>Una forma de enseñar</h2>
            <p>{t.bio}</p>
          </div>
        )}
        <div>
          <h3>Idiomas</h3>
          <p>{t.languages.join(' · ')}</p>
          <h3>Niveles</h3>
          <p>{t.levels.join(' · ')}</p>
        </div>
      </div>
      <section className="panel public-availability">
        <h2>Disponibilidad habitual</h2>
        <p>Hora de Madrid · Horarios semanales indicados por el profesor.</p>
        {t.availability?.length ? (
          <ul className="availability-list">
            {t.availability.map((s) => (
              <li key={s.id}>
                <strong>{WEEKDAYS[s.weekday - 1]}</strong>
                <span>
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>El profesor todavía no ha publicado sus horarios habituales.</p>
        )}
        <p className="small-text">
          Para reservar, consulta los grupos publicados debajo: allí verás las fechas concretas y
          las plazas. Estas franjas no cambian las clases ya acordadas.
        </p>
      </section>
      <h2>Encuentra tu grupo con {t.name.split(' ')[0]}</h2>
      {!catalog.items.some((g) => g.teacher_id === id) && (
        <p>
          Todavía no hay grupos publicados con este profesor. Las nuevas incorporaciones se
          organizan para el mes siguiente.
        </p>
      )}
      <div className="course-grid">
        {catalog.items
          .filter((g) => g.teacher_id === id)
          .map((g, i) => (
            <GroupCard key={g.id} group={g} index={i} />
          ))}
      </div>
      <div className="section compact-section">
        <h2>Reseñas verificadas</h2>
        {reviews.length === 0 ? (
          <p>No hay reseñas publicadas. Solo pueden valorar alumnos que hayan recibido clases.</p>
        ) : (
          reviews.map((r) => (
            <article className="review" key={r.id}>
              <strong>
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
              </strong>
              <p>{r.comment}</p>
              <small>
                Relación académica verificada · {new Date(r.created_at).toLocaleDateString('es-ES')}
              </small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
