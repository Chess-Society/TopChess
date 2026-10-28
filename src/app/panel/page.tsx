import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { dashboard } from '@/lib/academy';
import { Dashboard, type DashboardData } from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi academia', robots: { index: false, follow: false } };
export default async function Panel() {
  const user = await currentUser();
  if (!user) redirect('/acceso');
  if (!user.lichess_id || !user.profile_completed_at) redirect('/completar-perfil');
  const data = await dashboard(user);
  return (
    <div className="container section">
      <Dashboard
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          verified: !!user.profile_completed_at,
        }}
        data={JSON.parse(JSON.stringify(data)) as DashboardData}
      />
    </div>
  );
}
