# Pagos

- Proveedor decidido: Stripe. Cobra a los alumnos; TopChess hace manualmente las transferencias a profesores según los importes de la web. No usar Stripe Connect ni exigir cuenta Stripe al profesor.
- Cuota final: 50 €/alumno/mes, IVA español del 21 % incluido. Base 41,32 € e IVA 8,68 €.
- TopChess asume el IVA y las comisiones de Stripe. El porcentaje docente se aplica a los 50 € completos: un 50 % corresponde a 25 € por cuatro clases del alumno.
- La reserva autoriza el método sin cobrar. La cuota se programa para el día 1 del mes de incorporación, sujeta al mínimo y al calendario aprobado; las renovaciones siguen el calendario mensual.
- Cierre docente el día 28 por clases impartidas y cobradas hasta el 27. Las posteriores pasan al siguiente cierre. Registrar una transferencia en la web no envía dinero.
- Las facturas deben ser reales, numeradas, fechadas, con los datos fiscales y PDF privado descargable por su titular o administración.
- El usuario confirmó IVA y datos fiscales completos en Stripe. Eso no equivale a aprobar los borradores legales públicos ni a validar todo el flujo de cobro.
- Los cobros se dejaron desactivados. Antes de activarlos, verificar las condiciones legales, las pruebas con Stripe y los permisos efectivos de la clave. No asumir que un diagnóstico anterior sigue vigente.

Detalle e integración: [pagos](../payments.md). Código: `src/lib/monthly-billing.ts`, `src/lib/manual-settlements.ts`, `src/lib/billing-preflight.ts`, `src/app/api/invoices/[id]/route.ts`.
