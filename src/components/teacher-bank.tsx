'use client';
import { useState } from 'react';
import { ActionForm } from './action-form';
export function TeacherBankForm() {
  return (
    <section className="panel">
      <h2>Cuenta para recibir tus pagos</h2>
      <p>
        TopChess te paga por transferencia bancaria. No necesitas una cuenta de Stripe. Estos datos
        solo son accesibles para ti y la administración de la escuela.
      </p>
      <ActionForm endpoint="/api/teacher/bank" label="Guardar cuenta bancaria">
        <label>
          Titular de la cuenta
          <input name="holder" minLength={3} maxLength={150} required autoComplete="name" />
        </label>
        <label>
          IBAN
          <input
            name="iban"
            minLength={15}
            maxLength={42}
            required
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </ActionForm>
    </section>
  );
}
export function BankDetails({ teacherId }: { teacherId: string }) {
  const [details, setDetails] = useState<{
      holder?: string;
      iban?: string;
      updated_at?: string;
      message?: string;
    }>(),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch(`/api/teachers/${teacherId}/bank`, { cache: 'no-store' }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo consultar la cuenta.');
      setDetails(d);
    } catch {
      setDetails({ message: 'No se pudo consultar la cuenta bancaria.' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {!details ? (
        <button type="button" className="button ghost" onClick={load} disabled={busy}>
          Ver cuenta bancaria
        </button>
      ) : details.iban ? (
        <p>
          <strong>{details.holder}</strong>
          <br />
          {details.iban}
          <br />
          <small>Actualizada: {new Date(details.updated_at!).toLocaleDateString('es-ES')}</small>
        </p>
      ) : (
        <p>{details.message || 'El profesor todavía no ha indicado su cuenta.'}</p>
      )}
    </div>
  );
}
