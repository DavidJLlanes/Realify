/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ZONA DEL PANEL
   Contenedor translúcido sobre la barra de pestañas donde cada pestaña dibuja su panel. Monta el de la pestaña elegida y desmonta
   el anterior; si la pestaña aún no tiene panel, queda oculto.
   Entradas: montarPanel(escenario, visor) (visor = { foto, gestos } de ui/viewport.js). Salidas: nada (escucha `pestana` y `foto` en app/store.js).
   Límites: sólo hospeda; el contenido de cada panel está en tabs/.
   ═══════════════════════════════════════════════════════════════ */
import { suscribir } from "../app/store.js";
import { PESTANAS } from "../tabs/index.js";
import { h } from "./dom.js";

export function montarPanel(escenario, visor) {
  const caja = h("section", { class: "barra panel", hidden: true });
  escenario.append(caja);
  let activo = null, id = null, cargando = 0;

  suscribir(async e => {
    const quiero = e.foto ? e.pestana : null;
    if (quiero === id) return;
    id = quiero; const turno = ++cargando;
    activo?.desmontar(); activo = null; caja.replaceChildren();
    const pestana = PESTANAS.find(p => p.id === quiero);
    caja.hidden = !pestana?.montar;
    if (!pestana?.montar) return;
    const montado = await pestana.montar(caja, visor);
    if (turno !== cargando) montado.desmontar(); else activo = montado;
  });
}
