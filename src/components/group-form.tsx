'use client';
import { fromZonedTime } from 'date-fns-tz';
import { ActionForm } from './action-form';
import { Select } from './select';
import { TimePicker } from './time-picker';

export function GroupForm({
  teacherId,
  teachers,
  admin = false,
}: {
  teacherId?: string;
  teachers?: { id: string; name: string }[];
  admin?: boolean;
}) {
  return (
    <section className="panel">
      <h2>{admin ? 'Crear un grupo de apoyo' : 'Publicar un nuevo grupo'}</h2>
      <p>
        Cuatro clases por mes, de dos a cuatro alumnos y comienzo el mes siguiente. Los alumnos
        verán tus fechas y podrán reservar plaza sin que la administración tenga que darles de alta.
      </p>
      <p className="small-text">
        Hora de Madrid. La primera clase debe ser la primera fecha de ese día de la semana en el
        mes. La inscripción cierra 48 horas antes del día 1.
      </p>
      <ActionForm
        endpoint={admin ? '/api/admin/groups' : '/api/teacher/groups'}
        label="Publicar grupo"
        transform={(f) => ({
          teacherId: f.get('teacherId'),
          title: f.get('title'),
          level: f.get('level'),
          language: f.get('language'),
          capacity: Number(f.get('capacity')),
          firstAt: fromZonedTime(
            `${f.get('firstAtDate')}T${f.get('firstAtTime')}`,
            'Europe/Madrid',
          ).toISOString(),
          duration: Number(f.get('duration')),
          timezone: 'Europe/Madrid',
          excludedDates: String(f.get('excludedDates') || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        })}
      >
        {admin ? (
          <label>
            Profesor autorizado
            <Select name="teacherId" required>
              <option value="">Selecciona un profesor</option>
              {teachers?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <input type="hidden" name="teacherId" value={teacherId} />
        )}
        <label>
          Nombre del grupo
          <input name="title" required minLength={5} maxLength={120} />
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
            <input name="language" required defaultValue="Español" />
          </label>
        </div>
        <label>
          Fecha de la primera clase
          <input type="date" name="firstAtDate" required />
        </label>
        <TimePicker name="firstAtTime" label="Hora semanal · Madrid" required />
        {!admin && (
          <p className="small-text">
            Elige un horario dentro de la disponibilidad que has publicado.
          </p>
        )}
        <div className="form-row">
          <label>
            Plazas
            <input type="number" name="capacity" min={2} max={4} defaultValue={4} required />
          </label>
          <label>
            Duración de cada clase (minutos)
            <input type="number" name="duration" min={30} max={180} defaultValue={60} required />
          </label>
        </div>
        <details>
          <summary>Festivos y excepciones</summary>
          <label>
            Fechas sin clase, separadas por coma
            <input name="excludedDates" placeholder="2026-12-25, 2027-01-01" />
          </label>
        </details>
      </ActionForm>
    </section>
  );
}
