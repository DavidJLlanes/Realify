/* ═══════════════════════════════════════════════════════════════
   APP · COMANDOS DE IA DESDE LOS MANIFIESTOS
   Registra un comando por cada manifiesto de js/ui/menu/ia/manifests.js: nadie escribe estas líneas a mano.
   Entradas: MANIFESTS. Salida: los comandos quedan registrados (necesitan un documento abierto). El motor de cada función
   sólo se carga al ejecutarla (manifest.load).
   ═══════════════════════════════════════════════════════════════ */
import { registerAll } from "../../../core/commands.js";
import { needsDoc } from "../helpers.js";
import { MANIFESTS } from "../../../ui/menu/ia/manifests.js";

/** La función que abre la herramienta: `open` o la primera exportación `openXxx` de index.js. */
const abrirDe = mod => mod.open || Object.entries(mod).find(([k, v]) => /^open[A-Z]/.test(k) && typeof v === "function")?.[1];

registerAll(Object.fromEntries(MANIFESTS.map(m => [m.cmd, {
  run: async () => {
    const abrir = abrirDe(await m.load());
    if(!abrir) throw new Error(`El manifiesto de ${m.cmd} no exporta una función open…`);
    return abrir();
  },
  enabled: needsDoc
}])));
