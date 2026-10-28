# Roles y permisos

| Acción                    | Visitante | Alumno                       | Candidato                | Profesor                       | Admin/superadmin                         |
| ------------------------- | --------- | ---------------------------- | ------------------------ | ------------------------------ | ---------------------------------------- |
| Catálogo publicado        | Sí        | Sí                           | Sí                       | Sí                             | Sí                                       |
| Solicitar plaza           | No        | Propia, nombre real completo | No                       | No                             | No                                       |
| Consultar clases/pagos    | No        | Propios                      | No                       | Solo clases e ingresos propios | Global cuando el flujo esté implementado |
| Presentar candidatura     | No        | Propia, nombre real completo | Una                      | No                             | Revisa                                   |
| CV y referencias privadas | No        | No                           | No descarga en esta fase | No                             | Descarga autenticada y auditada          |
| Asistencia                | No        | Consulta propia              | No                       | Grupos asignados               | Sí                                       |
| Publicar disponibilidad   | No        | Consulta pública             | No                       | Propia, con ficha autorizada   | Propia, con ficha autorizada             |
| Comisiones                | No        | No                           | No                       | Lectura propia                 | Configuración avanzada pendiente         |
| Moderar reseñas           | No        | No                           | No                       | No                             | Motivo obligatorio                       |
| Motivos privados de baja  | No        | No expuestos en catálogo     | No                       | No                             | Solo gestión autorizada                  |
| Campañas y captación      | No        | No                           | No                       | No                             | Sí                                       |

Los permisos se verifican en el servidor y las lecturas se acotan por el usuario autenticado. El rol no se acepta desde el formulario. No existen cuentas públicas de demostración con permiso de administración.

Administración y docencia pueden coexistir: un administrador puede completar y confirmar su propia ficha docente sin cambiar su rol. El selector Administración / Profesor conserva la gestión global y muestra, en el espacio docente, únicamente sus propios grupos, alumnos, agenda e ingresos. La publicación de su ficha es explícita y las operaciones bancarias y de disponibilidad requieren un perfil docente autorizado.

Un docente autorizado puede publicar franjas semanales para varios días y retirar exclusivamente las suyas. No requieren una revisión adicional por franja: la selección y autorización del profesor las realiza TopChess. Las franjas solo son públicas si el docente está activo, autorizado y publicado; se rechazan horas inválidas, intervalos menores de 30 minutos y solapamientos. Editar disponibilidad no modifica sesiones, matrículas ni horarios ya contratados.

`superadmin` se autoriza por stdin sobre una cuenta que ya ha accedido con Lichess y completado su nombre. No se crean credenciales locales. En esta versión admin y superadmin comparten las funciones implementadas; la delegación granular y gestión de administradores requiere una fase adicional.

Las operaciones de academia requieren identidad Lichess y perfil con nombre y apellidos reales, mayoría de edad y aceptación de privacidad. Un perfil incompleto solo puede completarse o cerrar sesión. La elección «profesor» crea un candidato, nunca un profesor activo. Las sesiones tienen token opaco en cookie HttpOnly, Secure en producción y SameSite=Lax. El hash del token y su caducidad están en PostgreSQL. No existen contraseña local, recuperación ni endpoints de registro por email. La migración a Lichess invalida todas las sesiones anteriores y elimina los hashes heredados.

El endpoint de trabajos requiere un secreto independiente, más el Origin configurado. El webhook Stripe no usa sesión/origen de navegador: verifica la firma sobre el cuerpo sin modificar.

Antes de producción: MFA administrativo, auditoría de accesos sensibles adicional, revisión de mínimos privilegios del usuario SQL y roles operativos separados para contabilidad, atención y contratación docente.
