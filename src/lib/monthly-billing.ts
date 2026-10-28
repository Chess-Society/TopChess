import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assert } from './domain';
import { sameBillingMonth, MONTHLY_TERMS } from './monthly-calendar';
import { atomic, d1Query, auditStatement, type Statement } from './cloudflare';
import type { User } from './auth';
type Row = Record<string, any>;
export const billingDetails = z.object({
  billingName: z.string().trim().min(3).max(150),
  billingTaxId: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^[\p{L}\p{N} .-]+$/u),
  billingStreet: z.string().trim().min(4).max(180),
  billingCity: z.string().trim().min(2).max(100),
  billingPostalCode: z.string().trim().min(3).max(15),
  billingCountry: z.literal('ES'),
});
type Details = z.infer<typeof billingDetails>;
type Dependencies = {
  stripe: Stripe;
  query: <T = Row>(sql: string, values?: unknown[]) => Promise<T[]>;
  write: (statements: Statement[]) => Promise<unknown>;
  now: () => Date;
  priceId: string;
  taxRateId: string;
  appUrl: string;
};
export function stripeClient() {
  assert(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
    'Falta conectar la cuenta de cobros de Stripe.',
    503,
  );
  return new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
}
export function monthlyBilling(stripe?: Stripe, eventsOnly = false) {
  assert(
    eventsOnly || (process.env.BILLING_ENABLED === 'true' && process.env.LEGAL_READY === 'true'),
    'Los cobros aún no están activados. Falta conectar Stripe y validar la fiscalidad y las condiciones.',
    503,
  );
  assert(
    eventsOnly || (process.env.STRIPE_PRICE_ID && process.env.STRIPE_TAX_RATE_ID),
    'Falta configurar la cuota y su tratamiento fiscal.',
    503,
  );
  return new MonthlyBilling({
    stripe: stripe || stripeClient(),
    query: d1Query,
    write: atomic,
    now: () => new Date(),
    priceId: process.env.STRIPE_PRICE_ID || '',
    taxRateId: process.env.STRIPE_TAX_RATE_ID || '',
    appUrl: process.env.APP_URL!,
  });
}
export class MonthlyBilling {
  constructor(private d: Dependencies) {}
  private async config() {
    const [price, tax] = await Promise.all([
      this.d.stripe.prices.retrieve(this.d.priceId),
      this.d.stripe.taxRates.retrieve(this.d.taxRateId),
    ]);
    assert(
      price.active &&
        price.currency === 'eur' &&
        price.unit_amount === 5000 &&
        price.recurring?.interval === 'month' &&
        price.recurring.interval_count === 1 &&
        price.tax_behavior === 'inclusive',
      'La cuota debe ser 50 EUR al mes con impuestos incluidos.',
      503,
    );
    assert(
      tax.active && tax.inclusive && tax.country === 'ES',
      'Debe configurarse el tipo fiscal inclusivo validado para España.',
      503,
    );
  }
  private async sub(id: string) {
    const [s] = await this.d.query<Row>(
      "SELECT s.*,e.student_id,e.group_id,e.status AS enrollment_status FROM subscriptions s JOIN group_enrollments e ON e.id=s.enrollment_id WHERE s.id=$1 AND s.billing_model='calendar_month'",
      [id],
    );
    assert(s, 'Matrícula no encontrada.', 404);
    return s;
  }
  private job(kind: string, sub: string, invoice?: string): Statement {
    return {
      sql: 'INSERT INTO billing_actions(id,kind,subscription_id,invoice_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      values: [`${kind}:${sub}:${invoice || ''}`, kind, sub, invoice || null],
    };
  }
  private async notice(group: string, kind: string, message: string) {
    await this.d.write([
      {
        sql: "INSERT INTO incidents(group_id,kind,description) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM incidents WHERE group_id=$1 AND kind=$2 AND status='open')",
        values: [group, kind, message],
      },
    ]);
  }
  async checkout(user: User, enrollment: string, details: Details) {
    assert(
      user.role === 'student' && user.email,
      'La matrícula requiere tu cuenta de alumno y un correo de contacto.',
      403,
    );
    const customerData = billingDetails.parse(details);
    await this.config();
    const [e] = await this.d.query<Row>(
      `SELECT e.*,g.first_at,g.enrollment_deadline,g.status AS group_status,g.billing_model,t.status AS teacher_status,b.starts_at,(SELECT max(ends_at) FROM billing_cycles WHERE group_id=g.id AND approved=1) AS horizon FROM group_enrollments e JOIN groups g ON g.id=e.group_id JOIN teacher_profiles t ON t.user_id=g.teacher_id JOIN billing_cycles b ON b.group_id=g.id AND b.sequence=1 AND b.approved=1 WHERE e.id=$1 AND e.student_id=$2`,
      [enrollment, user.id],
    );
    assert(e, 'Matrícula no encontrada.', 404);
    assert(
      e.status === 'awaiting_payment' &&
        e.group_status === 'confirmed' &&
        e.teacher_status === 'active' &&
        e.billing_model === 'calendar_month',
      'El grupo no está preparado para contratar.',
    );
    assert(
      sameBillingMonth(new Date(e.first_at), this.d.now()) &&
        new Date(e.enrollment_deadline).getTime() > this.d.now().getTime() + 31 * 60_000,
      'El plazo de contratación del mes siguiente ha terminado.',
    );
    await this.d.write([
      {
        sql: "INSERT INTO subscriptions(id,enrollment_id,billing_model,billing_start_at,billing_end_at) VALUES($1,$2,'calendar_month',$3,$4) ON CONFLICT(enrollment_id) DO NOTHING",
        values: [randomUUID(), enrollment, e.starts_at, e.horizon],
      },
    ]);
    let s = (
      await this.d.query<Row>('SELECT * FROM subscriptions WHERE enrollment_id=$1', [enrollment])
    )[0];
    assert(
      s.billing_model === 'calendar_month' && s.status !== 'cancelled' && !s.cancel_at_period_end,
      'Esta matrícula necesita revisión de TopChess.',
    );
    if (s.setup_completed_at)
      return {
        message: 'Método de pago autorizado. No se cobra antes del día 1 del mes de incorporación.',
      };
    let checkoutExpired = false;
    if (s.checkout_id) {
      const previous = await this.d.stripe.checkout.sessions.retrieve(s.checkout_id);
      if (previous.status === 'open') return { url: previous.url };
      assert(
        previous.status === 'expired',
        'La autorización se está procesando. Consulta tu panel.',
      );
      checkoutExpired = true;
    }
    if (
      checkoutExpired ||
      !s.checkout_expires_at ||
      new Date(s.checkout_expires_at) <= this.d.now()
    ) {
      await this.d.write([
        {
          sql: 'UPDATE subscriptions SET checkout_generation=checkout_generation+1,checkout_id=NULL,checkout_expires_at=$2 WHERE id=$1 AND checkout_generation=$3 AND setup_completed_at IS NULL',
          values: [s.id, new Date(this.d.now().getTime() + 60 * 60_000), s.checkout_generation],
        },
      ]);
      s = await this.sub(s.id);
    }
    const params = {
      name: customerData.billingName,
      email: user.email,
      address: {
        line1: customerData.billingStreet,
        city: customerData.billingCity,
        postal_code: customerData.billingPostalCode,
        country: customerData.billingCountry,
      },
      invoice_settings: {
        custom_fields: [{ name: 'NIF / DNI', value: customerData.billingTaxId }],
      },
      metadata: { topchess_subscription: s.id },
    };
    if (!s.stripe_customer_id) {
      const c = await this.d.stripe.customers.create(params, {
        idempotencyKey: `monthly-customer:${s.id}`,
      });
      await this.d.write([
        { sql: 'UPDATE subscriptions SET stripe_customer_id=$2 WHERE id=$1', values: [s.id, c.id] },
      ]);
      s.stripe_customer_id = c.id;
    } else await this.d.stripe.customers.update(s.stripe_customer_id, params);
    const session = await this.d.stripe.checkout.sessions.create(
      {
        mode: 'setup',
        currency: 'eur',
        customer: s.stripe_customer_id,
        client_reference_id: s.id,
        expires_at: Math.floor(new Date(s.checkout_expires_at).getTime() / 1000),
        setup_intent_data: { metadata: { topchess_subscription: s.id } },
        custom_text: {
          submit: {
            message:
              'Autorizas 50 EUR al mes, IVA incluido, desde el día 1 del mes de incorporación si se confirma el mínimo del grupo. Hoy no se cobra. Cuatro clases con horario fijo por mes.',
          },
        },
        success_url: `${this.d.appUrl}/panel?checkout=autorizado`,
        cancel_url: `${this.d.appUrl}/panel`,
        integration_identifier: 'topchess_mensual_qmxrtplv',
      },
      { idempotencyKey: `monthly-checkout:${s.id}:${s.checkout_generation}` },
    );
    await this.d.write([
      {
        sql: 'UPDATE subscriptions SET checkout_id=$2 WHERE id=$1 AND checkout_generation=$3',
        values: [s.id, session.id, s.checkout_generation],
      },
      {
        sql: 'UPDATE group_enrollments SET terms_version=$2,accepted_at=$3 WHERE id=$1',
        values: [enrollment, MONTHLY_TERMS, this.d.now()],
      },
      auditStatement(user.id, 'monthly_checkout', 'subscription', s.id),
    ]);
    return { url: session.url };
  }
  async cancel(user: User, enrollment: string, reason: string) {
    const [s] = await this.d.query<Row>(
      "SELECT s.* FROM subscriptions s JOIN group_enrollments e ON e.id=s.enrollment_id WHERE e.id=$1 AND e.student_id=$2 AND s.billing_model='calendar_month'",
      [enrollment, user.id],
    );
    assert(s, 'Matrícula no encontrada.', 404);
    const before = this.d.now() < new Date(s.billing_start_at);
    await this.d.write([
      this.job(before ? 'cancel' : 'stop_renewal', s.id),
      { sql: 'UPDATE subscriptions SET cancel_at_period_end=1 WHERE id=$1', values: [s.id] },
      {
        sql: 'UPDATE group_enrollments SET status=$2 WHERE id=$1',
        values: [enrollment, before ? 'left' : 'leaving'],
      },
      {
        sql: "INSERT INTO student_withdrawals(enrollment_id,kind,reason,effective_at) SELECT $1,'cancel_renewal',$2,$3 WHERE NOT EXISTS(SELECT 1 FROM student_withdrawals WHERE enrollment_id=$1 AND kind='cancel_renewal')",
        values: [
          enrollment,
          reason || null,
          before ? this.d.now() : s.current_period_end || s.billing_start_at,
        ],
      },
      auditStatement(user.id, 'cancel_monthly', 'subscription', s.id),
    ]);
    await this.actions();
    return {
      message: before
        ? 'Cancelación registrada antes de comenzar las clases.'
        : 'Renovaciones canceladas. Conservas las clases del periodo abonado.',
    };
  }
  async event(event: Stripe.Event) {
    if ((await this.d.query('SELECT id FROM stripe_events WHERE id=$1', [event.id])).length) return;
    const obj = event.data.object as any,
      writes: Statement[] = [];
    if (event.type === 'checkout.session.completed') {
      const [s] = await this.d.query<Row>(
        "SELECT * FROM subscriptions WHERE checkout_id=$1 AND billing_model='calendar_month'",
        [obj.id],
      );
      if (!s) {
        if (
          obj.client_reference_id &&
          (
            await this.d.query('SELECT id FROM subscriptions WHERE id=$1', [
              obj.client_reference_id,
            ])
          ).length
        )
          throw new Error('Reintentar Checkout aún no vinculado');
        return;
      }
      const session = await this.d.stripe.checkout.sessions.retrieve(obj.id);
      assert(
        session.mode === 'setup' &&
          session.status === 'complete' &&
          session.customer === s.stripe_customer_id &&
          typeof session.setup_intent === 'string',
        'Autorización no válida.',
        409,
      );
      const setup = await this.d.stripe.setupIntents.retrieve(session.setup_intent);
      assert(
        setup.status === 'succeeded' &&
          setup.customer === s.stripe_customer_id &&
          typeof setup.payment_method === 'string' &&
          setup.metadata?.topchess_subscription === s.id,
        'El método aún no está autorizado.',
        409,
      );
      writes.push({
        sql: 'UPDATE subscriptions SET payment_method_id=$2,setup_completed_at=$3 WHERE id=$1 AND cancel_at_period_end=0',
        values: [s.id, setup.payment_method, this.d.now()],
      });
    } else if (
      event.type.startsWith('customer.subscription.') ||
      event.type === 'invoice.paid' ||
      event.type === 'invoice.payment_failed'
    ) {
      const invoice = event.type.startsWith('invoice.')
        ? await this.d.stripe.invoices.retrieve(obj.id)
        : undefined;
      const subId = invoice ? invoice.parent?.subscription_details?.subscription : obj.id;
      if (typeof subId !== 'string') return;
      const sub = await this.d.stripe.subscriptions.retrieve(subId);
      if (!sub.metadata.topchess_subscription) return;
      if (
        !(
          await this.d.query('SELECT id FROM subscriptions WHERE id=$1', [
            sub.metadata.topchess_subscription,
          ])
        ).length
      )
        return;
      const s = await this.sub(sub.metadata.topchess_subscription);
      assert(
        (!s.stripe_id || s.stripe_id === sub.id) && sub.customer === s.stripe_customer_id,
        'La suscripción no coincide.',
        409,
      );
      const state =
        sub.status === 'active'
          ? 'active'
          : sub.status === 'past_due'
            ? 'past_due'
            : ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)
              ? 'cancelled'
              : 'pending';
      writes.push({
        sql: 'UPDATE subscriptions SET stripe_id=$2,status=$3,current_period_end=$4 WHERE id=$1',
        values: [
          s.id,
          sub.id,
          state,
          sub.items.data[0]?.current_period_end
            ? new Date(sub.items.data[0].current_period_end * 1000)
            : null,
        ],
      });
      if (state === 'cancelled')
        writes.push({
          sql: "UPDATE group_enrollments SET status='left' WHERE id=$1",
          values: [s.enrollment_id],
        });
      if (invoice && invoice.amount_due > 0) {
        assert(
          invoice.currency === 'eur' &&
            invoice.amount_due === 5000 &&
            invoice.lines.data.length === 1 &&
            !invoice.lines.data[0].parent?.subscription_item_details?.proration,
          'Factura inesperada: requiere conciliación.',
          409,
        );
        const paid = invoice.status === 'paid',
          period = invoice.lines.data[0].period;
        const [teacher] = await this.d.query<Row>(
          'SELECT t.teacher_bps,t.cycle FROM teacher_profiles t JOIN groups g ON g.teacher_id=t.user_id WHERE g.id=$1',
          [s.group_id],
        );
        writes.push({
          sql: "INSERT INTO payments(subscription_id,stripe_invoice_id,amount_cents,status,teacher_bps,teacher_cycle,paid_at,invoice_url,period_start,period_end,invoice_number,invoice_date,invoice_pdf,tax_cents) VALUES($1,$2,5000,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(stripe_invoice_id) DO UPDATE SET status=CASE WHEN payments.status IN ('refunded','disputed') THEN payments.status WHEN excluded.status='paid' THEN 'paid' ELSE payments.status END,paid_at=coalesce(payments.paid_at,excluded.paid_at),invoice_number=excluded.invoice_number,invoice_pdf=excluded.invoice_pdf",
          values: [
            s.id,
            invoice.id,
            paid ? 'paid' : 'failed',
            teacher.teacher_bps,
            teacher.cycle,
            paid ? this.d.now() : null,
            invoice.hosted_invoice_url,
            new Date(period.start * 1000),
            new Date(period.end * 1000),
            invoice.number,
            new Date(invoice.created * 1000),
            invoice.invoice_pdf,
            invoice.total_excluding_tax === null
              ? null
              : invoice.total - invoice.total_excluding_tax,
          ],
        });
        if (paid) {
          assert(invoice.amount_paid === 5000, 'Importe cobrado inesperado.', 409);
          writes.push({
            sql: "INSERT INTO ledger_entries(payment_id,kind,amount_cents,idempotency_key) SELECT id,'receipt',5000,$2 FROM payments WHERE stripe_invoice_id=$1 ON CONFLICT(idempotency_key) DO NOTHING",
            values: [invoice.id, `invoice:${invoice.id}`],
          });
          const [cycle] = await this.d.query<Row>(
            'SELECT collection_state FROM billing_cycles WHERE group_id=$1 AND starts_at=$2',
            [s.group_id, new Date(period.start * 1000)],
          );
          if (s.enrollment_status === 'left' || cycle?.collection_state === 'aborted')
            writes.push(this.job('refund', s.id, invoice.id));
          else
            writes.push({
              sql: "UPDATE group_enrollments SET status=CASE WHEN status='leaving' THEN status ELSE 'active' END WHERE id=$1 AND status NOT IN ('left','expired')",
              values: [s.enrollment_id],
            });
        }
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const charge = await this.d.stripe.charges.retrieve(
        event.type === 'charge.refunded'
          ? obj.id
          : typeof obj.charge === 'string'
            ? obj.charge
            : obj.charge.id,
      );
      if (!charge.payment_intent) return;
      const payments = await this.d.stripe.invoicePayments.list({
        payment: {
          type: 'payment_intent',
          payment_intent:
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id,
        },
        limit: 100,
      });
      for (const match of payments.data) {
        const inv = typeof match.invoice === 'string' ? match.invoice : match.invoice.id;
        if (
          !(await this.d.query('SELECT id FROM payments WHERE stripe_invoice_id=$1', [inv])).length
        )
          continue;
        writes.push({
          sql: "UPDATE payments SET status=CASE WHEN status='refunded' THEN status ELSE $2 END WHERE stripe_invoice_id=$1",
          values: [
            inv,
            event.type === 'charge.refunded' && charge.amount_refunded === charge.amount
              ? 'refunded'
              : 'disputed',
          ],
        });
      }
      if (!writes.length) return;
      writes.push({
        sql: "INSERT INTO incidents(kind,description) VALUES('payment_reconciliation',$1)",
        values: [
          `Stripe ${event.type}: ${event.id}. Revisar devoluciones y liquidaciones manuales.`,
        ],
      });
    } else return;
    writes.push({
      sql: 'INSERT INTO stripe_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING',
      values: [event.id, event.type],
    });
    await this.d.write(writes);
  }
  async run() {
    await this.config();
    const groups = await this.d.query<Row>(
      "SELECT g.*,b.sequence,b.starts_at,b.ends_at,b.collection_state,b.id AS cycle_id,(SELECT min(starts_at) FROM sessions WHERE cycle_id=b.id) AS first_session FROM groups g JOIN billing_cycles b ON b.group_id=g.id WHERE g.billing_model='calendar_month' AND b.approved=1 AND b.starts_at<=$1 AND b.ends_at>$2",
      [new Date(this.d.now().getTime() + 24 * 3600_000), this.d.now()],
    );
    for (const g of groups) {
      try {
        const subs = await this.d.query<Row>(
          "SELECT s.*,e.status AS enrollment_status FROM subscriptions s JOIN group_enrollments e ON e.id=s.enrollment_id WHERE e.group_id=$1 AND s.billing_model='calendar_month'",
          [g.id],
        );
        const ready = subs.filter(
          (s) =>
            s.setup_completed_at &&
            !s.cancel_at_period_end &&
            !['left', 'expired'].includes(s.enrollment_status) &&
            s.status !== 'cancelled',
        );
        const now = this.d.now().getTime(),
          start = new Date(g.starts_at).getTime();
        if (start > now && g.collection_state !== 'aborted') {
          if (ready.length < g.min_students) {
            await this.abort(g, subs);
            continue;
          }
          const cycles = await this.d.query<Row>(
            'SELECT * FROM billing_cycles WHERE group_id=$1 AND approved=1 ORDER BY sequence',
            [g.id],
          );
          const futureCycles = cycles.filter((c) => new Date(c.starts_at).getTime() >= start);
          for (const [index, c] of futureCycles.entries()) {
            const [sessions] = await this.d.query<Row>(
              "SELECT count(*) AS n FROM sessions WHERE cycle_id=$1 AND status='scheduled'",
              [c.id],
            );
            assert(
              Number(sessions.n) === 4 &&
                (!index || futureCycles[index - 1].ends_at === c.starts_at),
              'Calendario incompleto.',
            );
          }
          for (const s of ready) {
            if (s.schedule_id) continue;
            const schedules = await this.d.stripe.subscriptionSchedules.list({
              customer: s.stripe_customer_id,
              limit: 100,
            });
            const schedule =
              schedules.data.find((x) => x.metadata?.topchess_subscription === s.id) ||
              (await this.d.stripe.subscriptionSchedules.create(
                {
                  customer: s.stripe_customer_id,
                  start_date: Math.floor(start / 1000),
                  end_behavior: 'cancel',
                  metadata: { topchess_subscription: s.id },
                  default_settings: {
                    default_payment_method: s.payment_method_id,
                    collection_method: 'charge_automatically',
                  },
                  phases: [
                    {
                      items: [{ price: this.d.priceId, quantity: 1 }],
                      default_tax_rates: [this.d.taxRateId],
                      duration: { interval: 'month', interval_count: cycles.length },
                      proration_behavior: 'none',
                      metadata: { topchess_subscription: s.id },
                    },
                  ],
                },
                { idempotencyKey: `schedule:${s.id}` },
              ));
            await this.d.write([
              {
                sql: 'UPDATE subscriptions SET schedule_id=$2 WHERE id=$1',
                values: [s.id, schedule.id],
              },
            ]);
            if ((await this.sub(s.id)).cancel_at_period_end)
              await this.d.write([
                this.job('cancel', s.id),
                {
                  sql: "UPDATE billing_actions SET status='pending' WHERE id=$1",
                  values: [`cancel:${s.id}:`],
                },
              ]);
          }
          await this.d.write([
            {
              sql: "UPDATE billing_cycles SET collection_state='ready' WHERE id=$1 AND collection_state='pending'",
              values: [g.cycle_id],
            },
          ]);
        } else if (start <= now) {
          for (const s of subs) {
            if (s.schedule_id && !s.stripe_id) {
              const schedule = await this.d.stripe.subscriptionSchedules.retrieve(s.schedule_id);
              if (typeof schedule.subscription === 'string')
                await this.d.write([
                  {
                    sql: 'UPDATE subscriptions SET stripe_id=$2 WHERE id=$1',
                    values: [s.id, schedule.subscription],
                  },
                ]);
            }
          }
          const [paid] = await this.d.query<Row>(
            "SELECT count(DISTINCT s.id) AS n FROM subscriptions s JOIN group_enrollments e ON e.id=s.enrollment_id JOIN payments p ON p.subscription_id=s.id WHERE e.group_id=$1 AND e.status IN ('active','leaving') AND p.status='paid' AND p.period_start=$2",
            [g.id, g.starts_at],
          );
          if (g.collection_state !== 'aborted' && Number(paid.n) >= g.min_students)
            await this.d.write([
              {
                sql: "UPDATE billing_cycles SET collection_state='active' WHERE id=$1 AND collection_state<>'aborted'",
                values: [g.cycle_id],
              },
              {
                sql: "UPDATE groups SET status='active' WHERE id=$1 AND status IN ('confirmed','full')",
                values: [g.id],
              },
            ]);
          else if (
            g.collection_state === 'aborted' ||
            (g.collection_state !== 'active' &&
              now >=
                Math.min(start + 24 * 3600_000, new Date(g.first_session).getTime() - 3600_000))
          )
            await this.abort(g, subs);
        }
      } catch {
        await this.notice(
          g.id,
          'billing_retry',
          'La programación de cobros necesita reintento o revisión en Stripe. No se han simulado pagos.',
        );
      }
    }
    await this.actions();
    return { checked: groups.length };
  }
  private async abort(g: Row, subs: Row[]) {
    const writes: Statement[] = [
      {
        sql: "UPDATE billing_cycles SET collection_state='aborted' WHERE id=$1",
        values: [g.cycle_id],
      },
      {
        sql: "UPDATE groups SET status='suspended' WHERE id=$1 AND ($2=1 OR $3<=$4)",
        values: [g.id, g.sequence, g.starts_at, this.d.now()],
      },
    ];
    for (const s of subs) {
      writes.push(
        this.job(
          g.sequence > 1 && new Date(g.starts_at) > this.d.now() ? 'stop_renewal' : 'cancel',
          s.id,
        ),
      );
      const payments = await this.d.query<Row>(
        "SELECT stripe_invoice_id FROM payments WHERE subscription_id=$1 AND status='paid' AND period_start=$2",
        [s.id, g.starts_at],
      );
      for (const p of payments) writes.push(this.job('refund', s.id, p.stripe_invoice_id));
    }
    await this.d.write(writes);
    await this.notice(
      g.id,
      'billing_minimum',
      'El grupo no reúne el mínimo para empezar este mes. Se cancelan las cuotas y se devuelven los cargos del mes si los hubiera.',
    );
  }
  async actions() {
    const jobs = await this.d.query<Row>(
      "SELECT * FROM billing_actions WHERE status='pending' ORDER BY CASE kind WHEN 'cancel' THEN 0 ELSE 1 END LIMIT 100",
    );
    for (const job of jobs) {
      await this.d.write([
        { sql: 'UPDATE billing_actions SET attempts=attempts+1 WHERE id=$1', values: [job.id] },
      ]);
      try {
        const s = await this.sub(job.subscription_id);
        if (job.kind === 'refund') {
          const payments = await this.d.stripe.invoicePayments.list({
            invoice: job.invoice_id,
            limit: 100,
          });
          assert(payments.data.length === 1, 'El reembolso requiere conciliación.');
          const pi = payments.data[0].payment.payment_intent;
          assert(typeof pi === 'string', 'Falta el cobro de la factura.');
          const refunds = await this.d.stripe.refunds.list({ payment_intent: pi, limit: 100 });
          const refund =
            refunds.data.find((r) => r.metadata?.topchess_action === job.id) ||
            (await this.d.stripe.refunds.create(
              { payment_intent: pi, metadata: { topchess_action: job.id } },
              { idempotencyKey: job.id },
            ));
          assert(refund.status === 'succeeded', 'Reembolso pendiente.');
          await this.d.write([
            {
              sql: "UPDATE payments SET status='refunded' WHERE stripe_invoice_id=$1",
              values: [job.invoice_id],
            },
            {
              sql: "INSERT INTO refunds(payment_id,stripe_id,amount_cents,reason,status) SELECT id,$2,$3,'Grupo no viable','succeeded' FROM payments WHERE stripe_invoice_id=$1 ON CONFLICT(stripe_id) DO NOTHING",
              values: [job.invoice_id, refund.id, refund.amount],
            },
            {
              sql: "INSERT INTO ledger_entries(payment_id,kind,amount_cents,idempotency_key) SELECT id,'refund',-$2,$3 FROM payments WHERE stripe_invoice_id=$1 ON CONFLICT(idempotency_key) DO NOTHING",
              values: [job.invoice_id, refund.amount, job.id],
            },
          ]);
        } else {
          let subId = s.stripe_id,
            scheduleId = s.schedule_id;
          if (!scheduleId && s.stripe_customer_id) {
            const schedules = await this.d.stripe.subscriptionSchedules.list({
              customer: s.stripe_customer_id,
              limit: 100,
            });
            scheduleId = schedules.data.find((x) => x.metadata?.topchess_subscription === s.id)?.id;
          }
          if (scheduleId) {
            const schedule = await this.d.stripe.subscriptionSchedules.retrieve(scheduleId);
            subId ||=
              typeof schedule.subscription === 'string'
                ? schedule.subscription
                : typeof schedule.released_subscription === 'string'
                  ? schedule.released_subscription
                  : null;
            if (job.kind === 'cancel' && ['active', 'not_started'].includes(schedule.status))
              await this.d.stripe.subscriptionSchedules.cancel(
                schedule.id,
                { invoice_now: false, prorate: false },
                { idempotencyKey: job.id },
              );
            if (job.kind === 'stop_renewal' && schedule.status === 'active')
              await this.d.stripe.subscriptionSchedules.release(
                schedule.id,
                {},
                { idempotencyKey: `release:${job.id}` },
              );
          }
          if (subId) {
            const sub = await this.d.stripe.subscriptions.retrieve(subId);
            if (sub.status !== 'canceled') {
              if (job.kind === 'cancel')
                await this.d.stripe.subscriptions.cancel(
                  subId,
                  { invoice_now: false, prorate: false },
                  { idempotencyKey: `sub:${job.id}` },
                );
              else
                await this.d.stripe.subscriptions.update(
                  subId,
                  { cancel_at_period_end: true },
                  { idempotencyKey: job.id },
                );
            }
          }
          if (job.kind === 'cancel') {
            await this.d.write([
              {
                sql: "UPDATE subscriptions SET status='cancelled',cancel_at_period_end=1 WHERE id=$1",
                values: [s.id],
              },
              {
                sql: "UPDATE group_enrollments SET status='left' WHERE id=$1",
                values: [s.enrollment_id],
              },
            ]);
            if (subId) {
              const invoices = await this.d.stripe.invoices.list({
                subscription: subId,
                limit: 100,
              });
              for (const inv of invoices.data) {
                if (inv.status === 'draft') await this.d.stripe.invoices.del(inv.id);
                else if (inv.status === 'open')
                  await this.d.stripe.invoices.voidInvoice(
                    inv.id,
                    {},
                    { idempotencyKey: `void:${inv.id}` },
                  );
                else if (inv.status === 'paid' && inv.amount_paid > 0) {
                  const [cycle] = await this.d.query<Row>(
                    'SELECT collection_state FROM billing_cycles WHERE group_id=$1 AND starts_at=$2',
                    [s.group_id, new Date(inv.lines.data[0].period.start * 1000)],
                  );
                  if (cycle?.collection_state === 'aborted')
                    await this.d.write([this.job('refund', s.id, inv.id)]);
                }
              }
            }
          } else
            await this.d.write([
              {
                sql: 'UPDATE subscriptions SET cancel_at_period_end=1 WHERE id=$1',
                values: [s.id],
              },
            ]);
        }
        await this.d.write([
          { sql: "UPDATE billing_actions SET status='done' WHERE id=$1", values: [job.id] },
        ]);
      } catch {
        /* La acción queda pendiente; el siguiente turno consulta Stripe antes de reintentarlo. */
      }
    }
  }
}
