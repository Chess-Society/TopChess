'use client';
import { ActionForm } from './action-form';
import { money } from '@/lib/domain';
import { BankDetails } from './teacher-bank';
type Row = Record<string, string | number | boolean | null | undefined>;
export type SettlementsData = { summaries: Row[]; payouts: Row[] };
export function SettlementsPanel({
  data,
  admin = false,
}: {
  data?: SettlementsData | null;
  admin?: boolean;
}) {
  return (
    <section className="panel">
      <h2>{admin ? 'Pagos a profesores' : 'Lo que te corresponde'}</h2>
      <p>
        El porcentaje se aplica a la cuota de 50 €. TopChess asume el IVA y las comisiones de
        Stripe. Se genera la parte de cada clase impartida y cobrada; el cierre del día 28 incluye
        las clases realizadas hasta el 27. Las posteriores pasan al siguiente cierre.
      </p>
      {admin && (
        <ActionForm endpoint="/api/admin/settlements-refresh" label="Actualizar importes">
          <p className="small-text">
            Comprueba el desglose, realiza la transferencia desde tu banco y después registra su
            referencia.
          </p>
        </ActionForm>
      )}
      {!data?.summaries.length ? (
        <p>No hay importes registrados todavía.</p>
      ) : (
        data.summaries.map((s) => (
          <article className="panel" key={String(s.teacher_id)}>
            <h3>{s.name}</h3>
            {admin && <BankDetails teacherId={String(s.teacher_id)} />}
            <div className="data-row">
              <span>Porcentaje: {Number(s.teacher_bps) / 100} %</span>
              <strong>Generado: {money(Number(s.earned))}</strong>
              <strong>Pendiente: {money(Number(s.pending))}</strong>
            </div>
            <p className="small-text">
              Una cuota completa de 50 € al {Number(s.teacher_bps) / 100} % corresponde a{' '}
              {money(Math.floor((5000 * Number(s.teacher_bps)) / 10000))} por sus cuatro clases.
            </p>
          </article>
        ))
      )}
      <h3>{admin ? 'Liquidaciones para transferir' : 'Historial de pagos'}</h3>
      {!data?.payouts.length ? (
        <p>Las liquidaciones se preparan a partir del día 28.</p>
      ) : (
        data.payouts.map((p) => (
          <article className="panel" key={String(p.id)}>
            <div className="data-row">
              <div>
                <strong>
                  {p.name} · {p.period}
                </strong>
                <p>{p.status === 'paid' ? 'Pagado por TopChess' : 'Pendiente de transferencia'}</p>
              </div>
              <strong>{money(Number(p.amount_cents))}</strong>
            </div>
            {p.paid_at && (
              <p>
                Fecha: {new Date(String(p.paid_at)).toLocaleDateString('es-ES')} · Referencia:{' '}
                {p.payment_reference}
              </p>
            )}
            {Number(p.needs_review) > 0 && (
              <p className="form-error">
                Hay un ajuste o una disputa pendiente de revisar. No registres la transferencia
                hasta resolver la incidencia.
              </p>
            )}
            {admin &&
              !Number(p.needs_review) &&
              p.status !== 'paid' &&
              Number(p.amount_cents) > 0 && (
                <ActionForm
                  endpoint="/api/admin/manual-payout"
                  label="Registrar transferencia realizada"
                >
                  <input type="hidden" name="payoutId" value={String(p.id)} />
                  <input type="hidden" name="amount" value={String(p.amount_cents)} />
                  <label>
                    Referencia bancaria
                    <input
                      name="reference"
                      minLength={3}
                      maxLength={150}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label className="check-label">
                    <input name="confirmed" type="checkbox" required />
                    <span>
                      Confirmo que ya he realizado esta transferencia. Este botón solo la registra.
                    </span>
                  </label>
                </ActionForm>
              )}
          </article>
        ))
      )}
    </section>
  );
}
