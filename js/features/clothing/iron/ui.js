/* ═══════════════════════════════════════════════════════════════
   PLANCHAR ARRUGAS DE ROPA · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de ropa monta los mandos de `params` en el grupo «planchar».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export const panel = () => ({ editor: "clothing", group: "planchar", telas: false, title: "Planchar arrugas de ropa", params: PARAMS });
