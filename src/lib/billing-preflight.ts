import Stripe from 'stripe';
import { atomic } from './cloudflare';
export async function billingPreflight() {
  const result: {
    checked_at: string;
    key_present: boolean;
    webhook_present: boolean;
    account_id?: string;
    price_ok?: boolean;
    tax_ok?: boolean;
    error?: string;
    key_kind?: string;
    checks?: Record<string, { ok: boolean; status?: number; reason?: string }>;
  } = {
    checked_at: new Date().toISOString(),
    key_present: !!process.env.STRIPE_SECRET_KEY,
    webhook_present: !!process.env.STRIPE_WEBHOOK_SECRET,
  };
  if (result.key_present) {
    const key = process.env.STRIPE_SECRET_KEY!;
    result.key_kind = /^sk_live_/.test(key)
      ? 'secret_live'
      : /^rk_live_/.test(key)
        ? 'restricted_live'
        : /^pk_/.test(key)
          ? 'publishable_invalid'
          : /^(sk|rk)_test_/.test(key)
            ? 'test_invalid_for_live'
            : 'unknown_format';
    result.checks = {};
    const check = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
        result.checks![name] = { ok: true };
      } catch (e) {
        const err = e as { statusCode?: number; type?: string; code?: string };
        result.checks![name] = {
          ok: false,
          status: err.statusCode,
          reason: [
            'StripeAuthenticationError',
            'StripePermissionError',
            'StripeInvalidRequestError',
            'StripeConnectionError',
            'StripeAPIError',
          ].includes(err.type || '')
            ? err.type
            : 'unexpected_error',
        };
        result.error =
          err.code === 'api_key_expired'
            ? 'clave_caducada'
            : err.code === 'resource_missing'
              ? 'configuracion_no_coincide_con_cuenta'
              : 'clave_o_permisos_no_verificados';
      }
    };
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 1 });
      await check('account', async () => {
        const account = await stripe.accounts.retrieveCurrent();
        result.account_id = account.id;
      });
      await check('price', async () => {
        if (process.env.STRIPE_PRICE_ID) {
          const p = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
          result.price_ok =
            p.active &&
            p.currency === 'eur' &&
            p.unit_amount === 5000 &&
            p.recurring?.interval === 'month' &&
            p.tax_behavior === 'inclusive';
        }
      });
      await check('tax', async () => {
        if (process.env.STRIPE_TAX_RATE_ID) {
          const t = await stripe.taxRates.retrieve(process.env.STRIPE_TAX_RATE_ID);
          result.tax_ok = t.active && t.inclusive && t.country === 'ES' && t.percentage === 21;
        }
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      result.error =
        code === 'api_key_expired'
          ? 'clave_caducada'
          : code === 'resource_missing'
            ? 'configuracion_no_coincide_con_cuenta'
            : 'clave_o_permisos_no_verificados';
    }
  }
  await atomic([
    {
      sql: "INSERT INTO platform_settings(key,value) VALUES('stripe_preflight',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      values: [JSON.stringify(result)],
    },
  ]);
  return result;
}
