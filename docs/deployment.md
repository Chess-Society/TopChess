# Despliegue y operación

## Situación

Destino actual: Cloudflare Workers con la base central D1 `topchess-global`. Ver `docs/cloudflare.md` para publicación, acceso administrativo de AndresLi y documentos privados. No hay contenido de demostración. Los servicios económicos y automatizaciones pendientes se indican en README; no se presentan como operativos.

## Entorno Node anterior (desarrollo/compatibilidad)

Servidor Node.js 24, HTTPS y PostgreSQL externo. Un contenedor/servidor compatible puede ejecutar `npm ci`, `npm run build`, `npm run start`. No se necesita un proceso en memoria como fuente de verdad. `APP_URL` debe coincidir exactamente con el origen real, sin barra final. El proceso de la aplicación no debe ejecutarse como superusuario.

1. Guardar secretos en el gestor del destino. `.env.example` contiene nombres y explicaciones, no claves reales. Nunca versionar `.env.local`.
2. Crear usuario SQL de migración con los permisos necesarios para `btree_gist`; limitar el usuario de ejecución a las tablas y operaciones necesarias. Mantener TLS verificado.
3. Ejecutar migraciones una vez en fase de release. No ejecutar migraciones desde cada petición.
4. Configurar Lichess (ver `docs/lichess.md`), acceder y completar el nombre real. Autorizar la cuenta como superadministrador por stdin; no hay contraseñas locales.
5. Configurar proveedor de correo HTTPS compatible con `{from,to,subject,text}` y `Idempotency-Key`. El acceso depende de Lichess; el correo se utiliza para comunicaciones operativas, no para autenticarse.
6. Bucket S3 privado, cifrado y bloqueo de acceso público. Activar escaneo antimalware antes de procesar CV de terceros. Los controles de firma del MVP no equivalen a un antivirus.
7. Configurar dominios permitidos de videollamada; enlaces solo para los participantes y docente autorizado.
8. Stripe sandbox, producto/precio mensual de 50 EUR final, webhooks y pruebas completas antes de live. Mantener Billing deshabilitado hasta resolver la coordinación de mínimos y cobros.
9. Completar datos legales, contratos y procesos de privacidad; activar `LEGAL_READY` solo tras su aprobación.

## Cola de correo

Programar externamente un POST a `/api/jobs/run` cada cinco minutos con `Authorization: Bearer <CRON_SECRET>` y `Origin: <APP_URL>`. No se ha creado una automatización en la cuenta del usuario. Los mensajes se bloquean con `FOR UPDATE SKIP LOCKED` y se reintentan hasta ocho veces con espera de 15 min. Configurar alerta para mensajes agotados. El proveedor debe deduplicar por ID; sin ello un fallo de respuesta puede causar correos repetidos.

Restringir la lectura del outbox, cifrar almacenamiento/backups y eliminar el contenido después del envío. No registrar cuerpos de mensajes, códigos OAuth ni cabeceras de autenticación. No hay enlaces de recuperación de contraseña locales.

## Puerta de producción

Antes de admitir datos reales: revisar amenazas, permisos de cada rol e identificadores cruzados; validar concurrencia en PostgreSQL externo; probar pagos fallidos, cancelaciones, sustituciones, devoluciones, webhooks y pérdida de respuesta; aprobar contratos y fiscalidad; realizar auditoría WCAG 2.2 AA; configurar MFA de administración, escaneo documental, logs sin secretos, alertas, retención y procesos RGPD.

## Restauración

Backups cifrados diarios, PITR según proveedor y políticas de retención aprobadas por TopChess. Restaurar periódicamente en entorno aislado y conciliar contra Stripe antes de reabrir escrituras. Eliminar claves de pago y desactivar colas en copias restauradas de prueba para impedir operaciones externas accidentales. Registrar RPO/RTO acordados tras una prueba real; no se han inventado garantías de recuperación.
