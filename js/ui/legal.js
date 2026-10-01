/* Aviso legal, privacidad y cookies. Documentación estática y sólo la
   abre quien la pide, así que se carga bajo demanda igual que la
   guía (./guide.js), con el mismo envoltorio `.guide` para que se vea
   igual: mismos títulos, mismos párrafos, mismo diálogo. */

import { dialog } from "./dialog.js";

const CONTACT = "djl@djl.red";
const OWNER = "David";
/* Fecha que se enseña al final de los tres documentos: cambiarla en
   cada modificación de cualquiera de ellos. */
const UPDATED = "1 de octubre de 2026";

const LEGAL_BODY = `<div class="guide">

  <h3>Titularidad</h3>
  <p class="lead">Realify es un proyecto personal de ${OWNER} (contacto:
    <code>${CONTACT}</code>). Esta página identifica quién está detrás de
    la aplicación.</p>

  <h3>Qué es esto</h3>
  <p>Realify es una aplicación web que se ejecuta enteramente en el
    navegador de quien la usa: no hay servidores propios que reciban,
    procesen o almacenen imágenes de nadie. Todo el tratamiento ocurre en
    tu propio equipo. Sólo una función opcional descarga recursos de un
    tercero (los modelos de inteligencia artificial grandes, de Hugging
    Face); se detalla en la Política de privacidad. Las tipografías se
    sirven desde el propio sitio.</p>

  <h3>Propiedad intelectual</h3>
  <p>El código, el diseño y los textos de Realify pertenecen a su autor,
    salvo que se indique lo contrario. Las imágenes que edites con la
    herramienta siguen siendo tuyas en todo momento: la aplicación no
    reclama ningún derecho sobre ellas, porque nunca salen de tu equipo ni
    llegan a verse desde fuera.</p>

  <h3>Licencia y uso de la aplicación</h3>
  <p>El código fuente de Realify se distribuye bajo la licencia
    <b>PolyForm Noncommercial 1.0.0</b>: puede estudiarse, modificarse y
    redistribuirse sólo con fines no comerciales; venderlo, integrarlo
    en un producto o servicio de pago u ofrecer una copia o adaptación
    con ánimo de lucro requiere autorización expresa del titular.</p>
  <p>Esa limitación se refiere al código. <b>El uso de la aplicación en
    <code>realify.es</code> está permitido para cualquier fin, también
    profesional o comercial</b>: puedes editar con ella tus fotos o las de
    tus clientes y usar el resultado como quieras.</p>

  <h3>Responsabilidad</h3>
  <p>Realify se ofrece tal cual, sin garantía de disponibilidad continua
    ni de idoneidad para un uso concreto. El uso de sus filtros y ajustes
    es responsabilidad de quien los aplica.</p>

  <h3>Cambios en estas condiciones</h3>
  <p>El titular puede modificar en cualquier momento y sin previo aviso
    este aviso legal, las condiciones de uso y de licencia, la Política de
    privacidad y la Política de cookies, así como la propia aplicación y
    sus funciones. Los cambios se reflejarán siempre en estos documentos,
    disponibles en el menú Ayuda, y se aplican desde su publicación; la
    fecha de la última actualización figura al final de cada uno. Te
    recomendamos revisarlos de vez en cuando. Seguir usando Realify tras
    un cambio supone aceptar la versión vigente.</p>

  <h3>Contacto</h3>
  <p>Para cualquier consulta relacionada con este aviso legal, escribe a
    <code>${CONTACT}</code>.</p>
  <p><small>Última actualización: ${UPDATED}.</small></p>

</div>`;

const PRIVACY_BODY = `<div class="guide">

  <h3>Resumen</h3>
  <p class="lead">Realify no tiene servidores propios de procesamiento:
    todo ocurre en tu navegador. No se sube ninguna imagen, no hay
    analítica ni publicidad, no hacen falta cuentas de usuario y no se
    crean perfiles de nadie. El único dato personal que se trata es
    técnico: el servidor web que aloja Realify anota cada petición
    (incluida tu <b>dirección IP</b>) en un registro que se usa sólo para
    la seguridad y para corregir errores, y que se borra solo a los
    14 días. Además, si usas ciertas funciones opcionales de inteligencia
    artificial, tu navegador descarga un modelo de un servicio de
    terceros. Las dos cosas se explican más abajo.</p>

  <h3>Responsable</h3>
  <p>El responsable de este sitio es ${OWNER}, contacto
    <code>${CONTACT}</code>.</p>

  <h3>Qué se procesa</h3>
  <p>Nada sale de tu equipo. Las imágenes que abres, editas y exportas
    permanecen en la memoria y el almacenamiento de tu propio navegador en
    todo momento.</p>

  <h3>Registros del servidor web</h3>
  <p>Para enseñarte la aplicación, tu navegador descarga sus archivos
    (páginas, código, estilos, tipografías y, si los usas, algunos
    modelos de IA) del servidor de Realify. Como cualquier servidor web,
    éste anota automáticamente cada petición en un registro de accesos.</p>
  <ul>
    <li><b>Qué se anota:</b> tu dirección IP, la fecha y hora, el archivo
      pedido, si se sirvió bien o hubo error, la página desde la que se
      pidió y el navegador y sistema operativo que lo anuncian
      («user agent»). Nada más: ni tus imágenes, ni tus textos, ni lo que
      haces dentro de la aplicación, que nunca llega al servidor.</li>
    <li><b>Para qué:</b> exclusivamente para mantener el sitio seguro
      (detectar y frenar ataques y abusos) y para diagnosticar fallos,
      por ejemplo averiguar qué archivo no le llega a quien no consigue
      abrir la aplicación. No se usa para analítica, estadísticas de
      visitas, publicidad ni para identificar o perfilar a nadie, y no se
      cruza con ningún otro dato.</li>
    <li><b>Base jurídica:</b> el interés legítimo en garantizar la
      seguridad y el funcionamiento del servicio (art. 6.1.f y
      considerando 49 del RGPD).</li>
    <li><b>Cuánto tiempo:</b> el registro se rota a diario y se borra
      automáticamente a los <b>14 días</b>. Sólo se conservaría más tiempo
      la parte concreta necesaria si hubiera que investigar un ataque o
      atender un requerimiento legal.</li>
    <li><b>Quién puede verlo:</b> sólo el responsable de Realify. No se
      cede ni se vende a nadie, salvo obligación legal. La empresa que
      proporciona el servidor actúa como encargada del tratamiento
      (sólo lo aloja).</li>
    <li><b>Registro de errores del servidor:</b> cuando una petición
      falla, el servidor también anota el error con la IP de origen, con
      el mismo fin y la misma conservación.</li>
  </ul>

  <h3>Servicios de terceros (opcionales)</h3>
  <p>Para descargar un recurso de internet, tu navegador tiene que
    conectarse al servidor que lo aloja, y ese servidor recibe
    inevitablemente tu <b>dirección IP</b> y datos técnicos de la petición
    (navegador, sistema, hora). Realify sólo hace esta descarga en un
    caso, y nunca envía tus imágenes ni tus textos:</p>
  <ul>
    <li><b>Hugging Face</b> (Hugging Face, Inc.). Los modelos de
      inteligencia artificial (eliminar fondo con MODNet o ISNet, relleno y
      expansión con LaMa, ampliar, colorear, reducción de ruido y de
      artefactos JPEG) se
      descargan de <code>huggingface.co</code> la primera vez que eliges
      uno de ellos, y a partir de ahí se guardan en tu navegador. La imagen
      se procesa en tu equipo: sólo se descarga el modelo. Base jurídica:
      la ejecución de la función que has pedido (art. 6.1.b RGPD).
      <a href="https://huggingface.co/privacy" target="_blank" rel="noopener">Política de privacidad de Hugging Face</a>.</li>
  </ul>
  <p><b>Tipografías.</b> Todas las fuentes de la herramienta Texto, del
    creador de memes y del collage (el catálogo libre de Google Fonts, con
    licencias SIL Open Font License, Apache y Ubuntu Font Licence) se
    sirven desde el propio servidor de Realify. Tu navegador <b>no se
    conecta con Google</b> ni con ningún otro tercero para usarlas.</p>

  <h3>Qué guarda tu navegador (nunca sale de tu equipo)</h3>
  <ul>
    <li><b>Preferencias de la interfaz.</b> Posición de las ventanas,
      ajustes de reglas y guías, herramientas y niveles de historial:
      en <code>localStorage</code>, sólo en tu navegador.</li>
    <li><b>Proyectos guardados.</b> Si guardas un proyecto, se almacena
      localmente mediante <code>IndexedDB</code>, en tu propio equipo.</li>
    <li><b>Preferencias de EXIF y de la simulación de cámara.</b> Igual
      que lo anterior: quedan en tu navegador para la próxima visita.</li>
    <li><b>Las tipografías que hayas elegido en el buscador</b>, para que
      sigan apareciendo en la lista, en <code>localStorage</code>.</li>
    <li><b>Modelos de IA descargados</b>, en <code>IndexedDB</code>, para
      no tener que volver a descargarlos.</li>
  </ul>
  <p>Nada de esto identifica a nadie ni se transmite a ningún servidor.
    Puedes borrarlo cuando quieras vaciando los datos del sitio desde tu
    propio navegador.</p>

  <h3>Cookies</h3>
  <p>Realify no utiliza cookies de analítica, publicidad ni seguimiento.
    Consulta la Política de cookies para más detalle.</p>

  <h3>Tus derechos</h3>
  <p>Realify no tiene cuentas, bases de datos de usuarios ni guarda
    nada de lo que haces en la aplicación; el único dato personal en sus
    servidores es la dirección IP de los registros descritos arriba, que
    se borran solos a los 14 días. Sobre ellos puedes ejercer tus
    derechos de acceso, supresión, limitación y oposición escribiendo a
    <code>${CONTACT}</code>: indica tu IP y el día y la hora aproximados
    de la visita, porque el registro no contiene ningún otro dato que
    permita encontrarte. Lo que guarda tu navegador puedes borrarlo tú
    mismo vaciando los datos del sitio. Frente a Hugging Face puedes ejercer tus derechos
    según su propia política. También puedes reclamar ante la
    Agencia Española de Protección de Datos (<code>aepd.es</code>). Si
    tienes cualquier duda sobre privacidad, escribe a
    <code>${CONTACT}</code>.</p>

  <h3>Cambios</h3>
  <p>Esta política puede modificarse en cualquier momento y sin previo
    aviso, por ejemplo si cambia el funcionamiento de la aplicación o del
    servidor o la normativa. Los cambios se reflejarán siempre en este
    documento, disponible en Ayuda › Política de privacidad, y se aplican
    desde su publicación. Si un cambio supusiera tratar tus datos con un
    fin nuevo, se indicará aquí antes de hacerlo.</p>
  <p><small>Última actualización: ${UPDATED}.</small></p>

</div>`;

const COOKIES_BODY = `<div class="guide">

  <h3>Resumen</h3>
  <p class="lead">Realify no utiliza cookies de analítica, publicidad ni
    seguimiento de ningún tipo.</p>

  <h3>Qué es una cookie</h3>
  <p>Una cookie es un pequeño archivo que un sitio web puede guardar en tu
    navegador para recordar información entre visitas. Realify no instala
    ninguna.</p>

  <h3>Recursos de terceros</h3>
  <p>Realify no incrusta contenido de terceros que instale cookies. Las
    tipografías se sirven desde el propio sitio, y los modelos de Hugging
    Face (sólo si los usas) se descargan como archivos, sin cookies. Los
    detalles, en la Política de privacidad.</p>

  <h3>Almacenamiento local, que no es lo mismo</h3>
  <p>Aparte de las cookies, los navegadores ofrecen otras formas de
    guardar datos sólo en tu equipo, como <code>localStorage</code> e
    <code>IndexedDB</code>. Realify las usa exclusivamente para recordar
    tus propias preferencias de uso —posición de ventanas, ajustes de
    herramientas, proyectos guardados— y ese contenido nunca se envía a
    ningún servidor. Puedes borrarlo cuando quieras desde los ajustes de
    tu navegador («borrar datos del sitio»).</p>

  <h3>Cambios</h3>
  <p>Esta política puede modificarse en cualquier momento y sin previo
    aviso. Los cambios se reflejarán siempre en este documento, disponible
    en Ayuda › Política de cookies, y se aplican desde su publicación. Si
    algún día se usaran cookies que requieran tu consentimiento, se te
    pediría antes de instalarlas.</p>

  <h3>Contacto</h3>
  <p>Si tienes dudas sobre esta política, escribe a
    <code>${CONTACT}</code>.</p>
  <p><small>Última actualización: ${UPDATED}.</small></p>

</div>`;

const open = (title, body, onOpen) => dialog({ title, wide: true, body, onOpen, buttons: [{ label: "Cerrar", primary: true }] });

export const openLegalNotice = () => open("Aviso legal", LEGAL_BODY);
export const openPrivacyPolicy = () => open("Política de privacidad", PRIVACY_BODY);
export const openCookiesPolicy = () => open("Política de cookies", COOKIES_BODY);
