/* ═══════════════════════════════════════════════════════════════
   CAMBIAR COLOR DE PRENDAS · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de ropa monta los mandos de `params` en el grupo «color».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export const panel = () => ({ editor: "clothing", group: "color", telas: false, title: "Cambiar color de prendas", params: PARAMS });
