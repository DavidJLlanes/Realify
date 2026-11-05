/* ═══════════════════════════════════════════════════════════════
   ESTILO DESDE UNA FOTO · INTERFAZ
   Sólo declara el panel (ai-kit/simple-host.js lo monta). Entradas: los mandos con sus opciones. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

/** `opciones` sustituye las opciones de los mandos de tipo lista que se conocen al abrir (clave → [[valor, texto]…]). */
export const panel = (opciones = {}) => ({ title: "Estilo desde una foto", subtitle: "Premium 👑", applyLabel: "Aplicar", params: PARAMS.map(p => opciones[p.key] ? { ...p, options: opciones[p.key], def: opciones[p.key][0][0] } : p) });
