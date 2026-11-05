/* ═══════════════════════════════════════════════════════════════
   BRILLOS DE LA PIEL · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Brillos».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "brillos", title: "Brillos de la piel", params: PARAMS });
