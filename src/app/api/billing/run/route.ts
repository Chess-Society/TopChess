import { timingSafeEqual } from 'node:crypto';
import { monthlyBilling } from '@/lib/monthly-billing';
import { ManualSettlements } from '@/lib/manual-settlements';
import { billingPreflight } from '@/lib/billing-preflight';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const received = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
  if (
    !process.env.CRON_SECRET ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  if (process.env.BILLING_ENABLED !== 'true')
    return Response.json({ enabled: false, preflight: await billingPreflight() });
  try {
    const result = await monthlyBilling().run();
    await new ManualSettlements().refresh();
    return Response.json(result);
  } catch {
    return Response.json(
      { error: 'La conciliación de cobros requiere reintento.' },
      { status: 503 },
    );
  }
}
