'use client';

import { useId, useState } from 'react';
import { splitCents, money } from '@/lib/domain';

export function CommissionExplainer() {
  const id = useId();
  const [percentage, setPercentage] = useState(50);
  const split = splitCents(5000, percentage * 100);
  return (
    <div className="commission-example">
      <span className="eyebrow">UN EJEMPLO PARA ENTENDER EL REPARTO</span>
      <h3>Sobre una cuota de 50 €</h3>
      <p>
        El alumno paga 50 € con IVA incluido. Tu porcentaje se calcula sobre esa cuota; TopChess
        asume el IVA y las comisiones de Stripe. El ejemplo corresponde a las cuatro clases del mes.
      </p>
      <label htmlFor={id}>
        Participación del profesor en el ejemplo <strong>{percentage} %</strong>
      </label>
      <input
        id={id}
        type="range"
        min={50}
        max={95}
        step={5}
        value={percentage}
        onChange={(event) => setPercentage(Number(event.target.value))}
        aria-valuetext={`${percentage} por ciento para el profesor; ${100 - percentage} por ciento para TopChess`}
      />
      <div className="commission-range-labels">
        <span>Inicio: 50 %</span>
        <span>Límite previsto: 95 %</span>
      </div>
      <div className="commission-bar" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
        <span style={{ width: `${100 - percentage}%` }} />
      </div>
      <div className="commission-totals" aria-live="polite" aria-atomic="true">
        <div>
          <span>Profesor</span>
          <strong>{money(split.teacher)}</strong>
          <small>{percentage} % de la cuota</small>
        </div>
        <div>
          <span>TopChess</span>
          <strong>{money(split.academy)}</strong>
          <small>{100 - percentage} % de la cuota</small>
        </div>
      </div>
      <small className="commission-caption">
        Mover este control no asigna un nivel ni una comisión. Los tramos reales se acuerdan por
        escrito; el 95 % no es automático ni está garantizado.
      </small>
    </div>
  );
}
