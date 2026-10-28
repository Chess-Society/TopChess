# Arquitectura

## Decisiones

La arquitectura principal es Cloudflare Workers con OpenNext y una única base D1 de TopChess. No hay un tenant ni una base por profesor. Los usuarios se identifican con Lichess y se autorizan mediante roles en servidor. Los currículums privados pueden persistirse en fragmentos en D1; R2 es opcional si se activa en la cuenta.

El backend PostgreSQL inicial sigue disponible para desarrollo y compatibilidad. `cloudflare.ts` adapta las lecturas; `cloudflare-api.ts` implementa escrituras con lotes D1 atómicos y restricciones SQL. La API de transacciones PostgreSQL falla deliberadamente en Cloudflare para impedir simulaciones de atomicidad incompatibles con D1.

## Módulos

- `src/lib/domain.ts`: invariantes puras, importes enteros, fechas locales y progresión.
- `src/lib/db.ts`, `schema.ts`: pool PostgreSQL, ORM y transacciones. SQL es la fuente de verdad del esquema completo.
- `auth.ts` y `lichess.ts`: Lichess OAuth2 con PKCE S256, estado aleatorio, cookie de intento cifrada/autenticada AES-256-GCM durante diez minutos, sesión opaca cuyo hash se guarda en PostgreSQL y rate limiting persistente. El token Lichess se usa solo en servidor y se revoca tras obtener identidad/correo; no se almacena.
- `academy.ts`: grupos, reservas, bajas, reseñas, auditoría y lecturas con alcance por rol.
- `billing.ts`: cliente Stripe, Checkout, cancelación, webhooks y registro económico. Sin transferencias Connect.
- `storage.ts`: archivos privados S3; ningún CV está en `public/`.
- `app/api`: límites de cuerpo, validación Zod, origen, autenticación y permisos. Firma propia en webhook Stripe.
- `components`: navegación, catálogo, controles y paneles. El servidor vuelve a validar cada operación.
- `globals.css`: estructura responsive. `reference-theme.css`: tokens y apariencia de las referencias del usuario, cargados después para aplicar el tema a todas las superficies.

## Transacciones y concurrencia

En Cloudflare, capacidad, doble reserva, continuidad y reseñas se protegen en triggers de la base central. Cada operación compone un lote D1 atómico. Los documentos se fraccionan en filas limitadas y se insertan en un único lote. No se simula BEGIN/COMMIT de PostgreSQL sobre D1.

En el backend PostgreSQL anterior: Las mutaciones de calendario usan un bloqueo asesor transaccional compartido, seguido de bloqueo de filas. Este mecanismo prioriza corrección en el MVP; serializa las reservas de la academia y debe medirse antes de aumentar volumen. Las exclusiones GiST siguen siendo la última barrera contra dobles asignaciones. Una mejora posterior puede particionar bloqueos por docente y alumno con un orden total documentado.

El envío externo no tiene atomicidad distribuida con PostgreSQL. Stripe usa claves idempotentes estables; los reintentos deben conservar el ID de operación. El proveedor de correo debe respetar `Idempotency-Key`. Se requiere conciliación operativa de operaciones cuya respuesta se pierda después de surtir efecto.

## Idioma y zonas

Español inicial con `lang=es`. Formateo de moneda centralizado y almacenamiento de instantes en `timestamptz`; zona IANA en grupo. La extracción completa de textos a catálogos de traducción queda para la fase de internacionalización. No se afirma que cambiar un único ajuste traduzca toda la aplicación.

## Seguridad operativa pendiente

Revisar dependencia de identificadores suministrados, CSP con nonce para retirar `unsafe-inline`, MFA administrativo, límites globales de acceso en el proxy, escáner de documentos, instrumentación sin datos sensibles y pruebas de carga. No desactivar autenticación para una demostración de paneles.
