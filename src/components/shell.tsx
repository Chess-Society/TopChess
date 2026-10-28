'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight, Menu, X, ChevronRight } from 'lucide-react';
export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="brand-mark" aria-hidden="true">
        ♜
      </span>
      <span>
        TopChess<span className="brand-global">GLOBAL</span>
      </span>
    </span>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="header">
      <div className="container nav">
        <Link href="/" aria-label="TopChess Global, inicio">
          <Wordmark />
        </Link>
        <nav className={open ? 'nav-links is-open' : 'nav-links'} aria-label="Principal">
          <Link
            aria-current={path === '/clases' ? 'page' : undefined}
            href="/clases"
            onClick={() => setOpen(false)}
          >
            Buscar clases
          </Link>
          <Link
            aria-current={path.startsWith('/profesores') ? 'page' : undefined}
            href="/profesores"
            onClick={() => setOpen(false)}
          >
            Nuestros profesores
          </Link>
          <Link href="/?para=profesores" onClick={() => setOpen(false)}>
            Para profesores
          </Link>
          <Link href="/como-funciona" onClick={() => setOpen(false)}>
            Cómo funciona
          </Link>
          <Link href="/precios" onClick={() => setOpen(false)}>
            Precios
          </Link>
          <Link className="mobile-access" href="/acceso" onClick={() => setOpen(false)}>
            Mi academia
          </Link>
        </nav>
        <div className="nav-actions">
          <Link className="login-link" href="/acceso">
            Mi academia <ArrowUpRight size={16} />
          </Link>
          <Link className="button small" href="/clases">
            Encuentra tu clase <ChevronRight size={15} />
          </Link>
          <button
            className="menu-button"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link href="/">
            <Wordmark />
          </Link>
          <p>
            Ajedrez que enseña a pensar.
            <br />
            Una academia para seguir creciendo.
          </p>
          <span className="small-text">Hecho para aprender, jugada a jugada.</span>
        </div>
        <div>
          <h3>La academia</h3>
          <Link href="/clases">Buscar clases</Link>
          <Link href="/profesores">Nuestros profesores</Link>
          <Link href="/como-funciona">Cómo funciona</Link>
          <Link href="/precios">Precios</Link>
        </div>
        <div>
          <h3>Formamos equipo</h3>
          <Link href="/?para=profesores">Enseña con TopChess</Link>
          <Link href="/preguntas-frecuentes">Preguntas frecuentes</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/panel">Mi academia</Link>
        </div>
        <div>
          <h3>Con transparencia</h3>
          <Link href="/legal/condiciones">Condiciones de contratación</Link>
          <Link href="/legal/asistencia">Clases y asistencia</Link>
          <Link href="/legal/privacidad">Privacidad</Link>
          <Link href="/legal/resenas">Política de reseñas</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} TopChess Global</span>
        <div>
          <Link href="/legal/aviso">Aviso legal</Link>
          <Link href="/legal/cookies">Cookies</Link>
          <span>Español · EUR €</span>
        </div>
      </div>
    </footer>
  );
}
