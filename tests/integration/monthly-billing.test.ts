import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { MonthlyBilling } from '../../src/lib/monthly-billing';
import { ManualSettlements } from '../../src/lib/manual-settlements';
import { monthlyStore } from '../helpers/monthly-store';
const details = {
  billingName: 'Alumno de prueba',
  billingTaxId: '12345678Z',
  billingStreet: 'Calle de prueba 1',
  billingCity: 'Madrid',
  billingPostalCode: '28001',
  billingCountry: 'ES' as const,
};
async function fixture() {
  const store = monthlyStore(),
    enrollments = await store.seed();
  let now = new Date(store.start.getTime() - 7 * 86400_000);
  const sessions = new Map<string, any>(),
    schedules = new Map<string, any>(),
    subscriptions = new Map<string, any>(),
    invoices = new Map<string, any>(),
    setups = new Map<string, any>(),
    refunds: any[] = [];
  let customerCount = 0,
    setupCount = 0,
    scheduleCount = 0;
  const stripe = {
    prices: {
      retrieve: async () => ({
        id: 'price_test',
        active: true,
        currency: 'eur',
        unit_amount: 5000,
        tax_behavior: 'inclusive',
        recurring: { interval: 'month', interval_count: 1 },
      }),
    },
    taxRates: { retrieve: async () => ({ active: true, inclusive: true, country: 'ES' }) },
    customers: { create: async () => ({ id: `cus_${++customerCount}` }), update: async () => ({}) },
    checkout: {
      sessions: {
        create: async (p: any) => {
          assert.equal(p.mode, 'setup');
          assert.equal(p.line_items, undefined);
          const session = {
            ...p,
            id: `cs_${++setupCount}`,
            status: 'open',
            url: 'https://checkout.stripe.com/test',
          };
          sessions.set(session.id, session);
          return session;
        },
        retrieve: async (id: string) => sessions.get(id),
      },
    },
    setupIntents: { retrieve: async (id: string) => setups.get(id) },
    subscriptionSchedules: {
      list: async (p: any) => ({
        data: [...schedules.values()].filter((s) => s.customer === p.customer),
      }),
      create: async (p: any) => {
        assert.equal(p.start_date, new Date(store.start).getTime() / 1000);
        const s = {
          ...p,
          id: `sched_${++scheduleCount}`,
          status: 'not_started',
          subscription: null,
        };
        schedules.set(s.id, s);
        return s;
      },
      retrieve: async (id: string) => schedules.get(id),
      cancel: async (id: string) => {
        const s = schedules.get(id);
        s.status = 'canceled';
        if (s.subscription) subscriptions.get(s.subscription).status = 'canceled';
        return s;
      },
      release: async (id: string) => {
        const s = schedules.get(id);
        s.status = 'released';
        s.released_subscription = s.subscription;
        return s;
      },
    },
    subscriptions: {
      retrieve: async (id: string) => subscriptions.get(id),
      cancel: async (id: string) => {
        subscriptions.get(id).status = 'canceled';
        return subscriptions.get(id);
      },
      update: async (id: string, p: any) => Object.assign(subscriptions.get(id), p),
    },
    invoices: {
      retrieve: async (id: string) => invoices.get(id),
      list: async (p: any) => ({
        data: [...invoices.values()].filter(
          (i) => i.parent.subscription_details.subscription === p.subscription,
        ),
      }),
      del: async () => ({}),
      voidInvoice: async () => ({}),
    },
    invoicePayments: {
      list: async (p: any) => ({
        data: [
          {
            invoice: p.invoice,
            payment: { type: 'payment_intent', payment_intent: `pi_${p.invoice}` },
          },
        ],
      }),
    },
    refunds: {
      list: async () => ({ data: refunds }),
      create: async (p: any) => {
        const r = {
          id: `re_${refunds.length}`,
          status: 'succeeded',
          amount: 5000,
          metadata: p.metadata,
        };
        refunds.push(r);
        return r;
      },
    },
  } as unknown as Stripe;
  const billing = new MonthlyBilling({
    stripe,
    query: store.query,
    write: store.write,
    now: () => now,
    priceId: 'price_test',
    taxRateId: 'txr_test',
    appUrl: 'https://example.test',
  });
  async function authorize(index: number) {
    await billing.checkout(store.students[index], enrollments[index], details);
    const session = [...sessions.values()][index];
    session.status = 'complete';
    session.setup_intent = `seti_${index}`;
    setups.set(session.setup_intent, {
      status: 'succeeded',
      customer: session.customer,
      payment_method: `pm_${index}`,
      metadata: { topchess_subscription: session.client_reference_id },
    });
    await billing.event({
      id: `evt_setup_${index}`,
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event);
  }
  async function pay(index: number) {
    const s = [...schedules.values()][index],
      subId = `sub_${index}`;
    s.status = 'active';
    s.subscription = subId;
    subscriptions.set(subId, {
      id: subId,
      status: 'active',
      customer: s.customer,
      metadata: s.metadata,
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: store.calendar[0].end.getTime() / 1000 }] },
    });
    const invoice = {
      id: `in_${index}`,
      currency: 'eur',
      status: 'paid',
      amount_due: 5000,
      amount_paid: 5000,
      total: 5000,
      total_excluding_tax: 4132,
      created: Math.floor(now.getTime() / 1000),
      number: `TEST-${index + 1}`,
      hosted_invoice_url: `https://invoice.stripe.com/${index}`,
      invoice_pdf: `https://pay.stripe.com/${index}/pdf`,
      parent: { subscription_details: { subscription: subId } },
      lines: {
        data: [
          {
            period: {
              start: store.start.getTime() / 1000,
              end: store.calendar[0].end.getTime() / 1000,
            },
          },
        ],
      },
    };
    invoices.set(invoice.id, invoice);
    await billing.event({
      id: `evt_paid_${index}`,
      type: 'invoice.paid',
      data: { object: invoice },
    } as Stripe.Event);
    return invoice;
  }
  return {
    store,
    billing,
    enrollments,
    authorize,
    pay,
    sessions,
    schedules,
    subscriptions,
    invoices,
    refunds,
    setNow: (date: Date) => (now = date),
    getNow: () => now,
  };
}
test('la reserva y la autorización no cobran; Stripe programa una sola cuota mensual desde el día 1', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.store.query('SELECT count(*) AS n FROM payments'))[0].n, 0);
    await f.authorize(0);
    await f.authorize(1);
    await f.billing.run();
    assert.equal(f.schedules.size, 0);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    await f.billing.run();
    assert.equal(f.schedules.size, 2);
    assert.equal((await f.store.query('SELECT count(*) AS n FROM payments'))[0].n, 0);
  } finally {
    f.store.db.close();
  }
});
test('un solo alumno autorizado no inicia cobros y su matrícula se cancela', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    assert.equal(f.schedules.size, 0);
    assert.equal((await f.store.query('SELECT status FROM subscriptions'))[0].status, 'cancelled');
  } finally {
    f.store.db.close();
  }
});
test('un evento repetido no duplica el cobro; guarda número, fecha y PDF de factura', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    await f.authorize(1);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    f.setNow(new Date(f.store.start.getTime() + 3600_000));
    const invoice = await f.pay(0);
    await f.billing.event({
      id: 'evt_repeated',
      type: 'invoice.paid',
      data: { object: invoice },
    } as Stripe.Event);
    const [p] = await f.store.query('SELECT * FROM payments');
    assert.equal((await f.store.query('SELECT count(*) AS n FROM payments'))[0].n, 1);
    assert.equal(p.invoice_number, 'TEST-1');
    assert.ok(p.invoice_date && p.invoice_pdf);
    assert.equal(p.amount_cents, 5000);
    assert.equal(p.tax_cents, 868);
    assert.equal(
      (await f.store.query("SELECT count(*) AS n FROM ledger_entries WHERE kind='receipt'"))[0].n,
      1,
    );
  } finally {
    f.store.db.close();
  }
});
test('si no se alcanza el mínimo de pagos se cancela el arranque y se devuelve el cargo', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    await f.authorize(1);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    f.setNow(new Date(f.store.start.getTime() + 3600_000));
    await f.pay(0);
    f.setNow(new Date(f.store.start.getTime() + 25 * 3600_000));
    await f.billing.run();
    await f.billing.run();
    assert.equal(f.refunds.length, 1);
    assert.equal((await f.store.query('SELECT status FROM payments'))[0].status, 'refunded');
  } finally {
    f.store.db.close();
  }
});
test('se calcula el 50 % de la cuota completa y el administrador registra el pago manual sin enviar dinero', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    await f.authorize(1);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    f.setNow(new Date(f.store.start.getTime() + 3600_000));
    await f.pay(0);
    await f.pay(1);
    await f.store.query(
      "UPDATE sessions SET status='taught' WHERE cycle_id=(SELECT id FROM billing_cycles WHERE group_id=$1 AND sequence=1)",
      [f.store.group],
    );
    const settlements = new ManualSettlements(f.store);
    const close = new Date(f.store.start);
    close.setUTCDate(28);
    close.setUTCHours(12);
    await settlements.refresh(close);
    await settlements.refresh(close);
    const [p] = await f.store.query('SELECT * FROM payouts');
    assert.equal(p.amount_cents, 5000);
    assert.equal(
      (
        await f.store.query(
          "SELECT count(*) AS n FROM ledger_entries WHERE kind='teacher_allocation'",
        )
      )[0].n,
      8,
    );
    await settlements.markPaid(f.store.admin, p.id, 5000, 'TRANSFER-TEST', close);
    assert.equal((await f.store.query('SELECT status FROM payouts'))[0].status, 'paid');
    assert.equal(f.refunds.length, 0);
    await assert.rejects(() => settlements.markPaid(f.store.admin, p.id, 5000, 'DUPLICADO', close));
  } finally {
    f.store.db.close();
  }
});
test('otra persona no puede contratar ni cancelar una matrícula ajena', async () => {
  const f = await fixture();
  try {
    await assert.rejects(() => f.billing.checkout(f.store.students[1], f.enrollments[0], details));
    await f.authorize(0);
    await assert.rejects(() => f.billing.cancel(f.store.students[1], f.enrollments[0], ''));
  } finally {
    f.store.db.close();
  }
});

test('una baja antes de renovar conserva las clases pagadas y detiene la siguiente cuota del grupo inviable', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    await f.authorize(1);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    f.setNow(new Date(f.store.start.getTime() + 3600_000));
    await f.pay(0);
    await f.pay(1);
    await f.billing.run();
    await f.store.query(
      "UPDATE sessions SET status='taught' WHERE cycle_id=(SELECT id FROM billing_cycles WHERE group_id=$1 AND sequence=1)",
      [f.store.group],
    );
    f.setNow(new Date(f.store.calendar[0].end.getTime() - 12 * 3600_000));
    await f.billing.cancel(f.store.students[0], f.enrollments[0], 'No renuevo');
    await f.billing.run();
    assert.equal((await f.store.query('SELECT status FROM groups'))[0].status, 'active');
    assert.equal(
      (await f.store.query('SELECT collection_state FROM billing_cycles WHERE sequence=2'))[0]
        .collection_state,
      'aborted',
    );
    assert.equal(f.subscriptions.get('sub_1').cancel_at_period_end, true);
    assert.equal(f.refunds.length, 0);
  } finally {
    f.store.db.close();
  }
});

test('una devolución antes de transferir reduce el importe pendiente y mantiene el cierre sin duplicados', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    await f.authorize(1);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    f.setNow(new Date(f.store.start.getTime() + 3600_000));
    await f.pay(0);
    await f.pay(1);
    await f.store.query(
      "UPDATE sessions SET status='taught' WHERE cycle_id=(SELECT id FROM billing_cycles WHERE group_id=$1 AND sequence=1)",
      [f.store.group],
    );
    const close = new Date(f.store.start);
    close.setUTCDate(28);
    close.setUTCHours(12);
    const settlements = new ManualSettlements(f.store);
    await settlements.refresh(close);
    await f.store.query("UPDATE payments SET status='refunded' WHERE stripe_invoice_id='in_0'");
    await settlements.refresh(close);
    await settlements.refresh(close);
    const [p] = await f.store.query('SELECT * FROM payouts');
    assert.equal(p.amount_cents, 2500);
    await settlements.markPaid(f.store.admin, p.id, 2500, 'TRANSFER-AJUSTADA', close);
    assert.equal(
      (await f.store.query("SELECT count(*) AS n FROM ledger_entries WHERE kind='adjustment'"))[0]
        .n,
      1,
    );
  } finally {
    f.store.db.close();
  }
});

test('los céntimos del reparto se conservan y una clase futura o no impartida no se liquida', async () => {
  const f = await fixture();
  try {
    await f.authorize(0);
    await f.authorize(1);
    f.setNow(new Date(f.store.start.getTime() - 12 * 3600_000));
    await f.billing.run();
    f.setNow(new Date(f.store.start.getTime() + 3600_000));
    await f.pay(0);
    await f.pay(1);
    const settlements = new ManualSettlements(f.store);
    await settlements.refresh(f.getNow());
    assert.equal(
      (
        await f.store.query(
          "SELECT count(*) AS n FROM ledger_entries WHERE kind='teacher_allocation'",
        )
      )[0].n,
      0,
    );
    await f.store.query(
      "UPDATE sessions SET status='taught' WHERE cycle_id=(SELECT id FROM billing_cycles WHERE group_id=$1 AND sequence=1)",
      [f.store.group],
    );
    await settlements.refresh(f.getNow());
    assert.equal(
      (
        await f.store.query(
          "SELECT count(*) AS n FROM ledger_entries WHERE kind='teacher_allocation'",
        )
      )[0].n,
      0,
    );
  } finally {
    f.store.db.close();
  }
});
