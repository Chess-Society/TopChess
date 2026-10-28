import { teachers } from '@/lib/catalog';
import { Explorer } from '@/components/explorer';
export const metadata = { title: 'Nuestros profesores' };
export const dynamic = 'force-dynamic';
export default async function Teachers() {
  const data = await teachers();
  return (
    <div className="container section">
      <div className="page-heading">
        <span className="eyebrow">PERSONAS QUE HACEN LA DIFERENCIA</span>
        <h1>
          Aprende con quien
          <br />
          sabe acompañarte.
        </h1>
        <p>
          Elige un enfoque que encaje contigo. TopChess se ocupa de seleccionar y coordinar al
          equipo.
        </p>
      </div>
      <Explorer teachers={data.items} mode="teachers" />
    </div>
  );
}
