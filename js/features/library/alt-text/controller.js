/* ═══════════════════════════════════════════════════════════════
   TEXTO ALTERNATIVO · FLUJO
   Mando de longitud → foto visible reducida → registro de la IA (shared/indexar.js) → descripción con plantillas → informe y portapapeles.
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
    let copiado = false; try{ await navigator.clipboard.writeText(texto); copiado = true; }catch{}
    await openReport({ title: "Texto alternativo 👑", resumen: `${src.width}×${src.height}${copiado ? " · copiado al portapapeles" : ""}`, nombre: "texto-alternativo",
      items: [{ nivel: "info", titulo: "Descripción", texto }, { nivel: "info", titulo: "Revísalo", texto: "La IA describe tipo, objetos, color y luz; añade a mano quién sale o qué hace si importa." }], datos: { texto, largo: r.values.largo === "largo", tipo: reg.catEtiqueta } });
  } catch(err){ if(err && err.cancelled) return; toast("No se pudo describir la foto: " + (err.message || err), "err"); }
}
