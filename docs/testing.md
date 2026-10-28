# Pruebas

## Ejecutables

| Comando                    | Cobertura                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`        | TypeScript estricto                                                                                                                        |
| `npm test`                 | Cuatro sesiones, horario de verano, festivos, aforo/cierre, intervalos, redondeo, ascensos, reinicio y asistencia                          |
| `npm run test:integration` | Migración PostgreSQL/PGlite y funciones reales de calendario, reservas, capacidad, idempotencia, bajas, reseñas y restricciones económicas |
| `npm run test:e2e`         | Catálogo, filtros, navegación, errores de configuración, acceso anónimo, origen, móvil a 320 px y tema de desplegables/formularios         |
| `npm run build`            | Compilación de producción con Webpack                                                                                                      |
| `npm audit --omit=dev`     | Avisos conocidos de dependencias de ejecución                                                                                              |

PGlite ejecuta PostgreSQL WASM efímero con `btree_gist`; el adaptador de pool se sustituye solo dentro del proceso de test. No está conectado con el servidor ni se usa como persistencia del producto. No equivale a una prueba de concurrencia de varias conexiones TCP a PostgreSQL externo.

Las E2E esperan el catálogo de demostración y ausencia de servicios externos. Ejecutarlas sin `DATABASE_URL`, `MAIL_API_URL`, claves Stripe ni datos reales. El servidor debe usar `APP_URL=http://127.0.0.1:3000`. Se utiliza Chrome instalado; cambiar `PLAYWRIGHT_CHANNEL` si corresponde.

Los datos de pruebas son ficticios y usan direcciones `example.test`. No hay datos de alumnos reales en los tests.

## Validaciones que siguen siendo obligatorias

- Varias solicitudes simultáneas a la última plaza y a grupos con horarios en conflicto contra PostgreSQL externo.
- Stripe sandbox: pagos completos, tarjeta rechazada, SCA, reintentos, devolución parcial/total, disputa, evento anterior al Checkout y repetición tras fallos SQL.
- Grupo con un único alumno contratado antes del inicio y cancelación sin cargos de las suscripciones pendientes; continuidad cuando se pierde alumnado.
- Fin de calendario, festivos, 29/30/31 del mes, sustituciones, recuperación y cambios sin doble disfrute.
- Lichess real: consentimiento, cancelación, callback, caducidad/reutilización de código y sesión; nombres reales, cambios y roles. Las pruebas existentes de canje usan respuestas controladas y no certifican un acceso real contra el proveedor.
- Archivos maliciosos, tamaño sin Content-Length, IAM del bucket, descarga indebida y conservación/eliminación.
- Reseñas de otro alumno, fraude, moderación negativa legítima y aislamiento de motivos privados.
- Liquidaciones cerradas, ascensos por alumnos únicos, periodo congelado, reinicio tras readmisión y revisión trimestral cuando se implementen.
- Lector de pantalla, teclado completo, contraste, foco y zoom a 200/400 %; la apariencia por sí sola no certifica WCAG.
- Copia y restauración, caída del proveedor, instrumentación sin datos sensibles y pruebas de carga.

No describir ninguna de estas validaciones pendientes como realizada.
