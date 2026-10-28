import { currentUser } from '@/lib/auth';
import { d1Query } from '@/lib/cloudflare';
import { canAdmin } from '@/lib/domain';
import { stripeClient } from '@/lib/monthly-billing';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response('Accede a tu cuenta.', { status: 401 });
  const { id } = await params;
  const [row] = await d1Query<{ student_id: string; stripe_invoice_id: string }>(
    'SELECT e.student_id,p.stripe_invoice_id FROM payments p JOIN subscriptions s ON s.id=p.subscription_id JOIN group_enrollments e ON e.id=s.enrollment_id WHERE p.id=$1',
    [id],
  );
  if (!row || (!canAdmin(user.role) && row.student_id !== user.id))
    return new Response('Factura no encontrada.', { status: 404 });
  try {
    const invoice = await stripeClient().invoices.retrieve(row.stripe_invoice_id);
    if (!invoice.number || !invoice.invoice_pdf)
      return new Response('Factura pendiente de emisión.', { status: 409 });
    const url = new URL(invoice.invoice_pdf);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.stripe.com'))
      return new Response('Documento no disponible.', { status: 502 });
    const pdf = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!pdf.ok || !pdf.headers.get('content-type')?.includes('application/pdf'))
      throw new Error('PDF no disponible');
    return new Response(pdf.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura-${invoice.number.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('No se pudo descargar la factura. Vuelve a intentarlo.', { status: 503 });
  }
}
