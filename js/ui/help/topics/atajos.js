/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «atajos»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const atajosTopic = { id:"atajos", title:"Atajos de teclado",
    desc:"Todo el teclado que no sea la letra de cada herramienta.",
    html:`
      <h3>Atajos</h3>
      <p>Las teclas de herramienta (Pincel, Mover, Recortar…) están en la letra que
        acompaña a cada una en su propio tema, no aquí: esto es todo lo demás.</p>
      <ul>
        <li><kbd>Espacio</kbd> (mantener) paneo temporal, con cualquier herramienta
          activa</li>
        <li><kbd>D</kbd> restablece frontal/fondo a blanco y negro · <kbd>X</kbd>
          los intercambia</li>
        <li><kbd>[</kbd> <kbd>]</kbd> tamaño de pincel · <kbd>Mayús</kbd>+<kbd>[</kbd>/<kbd>]</kbd>
          dureza —sólo con una herramienta que tenga esas opciones—</li>
        <li>Un dígito (<kbd>0</kbd>–<kbd>9</kbd>) pone la opacidad de la herramienta
          activa; dos seguidos componen el número (<kbd>2</kbd> luego <kbd>5</kbd> → 25 %)</li>
        <li>Con Mover activo, las flechas desplazan 1 px; <kbd>Alt</kbd>+flecha, 10 px</li>
        <li><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+Mayús+Z</kbd> o <kbd>Ctrl+Y</kbd> rehacer</li>
        <li><kbd>Ctrl+Mayús+D</kbd> Dodge &amp; Burn · <kbd>Ctrl+Mayús+H</kbd> Pincel de historial</li>
        <li><kbd>Ctrl+O</kbd> abrir · <kbd>Ctrl+N</kbd> documento nuevo</li>
        <li><kbd>Ctrl+S</kbd> guardar proyecto · <kbd>Ctrl+Alt+S</kbd> exportar ·
          <kbd>Ctrl+Mayús+S</kbd> exportar PNG rápido</li>
        <li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+X</kbd> / <kbd>Ctrl+V</kbd> copiar, cortar, pegar</li>
        <li><kbd>Ctrl+R</kbd> tamaño de imagen</li>
        <li><kbd>Ctrl+Mayús+N</kbd> nueva capa · <kbd>Ctrl+J</kbd> duplicar capa</li>
        <li><kbd>Ctrl+G</kbd> agrupar capas · <kbd>Ctrl+Mayús+G</kbd> desagrupar</li>
        <li><kbd>Ctrl+E</kbd> combinar hacia abajo · <kbd>Ctrl+Mayús+E</kbd> combinar visibles</li>
        <li><kbd>Ctrl+A</kbd> seleccionar todo · <kbd>Ctrl+D</kbd> deseleccionar ·
          <kbd>Ctrl+Mayús+I</kbd> invertir selección</li>
        <li><kbd>Ctrl+L</kbd> Niveles · <kbd>Ctrl+M</kbd> Curvas —de la máscara en vez
          de la imagen si su miniatura está seleccionada como destino—</li>
        <li><kbd>Ctrl+U</kbd> Tono y saturación · <kbd>Ctrl+I</kbd> Invertir ·
          <kbd>Ctrl+Mayús+U</kbd> Blanco y negro</li>
        <li><kbd>Ctrl+0</kbd> ajustar el zoom a la ventana · <kbd>Ctrl+1</kbd> zoom 100 %
          · <kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd> acercar/alejar</li>
        <li><kbd>Ctrl+Mayús+1</kbd> comparar antes/después al 100 % de golpe</li>
        <li><kbd>Tab</kbd> mostrar/ocultar los paneles</li>
        <li>En los editores a pantalla completa: <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Mayús+Z</kbd>
          deshacen y rehacen dentro del propio editor, <kbd>Esc</kbd> cancela, <kbd>Supr</kbd>
          borra el elemento elegido y las flechas lo mueven</li>
        <li>La rueda del ratón hace zoom aunque haya un diálogo abierto: el panel se
          puede arrastrar a un lado por su cabecera, y la rueda funciona sobre el
          lienzo que quede visible alrededor —nunca sobre la propia tarjeta, donde
          sigue haciendo scroll normal—.</li>
      </ul>` };
