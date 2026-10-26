/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «instantaneas»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const instantaneasTopic = { id:"instantaneas", title:"Instantáneas",
    desc:"Copias completas del documento, con nombre, para volver de un solo paso.",
    html:`
      <h3>Instantáneas</h3>
      <p>El historial de deshacer (<kbd>Ctrl+Z</kbd>) es una cinta que se recorre paso a
        paso y que, para no comerse toda la memoria, va soltando las capturas más
        antiguas con el tiempo. Una instantánea es otra cosa: una copia COMPLETA del
        documento —todas las capas, con sus píxeles y máscaras—, con el nombre que le
        pongas («antes del retoque»), que no se suelta sola nunca —sólo si la borras a
        propósito—. Volver a ella es un único paso de deshacer, no cuarenta.</p>
      <ul>
        <li><b>Nueva instantánea…</b> (el icono junto a Deshacer/Rehacer, en el panel
          Historial, o menú Editar). Pide un nombre y guarda el estado actual.</li>
        <li><b>Volver a una instantánea.</b> Clic sobre su nombre, en el panel
          Historial. Las capas creadas después de tomarla desaparecen; las que había
          antes vuelven a como estaban entonces.</li>
        <li><b>Renombrar / Eliminar.</b> Doble clic sobre el nombre para renombrarla;
          la ✕ de su fila la borra. Borrar una instantánea no afecta al historial de
          deshacer normal.</li>
        <li><b>Origen del Pincel de historial.</b> El círculo a la izquierda de cada
          fila: clic para marcar esa instantánea como la que usa el pincel de arriba.</li>
      </ul>` };
