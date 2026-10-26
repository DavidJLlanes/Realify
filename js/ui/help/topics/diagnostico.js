/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «diagnostico»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const diagnosticoTopic = { id:"diagnostico", title:"Diagnóstico",
    desc:"Comprueba WebGL2, shaders y las funciones del navegador que usa la app.",
    html:`
      <h3>Diagnóstico</h3>
      <p>Si algo se ve raro o no responde, esto comprueba una por una las piezas
        de las que depende la página: WebGL2, la precisión del buffer, la
        compilación de cada shader por separado, y las funciones del navegador
        que usan la exportación y el análisis. <b>Copiar diagnóstico</b> copia un informe
        (navegador, funciones disponibles y errores) para enviarlo si algo falla.</p>
      <p id="diag-update"><b>Actualizar la web o la app instalada.</b> Realify compara
        su versión abierta con la publicada al arrancar, volver a la app, recuperar
        conexión y cada dos minutos mientras está visible (una consulta de unos 50 bytes);
        además, el service worker nuevo avisa a las páginas abiertas al encontrarse y al
        activarse. Cuando hay una versión nueva, <b>el aviso Actualizar / Luego sale
        siempre</b> y, si se puede, la app <b>se actualiza sola</b>: guarda los documentos,
        recarga y los recupera (el historial de deshacer empieza de cero). Si guardar se atasca
        (más de 12 segundos) o falla, el aviso se queda para decidir. <b>Ayuda › Buscar
        actualización…</b> consulta en el momento y dice la versión de esta copia y la última
        publicada; el Diagnóstico incluye cuándo se comprobó, el error si lo hubo y un registro
        de lo ocurrido (comprobaciones, avisos y actualizaciones automáticas), para saber por qué
        no llegó un aviso. Sin conexión conserva la sesión.</p>
      <p id="diag-report"><b>Informar de un error.</b> <b>Ayuda › Informar de un error…</b> envía un aviso al
        equipo de Realify: escribes qué ha pasado y, si quieres, tu correo (sólo para responderte). El
        <b>diagnóstico</b> va marcado por defecto y puedes leer su texto exacto antes de enviar; la
        <b>copia reducida de la imagen</b> sólo se adjunta si la marcas, y nunca se manda el archivo original. No se
        envía nada sin pulsar «Enviar informe». También aparece «Enviar informe» en el panel de «Realify no ha podido
        arrancar», y el diagnóstico anota qué archivo no se pudo cargar y con qué código.</p>
      <p id="diag-compat"><b>Avisos automáticos.</b> Al arrancar, la app comprueba que el
        navegador le deja leer los píxeles del lienzo (Firefox con la protección estricta contra
        rastreo, LibreWolf o Mullvad los bloquean o los alteran, y entonces los filtros no hacen
        nada y lo exportado sale mal), que hay WebGL2 y que puede guardar datos. Si algo falla,
        una barra abajo explica qué pasa y cómo arreglarlo paso a paso. Y si la app no llega a
        arrancar (una extensión que bloquea scripts, un navegador muy antiguo), en unos segundos
        aparece un panel con el error y el botón «Copiar diagnóstico». Antes de eso, si el fallo
        viene de archivos viejos guardados en el navegador (una versión mezclada con otra tras una
        actualización), la app se repara sola una vez: borra su caché, vuelve a descargar su
        código y recarga («Actualizando Realify a la última versión…»).</p>` };
