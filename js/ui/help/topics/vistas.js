/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «vistas»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const vistasTopic = { id:"vistas", title:"Ver y análisis visual",
    desc:"Histograma interactivo, cuadrícula inteligente, reglas, guías, comparar, paleta, cuentagotas.",
    html:`
      <h3>Ver y análisis visual</h3>
      <ul>
        <li id="view-histogram"><b>Histograma</b> (Ver o Análisis › Histograma interactivo; panel
          lateral). El histograma RGB de la composición, al día con cada cambio y dividido
          en cinco zonas: Negros, Sombras, Medios, Luces y Blancos. Al pasar por encima
          dice cuánta imagen cae en cada zona y cuánto hay de negro y blanco puro; al
          <b>tocar una zona</b> se abre «Tonos del histograma» con esa franja elegida para
          ajustar sólo esos tonos.</li>
        <li id="view-smartgrid"><b>Cuadrícula inteligente…</b> Guías de composición calculadas a
          partir del contenido:
          <ul>
            <li><b>Sujeto principal</b> (la zona que más destaca, o la cara si la hay), con su
              caja y una flecha al punto fuerte de los tercios más cercano.</li>
            <li><b>Horizonte</b> detectado, cuánto está inclinado y «Enderezar horizonte»,
              que gira la foto lo justo y la amplía para no dejar esquinas vacías.</li>
            <li><b>Rostros</b> y la línea de los ojos (que conviene en el tercio superior).
              Si el navegador no trae detección de caras, se estiman por el tono de piel y
              se marcan como «estimado».</li>
            <li>Guías clásicas: tercios, proporción áurea, <b>espiral áurea orientada hacia
              el sujeto</b>, diagonales y triángulos áureos, centro y simetría.</li>
          </ul>
          El diálogo resume el análisis en palabras y ofrece «Recortar para encuadrar», que
          abre Recortar con el marco ya puesto donde lleva el sujeto a su punto fuerte.
          «Mostrar u ocultar la cuadrícula inteligente» la enciende y apaga sin diálogo.</li>
        <li><b>Reglas, guías y cuadrícula.</b> Arrastra desde una regla para sacar una guía;
          la cuadrícula se configura en tamaño y subdivisiones, y «Ajustar a la cuadrícula»
          hace que lo que mueves se enganche a ella.</li>
        <li><b>Comparar antes/después</b> (también al 100 %) y <b>Mostrar u ocultar
          paneles</b> (<kbd>Tab</kbd>).</li>
        <li id="an-palette"><b>Paleta de colores…</b> (menú Análisis). Los colores dominantes de la
          imagen: tocar uno copia su código y lo pone como color frontal. La paleta se puede
          crear como capa, descargar o copiar.</li>
        <li id="an-eyedropper"><b>Cuentagotas de pantalla</b> (menú Análisis). Coge un color de
          cualquier parte de la pantalla, también fuera de la imagen. Sólo en Chrome y Edge de
          escritorio, que son los navegadores que lo permiten.</li>
      </ul>` };
