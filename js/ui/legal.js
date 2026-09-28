/* Aviso legal, privacidad y cookies. Documentación estática y sólo la
   abre quien la pide, así que se carga bajo demanda igual que la
   guía (./guide.js), con el mismo envoltorio `.guide` para que se vea
   igual: mismos títulos, mismos párrafos, mismo diálogo. */

import { dialog } from "./dialog.js";

const CONTACT = "djl@djl.red";
const OWNER = "David";

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

  <h3>Responsabilidad</h3>
  <p>Realify se ofrece tal cual, sin garantía de disponibilidad continua
    ni de idoneidad para un uso concreto. El uso de sus filtros y ajustes
    es responsabilidad de quien los aplica.</p>

  <h3>Contacto</h3>
  <p>Para cualquier consulta relacionada con este aviso legal, escribe a
    <code>${CONTACT}</code>.</p>

</div>`;

const PRIVACY_BODY = `<div class="guide">

  <h3>Resumen</h3>
  <p class="lead">Realify no tiene servidores propios de procesamiento:
    todo ocurre en tu navegador. No se sube ninguna imagen, no hay
    analítica, no hacen falta cuentas de usuario y no se recoge ningún
    dato personal para que la aplicación funcione. Sólo si usas ciertas
    funciones opcionales de inteligencia artificial, tu navegador descarga
    un modelo de un servicio de terceros, como se explica más abajo.</p>

  <h3>Responsable</h3>
  <p>El responsable de este sitio es ${OWNER}, contacto
    <code>${CONTACT}</code>.</p>

  <h3>Qué se procesa</h3>
  <p>Nada sale de tu equipo. Las imágenes que abres, editas y exportas
    permanecen en la memoria y el almacenamiento de tu propio navegador en
    todo momento.</p>

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
  <p>Realify no recoge ni almacena ningún dato personal en servidores
    propios, así que no existen ficheros ni bases de datos sobre los que
    ejercer derechos de acceso, rectificación o supresión frente a
    Realify. Puedes borrar todo lo guardado vaciando los datos del sitio
    en tu navegador. Frente a Hugging Face puedes ejercer tus derechos
    según su propia política. También puedes reclamar ante la
    Agencia Española de Protección de Datos (<code>aepd.es</code>). Si
    tienes cualquier duda sobre privacidad, escribe a
    <code>${CONTACT}</code>.</p>

  <h3>Cambios</h3>
  <p>Esta política puede actualizarse si cambia el funcionamiento de la
    aplicación.</p>

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

  <h3>Contacto</h3>
  <p>Si tienes dudas sobre esta política, escribe a
    <code>${CONTACT}</code>.</p>

</div>`;

const open = (title, body, onOpen) => dialog({ title, wide: true, body, onOpen, buttons: [{ label: "Cerrar", primary: true }] });

export const openLegalNotice = () => open("Aviso legal", LEGAL_BODY);
export const openPrivacyPolicy = () => open("Política de privacidad", PRIVACY_BODY);
export const openCookiesPolicy = () => open("Política de cookies", COOKIES_BODY);
