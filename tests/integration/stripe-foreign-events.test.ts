import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { MonthlyBilling } from '../../src/lib/monthly-billing';
import { monthlyStore } from '../helpers/monthly-store';

test('los eventos de otros sitios de la cuenta Stripe no crean incidencias ni pagos', async () => {
  const store = monthlyStore();
  try {
    const stripe = {
      subscriptions: {
        retrieve: async () => ({ metadata: { topchess_subscription: 'foreign-school' } }),
      },
      charges: {
        retrieve: async () => ({
          payment_intent: 'pi_foreign',
          amount: 5000,
          amount_refunded: 5000,
        }),
      },
      invoicePayments: { list: async () => ({ data: [{ invoice: 'in_foreign' }] }) },
    } as unknown as Stripe;
    const billing = new MonthlyBilling({
      stripe,
      query: store.query,
      write: store.write,
      now: () => new Date(),
      priceId: 'price_test',
      taxRateId: 'txr_test',
      appUrl: 'https://example.test',
    });
    for (const type of [
      'customer.subscription.updated',
      'charge.refunded',
      'charge.dispute.created',
    ]) {
      await billing.event({
        id: `evt_foreign_${type}`,
        type,
        data: { object: { id: 'foreign', charge: 'ch_foreign' } },
      } as Stripe.Event);
    }
    for (const table of ['payments', 'incidents', 'stripe_events']) {
      assert.equal((await store.query<{ n: number }>(`SELECT count(*) n FROM ${table}`))[0].n, 0);
    }
  } finally {
    store.db.close();
  }
});
