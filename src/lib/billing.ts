import { monthlyBilling } from './monthly-billing';
import { onCloudflare } from './cloudflare';
import { assert } from './domain';
import type { User } from './auth';
export async function checkout(
  user: User,
  enrollmentId: string,
  details?: Parameters<ReturnType<typeof monthlyBilling>['checkout']>[2],
) {
  assert(
    onCloudflare(),
    'La contratación se gestiona desde la academia pública de Cloudflare.',
    503,
  );
  assert(details, 'Completa tus datos de facturación.');
  return monthlyBilling().checkout(user, enrollmentId, details);
}
export async function cancelRenewal(user: User, enrollmentId: string, reason: string) {
  assert(
    onCloudflare(),
    'La contratación se gestiona desde la academia pública de Cloudflare.',
    503,
  );
  return monthlyBilling().cancel(user, enrollmentId, reason);
}
