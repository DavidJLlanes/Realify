/* ═══════════════════════════════════════════════════════════════
   LUZ EN LA CARA · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Luz».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "luz", title: "Luz en la cara", params: PARAMS });
