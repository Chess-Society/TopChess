# Producto

- TopChess es una escuela con base central propia, alumnos propios y profesores seleccionados manualmente por su administración.
- El catálogo debe mostrar solo perfiles y grupos reales autorizados. No rellenarlo con datos de demostración.
- La presentación distingue beneficios para alumnos y profesores y explica con claridad la selección docente y el reparto económico.
- Diseño de referencia: carbón y marfil, bordes negros, esquinas redondeadas y sombra inferior marcada. Aplicarlo también a menús, desplegables, formularios y paneles.
- Las horas usan el componente `TimePicker` con los desplegables propios: horas 00–23 y todos los minutos 00–59. Evitar el selector de horas nativo del navegador y las restricciones a saltos de 30 minutos.
- La sección administrativa «Enlaces de difusión» permite compartir enlaces y atribuir solicitudes a su origen. Es opcional y no contrata anuncios ni genera gastos publicitarios.
- Se reserva para incorporarse el mes natural siguiente: cuatro sesiones con fechas y horarios fijos. No hay incorporación parcial a final de mes.
- Ni alumno ni profesor cambian unilateralmente las clases. TopChess coordina excepciones y continuidad.
- La organización habitual es autónoma: el profesor publica grupos y el alumno elige uno y gestiona su matrícula. TopChess supervisa toda la escuela desde el panel; no debe tener que crear cada grupo o dar de alta manualmente a cada alumno. No añadir un flujo de petición de franjas: el usuario eligió solo grupos publicados.
- El profesor autorizado publica su disponibilidad semanal desde el panel: puede marcar varios días, añadir franjas y retirar las propias. El alumno ve los horarios de Madrid en el catálogo y en la ficha docente. Son disponibilidad habitual; las fechas y plazas que se pueden contratar siguen siendo las de los grupos publicados. No modificar clases ya acordadas al editar franjas.

Detalle: [reglas de negocio](../business-rules.md). Código: `src/lib/monthly-calendar.ts`, `src/components/dashboard.tsx`, `src/app/reference-theme.css`, `src/app/audience.css`.
