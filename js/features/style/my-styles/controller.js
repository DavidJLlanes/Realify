/* ═══════════════════════════════════════════════════════════════
   MIS ESTILOS · FLUJO
   Panel → guardar / importar / exportar / borrar / aplicar (a una foto o a todas las pestañas abiertas, cada resultado en una capa nueva). Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { toNewLayer } from "../../ai-kit/new-layer.js";
import { aiSession } from "../../ai-kit/session.js";
import { toast } from "../../../core/toast.js";
import { lista, buscar, guardar, borrar, aArchivo, deArchivo } from "../shared/estilos.js";
import { elegirArchivo, imagenDe, medirReferencia } from "../shared/referencia.js";
import { colorearCon } from "../shared/aplicar.js";
import { panel } from "./ui.js";

async function aplicarATodas(e, v){
  const D = await import("../../../editor/documents.js"), { doc } = await import("../../../core/doc.js"), vuelta = D.activeTab()?.tabId;
  let n = 0;
  for(const t of D.listTabs()){
    if(!D.switchTo(t.tabId, { force: true }) || !doc.open) continue;
    const src = await visibleImage(); if(!src) continue;
    await toNewLayer(await colorearCon(src, e.stats, v), "Estilo · " + e.nombre); n++;
  }
  if(vuelta != null) D.switchTo(vuelta, { force: true });
  toast(`Estilo «${e.nombre}» aplicado a ${n} foto(s)`, "ok");
}

export async function ejecutar(){
  const r = await openSimple(panel(lista().map(e => [e.id, e.nombre]))); if(!r.ok) return;
  const v = r.values, e = buscar(v.estilo);
  try{
    if(v.accion === "guardar"){
      const f = await elegirArchivo(); if(!f) return;
      const stats = await aiSession("Midiendo la referencia", async () => medirReferencia(await imagenDe(f)), { unit: "paso" });
      toast(`Estilo «${guardar(v.nombre, stats).nombre}» guardado`, "ok");
    } else if(v.accion === "importar"){
      const f = await elegirArchivo(".json,application/json"); if(!f) return;
      toast(`Estilo «${deArchivo(await f.text()).nombre}» importado`, "ok");
    } else if(!e){ toast("No hay ningún estilo guardado: guarda primero una referencia", "err");
    } else if(v.accion === "exportar"){
      const a = aArchivo(e.id), { download } = await import("../../../io/export/export.js");
      download(new Blob([a.texto], { type: "application/json" }), a.nombre);
    } else if(v.accion === "borrar"){ borrar(e.id); toast(`Estilo «${e.nombre}» borrado`, "ok");
    } else if(v.accion === "todas"){ await aplicarATodas(e, v);
    } else {
      const src = await visibleImage(); if(!src) return;
      await toNewLayer(await aiSession("Aplicando el estilo", () => colorearCon(src, e.stats, v), { unit: "paso" }), "Estilo · " + e.nombre);
    }
  } catch(err){ if(!err.cancelled) toast("No se pudo completar: " + (err.message || err), "err"); }
}
