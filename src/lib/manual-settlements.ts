import { randomUUID } from 'node:crypto';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { assert, splitCents } from './domain';
import { atomic, d1Query, auditStatement, type Statement } from './cloudflare';
type Row = Record<string, any>;
type Store = {
  query: <T = Row>(sql: string, values?: unknown[]) => Promise<T[]>;
  write: (statements: Statement[]) => Promise<unknown>;
};
export function perSessionShare(total: number, index: number) {
  assert(
    Number.isSafeInteger(total) && total >= 0 && Number.isInteger(index) && index >= 0 && index < 4,
    'Asignación inválida.',
  );
  return Math.floor(total / 4) + (index < total % 4 ? 1 : 0);
}
export class ManualSettlements {
  constructor(private store: Store = { query: d1Query, write: atomic }) {}
  async refresh(now = new Date()) {
    const rows = await this.store.query<Row>(
      `SELECT p.id AS payment_id,p.amount_cents,p.teacher_bps,g.teacher_id,s.id AS session_id,s.status,s.ends_at,row_number() OVER(PARTITION BY p.id ORDER BY s.starts_at,s.id)-1 AS ordinal,count(*) OVER(PARTITION BY p.id) AS n FROM payments p JOIN subscriptions sub ON sub.id=p.subscription_id JOIN group_enrollments e ON e.id=sub.enrollment_id JOIN groups g ON g.id=e.group_id JOIN sessions s ON s.group_id=g.id AND s.starts_at>=p.period_start AND s.ends_at<=p.period_end WHERE p.status='paid' AND sub.billing_model='calendar_month' AND s.status NOT IN ('cancelled','rescheduled')`,
    );
    for (const row of rows) {
      if (Number(row.n) !== 4 || row.status !== 'taught' || new Date(row.ends_at) > now) continue;
      const amount = perSessionShare(
        splitCents(row.amount_cents, row.teacher_bps).teacher,
        Number(row.ordinal),
      );
      const key = `earned:${row.payment_id}:${row.session_id}`;
      await this.store.write([
        {
          sql: "INSERT INTO ledger_entries(payment_id,kind,amount_cents,idempotency_key) VALUES($1,'teacher_allocation',$2,$3) ON CONFLICT(idempotency_key) DO NOTHING",
          values: [row.payment_id, amount, key],
        },
        {
          sql: 'INSERT INTO teacher_earnings(ledger_id,teacher_id,earned_at) SELECT id,$2,$3 FROM ledger_entries WHERE idempotency_key=$1 ON CONFLICT(ledger_id) DO NOTHING',
          values: [key, row.teacher_id, row.ends_at],
        },
      ]);
    }
    const reversals = await this.store.query<Row>(
      "SELECT p.id,g.teacher_id,sum(le.amount_cents) AS amount FROM payments p JOIN ledger_entries le ON le.payment_id=p.id AND le.kind='teacher_allocation' JOIN subscriptions sub ON sub.id=p.subscription_id JOIN group_enrollments e ON e.id=sub.enrollment_id JOIN groups g ON g.id=e.group_id WHERE p.status='refunded' GROUP BY p.id,g.teacher_id",
    );
    for (const r of reversals) {
      const key = `earned-reversal:${r.id}`;
      await this.store.write([
        {
          sql: "INSERT INTO ledger_entries(payment_id,kind,amount_cents,idempotency_key) VALUES($1,'adjustment',-$2,$3) ON CONFLICT(idempotency_key) DO NOTHING",
          values: [r.id, r.amount, key],
        },
        {
          sql: 'INSERT INTO teacher_earnings(ledger_id,teacher_id,earned_at) SELECT id,$2,$3 FROM ledger_entries WHERE idempotency_key=$1 ON CONFLICT(ledger_id) DO NOTHING',
          values: [key, r.teacher_id, now],
        },
        {
          sql: "INSERT INTO manual_payout_items(payout_id,ledger_id) SELECT p.id,negative.id FROM manual_payout_items old JOIN ledger_entries original ON original.id=old.ledger_id JOIN payouts p ON p.id=old.payout_id JOIN ledger_entries negative ON negative.idempotency_key=$2 WHERE original.payment_id=$1 AND original.kind='teacher_allocation' AND p.closed_at IS NULL LIMIT 1 ON CONFLICT(ledger_id) DO NOTHING",
          values: [r.id, key],
        },
      ]);
    }
    await this.store.write([
      {
        sql: 'UPDATE payouts SET amount_cents=max(0,coalesce((SELECT sum(le.amount_cents) FROM manual_payout_items i JOIN ledger_entries le ON le.id=i.ledger_id WHERE i.payout_id=payouts.id),0)) WHERE closed_at IS NULL',
      },
    ]);
    const date = formatInTimeZone(now, 'Europe/Madrid', 'yyyy-MM-dd');
    if (Number(date.slice(-2)) < 28) return;
    const period = date.slice(0, 7),
      cutoff = fromZonedTime(`${period}-28T00:00:00`, 'Europe/Madrid');
    const teachers = await this.store.query<Row>(
      'SELECT DISTINCT teacher_id FROM teacher_earnings WHERE earned_at<$1',
      [cutoff],
    );
    for (const t of teachers) {
      await this.store.write([
        {
          sql: 'INSERT INTO payouts(id,teacher_id,period,amount_cents) VALUES($1,$2,$3,0) ON CONFLICT(teacher_id,period) DO NOTHING',
          values: [randomUUID(), t.teacher_id, period],
        },
        {
          sql: 'INSERT INTO manual_payout_items(payout_id,ledger_id) SELECT p.id,e.ledger_id FROM payouts p JOIN teacher_earnings e ON e.teacher_id=p.teacher_id WHERE p.teacher_id=$1 AND p.period=$2 AND p.closed_at IS NULL AND e.earned_at<$3 AND NOT EXISTS(SELECT 1 FROM manual_payout_items old WHERE old.ledger_id=e.ledger_id) ON CONFLICT(ledger_id) DO NOTHING',
          values: [t.teacher_id, period, cutoff],
        },
        {
          sql: 'UPDATE payouts SET amount_cents=max(0,coalesce((SELECT sum(le.amount_cents) FROM manual_payout_items i JOIN ledger_entries le ON le.id=i.ledger_id WHERE i.payout_id=payouts.id),0)) WHERE teacher_id=$1 AND period=$2 AND closed_at IS NULL',
          values: [t.teacher_id, period],
        },
        {
          sql: 'DELETE FROM manual_payout_items WHERE payout_id IN (SELECT id FROM payouts WHERE teacher_id=$1 AND period=$2 AND closed_at IS NULL AND amount_cents=0)',
          values: [t.teacher_id, period],
        },
        {
          sql: 'DELETE FROM payouts WHERE teacher_id=$1 AND period=$2 AND closed_at IS NULL AND amount_cents=0',
          values: [t.teacher_id, period],
        },
      ]);
    }
  }
  async markPaid(
    actor: string,
    payoutId: string,
    amount: number,
    reference: string,
    now = new Date(),
  ) {
    assert(
      reference.trim().length >= 3 && reference.length <= 150,
      'Indica la referencia de la transferencia realizada.',
    );
    await this.refresh(now);
    const [p] = await this.store.query<Row>('SELECT * FROM payouts WHERE id=$1', [payoutId]);
    assert(
      p && p.amount_cents === amount && amount > 0 && !p.closed_at,
      'El importe ha cambiado o este pago ya está cerrado. Revisa la liquidación.',
    );
    await this.store.write([
      {
        sql: "UPDATE payouts SET status='paid',payment_reference=$2,paid_at=$3,closed_at=$3 WHERE id=$1 AND closed_at IS NULL AND amount_cents=$4 AND NOT EXISTS(SELECT pay.id FROM manual_payout_items i JOIN ledger_entries le ON le.id=i.ledger_id JOIN payments pay ON pay.id=le.payment_id WHERE i.payout_id=$1 AND pay.status<>'paid' GROUP BY pay.id HAVING sum(le.amount_cents)>0)",
        values: [payoutId, reference.trim(), now, amount],
      },
      auditStatement(actor, 'confirm_manual_teacher_payment', 'payout', payoutId, {
        amount_cents: amount,
      }),
    ]);
    const [current] = await this.store.query<Row>('SELECT status FROM payouts WHERE id=$1', [
      payoutId,
    ]);
    assert(
      current.status === 'paid',
      'Hay un reembolso o una incidencia pendiente. Revisa esta liquidación antes de pagar.',
    );
    return { message: 'Transferencia registrada como pagada. La web no ha enviado dinero.' };
  }
}
export async function settlementOverview(teacherId?: string) {
  const summaries = await d1Query<Row>(
    `SELECT t.user_id AS teacher_id,u.name,t.teacher_bps,coalesce(sum(le.amount_cents),0) AS earned,coalesce(sum(CASE WHEN p.status='paid' THEN 0 ELSE le.amount_cents END),0) AS pending FROM teacher_profiles t JOIN users u ON u.id=t.user_id LEFT JOIN teacher_earnings e ON e.teacher_id=t.user_id LEFT JOIN ledger_entries le ON le.id=e.ledger_id LEFT JOIN manual_payout_items item ON item.ledger_id=le.id LEFT JOIN payouts p ON p.id=item.payout_id WHERE ($1 IS NULL OR t.user_id=$1) GROUP BY t.user_id,u.name,t.teacher_bps ORDER BY u.name`,
    [teacherId || null],
  );
  const payouts = await d1Query<Row>(
    "SELECT p.*,u.name,(SELECT count(*) FROM manual_payout_items i JOIN ledger_entries le ON le.id=i.ledger_id JOIN payments pay ON pay.id=le.payment_id WHERE i.payout_id=p.id AND pay.status='disputed') AS needs_review FROM payouts p JOIN users u ON u.id=p.teacher_id WHERE ($1 IS NULL OR p.teacher_id=$1) ORDER BY p.period DESC,u.name",
    [teacherId || null],
  );
  return { summaries, payouts };
}
