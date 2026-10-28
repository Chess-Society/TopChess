# Operación

- Repositorio del código: `https://github.com/Chess-Society/TopChess`, rama principal `main`. Preservar su licencia e historial.
- La aplicación se ejecuta en Cloudflare Workers y usa D1 como base central. PostgreSQL se conserva como compatibilidad de desarrollo; no es un requisito para Cloudflare.
- El usuario decidió mantener la base en la cuenta actual de Cloudflare. No trasladarla ni eliminarla por el nombre de la URL. Cambiar el dominio público es una operación distinta.
- GitHub Pages es alojamiento estático; guardar el código en GitHub no traslada el servidor, los secretos o la base de datos.
- Los secretos permanecen en Cloudflare. Nunca incorporarlos al repositorio ni mostrarlos en registros o mensajes. Los datos bancarios docentes se guardan cifrados; no cambiar su secreto de cifrado sin un plan de migración.
- No habilitar R2 ni otros servicios adicionales por defecto. Los CV privados pueden almacenarse en D1.
- Las credenciales de Git del equipo y el conector de GitHub pueden tener accesos distintos. Verificar permisos actuales sin mostrar tokens; no dar por imposible una subida por el resultado de un solo conector.
- Validación según el cambio: `npm run typecheck`, pruebas relacionadas; integración con `npm run test:integration`. Para publicar código de la web: `npm run build:cloudflare` y `npm run cloudflare:deploy`.
- Las pruebas simuladas no demuestran un cobro real ni una validación completa de Stripe. No repetir comprobaciones exitosas sin cambios relevantes.

Detalle: [desarrollo local](../development.md), [Cloudflare](../cloudflare.md), [arquitectura](../architecture.md), [pruebas](../testing.md). Configuración de despliegue: `wrangler.jsonc`.
