/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «propiedades»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const propiedadesTopic = { id:"propiedades", title:"Panel de propiedades",
    desc:"El panel contextual bajo Capas: mandos en vivo, sin diálogos, sin abrir nada.",
    html:`
      <h3>Panel de propiedades</h3>
      <ul>
        <li><b>Contextual, siempre a la vista.</b> Debajo del panel de Capas: en vez de
          abrir un diálogo modal, muestra los mandos de lo que tengas seleccionado ahí
          mismo, en vivo. Cambia solo según la capa activa —o se apila con varias
          secciones a la vez si hace falta, por ejemplo Texto y Máscara juntas en la
          misma capa—.</li>
        <li><b>Capa de ajuste.</b> Sus mandos completos (Brillo/contraste, Niveles,
          Curvas…), exactamente igual que al reabrirla desde el panel de Capas, pero sin
          diálogo: cada arrastre se ve al instante en el lienzo.</li>
        <li><b>Capa de texto.</b> Fuente (incluida «Cargar fuente desde archivo…»),
          tamaño e interlineado. El contenido en sí se sigue editando con doble clic en
          el lienzo, como siempre; esto es para tocar su aspecto sin entrar a escribir.</li>
        <li><b>Capa con máscara.</b> Densidad (dosifica el efecto entero de la máscara) y
          Desvanecer (difumina sus bordes), más «Seleccionar sujeto» y «Seleccionar
          cielo» —la misma detección del menú Inteligencia Artificial—, útiles
          para repetir el intento sobre la máscara ya puesta si el primero no convenció.</li>
        <li><b>Capa fx (filtro reeditable).</b> Los parámetros del filtro, inline, con la
          misma vista previa en baja resolución mientras se arrastra y a resolución
          completa al soltar que ya tenía su diálogo. Un puñado de filtros sin mandos que
          editar —Invertir, Niveles automáticos, Contraste automático— o con un esqueleto
          propio —Tabla de color, Looks, Unmark— todavía sólo se editan en su propio
          diálogo; ahí el panel ofrece un botón para abrirlo en vez de intentar
          montarlo.</li>
        <li><b>Un solo paso de historial por sesión.</b> Mientras la capa siga
          seleccionada, tocar sus mandos no llena el historial de pasos sueltos: se
          confirma como uno solo al pasar a otra capa, el mismo criterio que ya usaban
          los diálogos con su botón Aplicar.</li>
      </ul>` };
