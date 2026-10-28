'use client';
import Link from 'next/link';
import { ActionForm } from './action-form';
import { useSearchParams } from 'next/navigation';
export function Reservation({ groupId }: { groupId: string }) {
  const search = useSearchParams();
  return (
    <ActionForm endpoint="/api/enrollments" label="Solicitar plaza sin cobro">
      <input type="hidden" name="groupId" value={groupId} />
      {search.get('campana') && (
        <input type="hidden" name="campaign" value={search.get('campana')!} />
      )}
      <label className="check-label">
        <input type="checkbox" name="terms" required />
        <span>
          He leído y acepto las <Link href="/legal/condiciones">condiciones</Link> y las{' '}
          <Link href="/legal/asistencia">normas de asistencia</Link>.
        </span>
      </label>
      <p className="small-text">
        Necesitas <Link href="/acceso">acceder con Lichess</Link> y completar tu nombre real. La
        solicitud no genera ningún cobro.
      </p>
    </ActionForm>
  );
}
