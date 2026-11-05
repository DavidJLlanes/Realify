/* ═══════════════════════════════════════════════════════════════
   MANOS Y DIENTES SOSPECHOSOS · FLUJO
   Foto → personas (puntos de cara, pose y manos) → motor de avisos → informe en diálogo. No toca la foto. Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { aiSession } from "../../ai-kit/session.js";
import { openReport } from "../../ai-kit/report-host.js";
import { analyze } from "../../../ai/people/analyze.js";
import { toast } from "../../../core/toast.js";
import { revisarMano, revisarDientes } from "../engine/avisos.js";

const sitio = (c, W, H) => { const x = (c.x + c.w / 2) / W, y = (c.y + c.h / 2) / H; return (y < 0.34 ? "arriba" : y > 0.66 ? "abajo" : "centro") + " " + (x < 0.34 ? "izquierda" : x > 0.66 ? "derecha" : "centro"); };

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  try{
    const res = await aiSession("Revisando manos y dientes", () => analyze(src, { quality: "mejor", kinds: ["landmarks", "poses", "manos"] }), { unit: "persona" });
    if(!res.personas.length){ toast("No se han encontrado personas", "err"); return; }
    const W = src.width, H = src.height, d = src.getContext ? src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data : null;
    let L = null; if(d){ L = new Float32Array(W * H); for(let i = 0; i < L.length; i++) L[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255; }
    const items = [];
    res.personas.forEach((p, k) => {
      const quien = `Persona ${k + 1} (${sitio(p.caja, W, H)})`;
      for(const m of p.manos || []) for(const a of revisarMano(m.puntos)) items.push({ nivel: "aviso", titulo: `${quien} · mano`, texto: a.texto });
      if(L && p.cara?.puntos) for(const a of revisarDientes(L, W, H, p.cara.puntos)) items.push({ nivel: "aviso", titulo: `${quien} · dientes`, texto: a.texto });
    });
    const manos = res.personas.reduce((n, p) => n + (p.manos || []).length, 0);
    if(!items.length) items.push({ nivel: "ok", titulo: "Sin avisos", texto: `No se ven indicios raros en ${manos} mano(s) ni en los dientes de ${res.personas.length} persona(s).` });
    await openReport({ title: "Manos y dientes sospechosos 👑", resumen: "Solo avisa: son indicios, no una prueba, y no se corrige nada. Una mano de perfil o tapada puede dar falsos avisos.", items });
  } catch(err){ if(!err.cancelled) toast("No se pudo revisar: " + (err.message || err), "err"); }
}
