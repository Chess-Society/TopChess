# Identidad y permisos

- El acceso es exclusivamente con Lichess. Se exige nombre y apellidos reales; el alias de Lichess queda vinculado por separado.
- La identidad propietaria es el usuario Lichess `AndresLi`, ID `andresli`. No sustituir su rol administrativo por el de profesor.
- Administración y docencia pueden coexistir en una cuenta. El panel permite alternar Administración / Profesor; los datos docentes se limitan al usuario actual.
- El administrador completa y confirma su propia ficha docente y decide si publicarla. Puede consultar sus grupos, alumnos, agenda, ingresos y datos de transferencia sin perder la administración.
- Para el resto, elegir profesor al registrarse inicia una candidatura; no concede autorización docente automática. TopChess revisa y publica los perfiles.
- Verificar permisos en el servidor. No aceptar roles ni la identidad del propietario desde campos del formulario.
- Los profesores autorizados y publicados crean sus propios grupos dentro de su disponibilidad y gestionan el enlace privado de las próximas clases de cada grupo. El alumno elige un grupo publicado y reserva; no se implementan solicitudes de franjas al profesor. La administración supervisa globalmente grupos, matrículas y próximas clases y conserva la creación manual como apoyo opcional.

Detalle: [permisos](../roles-permissions.md), [Lichess](../lichess.md). Código: `src/lib/lichess.ts`, `src/lib/auth.ts`, `src/lib/admin-teaching.ts`, `src/lib/academy.ts`, `src/lib/cloudflare-api.ts`.
