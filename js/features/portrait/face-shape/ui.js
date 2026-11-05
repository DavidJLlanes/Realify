/* ═══════════════════════════════════════════════════════════════
   FORMA DE LA CARA · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Forma».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "forma", title: "Forma de la cara", params: PARAMS });
