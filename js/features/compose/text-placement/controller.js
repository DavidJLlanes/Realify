/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · FLUJO
   Foto → panel → análisis → motor → texto (con sombra suave) en una capa nueva transparente. Sin píxeles de la foto tocados.
   Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { toNewLayer } from "../../ai-kit/new-layer.js";
import { toast } from "../../../core/toast.js";
import { panel } from "./ui.js";
import { analizar } from "./analysis.js";
import { colocarTexto } from "./engine.js";

const FUENTE = "600 100px system-ui, -apple-system, 'Segoe UI', sans-serif";

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  const r = await openSimple(panel()); if(!r.ok) return;
  const v = r.values, texto = (v.texto || "").trim();
  if(!texto){ toast("Escribe el texto", "err"); return; }
  try{
    const A = await analizar(src), W = src.width, H = src.height, hPx = Math.max(8, Math.round(H * v.tam / 100));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.font = FUENTE;
    const prop = x.measureText(texto).width / 100;
    const z = colocarTexto({ ...A, prop, altoRel: hPx / H * 1.25, fotoW: W, fotoH: H });
    if(!z){ toast("No hay zona libre suficiente", "err"); return; }
    const claro = v.color === "auto" ? z.claro : v.color === "claro";
    const px = Math.min(hPx, (z.w * W) / prop);
    x.font = FUENTE.replace("100px", px + "px"); x.textBaseline = "middle"; x.globalAlpha = v.opacidad / 100;
    x.shadowColor = claro ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.45)"; x.shadowBlur = px * 0.12;
    x.fillStyle = claro ? "#fff" : "#111";
    x.fillText(texto, z.x * W + (z.w * W - x.measureText(texto).width) / 2, (z.y + z.h / 2) * H);
    await toNewLayer(c, "Texto");
  } catch(err){ toast("No se pudo colocar: " + (err.message || err), "err"); }
}
