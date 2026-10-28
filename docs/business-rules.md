# Reglas e invariantes

| Regla                   | Implementación actual                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Contrato con TopChess   | Mensajes y términos de la academia; un único precio servidor                                            |
| 50 €/mes, cuatro clases | Precio Stripe validado, ciclos con cuatro fechas y sesiones de 60 min por defecto                       |
| Grupo de mínimo dos     | Primera reserva pendiente sin cobro; segunda confirma; acceso a contratación solo en confirmado         |
| Aforo                   | Validación bajo bloqueo transaccional                                                                   |
| Doble reserva           | Comparación de todo el calendario y exclusiones GiST por alumno/profesor                                |
| Cierre de inscripción   | Fecha persistida, 48 horas por defecto configurable antes de crear grupo                                |
| Cinco semanas           | Nunca se crea una quinta sesión dentro del ciclo                                                        |
| Festivo                 | Se omite la fecha; si desplaza la cuarta clase fuera del periodo se rechaza la publicación              |
| Zona horaria            | Hora local conservada durante cambios de verano/invierno                                                |
| Ausencia alumno         | Se registra solo en una clase impartida y consume sesión                                                |
| Ausencia docente        | Incidencia independiente, no consume como ausencia del alumno                                           |
| Salida o renovación     | Historial de solicitud y motivo privado; cancelación de renovación conserva acceso hasta fecha efectiva |
| Reseña                  | Clase impartida y asistencia presente, una por matrícula                                                |
| Docente                 | Solicitud, aprobación documentada y publicación administrativa separada                                 |
| Baja/readmisión         | Baja con control de continuidad; readmisión inicia nuevo ciclo al 50/50                                 |
| Auditoría y economía    | Ledger y auditoría no modificables; snapshot de porcentaje del pago protegido                           |

## Calendario

Cada grupo publica 12 ciclos mensuales desde su fecha original de inicio. El ancla mensual conserva el día original cuando existe y usa el último del mes cuando no. Se generan cuatro ocurrencias semanales por ciclo, en la hora local; un mes puede contener un intervalo sin clase entre la cuarta sesión y el siguiente ciclo. Las sesiones y periodos se persisten. No se admiten incorporaciones después del cierre inicial.

La asignación de 12 ciclos limita el horizonte: la suscripción debe terminar como máximo al final del calendario aprobado. Extenderla requiere aprobar nuevas fechas y ampliar ese horizonte deliberadamente, nunca seguir cobrando sin sesiones.

## Limitaciones antes de la apertura

Confirmación significa mínimo de solicitudes, no dos cobros garantizados. Antes de activar Billing es imprescindible completar una orquestación que verifique dos alumnos contratados, cierre los grupos insuficientes y cancele los intentos pendientes sin cobro. Un pago fallido no debe dejar a otro alumno pagando por un grupo que la academia no pueda prestar.

La retirada de una solicitud abre revisión de continuidad. Si no hay suscripciones activas y el grupo cae por debajo de dos solicitudes, se devuelve a pendiente. Con clases abonadas, debe conservarse el servicio y resolverlo con intervención administrativa.

La falta de nuevas altas no prueba abandono docente. El trabajo programado genera un recordatorio después de 15 días sin actividad registrada y respeta vacaciones aprobadas. No cambia automáticamente el estado ni da de baja.
