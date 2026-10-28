# TopChess Global

Repositorio de TopChess: [Chess-Society/TopChess](https://github.com/Chess-Society/TopChess).

Publicación actual: `topchess-global.kiroshirp.workers.dev`. Por decisión de TopChess, la base de datos permanece en la cuenta actual de Cloudflare; no hay una migración a otra cuenta autorizada. El código corresponde al repositorio independiente de TopChess. Un cambio futuro de dirección pública debe actualizar y verificar `APP_URL`, el cliente Lichess y el webhook de Stripe. Administración inicial de la escuela: `AndresLi`, con acceso real por Lichess y nombre completo obligatorio.

Academia online de ajedrez. **MVP funcional en desarrollo; todavía no apto para admitir usuarios ni cobros de producción.** No es una plataforma de partidas ni un directorio de docentes independientes: el servicio lo presta TopChess.

## Ejecutar

Destino principal: Cloudflare Workers y D1, con una única base central administrada por TopChess. El backend PostgreSQL anterior se conserva para desarrollo y compatibilidad; no es necesario para la publicación en Cloudflare. Ver `docs/cloudflare.md`.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Configurar las variables de `.env.local` con los valores del entorno de desarrollo. Para los scripts de base de datos, Node debe recibir también esas variables: `node --env-file=.env.local --import tsx scripts/migrate.ts`.

```powershell
npm run dev
```

Abrir [la aplicación local](http://127.0.0.1:3000). No se incluyen datos de demostración. El catálogo solo muestra docentes y grupos reales publicados por TopChess. Cloudflare usa el binding D1 `DB`; el desarrollo Node puede utilizar `DATABASE_URL`. Nunca se simulan reservas ni pagos.

## Funciones implementadas

- Web pública responsive desde 320 px, buscador con filtros, fichas docentes, grupos con cuatro fechas, precios, ayuda, contacto y candidatura.
- Estilo suministrado por el usuario: carbón y marfil, bordes negros, esquinas redondeadas y sombras inferiores. Se aplica también a los desplegables abiertos, menú móvil, formularios y paneles. No se ha creado un logotipo oficial.
- Acceso exclusivamente con Lichess OAuth2/PKCE, perfil obligatorio de adulto con nombre y apellidos reales, sesiones opacas revocables y autorización en servidor. El alias Lichess se conserva por separado y nunca se usa como nombre público.
- PostgreSQL, migración versionada, proyección Drizzle para identidad y SQL transaccional para reservas/calendarios.
- Solicitudes sin cobro, mínimo de dos alumnos, aforo, cierre de inscripción, rechazo de solapamientos de profesores y alumnos.
- Doce ciclos mensuales aprobados de cuatro sesiones; conserva horario de Madrid al cambiar el horario de verano. Sin incorporaciones a mitad del ciclo en esta fase.
- Panel de alumno, docente, candidatura y administración con datos persistidos, sin acceso público a métricas privadas.
- Solicitud y aprobación docente, autorización separada de publicación, disponibilidad propuesta, baja y readmisión con reinicio 50/50.
- CV PDF privado en S3, descarga autenticada y auditada. Comprobación de tamaño, extensión, MIME y firmas básicas.
- Registro de clases, asistencia e incidencias; una ausencia docente nunca se cuenta como ausencia del alumno.
- Reseñas verificadas por asistencia, una por matrícula, moderación con motivo e historial.
- Stripe Checkout/Billing con autorización sin cobro, cuotas el día 1, facturas PDF privadas y cancelación de renovaciones. Panel de liquidaciones del día 28 y registro de transferencias manuales a profesores, con IBAN cifrado. **Sin activar ni comprobar contra Stripe sandbox o live.** Véase `docs/payments.md`.
- Campañas por enlace y atribución de solicitudes, sin rastreadores de terceros.
- Cola persistente de correo con reintentos e idempotencia del proveedor, notificaciones internas y recordatorio de actividad.

## Lo que sigue pendiente

No se debe presentar este proyecto como una plataforma de producción completa. Faltan:

1. Completar las pruebas con cuentas reales de Lichess y configurar correo transaccional, videollamadas y Stripe. La base central Cloudflare D1 ya tiene esquema y controles transaccionales; los documentos pueden persistirse privadamente en D1 sin activar R2. Lichess admite clientes públicos sin client_secret; configurar `LICHESS_CLIENT_ID`, `APP_URL` y una clave propia `OAUTH_COOKIE_SECRET` de 32 bytes hexadecimales.
2. Ampliar las pruebas de concurrencia en Cloudflare real, pruebas completas de pagos asíncronos, reembolsos y disputas, restauración y auditoría de accesibilidad/seguridad.
3. Validar la orquestación mensual implementada con Stripe sandbox y en Cloudflare: mínimo de matrículas, pagos asíncronos, interrupciones y continuidad. Billing permanece deshabilitado.
4. Configurar datos fiscales reales, serie de facturas y tipo impositivo aplicable; completar ascensos automáticos por dos periodos, revisión trimestral y conciliación de ajustes complejos. TopChess asume IVA y comisiones: el porcentaje docente se aplica a la cuota íntegra. Los pagos a profesores son manuales; **la web no envía transferencias**.
5. Reprogramación/sustitución de clases, cierre de grupos y reubicación con flujos administrativos completos; aprobación de vacaciones y disponibilidad desde interfaz.
6. Autorizaciones de tutores/menores. El registro de esta fase admite solo mayores de 18 años.
7. Controles administrativos avanzados, exportación contable y de datos, retención/eliminación automatizadas, MFA administrativo, escaneo antimalware de PDF y monitorización operativa.
8. Automatizaciones de inactividad a 30/60 días y avisos de clases/renovaciones, recursos pedagógicos, informes y QR de campañas.
9. Textos legales y acuerdos revisados, identificación del titular, fiscalidad, desistimiento y proceso de reclamaciones. `LEGAL_READY=false` y `BILLING_ENABLED=false` son los valores iniciales.

## Administración inicial

No existen contraseñas locales ni promoción de roles desde formularios. En Cloudflare, la cuenta inicial es `AndresLi`, identificada por el ID real devuelto por Lichess y configurada por TopChess en servidor. Debe completar su nombre real y privacidad antes de administrar. El script `promote-admin.ts` solo corresponde al backend PostgreSQL anterior.

## Comprobaciones

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Las pruebas de integración verifican el esquema Cloudflare D1 sobre SQLite efímero y el backend anterior PostgreSQL sobre PGlite, exclusivamente para pruebas. Nunca es el almacenamiento de la aplicación. Las E2E usan Chrome instalado; `PLAYWRIGHT_CHANNEL` permite cambiar de navegador. Ejecutar contra un entorno sin servicios configurados para las pruebas que verifican el bloqueo por configuración ausente.

La compilación utiliza Webpack por un fallo observado en los procesos auxiliares de Turbopack en este Windows. El archivo de bloqueo fija las versiones instaladas.

Ver [arquitectura](docs/architecture.md), [reglas](docs/business-rules.md), [base de datos](docs/database.md), [permisos](docs/roles-permissions.md), [pagos](docs/payments.md), [comisiones](docs/commissions.md), [despliegue](docs/deployment.md) y [pruebas](docs/testing.md).
