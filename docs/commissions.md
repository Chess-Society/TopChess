# Comisiones y liquidaciones

Participación inicial del profesor: 5000 puntos básicos (50 %). Participación máxima prevista: 9500 (95 %); mínimo de TopChess: 5 %. No se han inventado tramos comerciales que no aparezcan aprobados en la solicitud.

Las tablas `teacher_commission_levels` e historial admiten umbral, porcentaje y fecha efectiva. La función pura `nextCommission` exige mantener el umbral en dos periodos consecutivos, respeta congelación y no rebaja automáticamente un nivel. **El cálculo programado sobre alumnos únicos pagados y activos, la revisión trimestral y el cierre de liquidaciones todavía no están implementados.**

Cada alumno en varios grupos del mismo profesor debe contar una sola vez. El origen comercial no cambia el reparto por defecto. Las promociones futuras no alterarán pagos ni liquidaciones cerradas: el pago guarda su porcentaje y ciclo profesional; hay restricciones SQL que impiden sobrescribir ese snapshot.

La base liquidable debe especificarse contractualmente: impuestos, descuentos, devoluciones y costes de pago. `splitCents` reparte una base entera ya definida, redondea al céntimo a favor del saldo de academia y garantiza conservación del total. No calcula impuestos ni beneficio neto.

La baja definitiva registra el cierre del ciclo y requiere resolver compromisos docentes. La readmisión incrementa el ciclo y restaura 50/50, con nuevo acuerdo y perfil sin publicar. Inactividad, vacaciones y suspensión provisional no reinician porcentajes. El sistema conserva el historial y audita el motivo administrativo; no permite aplicar una baja automática por mero transcurso del tiempo.

Stripe Connect, onboarding de cuentas, reservas por disputas, transferencias idempotentes, devoluciones compensatorias y conciliación bancaria requieren implementación y validación del modelo contractual/fiscal. No se ejecuta ninguna transferencia ni se presenta un reparto teórico como ingreso liquidado.
