# Desarrollo local

La presentación del proyecto está en el README principal. Esta guía contiene solo la preparación técnica del entorno.

Con Node.js 24:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Completar `.env.local` con la configuración del entorno de desarrollo y abrir `http://127.0.0.1:3000`. No copiar secretos de producción para rellenar ejemplos ni inventar reservas o pagos.

Cloudflare utiliza el binding D1 `DB`; el backend Node de desarrollo puede utilizar `DATABASE_URL`. Para las migraciones PostgreSQL, Node debe cargar las variables explícitamente:

```powershell
node --env-file=.env.local --import tsx scripts/migrate.ts
```

La compilación utiliza Webpack por un fallo observado con los procesos auxiliares de Turbopack en Windows. El archivo de bloqueo fija las dependencias.

Ver [Cloudflare](cloudflare.md), [arquitectura](architecture.md) y [pruebas](testing.md) según la tarea.
