/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE TEJIDO · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de ropa monta los mandos de `params` en el grupo «textura».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export const panel = () => ({ editor: "clothing", group: "textura", telas: false, title: "Textura de tejido", params: PARAMS });
