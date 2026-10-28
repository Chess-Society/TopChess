# Acceso exclusivo con Lichess

## Comportamiento

`/acceso` ofrece únicamente «Continuar con Lichess». Las antiguas páginas de registro, recuperación y verificación redirigen al mismo acceso; los endpoints antiguos de contraseña devuelven 410. No hay formulario de contraseña ni entrada alternativa administrativa.

Flujo:

1. `/api/auth/lichess` genera state y code_verifier aleatorios. Envía a Lichess un challenge SHA-256, nunca el verifier.
2. El intento queda en una cookie HttpOnly cifrada y autenticada con AES-256-GCM, SameSite=Lax, válida diez minutos y Secure con HTTPS.
3. El callback consume la cookie, valida state, antigüedad e integridad y canjea el código únicamente en servidor.
4. Consulta `/api/account` para obtener la identidad inmutable y `/api/account/email` para correo operativo (permiso `email:read`). No solicita permisos de partidas, mensajes ni estudios.
5. Se revoca el token de acceso al terminar, sin guardarlo en la base ni enviarlo al navegador. Si la revocación remota falla no se registra el token y no se muestra en errores.
6. Se vincula por `lichess_id`, nunca por email ni por nombre visible. Compartir un correo con una cuenta antigua no concede acceso a ella.
7. El primer acceso exige `/completar-perfil`: nombre y apellidos reales, modalidad alumno o candidato a profesor, mayoría de edad y privacidad. Sin completar el perfil no puede reservar ni presentar candidatura.
8. Las pantallas y fichas usan `users.name`. `lichess_username` se mantiene separado; volver a entrar no sobrescribe el nombre real.

El nombre es declarado por el usuario; no se solicita documento de identidad ni se afirma una verificación documental. Puede editarse después desde «Mi nombre y perfil». Elegir profesor no concede permisos docentes: la activación sigue requiriendo aprobación administrativa y acuerdo profesional.

## Configuración

Lichess admite clientes públicos no registrados: no se necesita client_secret ni un token personal de API del administrador. Configurar:

- `APP_URL`: origen canónico; HTTPS en producción.
- `LICHESS_CLIENT_ID`: identificador único de la aplicación, preferiblemente su dominio.
- `OAUTH_COOKIE_SECRET`: clave propia de 32 bytes en hexadecimal generada criptográficamente. Es un secreto de TopChess, no una credencial de Lichess.
- `DATABASE_URL`: PostgreSQL externo con migraciones 001 y 002 aplicadas.

El callback exacto es `<APP_URL>/api/auth/lichess/callback`. Se preserva el mismo redirect_uri durante autorización y canje. Si falta configuración, la pantalla muestra un error claro sin crear una sesión ficticia.

La migración 002 añade identidad y perfil, invalida sesiones y tokens anteriores y retira los hashes de contraseña. No enlaza usuarios heredados por correo: cualquier migración de una cuenta antigua requiere comprobación administrativa explícita.

Para el primer superadministrador: autenticar primero esa cuenta mediante Lichess, completar su perfil y promover su `lichessId` mediante `npm run admin:create` con JSON por stdin. El comando no puede crear una cuenta Lichess ni suplantar una identidad inexistente en la academia.

## Pruebas y límites

Hay pruebas de PKCE, manipulación de cookie, estado, expiración, código rechazado, canje con respuestas controladas, revocación del token, validación del nombre y vinculación sin mezclar cuentas por correo. Las E2E comprueban que solo se muestra Lichess, que no hay contraseña y que un callback inventado no inicia sesión.

Queda pendiente un acceso completo con una cuenta real en el dominio configurado y PostgreSQL externo. No se ha iniciado sesión en la cuenta personal del usuario ni se ha solicitado o guardado su contraseña de Lichess.

Fuentes oficiales: [Lichess API y PKCE](https://lichess.org/api), [autorización](https://github.com/lichess-org/api/blob/master/doc/specs/tags/oauth/oauth.yaml), [canje y revocación](https://github.com/lichess-org/api/blob/master/doc/specs/tags/oauth/api-token.yaml).
