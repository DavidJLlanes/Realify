/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «otras»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const otrasTopic = { id:"otras", title:"Otras herramientas",
    desc:"Bote de pintura, degradado, formas, texto, cuentagotas, mano, zoom, comparar.",
    html:`
      <h3>Otras herramientas</h3>
      <ul>
        <li id="tool-fill"><b>Bote de pintura (G).</b> Rellena la zona de color parecido bajo el
          cursor, con la misma tolerancia y el mismo «Contiguo» que la Varita mágica.</li>
        <li id="tool-gradient"><b>Degradado (N).</b> Lineal, radial o a transparente, arrastrando de un
          punto a otro con los dos colores del panel.</li>
        <li id="tool-shape"><b>Formas (U).</b> Rectángulo y elipse crean una <b>capa de
          forma</b> —vectorial, editable después, con relleno y borde independientes—;
          mantén <kbd>Mayús</kbd> mientras arrastras para una forma regular (cuadrado,
          círculo). Con esa capa activa y la herramienta todavía en Formas, arrastrar
          dentro de ella la mueve, una de sus ocho asas la redimensiona, y un noveno
          tirador azul en el borde superior ajusta el <b>radio de esquina</b> —también
          disponible, con relleno, borde y grosor, en el panel de Propiedades—. Línea es
          la excepción: sigue pintando píxeles fijos en la capa activa, como el resto de
          la barra, porque una línea no encaja en «relleno + borde de un contorno
          cerrado». «Rasterizar capa» (menú Capa) convierte cualquier forma en píxeles
          normales cuando ya no haga falta seguir editándola —o cuando de verdad haga
          falta pintar encima a mano—.</li>
        <li id="tool-text"><b>Texto (T).</b> Coloca una capa de texto editable; «Rasterizar texto»
          (menú Capa) la convierte en píxeles normales cuando ya no hace falta
          seguir editándola. Al cambiar la alineación, el bloque se queda en su sitio y
          sólo se realinean las líneas entre sí. Además de las fuentes del sistema, la
          lista trae más de setenta <b>tipografías libres</b> y, en «Más fuentes (buscar
          entre 1900)…», todo el catálogo de Google Fonts, con vista previa de cada una.
          Se sirven desde el propio Realify, sin conectarse con Google, y cada fuente se
          descarga sólo cuando se usa. Además del cuerpo, la fuente, el color, la sombra, el
          contorno, el círculo y el fondo de siempre, la barra de opciones trae:
          <ul>
            <li><b>Justificado</b>, cuarta opción junto a Izquierda/Centrado/Derecha
              —sólo con «Marco» puesto—: todas las líneas menos la última se
              estiran hasta llenar el ancho del marco repartiendo el espacio extra
              entre las palabras, como en cualquier maquetador.</li>
            <li><b>Sangrías</b> de primera línea, izquierda y derecha, también sólo
              con marco: la de primera línea puede ser negativa (sangría francesa).</li>
            <li><b>Kerning manual.</b> Con el cursor de edición puesto entre dos
              letras concretas (sin nada seleccionado) aparece un campo «Kerning»
              que añade o quita espacio justo en ese hueco; se guarda por posición,
              así que sobrevive a que el párrafo se reajuste de línea.</li>
            <li><b>Lig / Vers.</b> Ligaduras OpenType (fi, fl…) encendidas por
              defecto —apagarlas fuerza el dibujo letra a letra, sin combinar
              nada—, y versalitas reales del navegador, no mayúsculas encogidas
              a mano.</li>
            <li><b>Deformar: Arco, Bandera, Pez.</b> Dobla el bloque de texto entero
              —todas sus líneas a la vez, como una sola curva continua— según la
              fuerza elegida, positiva o negativa. Es una aproximación honesta al
              «Deformar texto» de los editores de referencia, no un calco
              pixel a pixel de su malla.</li>
            <li><b>Trazado.</b> Con este interruptor encendido, arrastrar sobre un
              hueco del lienzo traza una curva (una Bézier cuadrática: inicio,
              control, fin) y crea un texto que corre sobre ella, centrado si es
              corto o desbordando el final si es largo. Con esa capa activa y la
              herramienta Texto puesta, sus tres asas —naranjas los extremos, azul
              el punto de control— se pueden volver a arrastrar en cualquier
              momento para redibujar la curva; «Quitar trazado» la suelta y
              vuelve a dejar el texto en su ancla normal. Un texto en trazado se
              mueve arrastrando sus propias asas, no con la herramienta Mover.</li>
            <li><b>Estilos de carácter y de párrafo.</b> Un «sello» con nombre que
              guarda de un lado fuente/cuerpo/color/trazado/ligaduras/versalitas y
              del otro alineación/interlineado/sangrías (guardados aparte a
              propósito, para poder mezclar un estilo de carácter con cualquier
              estilo de párrafo); el botón «Guardar» junto a cada desplegable
              guarda los valores de la capa activa con el nombre que se pida, y
              elegir un estilo ya guardado en el desplegable lo aplica al momento
              sobre la capa activa. No son un enlace en vivo: aplicar uno copia sus
              valores una vez, editables después sin desligar nada.</li>
          </ul></li>
        <li id="tool-picker"><b>Cuentagotas (I).</b> Toma el color exacto de cualquier píxel visible y lo
          deja listo como color activo.</li>
        <li id="tool-pan"><b>Mano (H) / Zoom (Z).</b> Paneo y acercamiento; doble clic en Mano ajusta
          a la ventana, doble clic en Zoom vuelve al 100 %.</li>
        <li id="tool-compare"><b>Comparar (Y).</b> Arrastra la línea para ver el original a la izquierda y
          tu edición a la derecha, en el mismo lienzo.</li>
      </ul>` };
