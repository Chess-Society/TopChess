import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ActionForm } from '@/components/action-form';
import { Select } from '@/components/select';
import { canAdmin } from '@/lib/domain';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu nombre en la academia' };
export default async function CompleteProfile() {
  const user = await currentUser();
  if (!user) redirect('/acceso');
  return (
    <div className="container section onboarding-layout">
      <div className="page-heading">
        <span className="eyebrow">TU CUENTA ESTÁ CONECTADA</span>
        <h1>
          En el tablero, tu alias.
          <br />
          Aquí, tu nombre.
        </h1>
        <p>
          Has entrado con Lichess como <strong>{user.lichess_username}</strong>. En TopChess
          queremos conocerte por tu nombre real.
        </p>
      </div>
      <section className="form-card">
        <h2>{user.profile_completed_at ? 'Tu perfil' : 'Un último paso para empezar'}</h2>
        <p>
          Tu nombre y apellidos aparecerán como alumno o profesor. Tu usuario de Lichess se conserva
          por separado y no se cambia en Lichess.
        </p>
        <ActionForm endpoint="/api/profile" label="Guardar mi nombre y continuar">
          <label>
            Nombre y apellidos reales
            <input
              name="name"
              required
              minLength={3}
              maxLength={100}
              defaultValue={user.name || ''}
              autoComplete="name"
              placeholder="Ej.: María García López"
            />
          </label>
          {!user.profile_completed_at && (
            <>
              {canAdmin(user.role) ? (
                <>
                  <input type="hidden" name="kind" value="student" />
                  <div className="notice">
                    Tu cuenta está autorizada para la administración de TopChess. Gestionarás la
                    base común de la escuela.
                  </div>
                </>
              ) : (
                <label>
                  Quiero usar TopChess como
                  <Select name="kind" defaultValue="student">
                    <option value="student">Alumno · quiero aprender</option>
                    <option value="teacher">Profesor · quiero presentar mi candidatura</option>
                  </Select>
                </label>
              )}
              <label className="check-label">
                <input type="checkbox" name="adult" required />
                <span>Confirmo que tengo 18 años o más.</span>
              </label>
              <label className="check-label">
                <input type="checkbox" name="privacy" required />
                <span>
                  He leído la <Link href="/legal/privacidad">política de privacidad</Link> y
                  entiendo que mi nombre se mostrará en la academia.
                </span>
              </label>
            </>
          )}
          <label className="check-label">
            <input type="checkbox" name="realName" required />
            <span>Confirmo que he indicado mi nombre real, no mi alias de Lichess.</span>
          </label>
        </ActionForm>
        <p className="small-text">
          Elegir profesor no concede acceso docente: TopChess revisará y aprobará tu candidatura.
        </p>
      </section>
    </div>
  );
}
