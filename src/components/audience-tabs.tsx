'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BookOpen, GraduationCap, ArrowUpRight } from 'lucide-react';

type Audience = 'alumnos' | 'profesores';
export function AudienceTabs({
  initialAudience,
  studentContent,
  teacherContent,
}: {
  initialAudience: Audience;
  studentContent: ReactNode;
  teacherContent: ReactNode;
}) {
  const [active, setActive] = useState<Audience>(initialAudience);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const audiences: Audience[] = ['alumnos', 'profesores'];
  function choose(audience: Audience) {
    setActive(audience);
    const url = new URL(window.location.href);
    url.searchParams.set('para', audience);
    window.history.replaceState(window.history.state, '', url);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % 2;
    else if (event.key === 'ArrowLeft') next = (index + 1) % 2;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else return;
    event.preventDefault();
    choose(audiences[next]);
    buttons.current[next]?.focus();
  }
  return (
    <>
      <section className="audience-switch container" aria-label="Encuentra tu lugar en TopChess">
        <p>Una academia. Dos formas de crecer.</p>
        <div className="audience-tablist" role="tablist" aria-label="Beneficios de TopChess">
          {audiences.map((audience, index) => {
            const Icon = audience === 'alumnos' ? BookOpen : GraduationCap;
            return (
              <button
                key={audience}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                id={`tab-${audience}`}
                role="tab"
                type="button"
                aria-selected={active === audience}
                aria-controls={`panel-${audience}`}
                tabIndex={active === audience ? 0 : -1}
                onClick={() => choose(audience)}
                onKeyDown={(event) => navigate(event, index)}
              >
                <Icon size={20} />
                <span>
                  <strong>Para {audience}</strong>
                  <small>
                    {audience === 'alumnos' ? 'Quiero aprender ajedrez' : 'Quiero enseñar y crecer'}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            );
          })}
        </div>
      </section>
      <div
        className="audience-panel"
        role="tabpanel"
        id="panel-alumnos"
        aria-labelledby="tab-alumnos"
        hidden={active !== 'alumnos'}
        tabIndex={0}
      >
        {studentContent}
      </div>
      <div
        className="audience-panel"
        role="tabpanel"
        id="panel-profesores"
        aria-labelledby="tab-profesores"
        hidden={active !== 'profesores'}
        tabIndex={0}
      >
        {teacherContent}
      </div>
    </>
  );
}
