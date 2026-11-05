/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE PIEL · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Textura».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "textura", title: "Textura de piel", params: PARAMS });
