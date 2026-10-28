import { monthlyBilling, stripeClient } from '@/lib/monthly-billing';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 1024 * 1024)
    return new Response('Solicitud demasiado grande', { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1024 * 1024)
    return new Response('Solicitud demasiado grande', { status: 413 });
  const signature = request.headers.get('stripe-signature');
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return new Response('Firma inválida', { status: 400 });
  try {
    const stripe = stripeClient();
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return new Response('Firma inválida', { status: 400 });
    }
    await monthlyBilling(stripe, true).event(event);
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: 'El evento requiere reintento.' }, { status: 503 });
  }
}
