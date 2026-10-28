'use client';
import { ActionForm } from './action-form';
import { TimePicker } from './time-picker';
import type { Availability } from '@/lib/teacher-availability';
const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export function TeacherAvailabilityForm({ slots }: { slots: Availability[] }) {
  return (
    <>
      <section className="panel">
        <h2>Tus horarios disponibles</h2>
        <p>
          Marca uno o varios días y añade las horas a las que puedes enseñar. Se mostrarán en tu
          ficha cuando tu perfil esté publicado.
        </p>
        <p className="small-text">
          Hora de Madrid · Se repite cada semana. Cambiar estos horarios no modifica ninguna clase
          acordada.
        </p>
        <ActionForm
          endpoint="/api/teacher/availability"
          label="Publicar horario"
          transform={(f) => ({
            weekdays: f.getAll('weekdays').map(Number),
            start: f.get('start'),
            end: f.get('end'),
          })}
        >
          <fieldset className="availability-days">
            <legend>¿Qué días puedes dar clase?</legend>
            {days.map((day, i) => (
              <label className="check-label" key={day}>
                <input type="checkbox" name="weekdays" value={i + 1} />
                {day}
              </label>
            ))}
          </fieldset>
          <div className="form-row">
            <TimePicker name="start" label="Desde" required />
            <TimePicker name="end" label="Hasta" required />
          </div>
        </ActionForm>
      </section>
      <section className="panel">
        <h2>Horarios guardados</h2>
        {slots.length === 0 ? (
          <p>Aún no has indicado tus horarios. Añade tu primera franja arriba.</p>
        ) : (
          <ul className="availability-list">
            {slots.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{days[s.weekday - 1]}</strong>
                  <p>
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </p>
                  {!s.approved && <small>Pendiente de publicar</small>}
                </div>
                <div className="availability-actions">
                  {!s.approved && (
                    <ActionForm endpoint="/api/teacher/availability" label="Publicar">
                      <input type="hidden" name="weekday" value={s.weekday} />
                      <input type="hidden" name="start" value={s.start_time.slice(0, 5)} />
                      <input type="hidden" name="end" value={s.end_time.slice(0, 5)} />
                    </ActionForm>
                  )}
                  <ActionForm endpoint="/api/teacher/availability/remove" label="Quitar">
                    <input type="hidden" name="id" value={s.id} />
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
