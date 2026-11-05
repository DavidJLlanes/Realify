/* ═══════════════════════════════════════════════════════════════
   ARRUGAS DE TELAS Y FONDOS · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de ropa monta los mandos de `params` en el grupo «planchar».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export const panel = () => ({ editor: "clothing", group: "planchar", telas: true, title: "Arrugas de telas y fondos", params: PARAMS });
