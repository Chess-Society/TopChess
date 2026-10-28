'use client';
import { fromZonedTime } from 'date-fns-tz';
import { useMemo, useState } from 'react';
import { ActionForm } from './action-form';
import { Select } from './select';
import { TimePicker } from './time-picker';
import { groupStartOptions, type BusySession } from '@/lib/group-options';
import { nextBillingMonth } from '@/lib/monthly-calendar';
import type { Availability } from '@/lib/teacher-availability';
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function GroupForm({
  teacherId,
  teachers,
  admin = false,
  availability = [],
  busySessions = [],
  onEditAvailability,
}: {
  teacherId?: string;
  teachers?: { id: string; name: string }[];
  admin?: boolean;
  availability?: Availability[];
  busySessions?: BusySession[];
  onEditAvailability?: () => void;
}) {
  const [duration, setDuration] = useState(60),
    [excludedText, setExcludedText] = useState(''),
    [selected, setSelected] = useState('');
  const excluded = useMemo(
    () =>
      excludedText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [excludedText],
  );
  const options = useMemo(
    () => (admin ? [] : groupStartOptions(availability, duration, busySessions, excluded)),
    [admin, availability, duration, busySessions, excluded],
  );
  const choice = options.find((o) => o.key === selected) || options[0];
  const registrationClosed = nextBillingMonth().getTime() - 48 * 3600_000 <= Date.now();
  const dateLabel = (value: string) =>
    new Date(value).toLocaleString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    });
  return (
    <section className="panel">
      <h2>{admin ? 'Crear un grupo de apoyo' : 'Publicar un nuevo grupo'}</h2>
      <p>
        Cuatro clases por mes, de dos a cuatro alumnos y comienzo el mes siguiente. Los alumnos
        verán tus fechas y podrán reservar plaza sin que la administración tenga que darles de alta.
      </p>
      <p className="small-text">
        Hora de Madrid.{' '}
        {admin
          ? 'Indica el inicio del horario semanal.'
          : 'Elige uno de tus horarios publicados: calculamos el comienzo y las cuatro fechas del mes.'}{' '}
        La inscripción cierra 48 horas antes del día 1.
      </p>
      <ActionForm
        endpoint={admin ? '/api/admin/groups' : '/api/teacher/groups'}
        label="Publicar grupo"
        disabled={!admin && !choice}
        transform={(f) => ({
          teacherId: f.get('teacherId'),
          title: f.get('title'),
          level: f.get('level'),
          language: f.get('language'),
          capacity: Number(f.get('capacity')),
          firstAt: admin
            ? fromZonedTime(
                `${f.get('firstAtDate')}T${f.get('firstAtTime')}`,
                'Europe/Madrid',
              ).toISOString()
            : choice?.firstAt,
          ...(!admin ? { availabilityId: choice?.availabilityId } : {}),
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
        {!admin && (
          <>
            <h3>Tu disponibilidad publicada</h3>
            <div className="tags">
              {availability
                .filter((s) => s.approved)
                .map((s) => (
                  <span key={s.id}>
                    {weekdays[s.weekday - 1]} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                ))}
            </div>
            {choice ? (
              <>
                <label>
                  Horario del grupo
                  <Select
                    name="availableStart"
                    value={choice.key}
                    onValueChange={setSelected}
                    required
                  >
                    {options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {weekdays[o.weekday - 1]} · {o.start}–{o.end}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="notice">
                  <strong>Primera clase: {dateLabel(choice.firstAt)}</strong>
                  <p>Fechas del primer mes, calculadas automáticamente:</p>
                  <ul>
                    {choice.dates.map((d) => (
                      <li key={d}>{dateLabel(d)}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p role="status">
                {registrationClosed
                  ? 'La inscripción del próximo mes ya está cerrada. Podrás preparar nuevos grupos al comenzar el siguiente mes.'
                  : 'No hay horarios libres que encajen con esta duración y calendario. Revisa tu disponibilidad o ajusta la duración. Las clases ya programadas se mantienen.'}
              </p>
            )}
            {onEditAvailability && (
              <button type="button" className="text-link" onClick={onEditAvailability}>
                Cambiar mi disponibilidad
              </button>
            )}
          </>
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
        {admin && (
          <>
            <label>
              Fecha de la primera clase
              <input type="date" name="firstAtDate" required />
            </label>
            <TimePicker name="firstAtTime" label="Hora semanal · Madrid" required />
          </>
        )}
        <div className="form-row">
          <label>
            Plazas
            <input type="number" name="capacity" min={2} max={4} defaultValue={4} required />
          </label>
          <label>
            Duración de cada clase (minutos)
            <input
              type="number"
              name="duration"
              min={30}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
            />
          </label>
        </div>
        <details>
          <summary>Festivos y excepciones</summary>
          <label>
            Fechas sin clase, separadas por coma
            <input
              name="excludedDates"
              value={excludedText}
              onChange={(e) => setExcludedText(e.target.value)}
              placeholder="2026-12-25, 2027-01-01"
            />
          </label>
        </details>
      </ActionForm>
    </section>
  );
}
