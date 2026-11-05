/* ═══════════════════════════════════════════════════════════════
   LABIOS Y CEJAS · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Labios y cejas».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "labios", title: "Labios y cejas", params: PARAMS });
