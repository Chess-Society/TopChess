import { groups } from '@/lib/catalog';
import { Explorer } from '@/components/explorer';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Encuentra tu clase' };
export const dynamic = 'force-dynamic';
export default async function Classes() {
  const data = await groups();
  return (
    <div className="container section">
      <div className="page-heading">
        <span className="eyebrow">UN GRUPO, UN PROFESOR, UN CAMINO</span>
        <h1>
          Tu próxima clase
          <br />
          empieza por aquí.
        </h1>
        <p>Encuentra tu nivel y hazle un hueco al ajedrez. Cuatro clases online por 50 €/mes.</p>
      </div>
      <Explorer groups={data.items} />
    </div>
  );
}
