import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container section empty-state">
      <span className="giant-piece" aria-hidden="true">
        ♘
      </span>
      <h1>Esta jugada no existe.</h1>
      <p>No encontramos la página que buscas.</p>
      <Link className="button" href="/">
        Volver al inicio
      </Link>
    </div>
  );
}
