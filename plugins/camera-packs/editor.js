/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · EDITOR A PANTALLA COMPLETA
   Capa activa → editor del kit (zoom, comparar, deshacer; un mando cada vez en móvil) con la lista de cámaras de plugins/cameras agrupadas en
   packs y la intensidad → vista previa en vivo (foto a ≤ 1000 px con el motor de las cámaras) → al aplicar se renderiza a tamaño completo y
   queda como capa de filtro reeditable («camaras»). Aquí no hay píxeles: los calcula plugins/cameras. Entradas: ninguna.
   Salida: promesa que se resuelve al cerrar.
   ═══════════════════════════════════════════════════════════════ */
import { activeLayer, doc } from "../../js/core/doc.js";
import { toast } from "../../js/core/toast.js";
import { createAiEditor } from "../../js/ui/kit/ai-editor/index.js";
import { commitFilter } from "../../js/editor/layers/filterlayer.js";
import { opciones } from "../../js/features/style/camera-packs/packs.js";
import { PARAMS } from "../../js/features/style/camera-packs/params.js";
import { GRUPOS } from "../../js/features/style/camera-packs/ui.js";

const LADO_VISTA = 1000;
const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

export async function abrirEditorPacks(){
  const base = activeLayer();
  if(!doc.open || !base || !base.canvas){ toast("Selecciona una capa de imagen", "err"); return; }
  const [{ PRESETS }, { normalize }, cam] = await Promise.all([import("../cameras/presets.js"), import("../cameras/state.js"), import("../cameras/index.js")]);
  const origen = lienzo(base.canvas.width, base.canvas.height); origen.getContext("2d", { willReadFrequently: true }).drawImage(base.canvas, 0, 0);
  const k = Math.min(1, LADO_VISTA / Math.max(origen.width, origen.height)), pequena = lienzo(Math.max(1, Math.round(origen.width * k)), Math.max(1, Math.round(origen.height * k)));
  const px = pequena.getContext("2d"); px.imageSmoothingQuality = "high"; px.drawImage(origen, 0, 0, pequena.width, pequena.height);

  const lista = opciones(PRESETS), params = PARAMS.map(p => p.key === "estilo" ? { ...p, options: lista, def: lista[0]?.[0] || "" } : p);
  const estado = v => { const p = PRESETS.find(x => x.id === v.estilo); return p && normalize({ preset: p.id, intensity: v.intensidad, values: p.values, date: cam.dateText(doc.source?.file?.lastModified), premium: true }); };
  let version = 0, timer = 0, ed = null, enCurso = Promise.resolve();

  async function vista(){
    const mia = ++version, st = estado(ed.values());
    if(!st){ ed.setImage(pequena, true); return; }
    ed.sh.setBusy("Aplicando la cámara…");
    try{
      const r = await cam.renderCamaras({ init: st, render: { src: pequena } });
      if(mia === version) ed.setImage(r, true);
    } catch(err){ if(mia === version) toast("No se pudo mostrar la vista previa: " + (err.message || err), "err"); }
    if(mia === version) ed.sh.setBusy("");
  }
  const programar = () => { clearTimeout(timer); timer = setTimeout(() => { enCurso = enCurso.then(vista); }, 150); };

  ed = await createAiEditor({
    title: "Packs de cámara", subtitle: "Elige una cámara", groups: GRUPOS, params,
    onChange: programar,
    onApply: async e => {
      clearTimeout(timer); await enCurso;
      const st = estado(e.values()), p = PRESETS.find(x => x.id === e.values().estilo);
      if(!st || !p){ toast("Elige una cámara", "err"); return; }
      e.sh.setBusy("Aplicando a tamaño completo…");
      try{
        const result = await cam.renderCamaras({ init: st, render: { src: origen } });
        e.close();
        commitFilter({ base, result, title: `Cámaras · ${p.name}`, filter: "camaras", params: st });
        toast(`Cámaras · ${p.name}`, "ok");
      } catch(err){ e.sh.setBusy(""); toast("No se pudo aplicar: " + (err.message || err), "err"); }
    }
  });
  if(globalThis.__realifyTest) globalThis.__realifyTest.packs = { ed };
  ed.setImage(pequena, false); ed.setOriginal(pequena);
  programar();
}
