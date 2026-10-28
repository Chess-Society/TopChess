'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container section empty-state">
      <h1>No hemos podido cargar esta página.</h1>
      <p>
        Vuelve a intentarlo en unos instantes. No se ha confirmado ninguna operación desde esta
        pantalla.
      </p>
      <button className="button" onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
