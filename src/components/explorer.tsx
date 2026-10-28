'use client';
import { Select } from '@/components/select';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { GroupCard, TeacherCard } from './ui';
import type { Group, Teacher } from '@/lib/catalog';
export function Explorer({
  groups = [],
  teachers = [],
  mode = 'groups',
}: {
  groups?: Group[];
  teachers?: Teacher[];
  mode?: 'groups' | 'teachers';
}) {
  const campaign = useSearchParams().get('campana') || undefined;
  const [level, setLevel] = useState(''),
    [day, setDay] = useState(''),
    [time, setTime] = useState(''),
    [language, setLanguage] = useState(''),
    [specialty, setSpecialty] = useState(''),
    [search, setSearch] = useState(''),
    [available, setAvailable] = useState(false);
  const filtered = groups.filter((g) => {
    const d = new Date(g.first_at);
    const hour = Number(
      new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: g.timezone,
      }).format(d),
    );
    return (
      (!level || g.level === level) &&
      (!day ||
        new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: g.timezone }).format(d) ===
          day) &&
      (!time || (time === 'morning' ? hour < 14 : hour >= 14)) &&
      (!language || g.language === language) &&
      (!specialty || g.specialties?.includes(specialty)) &&
      (!available || g.count < g.capacity) &&
      `${g.title} ${g.teacher_name}`.toLowerCase().includes(search.toLowerCase())
    );
  });
  const faculty = teachers.filter(
    (t) =>
      (!level || t.levels.includes(level)) &&
      (!language || t.languages.includes(language)) &&
      (!specialty || t.specialties.includes(specialty)) &&
      `${t.name} ${t.headline}`.toLowerCase().includes(search.toLowerCase()),
  );
  const specialties = Array.from(
    new Set(
      mode === 'groups'
        ? groups.flatMap((g) => g.specialties || [])
        : teachers.flatMap((t) => t.specialties),
    ),
  );
  function reset() {
    setLevel('');
    setDay('');
    setTime('');
    setLanguage('');
    setSpecialty('');
    setSearch('');
    setAvailable(false);
  }
  const count = mode === 'groups' ? filtered.length : faculty.length;
  return (
    <>
      <div className="filters">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Buscar por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mode === 'groups' ? 'Busca una clase o un profesor' : 'Busca un profesor'}
          />
        </div>
        <label>
          Nivel
          <Select value={level} onValueChange={setLevel}>
            <option value="">Todos los niveles</option>
            {['Principiante', 'Intermedio', 'Avanzado'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </label>
        {mode === 'groups' && (
          <>
            <label>
              Día
              <Select value={day} onValueChange={setDay}>
                <option value="">Cualquier día</option>
                {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </Select>
            </label>
            <label>
              Horario
              <Select value={time} onValueChange={setTime}>
                <option value="">Cualquier hora</option>
                <option value="morning">Mañanas · antes de las 14 h</option>
                <option value="afternoon">Tardes · desde las 14 h</option>
              </Select>
            </label>
          </>
        )}
        <label>
          Idioma
          <Select value={language} onValueChange={setLanguage}>
            <option value="">Todos los idiomas</option>
            <option>Español</option>
            <option>Inglés</option>
          </Select>
        </label>
        <label>
          Especialidad
          <Select value={specialty} onValueChange={setSpecialty}>
            <option value="">Todas</option>
            {specialties.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </label>
        {mode === 'groups' && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />{' '}
            Solo con plazas
          </label>
        )}
        <button className="text-link" onClick={reset}>
          <X size={15} />
          Limpiar filtros
        </button>
      </div>

      <div className="results-line">
        <span>
          <strong>{count}</strong>{' '}
          {mode === 'groups' ? 'grupos para seguir creciendo' : 'profesores para acompañarte'}
        </span>
        <span>Horarios en Europe/Madrid</span>
      </div>
      <div className={mode === 'groups' ? 'course-grid' : 'teacher-grid'}>
        {mode === 'groups'
          ? filtered.map((g, i) => <GroupCard key={g.id} group={g} index={i} campaign={campaign} />)
          : faculty.map((t, i) => <TeacherCard key={t.id} teacher={t} index={i} />)}
      </div>
      {count === 0 && (
        <div className="empty-state">
          <Search size={30} />
          <h3>No hay resultados con estos filtros.</h3>
          <p>Prueba otro nivel u horario, o contacta con la academia.</p>
          <button className="button ghost" onClick={reset}>
            Restablecer filtros
          </button>
        </div>
      )}
    </>
  );
}
