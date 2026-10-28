# Cloudflare: una escuela, una base central

Web pública: https://topchess-global.kiroshirp.workers.dev

Base central: `topchess-global`. No se han insertado usuarios, docentes ni grupos de ejemplo.

TopChess administra una única academia. El Worker público usa una única base Cloudflare D1 para los alumnos, profesores seleccionados, grupos, matrículas e historial de la escuela. No hay bases separadas ni propiedad independiente por profesor.

- Visitantes: oferta pública real, sin perfiles, opiniones ni plazas inventadas.
- Alumnos: sus propias clases, solicitudes y suscripciones.
- Profesores aprobados: sus grupos y los datos necesarios de sus alumnos.
- Administración TopChess: gestión global. La cuenta inicial autorizada es `AndresLi`, comprobada mediante el identificador autenticado de Lichess, nunca mediante un nombre enviado por el navegador.

## Acceso e infraestructura

El despliegue utiliza Cloudflare Workers y OpenNext. D1 conserva datos remotos; las escrituras críticas se ejecutan en lotes atómicos y las restricciones de capacidad, solapamiento y asistencia están también en triggers SQL. Las migraciones de Cloudflare son independientes de las migraciones PostgreSQL anteriores. Una migración D1 ya aplicada no se modifica: añadir otra.

No existe un panel web para guardar el token de Cloudflare. Se utiliza la autorización oficial existente de Wrangler en el equipo del operador. El token no se incorpora al repositorio, al Worker público ni a los perfiles de la escuela. Los secretos OAuth de la aplicación se generan criptográficamente y se envían por stdin al almacén de secretos de Cloudflare sin imprimirlos.

## Documentación privada

El almacenamiento R2 no está activado en la cuenta en el momento de la preparación. El MVP puede guardar los currículums en la base central D1, divididos en fragmentos privados de 256 KiB y con máximo de 5 MiB por documento. No hay rutas públicas de archivos: solo la administración autenticada puede descargarlos y el acceso queda auditado. Si se habilita R2 después, puede añadirse el binding DOCUMENTS para nuevos archivos; las descargas conservan compatibilidad con documentos existentes en D1.

Esta solución evita activar otro producto, pero consume la cuota de almacenamiento D1 de la escuela. Revisar tamaño, retención y migración a R2 según aumente el volumen. La validación de PDF no sustituye un análisis antimalware.

## Publicación

```powershell
npm run build:cloudflare
npm run cloudflare:deploy
node scripts/cloudflare-init-secrets.mjs
```

`wrangler.jsonc` contiene identificadores y variables no secretas. `APP_URL` debe ser el origen público real para proteger los formularios y el callback Lichess. El código público de cuenta y base no es una contraseña; nunca añadir ahí tokens ni claves.

No se fabrican alumnos ni profesores para rellenar el catálogo. TopChess debe aprobar y publicar sus docentes y grupos. Los pagos requieren Stripe y la aprobación de las condiciones: mientras no estén configurados, no se ejecutan ni simulan cargos.

El punto de entrada `cloudflare/worker.ts` conserva el Worker de OpenNext y añade una tarea cada quince minutos para la conciliación mensual. Con `BILLING_ENABLED=false` solo verifica en lectura la conexión, precio e IVA y guarda un estado sin secretos en `platform_settings`; no cobra. La administración también puede ejecutar esta comprobación desde su panel. La migración `0002_monthly_billing.sql` añade estado mensual, facturas, acciones recuperables, asignaciones docentes y datos bancarios cifrados. Consultar `docs/payments.md` para las condiciones de activación; no se utiliza Stripe Connect ni se envía dinero a profesores desde el Worker.
