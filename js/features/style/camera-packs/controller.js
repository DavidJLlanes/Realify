/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · FLUJO
   Panel con los estilos de plugins/cameras → render con su motor → capa de filtro reeditable («camaras»). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { activeLayer, doc } from "../../../core/doc.js";
import { toast } from "../../../core/toast.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { commitFilter } from "../../../editor/layers/filterlayer.js";
import { opciones } from "./packs.js";
import { panel } from "./ui.js";

export async function ejecutar(){
  const layer = activeLayer();
  if(!doc.open || !layer || !layer.canvas){ toast("Selecciona una capa de imagen", "err"); return; }
  const base = layer;
  const [{ PRESETS }, { normalize }, cam] = await Promise.all([import("../../../../plugins/cameras/presets.js"), import("../../../../plugins/cameras/state.js"), import("../../../../plugins/cameras/index.js")]);
  const r = await openSimple(panel({ estilo: opciones(PRESETS) })); if(!r.ok) return;
  const p = PRESETS.find(x => x.id === r.values.estilo); if(!p) return;
  try{
    const src = document.createElement("canvas"); src.width = base.canvas.width; src.height = base.canvas.height; src.getContext("2d", { willReadFrequently: true }).drawImage(base.canvas, 0, 0);
    const state = normalize({ preset: p.id, intensity: r.values.intensidad, values: p.values, date: cam.dateText(doc.source?.file?.lastModified), premium: true });
    const result = await cam.renderCamaras({ init: state, render: { src } });
    commitFilter({ base, result, title: `Cámaras · ${p.name}`, filter: "camaras", params: state });
    toast(`Cámaras · ${p.name}`, "ok");
  } catch(err){ toast("No se pudo aplicar: " + (err.message || err), "err"); }
}
