/* ═══════════════════════════════════════════════════════════════
   TEXTO ALTERNATIVO · FLUJO
   Mandos de longitud y motor → foto visible reducida → registro de la IA (shared/indexar.js) → descripción con plantillas → informe y portapapeles.
   No toca la foto. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { openReport } from "../../ai-kit/report-host.js";
import { toast } from "../../../core/toast.js";
import { indexarFoto } from "../shared/indexar.js";
import { textoAlternativo } from "./engine/descripcion.js";
import { PARAMS } from "./params.js";

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  const r = await openSimple({ title: "Texto alternativo 👑", params: PARAMS, applyLabel: "Describir" });
  if(!r.ok) return;
  try{
    const k = Math.min(1, 640 / Math.max(src.width, src.height)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height);
    const { reg } = await indexarFoto(c), texto = textoAlternativo(reg, { largo: r.values.largo === "largo" });
    /* Florence-2 (opcional): describe lo que ve en inglés; se enseña aparte y el texto copiado sigue siendo el español de las plantillas. */
    let ia = null; if(r.values.motor === "florence"){ try{ ia = await (await import("../../../ai/florence.js")).describirFoto(src, r.values.largo === "largo" ? "detallada" : "corta"); }catch(err){ if(err && err.cancelled) return; toast("Florence-2: " + (err.message || err), "err"); } }
    let copiado = false; try{ await navigator.clipboard.writeText(texto); copiado = true; }catch{}
    await openReport({ title: "Texto alternativo 👑", resumen: `${src.width}×${src.height}${copiado ? " · copiado al portapapeles" : ""}`, nombre: "texto-alternativo",
      items: [{ nivel: "info", titulo: "Descripción", texto }, ...(ia ? [{ nivel: "info", titulo: "Lo que ve la IA (Florence-2, en inglés)", texto: ia }] : []), { nivel: "info", titulo: "Revísalo", texto: "La IA describe tipo, objetos, color y luz; añade a mano quién sale o qué hace si importa." }], datos: { texto, ia, largo: r.values.largo === "largo", tipo: reg.catEtiqueta } });
  } catch(err){ if(err && err.cancelled) return; toast("No se pudo describir la foto: " + (err.message || err), "err"); }
}
