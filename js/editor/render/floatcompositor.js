/* ═══════════════════════════════════════════════════════════════
   COMPOSITOR DE LA VISTA PREVIA EN GPU DE COMA FLOTANTE (fase 13)

   El compositor normal (editor/render/compositor.js, layertree.js) apila las
   capas sobre un lienzo de 8 bits: cada capa de ajuste lee los píxeles,
   los calcula y los vuelve a escribir redondeados, y cada fusión
   también redondea. Con varios ajustes o modos de fusión apilados, esos
   redondeos se acumulan y salen bandas en cielos y degradados; y una
   capa con origen de 16 bits (RAW, PNG de 16 bits…) se veía con 8.

   Aquí se recompone el mismo árbol de capas en WebGL2 con texturas de
   coma flotante (RGBA32F si el equipo puede dibujar en ellas, RGBA16F si
   no): la opacidad, los 28 modos de fusión, las máscaras, el recorte, los
   grupos, «Fusionar si» y las capas de ajuste (evaluadas sobre la misma
   rejilla RGB de 86³ que usa la exportación en coma flotante, con la misma
   interpolación trilineal) se calculan sin redondear entre capas, con las
   mismas fórmulas de io/precision/precision-stack.js —que es la referencia en las
   pruebas—. Los píxeles sin tocar de una capa con origen de 16 bits salen
   de esos 16 bits (misma regla que core/hisrc.js, comprobada en la GPU).
   Sólo al final se pasa a 8 bits, con tramado determinista, para mostrarlo.

   Se usa SOLO cuando compensa y todo está soportado; si no, el compositor
   de siempre sigue exactamente igual:
     · hay capas de ajuste, origen de 16 bits, «Fusionar si» o modos de
       fusión «a mano» (los que en 8 bits obligan a leer píxeles en CPU);
     · documento sRGB o Display P3 (éste sólo si el navegador conserva el P3 al
       pasarlo por la GPU; se comprueba una vez), sin estilos de capa, sin trazo
       en curso y sin pasar de los límites de memoria;
     · todos los modos y ajustes están entre los que reproduce el motor de
       exportación.
   ═══════════════════════════════════════════════════════════════ */

import "../../core/doc.js";
import "../../core/colorspace.js";
import "../layers/layerstyles.js";
import "../layers/blendif.js";
import "../layers/adjust-types.js";
import "../../core/blend.js";
import "../../io/precision/precision-stack.js";
import "../layers/layertree.js";
import "../layers/layerstyles.js";
import "../../core/canvasrev.js";
import { init } from "./floatcompositor/float-compose.js";
export { floatTuning, floatPlan, floatCompose, _debugFloat, floatInfo, floatReset } from "./floatcompositor/float-compose.js";

export const floatAvailable = () => !!init();
