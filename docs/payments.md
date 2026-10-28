# Cobros y pagos de TopChess

## Decisión vigente

Stripe cobra a los alumnos y abona el saldo disponible en la cuenta bancaria de TopChess. TopChess realiza manualmente las transferencias a sus profesores y registra su referencia en la web. No se utiliza Connect ni se exige Stripe a los profesores. Revolut, Trade Republic y Binance fueron opciones evaluadas y no forman parte de la integración.

La cuenta seleccionada por delegación del usuario es `acct_1RzKQXRBnPDD6EfR`. La conexión del chat permite consultar Stripe, pero no proporciona una clave privada al servidor. No se han realizado cargos ni transferencias reales.

Configuración confirmada el 28/10/2026: el usuario guardó `STRIPE_SECRET_KEY` como secreto de Cloudflare y confirmó IVA del 21 % incluido en los 50 EUR y datos fiscales completos del emisor en Stripe. Se creó el precio `price_1UVbMxRBnPDD6EfR1dsthxFF` con importe 5000 EUR minor units, periodicidad mensual y `tax_behavior=inclusive`, bajo el producto específico `prod_topchess_global_monthly`, el IVA inclusivo y el webhook específico. Se publicó la configuración y un diagnóstico privado sin cargos. No se crearon suscripciones ni cargos. Quedan la comprobación del Worker, las pruebas reales aisladas y completar las condiciones legales públicas antes de activar Billing. La confirmación de datos fiscales no equivale a aprobación de los borradores legales de la web.

## Calendario y cuotas

- Reserva gratuita para incorporarse el mes natural siguiente. El calendario es Europe/Madrid; el cargo se programa el día 1 a las 00:00 UTC, siempre día 1 también en Madrid.
- 50 EUR finales por alumno y mes, IVA incluido, por cuatro sesiones de horario fijo. Las cuatro fechas se conocen antes de contratar; no hay alta parcial a mitad de mes.
- La matrícula cierra 48 horas antes del inicio del mes. Checkout requiere datos de facturación del cliente y autorización expresa de las cuotas. Solo se admite facturación española en esta primera integración; no activar otros países sin validar su tratamiento fiscal.
- Checkout en modo `setup` autoriza el método sin cobrar. Su resultado solo se acepta mediante webhook firmado y consulta del SetupIntent, con identidad y titular verificados en servidor.
- Dentro de las 24 horas anteriores al día 1, la tarea programada confirma dos métodos autorizados y calendario aprobado. Crea Subscription Schedules con ancla en el día 1 y renovación mensual automática. El calendario se publica para doce meses y el cobro finaliza al acabar ese horizonte; no se cobra un mes sin calendario aprobado.
- Se revisa el mínimo antes de renovar. Una baja conserva las clases abonadas. Si el nuevo periodo queda inviable, se detienen futuras renovaciones.
- Si no se alcanza el mínimo de pagos antes de la primera clase (o en 24 horas, lo que ocurra antes), se cancela el arranque y se tramitan devoluciones del mes. Las solicitudes a Stripe se ejecutan fuera de los lotes D1, con claves estables y acciones pendientes recuperables.

## Reparto y transferencias manuales

El usuario ha indicado que TopChess asume IVA y comisiones de Stripe. El porcentaje del profesor se aplica a los 50 EUR íntegros de cuota, sin descontarle esos conceptos: con 50 % y cuatro clases impartidas corresponde un total de 25 EUR por alumno. Se conserva el porcentaje vigente al cobrar cada factura.

La generación se registra por clase impartida y cobrada. Se reparten los céntimos entre cuatro sesiones sin perder redondeos. El cierre del día 28 incluye las clases hasta el 27; las posteriores pasan al siguiente cierre. Las devoluciones y disputas revierten asignaciones y no reescriben cierres ya pagados.

El panel del profesor distingue generado, pendiente e historial de pagos. La administración puede actualizar importes, consultar la cuenta bancaria y registrar una transferencia realizada con su referencia. El botón no mueve dinero. Los cierres pagados son inmutables y un segundo registro no duplica el pago.

El profesor guarda titular e IBAN desde su panel. El IBAN se comprueba por módulo 97, se cifra con AES-256-GCM y una clave derivada específica de `OAUTH_COOKIE_SECRET`; el cifrado se vincula al identificador del profesor. Su consulta requiere identidad autorizada y se audita. Los datos bancarios no aparecen en el catálogo público.

## Facturas

Se recogen nombre fiscal, NIF/DNI/NIE y domicilio del alumno antes de autorizar el método de pago. Stripe genera las facturas reales con su numeración, fecha, periodo, descripción, desglose fiscal y datos del emisor y cliente. El NIF personal se incluye como campo de factura, sin fingir que es un identificador de IVA empresarial.

La web guarda número, fecha, URL y PDF del documento del proveedor. La descarga `/api/invoices/[id]` verifica la propiedad o el rol administrativo y responde con PDF privado sin caché. No se inventan facturas en una reserva ni en la página de éxito.

Antes de activar, configurar y revisar en Stripe los datos legales de TopChess, NIF, domicilio, serie correlativa y tratamiento fiscal, incluidos supuestos de exención y rectificación. El PDF de Stripe no constituye por sí solo una validación de todas las obligaciones fiscales o de software de facturación aplicables.

## Configuración y estado

`BILLING_ENABLED=false` y `LEGAL_READY=false` mantienen los cobros desactivados hasta completar la configuración y la validación. Son necesarios:

- `STRIPE_SECRET_KEY`: clave restringida en Cloudflare, nunca en código, cliente o chat.
- `STRIPE_WEBHOOK_SECRET`: firma del endpoint público `/api/stripe/webhook`.
- `STRIPE_PRICE_ID`: precio recurrente mensual EUR 5000, `tax_behavior=inclusive`.
- `STRIPE_TAX_RATE_ID`: IVA español del 21 % incluido, confirmado por TopChess. Cuota final 50 €, base 41,32 € e IVA 8,68 €. Se utiliza un tipo manual; no se crean registros de Stripe Tax.
- `CRON_SECRET`: ya existe; protege `/api/billing/run`. El Worker lo invoca cada quince minutos y no ejecuta cobros mientras Billing esté desactivado.

Eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`. Se consulta el estado actual del proveedor antes de procesar entregas fuera de orden. Las facturas, eventos, recibos y acciones tienen restricciones o claves de deduplicación.

Las pruebas automatizadas usan el código de negocio real, SQLite con el esquema D1 y un proveedor Stripe simulado aislado. **Todavía no se ha probado el flujo completo contra Stripe sandbox ni activado pagos reales.** Antes de activarlos, comprobar SCA, métodos asíncronos, reintentos, devoluciones parciales y totales, interrupción de tareas, conciliación y todos los datos de facturación con la cuenta efectiva.

Referencias: [Billing](https://docs.stripe.com/billing/quickstart), [Subscription Schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules), [facturas de suscripción](https://docs.stripe.com/billing/invoices/subscription), [contenido fiscal de facturas](https://www3.agenciatributaria.gob.es/Sede/iva/facturacion-registro/facturacion-iva/contenido-facturas.html).

Configuración real preparada el 28/10/2026: precio `price_1UVbMxRBnPDD6EfR1dsthxFF`, IVA inclusivo `txr_1UVbQ0RBnPDD6EfRV6xlbv1F`, cuenta Stripe terminada en `6EfR`. Endpoint propio de TopChess Global con versión `2026-09-30.endive`; secreto de firma guardado en Cloudflare, sin copia en archivos. Los otros sitios de esta cuenta conservan su configuración y sus eventos se ignoran cuando no pertenecen a matrículas de esta escuela.

Diagnóstico del Worker a las 18:30 UTC: ambos secretos presentes; conexión aún no verificada (`clave_o_permisos_no_verificados`). No interpretar este resultado como cuenta conectada ni habilitar cobros. Se añadieron comprobaciones independientes de cuenta, precio e IVA, con tipo de clave y errores seguros, sin guardar su contenido. La administración puede repetirlas en «Comprobar conexión con Stripe». El horario final sigue siendo cada quince minutos.
