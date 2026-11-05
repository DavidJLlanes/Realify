/* ═══════════════════════════════════════════════════════════════
   REFLEJOS EN GAFAS · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Reflejos gafas».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "gafas", title: "Reflejos en gafas", params: PARAMS });
