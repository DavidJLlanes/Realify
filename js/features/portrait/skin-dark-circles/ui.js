/* ═══════════════════════════════════════════════════════════════
   OJERAS Y BOLSAS · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Ojeras».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "ojeras", title: "Ojeras y bolsas", params: PARAMS });
