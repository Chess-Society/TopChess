'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
export function ActionForm({
  endpoint,
  children,
  label = 'Guardar',
  multipart = false,
  transform,
  successRedirect,
}: {
  endpoint: string;
  children: React.ReactNode;
  label?: string;
  multipart?: boolean;
  transform?: (data: FormData) => Record<string, unknown>;
  successRedirect?: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const data = transform
        ? transform(form)
        : Object.fromEntries(
            Array.from(form.entries()).map(([k, v]) => [k, v === 'on' ? true : v]),
          );
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: multipart ? undefined : { 'Content-Type': 'application/json' },
        body: multipart ? form : JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se ha podido completar la operación.');
      setError(false);
      setMessage(result.message || 'Guardado correctamente.');
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      if (result.redirect || successRedirect) {
        router.push(result.redirect || successRedirect);
        router.refresh();
      } else router.refresh();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : 'Error de conexión. Vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="action-form">
      {children}
      <button className="button" type="submit" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="spin" size={18} />
            Procesando…
          </>
        ) : (
          <>
            {label}
            <ArrowUpRight size={17} />
          </>
        )}
      </button>
      {message && (
        <div
          className={`form-message ${error ? 'form-error' : 'form-success'}`}
          role={error ? 'alert' : 'status'}
        >
          {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{message}</span>
        </div>
      )}
    </form>
  );
}
export function Logout() {
  return (
    <ActionForm endpoint="/api/auth/logout" label="Cerrar sesión">
      <></>
    </ActionForm>
  );
}
