// El fichero importado lo genera OpenNext durante build:cloudflare.
// @ts-ignore — salida generada, ausente antes de la primera compilación.
import worker from '../.open-next/worker.js';
// @ts-ignore — las clases también se exportan desde la salida generada.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js';
export default {
  fetch: worker.fetch,
  async scheduled(
    _event: unknown,
    env: Record<string, string>,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    if (env.BILLING_ENABLED !== 'true' && !env.STRIPE_SECRET_KEY) return;
    const request = new Request(`${env.APP_URL}/api/billing/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      worker.fetch(request, env, ctx).then((response: Response) => {
        if (!response.ok) throw new Error('Monthly billing reconciliation failed');
      }),
    );
  },
};
