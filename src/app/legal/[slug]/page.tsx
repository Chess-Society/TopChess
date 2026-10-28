import { notFound } from 'next/navigation';
const documents: Record<string, { title: string; sections: [string, string][] }> = {
  aviso: {
    title: 'Aviso legal',
    sections: [
      [
        'Estado del documento',
        'Borrador operativo pendiente de revisión profesional y de completar titular, NIF, domicilio, contacto y datos registrales. No habilita por sí mismo la contratación.',
      ],
      [
        'Prestador del servicio',
        'La contratación de las clases se realiza con la entidad titular de TopChess Global. Los profesores imparten la actividad dentro de la estructura de la academia. Deben completarse los datos oficiales de esta entidad antes de abrir al público.',
      ],
      [
        'Propiedad y uso',
        'La identidad y los recursos oficiales de TopChess deben incorporarse con autorización. La denominación tipográfica de esta versión no sustituye el logotipo oficial.',
      ],
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    sections: [
      [
        'Responsable y contacto',
        'Pendiente de completar los datos legales del responsable y el canal de ejercicio de derechos. Este documento requiere revisión antes de admitir usuarios reales.',
      ],
      [
        'Finalidades y datos',
        'Gestionar cuentas, matrículas, clases, pagos, incidencias y candidaturas. El acceso se realiza únicamente con Lichess, que autoriza la consulta de identidad y correo operativo. Se guarda su identificador por separado del nombre y apellidos declarados, que se muestran en la academia. No se solicita ni almacena la contraseña de Lichess. Las candidaturas y los motivos privados de baja se limitan al personal autorizado.',
      ],
      [
        'Bases y destinatarios',
        'La prestación contractual, obligaciones legales y, cuando corresponda, consentimiento deberán documentarse por finalidad. Los proveedores de pagos, correo, almacenamiento y videollamada deberán contar con contratos y garantías de tratamiento.',
      ],
      [
        'Conservación y derechos',
        'Antes del lanzamiento se fijarán plazos por categoría y un proceso de acceso, rectificación, supresión, oposición, limitación y portabilidad cuando proceda. La eliminación no puede borrar obligaciones de conservación económica.',
      ],
      [
        'Candidaturas',
        'El CV se guarda en almacenamiento privado. La comprobación de referencias exige transparencia y una base adecuada. No se contactará indiscriminadamente con empleadores actuales.',
      ],
      [
        'Menores',
        'El registro de esta primera versión requiere ser mayor de edad. No admitir menores hasta disponer del flujo de tutores y autorizaciones validado.',
      ],
    ],
  },
  cookies: {
    title: 'Política de cookies',
    sections: [
      [
        'Cookies de sesión',
        'La aplicación utiliza tc_session para identificar la sesión autenticada. Es HttpOnly, SameSite=Lax y Secure en producción, con duración máxima de siete días. Durante la autorización con Lichess utiliza tc_lichess_oauth, cifrada, HttpOnly y válida diez minutos. Son cookies necesarias para el acceso y no contienen contraseñas.',
      ],
      [
        'Analítica y publicidad',
        'Esta versión no carga herramientas de analítica ni publicidad de terceros. Cualquier incorporación posterior que requiera consentimiento debe permanecer bloqueada hasta obtenerlo y permitir su retirada.',
      ],
      [
        'Preferencias',
        'Las búsquedas solo se utilizan para mostrar resultados. El código de campaña incluido en un enlace se atribuye a la solicitud sin cargar rastreadores externos. La base de ese tratamiento debe incluirse en la revisión de privacidad.',
      ],
    ],
  },
  condiciones: {
    title: 'Condiciones de contratación',
    sections: [
      [
        'Documento pendiente de aprobación',
        'Borrador de reglas del producto. La contratación permanece deshabilitada hasta completar los datos del titular, validar la fiscalidad, los derechos de desistimiento, reembolsos y reclamaciones, y revisar este documento profesionalmente.',
      ],
      [
        'Objeto y precio',
        'El servicio es una suscripción de 50 € por mes natural, con los impuestos aplicables incluidos, cuatro clases online de duración inicial de 60 minutos, profesor asignado y grupo estable. No es un bono de libre utilización. Las fechas, el horario y el precio final constan antes de contratar.',
      ],
      [
        'Formación de grupos',
        'El mínimo es dos alumnos y la capacidad habitual cuatro. Una solicitud pendiente no genera cobros. Se publican las fechas antes de contratar y las inscripciones cierran 48 horas antes del día 1 del mes de incorporación. El inicio requiere el mínimo de matrículas y pagos confirmados.',
      ],
      [
        'Facturación',
        'La cuota final de 50 € incluye el IVA aplicable. Se solicitan nombre fiscal, NIF/DNI/NIE y domicilio del cliente antes de contratar. Tras su emisión por Stripe, la factura estará disponible en el panel con número, fecha y PDF descargable. Los datos legales del emisor, serie y desglose fiscal deben configurarse y validarse antes de activar cobros.',
      ],
      [
        'Reserva e incorporación',
        'Las reservas se realizan para incorporarse el mes siguiente, sujeto a confirmación del grupo y del calendario. No se admiten incorporaciones con un mes ya iniciado. La reserva no genera cobros. El primer cargo corresponde al mes de incorporación y las renovaciones se realizan el día 1; si no se confirma un grupo viable, no se inicia el cobro.',
      ],
      [
        'Ciclos, festivos y renovaciones',
        'Cada mes natural tiene exactamente cuatro fechas, comunicadas antes de contratar y con los festivos previstos en el calendario. Una quinta semana no añade clases. Las fechas y el horario son compartidos por el grupo: ni el alumno ni el profesor pueden mover una sesión unilateralmente. Las incidencias requieren coordinación de TopChess.',
      ],
      [
        'Cancelación y cambios',
        'El alumno puede cancelar futuras renovaciones y mantener el acceso hasta la fecha efectiva indicada. Puede solicitar otro grupo, horario o profesor para un mes posterior, sujeto a disponibilidad y confirmación de TopChess, sin duplicar el disfrute. Esto no permite cambiar libremente las clases ya contratadas. La falta de asistencia no equivale a cancelar una suscripción.',
      ],
      [
        'Incidencias de la academia',
        'Si el profesor o la plataforma no pueden prestar una clase, no se registra como ausencia del alumno. TopChess gestionará una sustitución, una recuperación acordada con el grupo o, si no puede prestarse el servicio, la devolución que corresponda conforme al contrato y las normas aplicables. El profesor comunica la incidencia a la academia y no cambia por su cuenta el calendario.',
      ],
      [
        'Derechos del consumidor',
        'Estas reglas no excluyen derechos irrenunciables de desistimiento, devolución o reclamación. El procedimiento, la información precontractual y los consentimientos específicos necesarios deben validarse antes de la apertura comercial.',
      ],
    ],
  },
  asistencia: {
    title: 'Normas de asistencia y clases',
    sections: [
      [
        'Horario fijo del grupo',
        'Las cuatro fechas y el horario se conocen antes de contratar y se comparten con todo el grupo. El alumno no puede trasladar una sesión individualmente. El profesor tampoco puede modificar unilateralmente una clase confirmada: cualquier incidencia se comunica a TopChess para su coordinación con el grupo.',
      ],
      [
        'Ausencia del alumno',
        'Una clase confirmada no se cancela ni se recupera unilateralmente por el alumno. Si no asiste, se registra su ausencia y la sesión se consume. No se acumula para otro mes ni genera devolución por la mera ausencia, sin perjuicio de sus derechos legales.',
      ],
      [
        'Incidencia del profesor',
        'Una clase no impartida por el profesor no se registra como ausencia del alumno. Se abre una incidencia y TopChess gestiona una sustitución, una recuperación acordada con el grupo o, si no se puede prestar el servicio, la devolución que corresponda. Una recuperación excepcional no permite cambiar libremente el horario habitual.',
      ],
      [
        'Cambios y continuidad',
        'Las solicitudes de otro horario, grupo o profesor son para un mes posterior y requieren disponibilidad y confirmación de TopChess. Si un grupo pierde alumnos, las clases abonadas no se interrumpen automáticamente. Se revisa su continuidad.',
      ],
      [
        'Participación',
        'Los enlaces de clase son privados. Respeta a los compañeros y no compartas datos personales ni grabes sesiones sin una base y autorización adecuadas.',
      ],
    ],
  },
  resenas: {
    title: 'Política de reseñas',
    sections: [
      [
        'Experiencia verificable',
        'Solo alumnos con asistencia a una clase impartida pueden valorar la relación académica. Cada matrícula admite una reseña, con puntuación de 1 a 5 y comentario opcional.',
      ],
      [
        'Moderación',
        'Las reseñas se revisan antes de publicarse. Pueden ocultarse durante una investigación y retirarse por fraude, insultos, amenazas o exposición de datos personales. Toda intervención registra su motivo.',
      ],
      [
        'Opiniones negativas',
        'Una reseña legítima no se elimina solo por ser negativa. La puntuación pública se calcula sobre las reseñas auténticas publicadas. Los profesores no pueden borrar reseñas; pueden solicitar revisión a la academia.',
      ],
      [
        'Reclamaciones',
        'Utiliza el formulario de contacto o una incidencia en el panel para solicitar revisión. No se fabrican puntuaciones ni opiniones de demostración como si fueran reales.',
      ],
    ],
  },
};
export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = documents[slug];
  if (!d) notFound();
  return (
    <article className="container section legal-page">
      <span className="eyebrow">INFORMACIÓN Y TRANSPARENCIA</span>
      <h1>{d.title}</h1>
      <div className="notice">
        Versión inicial · Pendiente de revisión y aprobación por TopChess antes de la contratación
        pública.
      </div>
      {d.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
    </article>
  );
}
